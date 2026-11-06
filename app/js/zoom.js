/* Card art viewer (v38.2). Tap or click the art in an open entry (or the gallery panel) to see it big.
   - It grows out of the thumbnail and shrinks back into it on close. Transform and opacity only.
   - It's never shown larger than the image can stay sharp on this screen (its own pixels, allowing for the screen's density).
   - Phones: pinch to zoom, drag to look around, double-tap to zoom in or out, swipe down (not zoomed) to close.
   - Desktop: click to zoom in where you clicked, drag to look around, click outside or Esc to close. */
(function () {
  'use strict';
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let el = null, img = null, from = null, base = { w: 0, h: 0 }, s = 1, tx = 0, ty = 0, maxS = 3, open = false;

  function build() {
    el = document.createElement('div'); el.className = 'zm'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Card art');
    el.innerHTML = '<div class="zm-bg"></div><img class="zm-img" alt="" draggable="false"><button type="button" class="zm-x" aria-label="Close">' + X + '</button><p class="zm-tip"></p>';
    document.body.appendChild(el); img = el.querySelector('.zm-img');
    el.querySelector('.zm-x').addEventListener('click', e => { e.stopPropagation(); close(); });
    wire();
  }
  const apply = (ms) => { img.style.transition = ms ? 'transform ' + ms + 'ms cubic-bezier(.2,.8,.2,1)' : 'none'; img.style.transform = 'translate(-50%,-50%) translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')'; el.classList.toggle('zoomed', s > 1.01); };
  // keep the picture from sliding away past its own edges
  function clamp() { const w = base.w * s, h = base.h * s, mx = Math.max(0, (w - innerWidth) / 2), my = Math.max(0, (h - innerHeight) / 2); tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty)); }
  function zoomAt(ns, cx, cy, ms) { ns = Math.max(1, Math.min(maxS, ns)); const ox = cx - innerWidth / 2 - tx, oy = cy - innerHeight / 2 - ty, k = ns / s; tx -= ox * (k - 1); ty -= oy * (k - 1); s = ns; if (s <= 1.01) { s = 1; tx = 0; ty = 0; } clamp(); apply(ms); }

  function size() {
    // the largest size that fits the screen with a margin, but no larger than the image's own pixels allow
    const dpr = Math.min(window.devicePixelRatio || 1, 2), nw = img.naturalWidth || 600, nh = img.naturalHeight || 840;
    const sharpW = nw / Math.max(1, dpr * .75), pad = innerWidth < 761 ? 16 : 56;
    const fit = Math.min((innerWidth - pad * 2) / nw, (innerHeight - pad * 2 - (innerWidth < 761 ? 40 : 0)) / nh);
    const w = Math.min(nw * fit, sharpW), h = w * nh / nw;
    base = { w, h }; img.style.width = w + 'px'; img.style.height = h + 'px';
    maxS = Math.max(2, Math.min(5, (nw / (w * dpr)) * 2.5));
  }

  function openZoom(src, thumb) {
    if (!src) return; if (!el) build();
    from = thumb || null; s = 1; tx = 0; ty = 0; open = true;
    el.querySelector('.zm-tip').textContent = innerWidth < 761 ? 'Pinch to zoom · swipe down to close' : 'Click to zoom · Esc to close';
    const show = () => {
      size(); apply(0); el.classList.add('on'); document.documentElement.classList.add('zm-open');
      // grow out of the thumbnail
      if (from && !calm.matches) { const r = from.getBoundingClientRect(); if (r.width) {
        const k = r.width / base.w, dx = r.left + r.width / 2 - innerWidth / 2, dy = r.top + r.height / 2 - innerHeight / 2;
        img.animate([{ transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')', borderRadius: '6px' }, { transform: 'translate(-50%,-50%) scale(1)', borderRadius: '14px' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
        from.style.opacity = '0'; } }
      el.querySelector('.zm-x').focus({ preventScroll: true });
    };
    img.onload = null;
    // show the thumbnail's picture straight away; swap to the full one when it arrives
    const quick = thumb && thumb.currentSrc;
    if (quick && quick !== src) { img.src = quick; img.decode ? img.decode().then(show, show) : show(); const full = new Image(); full.onload = () => { if (open) { img.src = src; size(); apply(0); } }; full.src = src; }
    else { img.src = src; if (img.complete && img.naturalWidth) show(); else img.onload = show; }
    if (window.CTNav) window.CTNav.push('zoom', () => close(true));
  }
  function close(fromPop) {
    if (!open) return; open = false; if (!fromPop && window.CTNav) window.CTNav.done('zoom');
    const done = () => { el.classList.remove('on', 'zoomed', 'drag'); document.documentElement.classList.remove('zm-open'); if (from) from.style.opacity = ''; el.style.removeProperty('--bg'); };
    const r = from && from.getBoundingClientRect(), vis = r && r.width && r.bottom > 0 && r.top < innerHeight;
    el.classList.add('out');
    if (vis && !calm.matches) {
      const k = r.width / base.w, dx = r.left + r.width / 2 - innerWidth / 2, dy = r.top + r.height / 2 - innerHeight / 2;
      const a = img.animate([{ transform: img.style.transform }, { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')', borderRadius: '6px' }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      a.onfinish = () => { done(); el.classList.remove('out'); a.cancel(); };
    } else setTimeout(() => { done(); el.classList.remove('out'); }, calm.matches ? 0 : 220);
  }

  function wire() {
    const pts = new Map(); let pinch = null, pan = null, swipe = null, lastTap = 0, moved = false, downImg = false;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.zm-x')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; downImg = e.target === img; // (pointer capture retargets later events)
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s0: s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, tx0: tx, ty0: ty }; pan = swipe = null; return; }
      if (s > 1.01) pan = { x: e.clientX, y: e.clientY, tx0: tx, ty0: ty };
      else if (e.pointerType !== 'mouse') swipe = { y: e.clientY, x: e.clientX };
    });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const p0 = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.hypot(e.clientX - p0.x, e.clientY - p0.y) > 0) moved = moved || Math.abs(e.clientX - p0.x) + Math.abs(e.clientY - p0.y) > 3;
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const ns = Math.max(.85, Math.min(maxS * 1.15, pinch.s0 * d / pinch.d)), k = ns / pinch.s0, ox = pinch.cx - innerWidth / 2 - pinch.tx0, oy = pinch.cy - innerHeight / 2 - pinch.ty0;
        s = ns; tx = pinch.tx0 - ox * (k - 1) + (cx - pinch.cx); ty = pinch.ty0 - oy * (k - 1) + (cy - pinch.cy); apply(0); return; }
      if (pan) { tx = pan.tx0 + e.clientX - pan.x; ty = pan.ty0 + e.clientY - pan.y; clamp(); el.classList.add('drag'); apply(0); return; }
      if (swipe) { const dy = Math.max(0, e.clientY - swipe.y); ty = dy; s = 1 - Math.min(.25, dy / 1600); apply(0); el.style.setProperty('--bg', String(Math.max(.25, 1 - dy / 500))); }
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); el.classList.remove('drag');
      if (pinch) { if (pts.size < 2) { pinch = null; if (s < 1) { s = 1; tx = 0; ty = 0; } else if (s > maxS) s = maxS; clamp(); apply(260); } return; }
      if (swipe) { const dy = e.clientY - swipe.y; swipe = null; el.style.removeProperty('--bg');
        if (dy > 110) { close(); return; } if (moved) { s = 1; tx = 0; ty = 0; apply(260); return; } }
      pan = null;
      if (moved) return;
      // a tap or click
      const onImg = downImg, now = performance.now();
      if (e.pointerType === 'mouse') { if (!onImg) { close(); return; } if (s > 1.01) zoomAt(1, e.clientX, e.clientY, 300); else zoomAt(Math.min(2.5, maxS), e.clientX, e.clientY, 300); return; }
      if (now - lastTap < 300) { lastTap = 0; zoomAt(s > 1.01 ? 1 : Math.min(2.5, maxS), e.clientX, e.clientY, 300); return; }
      lastTap = now;
      if (!onImg && s <= 1.01) setTimeout(() => { if (lastTap === now) close(); }, 300);
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', e => { if (!open) return; e.preventDefault(); zoomAt(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY, 120); }, { passive: false });
    document.addEventListener('keydown', e => { if (open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }, true);
    addEventListener('resize', () => { if (open) { size(); s = Math.min(s, maxS); clamp(); apply(0); } });
  }
  window.CTZoom = { open: openZoom, close: () => close() };
})();
