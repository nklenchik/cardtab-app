/* Card art for entries that came in without it (spreadsheet imports, older entries).
   In the background, each unique card is looked up once in the card database, the same search Add New uses. Art is
   added only when the match is clear (name, number and set line up). Unclear ones are left alone and tried again in a
   few days, never guessed. Paced to stay well under the card data plan's per-minute limit; picks up where it left off.
   Runs only on the real app when signed in. Changes save like any edit, so the art shows up on every device. */
(function () {
  'use strict';
  const S = window.CTStore, Sess = window.CTSession, L = window.CardLookup, P = window.CardParser;
  if (!S || !Sess || !L || !P) return;
  const GAP = 3500, RETRY_DAYS = 4, BUSY_WAIT = 60000;
  let on = false, running = false, timer = 0, prog = { done: 0, total: 0, found: 0 }, listeners = new Set();
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const emit = () => listeners.forEach(f => { try { f(Object.assign({ running }, prog)); } catch (e) {} });

  function parsedOf(e) {
    if (e.parsed && (e.parsed.name || e.parsed.number)) return e.parsed;
    const p = P.parse(e.source || e.name || ''); return { name: p.name || e.name, number: p.number || '', set: p.set || '', game: p.game || '' };
  }
  function needs(e) {
    if (e.deleted || (e.art && (e.art.list || e.art.detail)) || !e.name) return false;
    if (e.artTry && Date.now() - Date.parse(e.artTry) < RETRY_DAYS * 864e5) return false;
    return true;
  }
  async function lookup(p) {
    const base = window.CARDTAB_API;
    const q = '?name=' + encodeURIComponent(p.name || '') + '&number=' + encodeURIComponent(p.number || '') + '&set=' + encodeURIComponent(p.set || '') + '&game=' + encodeURIComponent(p.game || '');
    const r = await fetch(base + '/api/lookup' + q);
    if (r.status === 429) { const err = new Error('busy'); err.busy = true; throw err; }
    if (!r.ok) throw new Error('lookup ' + r.status);
    const j = await r.json();
    const cards = (j.cards || []).map(c => ({ id: c.id, n: c.n, s: c.s, num: c.num, r: c.r, g: c.g, h: 210, art: { list: base + c.art.list, detail: base + c.art.detail } }));
    return L.rank(cards, p);
  }

  async function run() {
    if (!on || running || !window.CARDTAB_API) return;
    const todo = S.all().filter(needs);
    if (!todo.length) return;
    // one lookup per unique card
    const groups = new Map();
    todo.forEach(e => { const p = parsedOf(e), k = [norm(p.name), norm(p.number).replace(/\b0+(?=\d)/g, ''), norm(p.set)].join('|'); if (!groups.has(k)) groups.set(k, { p, ids: [] }); groups.get(k).ids.push(e.id); });
    running = true; prog = { done: 0, total: groups.size, found: 0 }; emit();
    try {
      for (const g of groups.values()) {
        if (!on) break;
        let res = null;
        for (let tries = 0; tries < 3; tries++) {
          try { res = await lookup(g.p); break; }
          catch (e) { if (e.busy) { await sleep(BUSY_WAIT); continue; } res = null; break; }
        }
        const card = res && res.pick >= 0 ? res.list[res.pick] : null;
        const now = new Date().toISOString();
        for (const id of g.ids) {
          const cur = S.get(id); if (!cur || !needs(cur)) continue;
          if (card) await S._artPatch(id, { art: { list: card.art.list, detail: card.art.detail }, artFrom: 'lookup', cardId: card.id });
          else if (res) await S._artPatch(id, { artTry: now });   // no clear match: try again in a few days
        }
        if (card) prog.found += g.ids.length;
        prog.done++; emit();
        await sleep(GAP);
      }
    } finally { running = false; emit(); }
  }

  window.CTArtFill = {
    start() { if (!Sess.REAL) return; on = true; clearTimeout(timer); timer = setTimeout(run, 4000); },
    stop() { on = false; clearTimeout(timer); },
    now: run,
    progress: () => Object.assign({ running }, prog),
    onChange(f) { listeners.add(f); return () => listeners.delete(f); }
  };
  // new imports or entries kick it off again
  S.on(r => { if (on && (r === 'import' || r === 'sync' || r === 'add')) { clearTimeout(timer); timer = setTimeout(run, 3000); } });
})();
