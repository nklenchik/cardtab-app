/* Card art for entries that came in without it (spreadsheet imports, older entries).
   In the background, each unique card is looked up once in the card database, the same search Add New uses.
   v42.4 rules: art is added only when the match is clear. The card's name must match, its number must match
   (when the entry has one), the set must match exactly when the entry names one, and "Japanese" in the entry points
   to Japanese printings. Anything unclear is left alone (cranberry placeholder) and tried again in a few days.
   Picks you make with "Change card" (or "No card art") are remembered for every entry with the same text and are
   never overridden. Art filled in by the old, looser rules is re-checked once; lookups are cached on our server,
   so the re-check doesn't use up card data lookups. Paced, picks up where it left off, runs only when signed in. */
(function () {
  'use strict';
  const S = window.CTStore, Sess = window.CTSession, L = window.CardLookup, P = window.CardParser;
  if (!S || !Sess || !L || !P) return;
  const GAP = 3500, RETRY_DAYS = 4, BUSY_WAIT = 60000, LATER = 3 * 3600e3;
  let heldUntil = 0, force = false, report = [];
  let on = false, running = false, timer = 0, prog = { done: 0, total: 0, found: 0 }, listeners = new Set();
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const words = s => norm(s).split(' ').filter(w => w.length > 2 && !/^(the|and|for|holo|rare|card|pokemon|japanese|japan|promo|ex|gx|v)$/.test(w));
  const numKey = s => norm(s).split(' ').map(x => x.replace(/^0+(?=\d)/, '')).join(' ');
  const textKey = e => norm(e.source || e.name);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const emit = () => listeners.forEach(f => { try { f(Object.assign({ running }, prog)); } catch (e) {} });

  function parsedOf(e) {
    // Card Tab's own list format, "Name - number - set" (also what imports are saved as)
    const m = /^(.+?)\s+-\s+#?([A-Za-z]{0,6}\d[\w\/-]*)\s+-\s+(.+)$/.exec(String(e.name || '').trim());
    if (m) return { name: m[1].trim(), number: m[2], set: m[3].trim(), game: '' };
    let q = e.parsed && (e.parsed.name || e.parsed.number) ? Object.assign({}, e.parsed) : (() => { const p = P.parse(e.source || e.name || ''); return { name: p.name || e.name, number: p.number || '', set: p.set || '', game: p.game || '' }; })();
    // "Jolteon - 169 SV: Scarlet & Violet Promo Cards, Pokemon, 169": the number sits at the front of the set
    if (!q.number) { const inName = /\b([A-Za-z]{2,6}\d{2,4}[A-Za-z]?|\d{1,3}\/\d{1,3})\b/.exec(q.name || ''); if (inName && !/^(ss\d|ssb|ssg|ex\d+|bt\d+|db\d+)$/i.test(inName[1]) && /\d{2,}/.test(inName[1])) { q.number = inName[1]; q.name = q.name.replace(inName[0], ' ').replace(/\s+/g, ' ').trim(); } }
    const lead = /^#?(\d{1,4})\s+(.+)$/.exec(q.set || ''); if (lead && !q.number) { q.number = lead[1]; q.set = lead[2].replace(/,\s*pokemon\b.*$/i, '').trim(); }
    return q;
  }
  const isPick = e => e.artFrom === 'pick' || e.artFrom === 'none';
  function needs(e) {
    if (e.deleted || !e.name || isPick(e)) return false;
    if (e.artFrom === 'lookup' && !e.artV2) return true;                 // filled in by the old rules: re-check once
    if (!e.artV4 && !e.art) return true;                                  // v42.14: missing art gets one more try with the improved rules
    if (!e.artV4 && e.artFrom === 'lookup') { const p = parsedOf(e); if (p.set && !p.number && !/,|\/\//.test(p.name)) return true; }   // and plain names with a set (where wrong art came from) get one re-check
    // v42.18: art picked from a different set than the one the entry names ("Gogeta... - Collector's Selection Vol. 3" got Vicious Rejuvenation) gets one re-check
    if (!e.artV5 && e.artFrom === 'lookup') { const es = sigWords(parsedOf(e).set), cs = new Set(sigWords(e.cardName || '')); if (es.length && !es.some(w => cs.has(w))) return true; }
    if (e.art && (e.art.list || e.art.detail)) return false;
    if (!force && e.artTry && Date.now() - Date.parse(e.artTry) < RETRY_DAYS * 864e5) return false;
    return true;
  }
  // your own picks, by entry text (from every entry you've changed)
  function picks() { const m = new Map(); S.all().forEach(e => { if (isPick(e)) m.set(textKey(e), { art: e.art || null, artFrom: e.artFrom, cardId: e.cardId || null, cardName: e.cardName || null }); }); return m; }

  // a clear match (v42.14, tuned on real collections):
  //  - the card's name lines up with the entry both ways, or, when the card number matches exactly, the card's whole name
  //    appears in the entry (so "Neo Discovery - 31/75 - Tyranitar" and "History of Vegeta: Protector of the People" work).
  //    Card database names are cleaned first: "(SPR)", "(31)" and " - 081/080" come off, and two-sided leaders
  //    ("Goku Black // SS Rose Goku Black, ...") match on either side.
  //  - Japanese entries get Japanese printings. Other entries prefer English ones, but a Japanese-only set still matches.
  //  - a plain name (Umbreon) whose set clearly disagrees with the entry's set is not used.
  //  - then the printing: the set named in the entry, then words like SPR, SLR, Silver Foil in the entry, then the
  //    everyday printing when the rest are versions of the same card.
  const GAMEW = /^(dragon|ball|super|pokemon|card|cards|game|ccg|tcg|bandai|english|the|and|of|edition|ed|set|series)$/;
  const sigWords = s => words(s).filter(w => !GAMEW.test(w));
  const clean = n => String(n || '').replace(/\([^)]*\)/g, ' ').replace(/\s+-\s+#?[A-Za-z]{0,6}\d[\w\/-]*\s*$/, ' ').replace(/\s+/g, ' ').trim();
  const sides = n => { const c = clean(n), parts = c.split('//').map(x => x.trim()).filter(Boolean); return parts.length > 1 ? [c.replace('//', ' '), ...parts] : [c]; };
  const baseName = n => { const s = sides(n); return norm(s[s.length - 1]); };
  const HINTS = [[/\bspr\b|special rare/i, /\(spr\)|special rare/i], [/\bslr\b|special leader/i, /\(slr\)|special leader/i], [/\bscr\b|secret rare/i, /\(scr\)|secret/i],
    [/silver foil/i, /silver foil/i], [/gold[- ]?stamp/i, /gold[- ]?stamp|pre-?release/i], [/alt(ernate)?\.? art/i, /alt(ernate)? art/i], [/\b1st\b/i, /1st/i], [/\bshadowless\b/i, /shadowless/i]];
  function clearMatch(cards, p, e) {
    const text = (e.source || e.name || '') + ' ' + (p.set || ''), tn = norm(text), jp = /japan/i.test(text);
    const ew = new Set(words(p.name + ' ' + (e.name || ''))), pw = sigWords(p.name).length ? sigWords(p.name) : words(p.name);
    const has = (set, w) => set.has(w) || [...set].some(x => x.startsWith(w) || w.startsWith(x));
    const realNum = c => !!c.num && !/^n\/?a$/i.test(String(c.num).trim());
    const numExact = c => !!p.number && numKey(c.num) === numKey(p.number);
    let ok = cards.filter(c => {
      // sealed products have no number; then a "number" like SWSH07 is really the set code
      if (p.number) { if (realNum(c)) { const a = numKey(c.num).split(' ')[0], b = numKey(p.number).split(' ')[0]; if (!a || a !== b) return false; } else if (!norm(c.s).includes(norm(p.number))) return false; }
      return sides(c.n).some(v => {
        const cw = words(v); if (!cw.length) return false;
        if (numExact(c) && (cw.every(w => has(ew, w)) || (pw.length && pw.every(w => has(new Set(cw), w))))) return true;   // number matches exactly and one name holds the other                 // number matches exactly and the card's whole name is in the entry
        if (cw.every(w => has(ew, w)) && (/,|\/\//.test(v) || cw.length >= 3)) return true;   // a distinctive name, whole, in the entry ("Son Goku, Nimbus Master, Collector's Selection Vol. 2")
        if (cw.filter(w => has(ew, w)).length / cw.length < 0.75) return false;      // the card's name is in the entry
        const cs = new Set(cw); return !pw.length || pw.filter(w => has(cs, w)).length / pw.length >= 0.75;   // and the entry's card name is the card's
      });
    });
    // language: Japanese entries only Japanese printings; others prefer English when there's a choice
    const isJ = c => /japan/i.test((c.g || '') + ' ' + (c.s || ''));
    if (jp) ok = ok.filter(isJ); else if (ok.some(c => !isJ(c))) ok = ok.filter(c => !isJ(c));
    // a plain name (no subtitle, no number given) whose set clearly disagrees with the entry's set isn't the entry's card
    const es = sigWords(p.set);
    if (es.length && !p.number) ok = ok.filter(c => /,|\/\//.test(c.n) || sigWords(c.s + ' ' + c.n).some(w => es.some(x => x === w || x.startsWith(w) || w.startsWith(x))));
    if (ok.length <= 1) return ok[0] || null;
    // the set: as named, then a set (or a version in brackets) that appears in the entry, then the entry's set inside the card's
    const narrow = (list, f) => { const x = list.filter(f); return x.length ? x : list; };
    if (p.set) ok = narrow(ok, c => norm(c.s) === norm(p.set));
    if (ok.length > 1) ok = narrow(ok, c => { const s = norm(c.s), v = (String(c.n).match(/\(([^)]*)\)/g) || []).map(x => norm(x)).filter(x => x.length > 3); return (s.length > 3 && tn.includes(s)) || v.some(x => tn.includes(x)); });
    // ...or the set that shares the most words with the entry ("History of Son Goku" -> Theme Selection: History of Son Goku)
    if (ok.length > 1) { const tw = new Set(words(text)), sc = c => sigWords(c.s).filter(w => tw.has(w)).length, best = Math.max(...ok.map(sc)); if (best > 0 && ok.filter(c => sc(c) === best).length < ok.length) ok = ok.filter(c => sc(c) === best); }
    if (ok.length > 1 && p.set) ok = narrow(ok, c => norm(c.s).includes(norm(p.set)));
    // the card it already shows is still one of the right ones (after the set is taken into account): keep it
    if (e.cardId) { const was = ok.find(c => c.id === e.cardId); if (was) return was; }
    // words in the entry like SPR, SLR, Silver Foil, 1st
    for (const [inEntry, inCard] of HINTS) if (ok.length > 1 && inEntry.test(text)) ok = narrow(ok, c => inCard.test(c.n + ' ' + c.r));
    // the card whose name holds every word of the entry's card name (Sleeved Booster Pack, not Booster Pack)
    if (ok.length > 1 && pw.length) ok = narrow(ok, c => sides(c.n).some(v => { const cs = new Set(words(v)); return pw.every(w => has(cs, w)); }));
    if (ok.length === 1) return ok[0];
    // versions of the very same card (reprints, alternate arts, pre-release stamps): the everyday printing
    // (only when they share a card number, or the name is distinctive: two Charizards from different sets are different cards)
    if (new Set(ok.map(c => baseName(c.n))).size === 1 && (new Set(ok.map(c => numKey(c.num))).size === 1 || ok.every(c => /,|\/\//.test(c.n) || words(clean(c.n)).length >= 3))) return standard(ok);
    return null;                                                          // different cards with similar names: don't guess
  }

  // the everyday printing first: not an alternate art, special or secret rare, promo, or premium box version
  const FANCY = /alt(ernate)?\s*art|special|secret|\b(spr|scr|sr|gdr|ser)\b|serial|gold|god rare|promo|foil|premium|collector|anniversary|championship|judge|prize|stamp|reprint/i;
  function standard(list) { const plain = list.filter(c => !FANCY.test((c.r || '') + ' ' + (c.s || '') + ' ' + (c.n || ''))); return (plain.length ? plain : list)[0]; }
  async function lookup(p) {
    const base = window.CARDTAB_API;
    const q = '?name=' + encodeURIComponent(p.name || '') + '&number=' + encodeURIComponent(p.number || '') + '&set=' + encodeURIComponent(p.set || '') + '&game=' + encodeURIComponent(p.game || '');
    const r = await fetch(base + '/api/lookup' + q + '&src=fill' + (force ? '&force=1' : ''), { credentials: 'include' });
    if (r.status === 429) { let j = {}; try { j = await r.json(); } catch (e) {} const err = new Error('busy'); if (j.later) err.later = true; else err.busy = true; throw err; }
    if (!r.ok) throw new Error('lookup ' + r.status);
    const j = await r.json();
    return (j.cards || []).map(c => ({ id: c.id, n: c.n, s: c.s, num: c.num, r: c.r, g: c.g, h: 210, art: { list: base + c.art.list, detail: base + c.art.detail } }));
  }

  // every entry with the same text as one you changed gets the same card, no lookup needed
  async function applyPicks() {
    const pk = picks(); if (!pk.size) return;
    for (const e of S.all()) { if (e.deleted || isPick(e)) continue; const m = pk.get(textKey(e)); if (m && (e.cardId !== m.cardId || e.artFrom !== m.artFrom)) await S._artPatch(e.id, Object.assign({ artV2: 1 }, m)); }
  }
  let again = false;
  async function run() {
    if (running) { again = true; return; }
    if (!on || !window.CARDTAB_API) return;
    if (heldUntil > Date.now() && !force) { await applyPicks(); return; }
    running = true;
    try {
      // 1) your picks first: every entry with the same text as one you changed gets the same card, no lookup needed
      await applyPicks();
      const left = S.all().filter(needs);
      if (!left.length) return;
      // 2) one lookup per unique card
      const groups = new Map();
      left.forEach(e => { const p = parsedOf(e), k = [norm(p.name), numKey(p.number), norm(p.set), /japan/i.test(e.source || e.name) ? 'jp' : ''].join('|'); if (!groups.has(k)) groups.set(k, { p, ids: [], e }); groups.get(k).ids.push(e.id); });
      prog = { done: 0, total: groups.size, found: 0 }; emit(); if (force) report = [];
      let held = false;
      for (const g of groups.values()) {
        if (!on) break;
        let cards = null;
        for (let tries = 0; tries < 3; tries++) {
          try { cards = await lookup(g.p); break; }
          catch (err) { if (err.later) { held = true; break; } if (err.busy) { prog.waiting = true; emit(); await sleep(force ? 20000 : BUSY_WAIT); prog.waiting = false; emit(); continue; } cards = null; break; }
        }
        // nothing found for a long name with extra parts ("Son Goku, Nimbus Master, Collector's Selection Vol. 2"): try just the card's name
        if (cards && !cards.length && !held && (g.p.name.match(/,/g) || []).length >= 2) { const short = Object.assign({}, g.p, { name: g.p.name.split(',').slice(0, 2).join(',').trim() }); try { cards = await lookup(short); } catch (err) { if (err.later) held = true; } }
        if (cards && cards.length && !held && g.p.set && !clearMatch(cards, g.p, g.e)) { const es = sigWords(g.p.set); if (es.length && !cards.some(c => sigWords(c.s).some(w => es.includes(w)))) { try { const more = await lookup(Object.assign({}, g.p, { name: g.p.name + ' ' + es.join(' '), set: '' })); if (more && more.length) cards = more.concat(cards); } catch (err) { if (err.later) held = true; } } }
        if (held) { heldUntil = Date.now() + LATER; if (force) report.push({ entry: '(stopped)', looked: '', n: 0, result: 'monthly limit reached', got: [] }); break; }   // today's share is used up: stop quietly and pick up where we left off in a few hours
        const card = cards ? clearMatch(cards, g.p, g.e) : null, now = new Date().toISOString();
        for (const id of g.ids) {
          const cur = S.get(id); if (!cur || !needs(cur) || picks().has(textKey(cur))) continue;
          if (card) await S._artPatch(id, { art: { list: card.art.list, detail: card.art.detail }, artFrom: 'lookup', cardId: card.id, cardName: [card.n, card.num, card.s].filter(Boolean).join(' - '), artV2: 1, artV3: 1, artV4: 1, artV5: 1 });
          else if (cards) await S._artPatch(id, { art: null, artFrom: null, cardId: null, artTry: now, artV2: 1, artV3: 1, artV4: 1, artV5: 1 });   // unclear: placeholder, try again in a few days
        }
        if (force) report.push({ entry: g.e.name, looked: [g.p.name, g.p.number, g.p.set].filter(Boolean).join(' | '), n: g.ids.length, result: card ? 'filled' : cards ? (cards.length ? 'unclear' : 'not found') : 'lookup failed',
          got: card ? [card.n, card.num, card.s, card.r].filter(Boolean).join(' · ') : (cards || []).slice(0, 4).map(c => [c.n, c.num, c.s, c.r].filter(Boolean).join(' · ')) });
        if (card) prog.found += g.ids.length;
        prog.done++; emit();
        await sleep(force ? 2600 : GAP);
      }
    } finally { running = false; force = false; emit(); if (heldUntil > Date.now() && on) { clearTimeout(timer); timer = setTimeout(run, heldUntil - Date.now()); } else if (again && on) { again = false; clearTimeout(timer); timer = setTimeout(run, 600); } }
  }

  window.CTArtFill = {
    start() { if (!Sess.REAL) return; on = true; clearTimeout(timer); timer = setTimeout(run, 4000); },
    stop() { on = false; clearTimeout(timer); },
    now: run,
    // after "Change card": entries with the same text pick it up right away
    // admins: try every entry that has no art right now, past the daily share, and keep a report of what came back
    async force() { if (!window.CARDTAB_API) return null; while (running) await sleep(300); on = true; force = true; heldUntil = 0; report = []; await run(); return report.slice(); },
    report: () => report.slice(),
    learn() { applyPicks().catch(() => {}); if (on) { clearTimeout(timer); timer = setTimeout(run, 600); } },
    progress: () => Object.assign({ running }, prog),
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    _clearMatch: clearMatch, _parsed: parsedOf
  };
  S.on(r => { if (on && (r === 'import' || r === 'sync' || r === 'add')) { clearTimeout(timer); timer = setTimeout(run, 3000); } });
})();
