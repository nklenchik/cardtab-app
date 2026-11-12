/* Card Board inside the app.
   - The board's files (board/board.css, board/board.js) load only when needed: quietly in idle time a few seconds after the
     app starts, or right away the first time you open it. The entries screen never waits on them.
   - The board reads the same entries as your list, in cents, and redraws as soon as you add, edit or delete one. */
(function () {
  'use strict';
  const S = window.CTStore;
  // App entry -> board entry. Names are saved as "Name - number - set"; the board wants them apart.
  window.CTBoardData = function () {
    return S.all().map(t => {
      const parts = String(t.name || '').split(' - ');
      return { id: t.id, date: t.date, type: t.type, platform: t.platform || 'Other', name: parts[0] || t.name, no: parts[1] || '', set: parts.slice(2).join(' - '),
        amount: t.amount, net: t.type === 'sale' ? (t.net != null ? t.net : t.amount) : null, qty: t.qty || 1, art: t.art || null, game: t.game || '', condition: t.condition || '', grade: window.CTGrade ? window.CTGrade.of(t) : null, cardId: t.cardId || '' };   // v50.67: cardId lets a sale find its purchase // v50.37: graded cards show as slabs on the board
    });
  };
  // The board asks which plan you're on, and where Get Premium goes (checkout once payments exist; until then it switches plans here)
  window.CTBoardPlan = () => S.plan();
  window.CTBoardUpgrade = async () => { await S.setPlan('premium'); if (window.CTDash && window.CTDash.toast) window.CTDash.toast('Premium is on. (Checkout comes with payments.)'); };
  // Good-looking full art for the Premium sheet when the user has little art of their own yet (the art service will pick these later)
  window.CTPremiumArt = [
    { src: 'assets/card-art/mega-gengar-ex-wall.webp', focus: { x: .5, y: .22 } },
    { src: 'assets/card-art/magby-wall.webp', focus: { x: .5, y: .3 } },
    { src: 'assets/card-art/dragonair-wall.webp', focus: { x: .5, y: .2 } }
  ];
  // v52.5: whole raw cards (never graded) for the Premium header's fan when the user has fewer than 3 raw cards with art
  window.CTPremiumFan = ['charizard-ex', 'gengar-ex', 'pikachu-ex', 'greninja-ex', 'chi-yu-ex', 'magby', 'mega-gengar-ex', 'blastoise', 'houndoom']
    .map(n => ({ src: 'assets/card-art/' + n + '.webp', sm: 'assets/card-art/' + n + '-sm.webp' }));
  let loading = null, opened = false;
  function load() {
    if (window.CTBoard) return Promise.resolve();
    if (loading) return loading;
    const V = '52.55'; // bump when board files change, so phones don't keep an old copy
    const css = new Promise((res, rej) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'board/board.css?v=' + V; l.onload = res; l.onerror = rej; document.head.appendChild(l); });
    const js = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'board/board.js?v=' + V; s.async = true; s.onload = res; s.onerror = rej; document.body.appendChild(s); });
    loading = Promise.all([css, js]).then(() => { sync(); wrapOpen(); if (window.CTBoard.prewarm) window.CTBoard.prewarm(); }).catch(e => { loading = null; throw e; });
    return loading;
  }
  function sync() {
    if (!window.CTBoard) return;
    const sess = window.CTSession ? window.CTSession.current() : null, nm = document.querySelector('#app-menu .am-nm');
    window.CTBoard.user({ name: (nm && nm.textContent) || (sess && sess.name) || '', email: sess && sess.email, premium: S.plan() === 'premium' });
  }
  async function open(then) {
    // the board is kept current by the listener below, so opening it never rebuilds it (no redraw when you switch pages)
    try { await load(); sync(); window.CTBoard.open(); if (then === 'stories') setTimeout(() => { const b = document.getElementById('cb-stories'); if (b) b.click(); }, 620); }
    catch (e) { console.error('Card Board failed to load', e); }
  }
  // Keep the board current with the list.
  // v52.33: while the Board and Stories are on screen they update right away. While they're hidden, changes are gathered
  // and applied once things are quiet (a delete and its undo become one update, after the list has finished moving), and
  // always before the Board opens, so opening it never shows old numbers and still doesn't redraw.
  let pend = false, pt = 0;
  const onScreen = () => { const x = document.getElementById('csx'); return !!(window.CTBoard && (window.CTBoard.shown || (x && x.classList.contains('in')))); };
  function flush() { clearTimeout(pt); if (!pend || !window.CTBoard) return; pend = false; window.CTBoard.refresh(); }
  function wrapOpen() { const B = window.CTBoard; if (!B || B._fl) return; const o = B.open; B.open = function () { flush(); return o.apply(this, arguments); }; B._fl = 1;
    // Ask and the Premium sheet read the same numbers: bring them up to date first too
    ['CTAskOpen', 'CTPremiumOpen', 'CTProfileOpen'].forEach(k => { const f = window[k]; if (typeof f === 'function' && !f._fl) { const g = function () { flush(); return f.apply(this, arguments); }; g._fl = 1; window[k] = g; } }); }
  S.on(r => {
    if (!window.CTBoard) return;
    if (r === 'prefs') return;   // display choices (like a Stories theme) are applied where they're made; nothing to recount
    if (onScreen()) { pend = false; clearTimeout(pt); window.CTBoard.refresh(); return; }
    pend = true; clearTimeout(pt);
    pt = setTimeout(() => (window.requestIdleCallback || (f => setTimeout(f, 50)))(flush, { timeout: 3000 }), 600);
  });
  window.CTBoardFlush = flush;
  // Fetch it quietly once the app has settled, so the first open is instant
  addEventListener('load', () => { (window.requestIdleCallback || (f => setTimeout(f, 2500)))(() => { load().catch(() => {}); }, { timeout: 6000 }); });
  window.CTBoardLoader = { load, open, sync };
})();
