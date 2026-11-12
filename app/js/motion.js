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
  // v52.55 glide(): the same spring, but handed to the browser as one animation (a spring-shaped curve), so the system
  // draws it off the main thread at the screen's own rate (60, or 120 where the browser allows). Busy moments in the app
  // can't drop its frames. stop() reads where it is mid-move and holds it there, so a touch can still catch it.
  // Falls back to spring() where the browser can't take the curve.
  const curveOK = w => { try { return (w || window).CSS.supports('animation-timing-function', 'linear(0, 0.5 50%, 1)'); } catch (e) { return false; } };
  function glide(o) {
    const w = o.win || window, el = o.el, d = o.to - o.from;
    if (calmQ.matches || !el.animate || !curveOK(w) || Math.abs(d) < 0.5) {
      return spring({ win: w, from: o.from, to: o.to, v: o.v, k: o.k, c: o.c, set: x => { el.style.transform = o.tf(x); (o.with ? [].concat(o.with) : []).forEach(f => { if (f && f.el) f.el.style[f.prop] = f.map(x); }); }, done: o.done });
    }
    // trace the spring once (1ms steps), in units of the whole distance
    const k = o.k || 380, c = o.c || 39; let x = 0, v = (o.v || 0) / d, t = 0; const pts = [0];
    while (t < 2000) { for (let i = 0; i < 1; i++) { const a = -k * (x - 1) - c * v; v += a * 0.001; x += v * 0.001; } t++; pts.push(x); if (Math.abs((x - 1) * d) < 0.4 && Math.abs(v * d) < 14) break; }
    const n = Math.min(80, pts.length - 1), ease = 'linear(' + Array.from({ length: n + 1 }, (_, i) => { const j = Math.round(i / n * (pts.length - 1)); return (Math.round((i === n ? 1 : pts[j]) * 10000) / 10000) + ' ' + (Math.round(j / (pts.length - 1) * 10000) / 100) + '%'; }).join(', ') + ')';
    const dur = pts.length - 1;
    el.style.transform = o.tf(o.to);
    const an = el.animate([{ transform: o.tf(o.from) }, { transform: o.tf(o.to) }], { duration: dur, easing: ease });
    // followers (a backdrop's dim, the layer underneath) move on the same curve
    const fol = (o.with ? [].concat(o.with) : []).filter(f => f && f.el);
    const an2s = fol.map(f => { const a = f.el.animate([{ [f.prop]: f.map(o.from) }, { [f.prop]: f.map(o.to) }], { duration: dur, easing: ease }); f.el.style[f.prop] = f.map(o.to); return a; });
    let live = true;
    an.onfinish = () => { if (!live) return; live = false; an.cancel(); an2s.forEach(a => a.cancel()); o.done && o.done(); };
    return { get live() { return live; }, stop() { if (!live) return o.to; live = false; const p = at(el, w)[o.axis === 'y' ? 1 : 0]; an.cancel(); an2s.forEach(a => a.cancel()); el.style.transform = o.tf(p); fol.forEach(f => { f.el.style[f.prop] = f.map(p); }); return p; } };
  }
  // where an element sits right now (its transform, mid-animation included): [x, y]
  const at = (el, w) => { const t = (w || window).getComputedStyle(el).transform; if (!t || t === 'none') return [0, 0]; const m = t.match(/matrix(3d)?\(([^)]+)\)/); if (!m) return [0, 0]; const n = m[2].split(',').map(Number); return m[1] ? [n[12], n[13]] : [n[4], n[5]]; };
  window.CTMotion = { spring, glide, tracker, rubber, at };

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
