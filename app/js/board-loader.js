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
        amount: t.amount, net: t.type === 'sale' ? (t.net != null ? t.net : t.amount) : null, qty: t.qty || 1, art: t.art || null };
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
  let loading = null, opened = false;
  function load() {
    if (window.CTBoard) return Promise.resolve();
    if (loading) return loading;
    const V = '50.14'; // bump when board files change, so phones don't keep an old copy
    const css = new Promise((res, rej) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'board/board.css?v=' + V; l.onload = res; l.onerror = rej; document.head.appendChild(l); });
    const js = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'board/board.js?v=' + V; s.async = true; s.onload = res; s.onerror = rej; document.body.appendChild(s); });
    loading = Promise.all([css, js]).then(() => { sync(); if (window.CTBoard.prewarm) window.CTBoard.prewarm(); }).catch(e => { loading = null; throw e; });
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
  // Keep the board current with the list
  S.on(() => { if (window.CTBoard) window.CTBoard.refresh(); });
  // Fetch it quietly once the app has settled, so the first open is instant
  addEventListener('load', () => { (window.requestIdleCallback || (f => setTimeout(f, 2500)))(() => { load().catch(() => {}); }, { timeout: 6000 }); });
  window.CTBoardLoader = { load, open, sync };
})();
