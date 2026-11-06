/* Shared motion and back navigation, matching Card Board and Stories.
   - Sheets (Add a card, the entry editor, Import) open and close with the board's exact motion.
   - The back gesture / back button closes the top layer (sheet or menu) instead of leaving the app. */
(function () {
  'use strict';
  // One layer = one history step. When a layer closes by its own button we step back; a layer opened while that step
  // is still settling (menu -> Import) waits for it, so the two never collide and back never leaves the app.
  const NAV = []; let skip = 0, waiting = 0;
  const step = k => { try { history.pushState({ ctn: k }, ''); } catch (e) {} };
  function push(k, fn) { if (NAV.some(n => n.k === k)) return; NAV.push({ k, fn }); if (skip > 0) waiting++; else step(k); }
  function done(k) { const i = NAV.findIndex(n => n.k === k); if (i < 0) return; NAV.splice(i, 1); if (waiting > 0) { waiting--; return; } skip++; try { history.back(); } catch (e) { skip--; } }
  addEventListener('popstate', () => {
    if (skip > 0) { skip--; if (!skip) while (waiting > 0) { waiting--; step('w'); } return; }
    const t = NAV.pop(); if (t) t.fn();
  });
  window.CTNav = { push, done };

  const calm = matchMedia('(prefers-reduced-motion: reduce)'), phone = matchMedia('(max-width:760px)');
  ['as', 'ed', 'imp', 'ntf', 'fix', 'dela'].forEach(id => {
    const d = document.getElementById(id); if (!d) return;
    const realClose = d.close.bind(d), realShow = d.showModal.bind(d), realShowN = d.show.bind(d);
    d.showModal = function () { clearTimeout(d._ct); d.classList.remove('closing'); if (!d.open) realShow(); push('dlg:' + id, () => d.close()); };
    d.show = function () { clearTimeout(d._ct); d.classList.remove('closing'); if (!d.open) realShowN(); push('dlg:' + id, () => d.close()); };
    d.close = function (v) {
      if (!d.open || d.classList.contains('closing')) return;
      done('dlg:' + id);
      // drop the keyboard as the sheet starts to leave, and tell the sheet it's closing so it stops resizing
      const a = document.activeElement; if (a && d.contains(a) && a.blur) a.blur();
      d.dispatchEvent(new Event('closing'));
      if (calm.matches) { realClose(v); return; }
      d.classList.add('closing');
      d._ct = setTimeout(() => { d.classList.remove('closing'); if (d.open) realClose(v); }, phone.matches ? 270 : 250);
    };
    d.addEventListener('cancel', e => { e.preventDefault(); d.close(); });
  });
})();
