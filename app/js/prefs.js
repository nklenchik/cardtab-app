/* Settings that follow you (v50.27).
   Choices people make once and expect everywhere are saved to the account, not just this browser: appearance, what sales
   show, the Insights numbers, the board's "compare to", Stories' theme and background, the sort, and each Card Board
   (the phone board and the computer board, each with its saved-layout pick). A few are kept separately for phones and
   computers, because people use them differently on each: which page the app opens to, list or grid in Entries, and
   which entries show first. Computers start on grid, phones on list.
   How: the app keeps saving these to this browser as before; this file copies each change to the account (a moment
   later, so dragging a widget doesn't send a burst), and copies the account's choices back whenever they arrive. */
(function () {
  'use strict';
  const S = window.CTStore; if (!S || !S.meta) return;
  const PH = () => matchMedia('(max-width:760px)').matches, kind = () => PH() ? 'phone' : 'desk';
  // the same on every device
  const WIDE = ['cb.theme', 'ct.amt', 'ct.qm', 'cb.compare', 'cs.theme', 'cs.bg', 'ct.f.ct-sort',
    'cb.layout.v4', 'cb.layout.phone.v2', 'cb.layout.v4.free', 'cb.layout.phone.v2.free', 'cb.custom', 'cb.ly.cur.desk', 'cb.ly.cur.phone'];
  // one for phones, one for computers
  const PER = ['ct.view', 'ct.open', 'ct.filter'];
  const DEFAULTS = { desk: { 'ct.view': 'gallery' }, phone: { 'ct.view': 'list' } };
  const tracked = k => WIDE.includes(k) || PER.includes(k);
  const ST = Storage.prototype, rawSet = ST.setItem, rawDel = ST.removeItem, rawGet = ST.getItem;
  const lget = k => { try { return rawGet.call(localStorage, k); } catch (e) { return null; } };
  const lset = (k, v) => { try { v == null ? rawDel.call(localStorage, k) : rawSet.call(localStorage, k, v); } catch (e) {} };

  let pending = {}, timer = 0, applying = false;
  const cur = () => { const p = S.meta('prefs'); return p && typeof p === 'object' ? p : { w: {}, desk: {}, phone: {} }; };
  function note(k, v) {
    if (applying || !tracked(k)) return;
    pending[k] = v; clearTimeout(timer); timer = setTimeout(flush, 700);
  }
  async function flush() {
    const ks = Object.keys(pending); if (!ks.length) return;
    const p = cur(), out = { w: Object.assign({}, p.w), desk: Object.assign({}, p.desk), phone: Object.assign({}, p.phone) }, k0 = kind();
    ks.forEach(k => { const v = pending[k], box = PER.includes(k) ? out[k0] : out.w; if (v == null) delete box[k]; else box[k] = v; });
    pending = {};
    // the account keeps each setting up to ~24k characters; if boards ever grow past that, they stay on this device only
    // (Free boards first), so the other choices still sync
    for (const k of ['cb.layout.v4.free', 'cb.layout.phone.v2.free', 'cb.layout.phone.v2', 'cb.layout.v4']) { if (JSON.stringify(out).length < 20000) break; delete out.w[k]; }
    try { await S.setMeta('prefs', out); } catch (e) {}
  }
  // this browser's own saves are noticed as they happen
  ST.setItem = function (k, v) { rawSet.call(this, k, v); if (this === window.localStorage) note(k, String(v)); };
  ST.removeItem = function (k) { rawDel.call(this, k); if (this === window.localStorage) note(k, null); };
  // Stories runs in its own frame (same site): its saves arrive as storage events
  addEventListener('storage', e => { if (e.storageArea === localStorage && e.key) note(e.key, e.newValue); });

  // ---- the account's choices, applied here ----
  function apply(first) {
    const p = S.meta('prefs'), k0 = kind(), changed = [];
    applying = true;
    try {
      // a choice this browser has that the account doesn't yet is sent up rather than replaced
      if (p) WIDE.forEach(k => { if (!(k in (p.w || {}))) { if (lget(k) != null) { applying = false; note(k, lget(k)); applying = true; } return; } const v = p.w[k]; if (lget(k) !== v) { lset(k, v); changed.push(k); } });
      PER.forEach(k => {
        if (p && !(p[k0] && k in p[k0]) && lget(k) != null) { applying = false; note(k, lget(k)); applying = true; return; }
        const mine = p && p[k0] && k in p[k0] ? p[k0][k] : (DEFAULTS[k0][k] != null ? DEFAULTS[k0][k] : null); if (lget(k) !== mine) { lset(k, mine); changed.push(k); } });
    } finally { applying = false; }
    if (!changed.length) return;
    if (changed.includes('cb.theme') && window.CTApplyTheme) window.CTApplyTheme(lget('cb.theme') || 'auto', false);
    if (changed.includes('ct.amt')) dispatchEvent(new Event('ct-amt'));
    if (!first && changed.some(k => k.startsWith('cb.layout') || k.startsWith('cb.ly.cur') || k === 'cb.custom') && window.cbReloadLayout) window.cbReloadLayout();
    dispatchEvent(new CustomEvent('ct-prefs', { detail: { keys: changed, first: !!first } }));
  }
  // first time on an account that has nothing saved yet: what this browser already has becomes the account's
  async function seed() {
    if (S.meta('prefs')) return;
    const out = { w: {}, desk: {}, phone: {} }, k0 = kind();
    WIDE.forEach(k => { const v = lget(k); if (v != null) out.w[k] = v; });
    PER.forEach(k => { const v = lget(k); if (v != null) out[k0][k] = v; });
    try { await S.setMeta('prefs', out); } catch (e) {}
  }
  let started = false;
  S.on(r => {
    if (r === 'open') { started = true; seed().then(() => apply(true)); return; }
    if (r === 'sync' || r === 'remote') apply(false);
  });
  // in case the store was already open
  setTimeout(() => { if (!started && S.meta) { started = true; seed().then(() => apply(true)); } }, 1500);

  // ---- which page the app opens to (phones and computers each have their own) ----
  let opened = false;
  function openTo() {
    if (opened) return; opened = true;
    const v = lget('ct.open'); if (v !== 'board' && v !== 'stories') return;
    if (/^\/b\//.test(location.pathname) || location.hash) return;
    let n = 0;
    (function wait() {
      const app = document.getElementById('view-app');
      if (app && !app.hidden && window.CTTabGo && window.CTBoardLoader) { window.cbInstant = true; window.CTTabGo(v); return; }
      if (++n < 40) setTimeout(wait, 250);
    })();
  }
  addEventListener('ct-prefs', e => { if (e.detail && e.detail.first) openTo(); });
  setTimeout(openTo, 4000);

  // ---- for Settings: read and change the phone and computer choices from either device ----
  window.CTPrefs = {
    kind,
    get(k, who) { who = who || kind(); const p = S.meta('prefs'); if (p && p[who] && k in p[who]) return p[who][k]; return DEFAULTS[who][k] != null ? DEFAULTS[who][k] : null; },
    async set(k, v, who) {
      who = who || kind(); const p = cur(), out = { w: Object.assign({}, p.w), desk: Object.assign({}, p.desk), phone: Object.assign({}, p.phone) };
      if (v == null) delete out[who][k]; else out[who][k] = v;
      await S.setMeta('prefs', out);
      if (who === kind()) { applying = true; lset(k, v); applying = false; dispatchEvent(new CustomEvent('ct-prefs', { detail: { keys: [k] } })); }
    }
  };
})();
