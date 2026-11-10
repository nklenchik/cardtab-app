/* Sheets that slide up from the bottom (phones) follow your finger (v50.40).
   Drag down: the sheet moves 1:1. Drag up: it gives a little, then springs back.
   Let go after a short pull: it springs back into place. Pull past about a third of its height, or flick down
   (a real flick that has also moved a bit), and it slides the rest of the way down and closes from where it is.
   From the header (the grab bar and title row) a drag always moves the sheet; from the content it only does when the
   content is scrolled to the top, so scrolling stays scrolling. Transform only, so it stays at 60fps.
   Every open <dialog> sheet gets this automatically; the profile menu and Stories' sheets attach with CTSheetDrag.attach. */
(function () {
  'use strict';
  const EASE_BACK = 'cubic-bezier(.2,.9,.25,1)', EASE_OUT = 'cubic-bezier(.4,0,.8,.6)';
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HEAD = '.ed-head,.gp-grab,.imp-top,.amh,.bu-h,.sheet-h,.grab,.sh-grab,[data-grab]';
  const NODRAG = '[data-nodrag],.qm-grip,input[type=range],.ct-zoom';

  // o: { zone (where touches start), sheet (what moves) or sheetOf(target), on() -> bool, ownClose(dy) (the sheet's own
  //      close animates from its current transform) or dismiss() (we slide it out, hide it, then this closes it), backdrop }
  function attach(o) {
    const zone = o.zone, win = (zone.ownerDocument && zone.ownerDocument.defaultView) || window;
    let s = null; // the current touch
    const scrollerOf = (t, stop) => { for (let el = t; el && el !== stop.parentElement; el = el.parentElement) { const cs = win.getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return el; } return null; };
    const set = (sheet, y) => { sheet.style.transform = y ? 'translate3d(0,' + y + 'px,0)' : ''; if (o.backdrop) o.backdrop.style.opacity = y > 0 ? String(Math.max(0, 1 - y / (s ? s.h : 600))) : ''; };
    zone.addEventListener('touchstart', e => {
      s = null; if (e.touches.length !== 1 || (o.on && !o.on())) return;
      const t = e.target; if (t.closest && t.closest(NODRAG)) return;
      const sheet = o.sheet || (o.sheetOf && o.sheetOf(t)); if (!sheet || !sheet.contains(t)) return;
      const r = sheet.getBoundingClientRect(), y = e.touches[0].clientY;
      const head = !!(t.closest && t.closest(HEAD)) || y - r.top < 44;
      s = { sheet, head, sc: scrollerOf(t, sheet), x0: e.touches[0].clientX, y0: y, dy: 0, h: r.height || 600, drag: false, decided: false, pts: [[performance.now(), y]] };
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
        // v51.1: 'important', so an opening animation that is itself !important (the profile menu's) can't hold the sheet in place
        s.sheet.style.setProperty('transition', 'none', 'important'); s.sheet.style.setProperty('animation', 'none', 'important');
      }
      const d = y - s.y0; s.dy = d > 0 ? d : Math.max(-60, d / 3);                 // down 1:1, up with resistance
      set(s.sheet, s.dy); s.pts.push([performance.now(), y]); if (s.pts.length > 6) s.pts.shift();
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    const end = () => {
      if (!s || !s.drag) { s = null; return; }
      const c = s; s = null;
      const p = c.pts, a = p[0], b = p[p.length - 1], v = b[0] - a[0] > 0 ? (b[1] - a[1]) / (b[0] - a[0]) : 0;  // px per ms, + is down
      const close = c.dy > Math.max(110, c.h * 0.3) || (v > 0.9 && c.dy > 60);
      if (close) {
        if (o.ownClose) { o.ownClose(c.dy); return; }
        const from = c.sheet.style.transform || 'none';
        const fin = () => {
          // hidden until the window has really closed, so its own closing animation can't flash it back
          c.sheet.style.visibility = 'hidden'; c.sheet.style.transform = '';
          try { o.dismiss(c.sheet); } catch (er) {}
          const clear = () => { c.sheet.style.visibility = ''; c.sheet.style.removeProperty('transition'); c.sheet.style.removeProperty('animation'); if (o.backdrop) o.backdrop.style.opacity = ''; };
          const dlg = c.sheet.closest('dialog'); if (dlg && dlg.open) dlg.addEventListener('close', () => setTimeout(clear, 30), { once: true }); else setTimeout(clear, 400);
        };
        if (calm()) { fin(); return; }
        const an = c.sheet.animate([{ transform: from }, { transform: 'translate3d(0,' + (c.h + 40) + 'px,0)' }], { duration: Math.max(140, Math.min(260, (c.h - c.dy) / Math.max(1.2, v))), easing: EASE_OUT, fill: 'forwards' });
        an.id = 'ct-drag'; c.sheet.style.transform = ''; an.onfinish = () => { fin(); an.cancel(); };
        return;
      }
      // spring back
      const from = c.sheet.style.transform; set(c.sheet, 0);
      // the opening animation stays off (switching it back on would replay the slide-up); it comes back once the window closes
      const reset = () => { c.sheet.style.removeProperty('transition'); c.sheet.style.removeProperty('animation'); };
      const later = () => { const dlg = c.sheet.closest('dialog'); if (dlg) dlg.addEventListener('close', reset, { once: true }); else c.sheet.style.removeProperty('transition'); };
      if (from && !calm()) { const an = c.sheet.animate([{ transform: from }, { transform: 'none' }], { duration: 300, easing: EASE_BACK }); an.id = 'ct-drag'; an.onfinish = later; }
      else later();
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
