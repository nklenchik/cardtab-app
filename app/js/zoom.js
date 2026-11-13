/* Card art viewer (v38.2, slabs v50.43). Tap or click the art in an open entry (or the gallery panel) to see it big.
   - It grows out of the thumbnail and shrinks back into it on close. Transform and opacity only.
   - It's never shown larger than the image can stay sharp on this screen (its own pixels, allowing for the screen's density).
   - Phones: pinch to zoom, drag to look around, double-tap to zoom in or out, swipe down (not zoomed) to close.
   - Desktop: click to zoom in where you clicked, drag to look around, click outside or Esc to close.
   - The card's corners stay rounded at every zoom (the radius is a share of the card's width, like a real card's), so the
     white corners of a scan never show.
   - Graded cards open on their slab (a frosted case, so the page behind doesn't show through). A Slab | Card switch
     under it shows the card alone; on phones a single tap on the picture flips between the two as well. */
(function () {
  'use strict';
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const CARD_R = .048, SLAB_AR = 5.25 / 3.1, WELL = .80; // a card's corner radius is about 4.8% of its width; the card fills ~80% of a slab's width
  let el = null, img = null, slabEl = null, sw = null, from = null, thumbImg = null, thumbSlab = null, mode = 'card', graded = false, frame = null;
  // v52.44 the box the picture sits in (its background and shadow), so it leaves with the picture instead of staying behind
  // as an empty card-shaped outline: the closest wrapper that's the same size as the picture
  const frameOf = t => { if (!t) return null; let f = t; const r = t.getBoundingClientRect();
    for (let p = t.parentElement, i = 0; p && i < 3; p = p.parentElement, i++) { const q = p.getBoundingClientRect(); if (Math.abs(q.width - r.width) <= 3 && Math.abs(q.height - r.height) <= 3) f = p; else break; }
    return f; };
  let base = { w: 0, h: 0 }, s = 1, tx = 0, ty = 0, maxS = 3, open = false;
  const T = () => mode === 'slab' ? slabEl : img; // the thing on screen

  function build() {
    // a real <dialog> (v43.3), so it opens above an entry that's already open in its own window instead of behind it
    el = document.createElement('dialog'); el.className = 'zm'; el.setAttribute('aria-label', 'Card art');
    el.innerHTML = '<div class="zm-bg"></div><img class="zm-img" alt="" draggable="false"><div class="zm-slab" hidden></div>' +
      '<div class="zm-sw" role="group" aria-label="Show" hidden><button type="button" data-m="slab">Slab</button><button type="button" data-m="card">Card</button></div>' +
      '<button type="button" class="zm-x" aria-label="Close">' + X + '</button><p class="zm-tip"></p>';
    document.body.appendChild(el); img = el.querySelector('.zm-img');
    slabEl = el.querySelector('.zm-slab'); sw = el.querySelector('.zm-sw');
    // a sideways picture turned upright (js/artrot.js) has new proportions
    img.addEventListener('load', () => { if (open && el.classList.contains('on')) { size(); apply(0); } });
    el.addEventListener('cancel', e => { e.preventDefault(); close(); });
    el.querySelector('.zm-x').addEventListener('click', e => { e.stopPropagation(); close(); });
    sw.addEventListener('pointerdown', e => e.stopPropagation());
    sw.addEventListener('pointerup', e => e.stopPropagation());
    sw.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m, true); });
    wire();
  }
  const apply = (ms) => { const t = T(); t.style.transition = ms ? 'transform ' + ms + 'ms cubic-bezier(.2,.8,.2,1)' : 'none'; t.style.transform = 'translate(-50%,-50%) translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')'; el.classList.toggle('zoomed', s > 1.01); };
  // keep the picture from sliding away past its own edges
  function clamp() { const w = base.w * s, h = base.h * s, mx = Math.max(0, (w - innerWidth) / 2), my = Math.max(0, (h - innerHeight) / 2); tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty)); }
  function zoomAt(ns, cx, cy, ms) { ns = Math.max(1, Math.min(maxS, ns)); const ox = cx - innerWidth / 2 - tx, oy = cy - innerHeight / 2 - ty, k = ns / s; tx -= ox * (k - 1); ty -= oy * (k - 1); s = ns; if (s <= 1.01) { s = 1; tx = 0; ty = 0; } clamp(); apply(ms); }

  function size() {
    // the largest size that fits the screen with a margin, but no larger than the image's own pixels allow
    const ph = innerWidth < 761, dpr = Math.min(window.devicePixelRatio || 1, 2), nw = img.naturalWidth || 600, nh = img.naturalHeight || 840;
    const sharpW = nw / Math.max(1, dpr * .75), pad = ph ? 16 : 56, R = reserve();
    const availW = innerWidth - pad * 2, availH = graded ? innerHeight - R.top - R.bottom : innerHeight - pad * 2 - (ph ? 40 : 0);
    if (mode === 'slab') {
      // the slab fits the screen; the card in its well stays as sharp as the full view would be
      const w = Math.min(availW, availH / SLAB_AR, sharpW / WELL), h = w * SLAB_AR;
      base = { w, h }; slabEl.style.width = w + 'px'; slabEl.style.height = h + 'px';
      maxS = Math.max(2, Math.min(5, (nw / (w * WELL * dpr)) * 2.5));
    } else {
      const fit = Math.min(availW / nw, availH / nh);
      const w = Math.min(nw * fit, sharpW), h = w * nh / nw;
      base = { w, h }; img.style.width = w + 'px'; img.style.height = h + 'px';
      maxS = Math.max(2, Math.min(5, (nw / (w * dpr)) * 2.5));
    }
    img.style.borderRadius = (img.offsetWidth || base.w) * CARD_R + 'px';
    if (graded) sw.style.top = 'calc(50% + ' + (base.h / 2 + 14 + centerY()) + 'px)';
    // v50.52: the tip sits right under the Slab | Card switch (not pinned to the screen bottom, where a browser toolbar or
    // bigger text could push it over the switch); if there's no room below, it stays hidden
    const tp = el.querySelector('.zm-tip');
    if (graded) { const y = innerHeight / 2 + base.h / 2 + 14 + centerY() + (sw.offsetHeight || 40) + 8;
      tp.style.top = y + 'px'; tp.style.bottom = 'auto'; tp.style.display = y + 20 > innerHeight ? 'none' : ''; }
    else { tp.style.top = ''; tp.style.bottom = ''; tp.style.display = ''; }
  }
  // graded: room above for the close button and below for the Slab | Card switch and the tip
  const reserve = () => { const ph = innerWidth < 761; return { top: ph ? 76 : 56, bottom: ph ? 16 + 56 + 36 : 56 + 56 }; };
  const centerY = () => { if (!graded) return 0; const R = reserve(); return (R.top - R.bottom) / 2; };

  function setMode(m, animate) {
    if (!graded || m === mode) return;
    const old = T(); mode = m; s = 1; tx = 0; ty = 0;
    slabEl.hidden = mode !== 'slab'; img.style.visibility = mode === 'card' ? '' : 'hidden';
    sw.querySelectorAll('[data-m]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
    from = mode === 'slab' ? thumbSlab : thumbImg;
    size(); apply(0);
    if (animate && !calm.matches) T().animate([{ opacity: 0, transform: T().style.transform + ' scale(.94)' }, { opacity: 1, transform: T().style.transform }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    tip();
  }
  function tip() {
    const ph = innerWidth < 761;
    el.querySelector('.zm-tip').textContent = graded ? (ph ? 'Tap to flip · pinch to zoom · swipe down to close' : 'Click to zoom · Esc to close') : (ph ? 'Pinch to zoom · swipe down to close' : 'Click to zoom · Esc to close');
  }

  function openZoom(src, thumb) {
    if (!src) return; if (!el) build();
    // a graded card: its slab comes along (cloned from the one you tapped, with the full picture in its well)
    thumbImg = thumb || null; thumbSlab = thumb && thumb.closest ? thumb.closest('.slab') : null; graded = !!thumbSlab;
    slabEl.innerHTML = ''; sw.hidden = !graded; el.classList.toggle('zm-g', graded);
    // v52.78 a sealed product is a cut-out with see-through edges: no dark box, rounded corners or frame behind it
    el.classList.toggle('zm-s', !!((thumb && thumb.closest && thumb.closest('.ct-sealed')) || (window.CTSealedSrc && window.CTSealedSrc.has(src))));
    if (graded) { const c = thumbSlab.cloneNode(true); c.removeAttribute('style'); const ci = c.querySelector('.sl-well img'); if (ci) { ci.removeAttribute('loading'); ci.src = thumb.currentSrc || src; const full = new Image(); full.onload = () => { if (open) ci.src = src; }; full.src = src; } slabEl.appendChild(c); }
    mode = graded ? 'slab' : 'card'; slabEl.hidden = !graded; img.style.visibility = graded ? 'hidden' : '';
    sw.querySelectorAll('[data-m]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
    from = graded ? thumbSlab : thumbImg; s = 1; tx = 0; ty = 0; open = true; tip();
    el.style.setProperty('--zy', centerY() + 'px');
    const show = () => {
      if (!el.open) { try { el.showModal(); } catch (er) { el.setAttribute('open', ''); } } size(); apply(0); el.classList.add('on'); document.documentElement.classList.add('zm-open');
      // grow out of the thumbnail
      if (from && !calm.matches) { const r = from.getBoundingClientRect(); if (r.width) {
        const k = r.width / base.w, dx = r.left + r.width / 2 - innerWidth / 2, dy = r.top + r.height / 2 - innerHeight / 2 - centerY();
        T().animate([{ transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
        frame = frameOf(from); (frame || from).style.opacity = '0'; } }
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
    const t = T(), back = graded ? (mode === 'slab' ? thumbSlab : thumbImg) : from;
    const done = () => { el.classList.remove('on', 'zoomed', 'drag'); if (el.open) el.close(); document.documentElement.classList.remove('zm-open'); [thumbImg, thumbSlab, from, frame].forEach(x => { if (x) x.style.opacity = ''; }); frame = null; el.style.removeProperty('--bg'); };
    const r = back && back.getBoundingClientRect(), vis = r && r.width && r.bottom > 0 && r.top < innerHeight;
    el.classList.add('out');
    if (vis && !calm.matches) {
      if (back !== from && from) { from.style.opacity = ''; if (frame && frame !== back) frame.style.opacity = ''; } const bf = frameOf(back); (bf || back).style.opacity = '0'; if (bf && bf !== frame) { if (frame) frame.style.opacity = ''; frame = bf; }
      const k = r.width / base.w, dx = r.left + r.width / 2 - innerWidth / 2, dy = r.top + r.height / 2 - innerHeight / 2 - centerY();
      const a = t.animate([{ transform: t.style.transform }, { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')' }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      a.onfinish = () => { done(); el.classList.remove('out'); a.cancel(); };
    } else setTimeout(() => { done(); el.classList.remove('out'); }, calm.matches ? 0 : 220);
  }

  function wire() {
    const pts = new Map(); let pinch = null, pan = null, swipe = null, lastTap = 0, moved = false, downImg = false;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.zm-x,.zm-sw')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; downImg = T().contains(e.target); // (pointer capture retargets later events)
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
      // phones: one tap on a graded card flips between the slab and the card (a second tap within 300ms zooms instead)
      else if (onImg && graded && s <= 1.01) setTimeout(() => { if (lastTap === now && open) setMode(mode === 'slab' ? 'card' : 'slab', true); }, 300);
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    // v50.48: desktop zooming that follows your fingers.
    // - Trackpad pinch (the browser sends it as wheel events with ctrlKey): zoom smoothly, in step with the pinch, around the
    //   point under your fingers; a little give past the limits, then it settles back when you stop.
    // - Two-finger scroll on a trackpad: moves the picture around when zoomed in.
    // - A mouse wheel's notches: zoom in or out a step at a time, smoothly.
    // - Safari sends trackpad pinches as gesture events instead; same result.
    // Every change is drawn once per frame, with no animation lag behind the fingers.
    let raf = 0, settleT = 0, gest = null;
    const draw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; apply(0); }); };
    const scaleAt = (ns, cx, cy, soft) => { const lo = soft ? .85 : 1, hi = soft ? maxS * 1.15 : maxS; ns = Math.max(lo, Math.min(hi, ns));
      const ox = cx - innerWidth / 2 - tx, oy = cy - innerHeight / 2 - ty, k = ns / s; tx -= ox * (k - 1); ty -= oy * (k - 1); s = ns; };
    const settle = () => { clearTimeout(settleT); settleT = setTimeout(() => { if (s < 1.01) { s = 1; tx = 0; ty = 0; } else if (s > maxS) s = maxS; clamp(); apply(220); }, 140); };
    el.addEventListener('wheel', e => {
      if (!open) return; e.preventDefault();
      const px = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1, dx = e.deltaX * px, dy = e.deltaY * px;
      if (e.ctrlKey) { scaleAt(s * Math.exp(-dy * .0105), e.clientX, e.clientY, true); draw(); settle(); return; }   // pinch
      const notch = e.deltaMode === 1 || (Math.abs(dy) >= 50 && Math.abs(dx) < 1 && Number.isInteger(e.deltaY));
      if (notch) { zoomAt(s * (dy < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY, 160); return; }                        // mouse wheel
      if (s > 1.01) { tx -= dx; ty -= dy; clamp(); draw(); }                                                          // trackpad scroll: look around
    }, { passive: false });
    el.addEventListener('gesturestart', e => { if (!open) return; e.preventDefault(); gest = { s0: s }; });
    el.addEventListener('gesturechange', e => { if (!open || !gest) return; e.preventDefault(); scaleAt(gest.s0 * e.scale, e.clientX, e.clientY, true); draw(); });
    el.addEventListener('gestureend', e => { if (!gest) return; e.preventDefault(); gest = null; settle(); });
    document.addEventListener('keydown', e => { if (open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }, true);
    addEventListener('resize', () => { if (open) { el.style.setProperty('--zy', centerY() + 'px'); size(); s = Math.min(s, maxS); clamp(); apply(0); } });
  }
  window.CTZoom = { open: openZoom, close: () => close() };
})();
