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
  let heldUntil = 0;
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
    if (e.parsed && (e.parsed.name || e.parsed.number)) return e.parsed;
    const p = P.parse(e.source || e.name || ''); return { name: p.name || e.name, number: p.number || '', set: p.set || '', game: p.game || '' };
  }
  const isPick = e => e.artFrom === 'pick' || e.artFrom === 'none';
  function needs(e) {
    if (e.deleted || !e.name || isPick(e)) return false;
    if (e.artFrom === 'lookup' && !e.artV2) return true;                 // filled in by the old rules: re-check once
    if (!e.art && e.artV2 && !e.artV3) return true;                      // v42.12: emptied by the stricter rules: try again now with the printing rule
    if (e.art && (e.art.list || e.art.detail)) return false;
    if (e.artTry && Date.now() - Date.parse(e.artTry) < RETRY_DAYS * 864e5) return false;
    return true;
  }
  // your own picks, by entry text (from every entry you've changed)
  function picks() { const m = new Map(); S.all().forEach(e => { if (isPick(e)) m.set(textKey(e), { art: e.art || null, artFrom: e.artFrom, cardId: e.cardId || null, cardName: e.cardName || null }); }); return m; }

  // a clear match: name, number, set and language all line up, and only one printing is left
  function clearMatch(cards, p, e) {
    const text = (e.source || e.name || '') + ' ' + (p.set || ''), jp = /japan/i.test(text);
    const ew = new Set(words(p.name + ' ' + (e.name || ''))), pw = words(p.name);
    const has = (set, w) => set.has(w) || [...set].some(x => x.startsWith(w) || w.startsWith(x));
    const ok = cards.filter(c => {
      const cw = words(c.n); if (!cw.length) return false;
      if (cw.filter(w => has(ew, w)).length / cw.length < 0.75) return false;          // the card's name is in the entry
      const cs = new Set(cw); if (pw.length && pw.filter(w => has(cs, w)).length / pw.length < 0.75) return false;   // and the entry's card name is the card's (Scyther isn't Rocket's Scyther)
      if (p.number) { const a = numKey(c.num).split(' ')[0], b = numKey(p.number).split(' ')[0]; if (!a || a !== b) return false; }
      const cj = /japan/i.test((c.g || '') + ' ' + (c.s || ''));
      if (jp !== cj) return false;                                       // Japanese entries get Japanese printings, and only them
      return true;
    });
    if (ok.length <= 1) return ok[0] || null;
    // the card it already shows is still one of the right ones: keep it
    if (e.cardId) { const was = ok.find(c => c.id === e.cardId); if (was) return was; }
    if (p.set) { const exact = ok.filter(c => norm(c.s) === norm(p.set)); if (exact.length === 1) return exact[0]; }
    const ids = new Set(ok.map(c => norm(c.n) + '|' + numKey(c.num) + '|' + norm(c.s)));
    if (ids.size === 1) return ok[0];
    // v42.12: several printings of the very same card (same name; Dragon Ball leaders and reprints often have many):
    // use the standard printing. It's the right card either way, and "Change card" picks a specific printing.
    const same = ok.filter(c => norm(c.n) === norm(p.name));
    if (same.length && new Set(same.map(c => norm(c.n))).size === 1) return standard(same);
    return null;                                                          // different cards with similar names: don't guess
  }

  // the everyday printing first: not an alternate art, special or secret rare, promo, or premium box version
  const FANCY = /alt(ernate)?\s*art|special|secret|\b(spr|scr|sr|gdr|ser)\b|serial|gold|god rare|promo|foil|premium|collector|anniversary|championship|judge|prize|stamp|reprint/i;
  function standard(list) { const plain = list.filter(c => !FANCY.test((c.r || '') + ' ' + (c.s || '') + ' ' + (c.n || ''))); return (plain.length ? plain : list)[0]; }
  async function lookup(p) {
    const base = window.CARDTAB_API;
    const q = '?name=' + encodeURIComponent(p.name || '') + '&number=' + encodeURIComponent(p.number || '') + '&set=' + encodeURIComponent(p.set || '') + '&game=' + encodeURIComponent(p.game || '');
    const r = await fetch(base + '/api/lookup' + q + '&src=fill', { credentials: 'include' });
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
    if (heldUntil > Date.now()) { await applyPicks(); return; }
    running = true;
    try {
      // 1) your picks first: every entry with the same text as one you changed gets the same card, no lookup needed
      await applyPicks();
      const left = S.all().filter(needs);
      if (!left.length) return;
      // 2) one lookup per unique card
      const groups = new Map();
      left.forEach(e => { const p = parsedOf(e), k = [norm(p.name), numKey(p.number), norm(p.set), /japan/i.test(e.source || e.name) ? 'jp' : ''].join('|'); if (!groups.has(k)) groups.set(k, { p, ids: [], e }); groups.get(k).ids.push(e.id); });
      prog = { done: 0, total: groups.size, found: 0 }; emit();
      let held = false;
      for (const g of groups.values()) {
        if (!on) break;
        let cards = null;
        for (let tries = 0; tries < 3; tries++) {
          try { cards = await lookup(g.p); break; }
          catch (err) { if (err.later) { held = true; break; } if (err.busy) { await sleep(BUSY_WAIT); continue; } cards = null; break; }
        }
        if (held) { heldUntil = Date.now() + LATER; break; }   // today's share is used up: stop quietly and pick up where we left off in a few hours
        const card = cards ? clearMatch(cards, g.p, g.e) : null, now = new Date().toISOString();
        for (const id of g.ids) {
          const cur = S.get(id); if (!cur || !needs(cur) || picks().has(textKey(cur))) continue;
          if (card) await S._artPatch(id, { art: { list: card.art.list, detail: card.art.detail }, artFrom: 'lookup', cardId: card.id, cardName: [card.n, card.num, card.s].filter(Boolean).join(' - '), artV2: 1, artV3: 1 });
          else if (cards) await S._artPatch(id, { art: null, artFrom: null, cardId: null, artTry: now, artV2: 1, artV3: 1 });   // unclear: placeholder, try again in a few days
        }
        if (card) prog.found += g.ids.length;
        prog.done++; emit();
        await sleep(GAP);
      }
    } finally { running = false; emit(); if (heldUntil > Date.now() && on) { clearTimeout(timer); timer = setTimeout(run, heldUntil - Date.now()); } else if (again && on) { again = false; clearTimeout(timer); timer = setTimeout(run, 600); } }
  }

  window.CTArtFill = {
    start() { if (!Sess.REAL) return; on = true; clearTimeout(timer); timer = setTimeout(run, 4000); },
    stop() { on = false; clearTimeout(timer); },
    now: run,
    // after "Change card": entries with the same text pick it up right away
    learn() { applyPicks().catch(() => {}); if (on) { clearTimeout(timer); timer = setTimeout(run, 600); } },
    progress: () => Object.assign({ running }, prog),
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    _clearMatch: clearMatch
  };
  S.on(r => { if (on && (r === 'import' || r === 'sync' || r === 'add')) { clearTimeout(timer); timer = setTimeout(run, 3000); } });
})();
