/* Sheets that slide up from the bottom (phones) follow your finger (v50.40).
   Drag down: the sheet moves 1:1. Drag up: it gives a little, then springs back.
   Let go after a short pull: it springs back into place. Pull past about a third of its height, or flick down
   (a real flick that has also moved a bit), and it slides the rest of the way down and closes from where it is.
   From the header (the grab bar and title row) a drag always moves the sheet; from the content it only does when the
   content is scrolled to the top, so scrolling stays scrolling. Transform only, so it stays at 60fps.
   v52.52: letting go hands the finger's speed to a spring (a flick carries, a slow release settles), the sheet can be
   caught mid-move, and one that's still opening is picked up from where it is.
   Every open <dialog> sheet gets this automatically; the profile menu and Stories' sheets attach with CTSheetDrag.attach. */
(function () {
  'use strict';
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HEAD = '.ed-head,.gp-grab,.imp-top,.amh,.bu-h,.sheet-h,.grab,.sh-grab,[data-grab]';
  const NODRAG = '[data-nodrag],.qm-grip,input[type=range],.ct-zoom';

  // o: { zone (where touches start), sheet (what moves) or sheetOf(target), on() -> bool, ownClose(dy) (the sheet's own
  //      close animates from its current transform) or dismiss() (we slide it out, hide it, then this closes it), backdrop }
  function attach(o) {
    const zone = o.zone, win = (zone.ownerDocument && zone.ownerDocument.defaultView) || window, M = window.CTMotion;
    let s = null; // the current touch
    const scrollerOf = (t, stop) => { for (let el = t; el && el !== stop.parentElement; el = el.parentElement) { const cs = win.getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return el; } return null; };
    const set = (sheet, y, h) => { sheet.style.transform = y ? 'translate3d(0,' + y + 'px,0)' : ''; if (o.backdrop) o.backdrop.style.opacity = y > 0 ? String(Math.max(0, 1 - y / (h || (s ? s.h : 600)))) : ''; };
    const freeze = sheet => { sheet.style.setProperty('transition', 'none', 'important'); sheet.style.setProperty('animation', 'none', 'important'); };
    zone.addEventListener('touchstart', e => {
      s = null; if (e.touches.length !== 1 || (o.on && !o.on())) return;
      const t = e.target; if (t.closest && t.closest(NODRAG)) return;
      const sheet = o.sheet || (o.sheetOf && o.sheetOf(t)); if (!sheet || !sheet.contains(t)) return;
      const r = sheet.getBoundingClientRect(), y = e.touches[0].clientY;
      const head = !!(t.closest && t.closest(HEAD)) || y - r.top < 44;
      s = { sheet, head, sc: scrollerOf(t, sheet), x0: e.touches[0].clientX, y0: y, dy: 0, base: 0, h: r.height || 600, drag: false, decided: false, tr: M ? M.tracker() : null };
      if (s.tr) s.tr.add(y);
      // v52.52 caught mid-move (springing back, or sliding away after a flick): it stops under the finger and follows it
      if (sheet._ctSpring && sheet._ctSpring.live) { const at = sheet._ctSpring.stop(); s.heading = sheet._ctSpring.closing ? 'close' : 'back'; sheet._ctSpring = null;
        s.decided = true; s.drag = true; s.base = at; s.dy = at; s.y0 = y; freeze(sheet); }
    }, { passive: true });
    zone.addEventListener('touchmove', e => {
      if (!s) return; const x = e.touches[0].clientX, y = e.touches[0].clientY, dx = x - s.x0, dy = y - s.y0;
      if (!s.decided) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        s.decided = true;
        if (Math.abs(dx) > Math.abs(dy)) { s = null; return; }                    // sideways: chips, carousels
        const top = !s.sc || s.sc.scrollTop <= 0;
        s.drag = s.head || (dy > 0 && top);
        if (!s.drag) { s = null; return; }
        s.y0 = y; s.sheet.getAnimations().forEach(a => { if (a.id === 'ct-drag') a.cancel(); });
        // v52.52 still opening: pick it up from where it is right now, not where it's headed
        s.base = M ? Math.max(0, M.at(s.sheet, win)[1]) : 0;
        // v51.1: 'important', so an opening animation that is itself !important (the profile menu's) can't hold the sheet in place
        freeze(s.sheet);
      }
      const d = s.base + (y - s.y0); s.dy = d > 0 ? d : -(M ? M.rubber(-d, 60) : Math.min(60, -d / 3));   // down 1:1, up gives a little
      set(s.sheet, s.dy); if (s.tr) s.tr.add(y); s.moved = Math.max(s.moved || 0, Math.abs(y - s.y0));
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    const end = () => {
      if (!s || !s.drag) { s = null; return; }
      const c = s; s = null;
      const v = c.tr ? c.tr.v() : 0;   // px per second, + is down
      let close = c.dy > Math.max(110, c.h * 0.3) && v > -300 || (v > 650 && c.dy > 24);
      if (c.heading && (c.moved || 0) < 6) close = c.heading === 'close';   // caught and let go without moving: carries on where it was going
      const reset = () => { c.sheet.style.removeProperty('transition'); c.sheet.style.removeProperty('animation'); };
      if (close) {
        const fin = () => {
          if (o.ownClose) { const dlg = c.sheet.closest('dialog'); if (dlg) dlg.addEventListener('close', () => { c.sheet.style.transform = ''; reset(); }, { once: true }); o.ownClose(c.h + 40); return; }
          // hidden until the window has really closed, so its own closing animation can't flash it back
          c.sheet.style.visibility = 'hidden'; c.sheet.style.transform = '';
          try { o.dismiss(c.sheet); } catch (er) {}
          const clear = () => { c.sheet.style.visibility = ''; reset(); if (o.backdrop) o.backdrop.style.opacity = ''; };
          const dlg = c.sheet.closest('dialog'); if (dlg && dlg.open) dlg.addEventListener('close', () => setTimeout(clear, 30), { once: true }); else setTimeout(clear, 400);
        };
        if (calm() || !M) { fin(); return; }
        // slides the rest of the way at the speed it was flicked (a spring that's already moving, no fixed timing)
        c.sheet._ctSpring = M.spring({ win, from: c.dy, to: c.h + 40, v: Math.max(v, 900), k: 260, c: 30, set: y => set(c.sheet, y, c.h), done: () => { c.sheet._ctSpring = null; fin(); } }); c.sheet._ctSpring.closing = true;
        return;
      }
      // back into place: a spring that starts with the finger's speed, so a flick up settles naturally
      const later = () => { const dlg = c.sheet.closest('dialog'); if (dlg) dlg.addEventListener('close', reset, { once: true }); else c.sheet.style.removeProperty('transition'); };
      if (calm() || !M || !c.dy) { set(c.sheet, 0); later(); return; }
      c.sheet._ctSpring = M.spring({ win, from: c.dy, to: 0, v: Math.min(v, 2500), k: 340, c: 32, set: y => set(c.sheet, y, c.h), done: () => { c.sheet._ctSpring = null; set(c.sheet, 0); later(); } });
    };
    zone.addEventListener('touchend', end, { passive: true }); zone.addEventListener('touchcancel', end, { passive: true });
  }

  // every <dialog> sheet in the app, on phones: the panel inside it moves; closing goes through its own close button
  const PHONE = () => matchMedia('(max-width:760px)').matches;
  const PANEL = [':scope>.phone>.sheet', ':scope>.ed-form', ':scope>form', ':scope>.gp-in', ':scope>.bu-p', ':scope>div'];
  attach({
    zone: document, on: PHONE,
    sheetOf: t => { const d = t.closest && t.closest('dialog[open]:not(.zm):not(.au)'); if (!d) return null; for (const q of PANEL) { const el = d.querySelector(q); if (el) return el; } return null; },
    dismiss: sheet => { const d = sheet.closest('dialog'); if (!d) return; const x = d.querySelector('[data-close],.ed-x,[data-gx],[data-ntf-close],[data-fix-close],[data-imp-close],.bu-x,[data-bu-close],.as-x,[data-as-close]'); if (x) x.click(); else d.close(); }
  });
  window.CTSheetDrag = { attach };
})();
