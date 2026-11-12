/* Shared motion and back navigation, matching Card Board and Stories. v52.52: springs and finger speed (below).
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

  // v52.52 fluid motion, shared by settings pages, sheets and Stories:
  // - spring(): a position that springs toward a target, starting with the finger's speed. Driven by frames, so a slow
  //   first frame never makes it skip ahead, and stop() hands back where it is (so a touch can catch it mid-move).
  // - tracker(): the finger's speed over the last ~80ms (px per second).
  // - rubber(): past an edge it gives a little, more and more stiffly.
  const calmQ = matchMedia('(prefers-reduced-motion: reduce)');
  function spring(o) {
    const w = o.win || window, k = o.k || 380, c = o.c || 39, to = o.to;
    let x = o.from, v = o.v || 0, last = 0, id = 0, live = true;
    if (calmQ.matches) { o.set(to); o.done && o.done(); return { stop: () => to, get live() { return false; } }; }
    const tick = now => { if (!live) return; const dt = last ? Math.min(0.034, (now - last) / 1000) : 1 / 60; last = now;
      for (let i = 0; i < 4; i++) { const h = dt / 4, a = -k * (x - to) - c * v; v += a * h; x += v * h; }
      if (Math.abs(x - to) < 0.4 && Math.abs(v) < 14) { live = false; o.set(to); o.done && o.done(); return; }
      o.set(x); id = w.requestAnimationFrame(tick); };
    id = w.requestAnimationFrame(tick);
    return { stop() { if (live) { live = false; w.cancelAnimationFrame(id); } return x; }, get live() { return live; }, get x() { return x; } };
  }
  function tracker() { const pts = []; return { add(p) { const t = performance.now(); pts.push([t, p]); while (pts.length > 2 && t - pts[0][0] > 80) pts.shift(); },
    v() { if (pts.length < 2) return 0; const a = pts[0], b = pts[pts.length - 1], dt = (b[0] - a[0]) / 1000; return dt > 0 ? (b[1] - a[1]) / dt : 0; } }; }
  const rubber = (d, lim) => lim * (1 - 1 / (d / lim * 0.55 + 1));
  // where an element sits right now (its transform, mid-animation included): [x, y]
  const at = (el, w) => { const t = (w || window).getComputedStyle(el).transform; if (!t || t === 'none') return [0, 0]; const m = t.match(/matrix(3d)?\(([^)]+)\)/); if (!m) return [0, 0]; const n = m[2].split(',').map(Number); return m[1] ? [n[12], n[13]] : [n[4], n[5]]; };
  window.CTMotion = { spring, tracker, rubber, at };

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
      d._ct = setTimeout(() => { d.classList.remove('closing'); if (d.open) realClose(v); }, phone.matches ? 250 : 250);   // v50.98: every sheet closes in .22s (phones) or .24s (computers)
    };
    d.addEventListener('cancel', e => { e.preventDefault(); d.close(); });
  });
})();
