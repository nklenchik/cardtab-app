/* Sealed product cut-outs (v52.78). Store photos of packs, boxes and ETBs sit on a plain white (or near-white) backdrop.
   For sealed entries the picture is cut out once in the browser: the backdrop touching the edges is made see-through
   (a flood fill from the border, so white inside the artwork stays), the edge is softened by a pixel, and the empty
   margin is trimmed, so the product itself stands on the page in its own shape. Photos without a plain backdrop are
   left as they are. The cut-out is kept for the visit, and swaps in when it's ready, so nothing jumps. */
(function () {
  'use strict';
  const done = new Map(), busy = new Map(), MAX = 640;
  const SEL = '.ct-sealed img, img.ct-card-art.ct-sealed, img.ct-sealed';
  function cut(src) {
    if (done.has(src)) return Promise.resolve(done.get(src));
    if (busy.has(src)) return busy.get(src);
    const p = (async () => {
      try {
        const r = await fetch(src, { mode: 'cors', credentials: 'omit' }); if (!r.ok) throw 0;
        const bmp = await createImageBitmap(await r.blob());
        const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height)), W = Math.max(1, Math.round(bmp.width * k)), H = Math.max(1, Math.round(bmp.height * k));
        const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, W, H);
        const im = g.getImageData(0, 0, W, H), d = im.data, N = W * H;
        // the backdrop colour: what most of the border is (only light, low-colour backdrops count)
        let br = 0, bg = 0, bb = 0, bn = 0, ok = 0;
        const edge = i => { const o = i * 4; if (d[o + 3] < 20) { ok++; return; } const r0 = d[o], g0 = d[o + 1], b0 = d[o + 2], mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0); if (mx > 214 && mx - mn < 26) { br += r0; bg += g0; bb += b0; bn++; ok++; } };
        for (let x = 0; x < W; x++) { edge(x); edge((H - 1) * W + x); } for (let y = 0; y < H; y++) { edge(y * W); edge(y * W + W - 1); }
        // a plain backdrop shows at three or more corners and along a good part of the border (a pack can fill the width)
        const lightAt = (x, y) => { const o = (y * W + x) * 4; if (d[o + 3] < 20) return true; const mx = Math.max(d[o], d[o + 1], d[o + 2]), mn = Math.min(d[o], d[o + 1], d[o + 2]); return mx > 214 && mx - mn < 26; };
        const corners = [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]].filter(([x, y]) => lightAt(Math.max(0, x), Math.max(0, y))).length;
        const per = 2 * (W + H); if (ok < per * (corners >= 3 ? 0.2 : 0.28)) { done.set(src, ''); return ''; }   // no plain backdrop: leave the photo alone
        const R = bn ? br / bn : 255, G = bn ? bg / bn : 255, B = bn ? bb / bn : 255, T = 34 * 34;
        const near = o => { if (d[o + 3] < 20) return true; const dr = d[o] - R, dg = d[o + 1] - G, db = d[o + 2] - B; return dr * dr + dg * dg + db * db < T; };
        // flood fill from every border pixel that matches the backdrop
        const out = new Uint8Array(N), st = new Int32Array(N); let sp = 0;
        const push = i => { if (!out[i] && near(i * 4)) { out[i] = 1; st[sp++] = i; } };
        for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
        while (sp) { const i = st[--sp], x = i % W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < N - W) push(i + W); }
        let gone = 0; for (let i = 0; i < N; i++) gone += out[i];
        if (gone < N * 0.03 || gone > N * 0.9) { done.set(src, ''); return ''; }   // nothing to cut, or it would cut the product away
        // see-through backdrop, and a one-pixel soft edge so the outline isn't jagged
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, o = i * 4;
          if (out[i]) { d[o + 3] = 0; continue; }
          const nb = (x > 0 && out[i - 1]) + (x < W - 1 && out[i + 1]) + (y > 0 && out[i - W]) + (y < H - 1 && out[i + W]);
          if (nb) d[o + 3] = Math.round(d[o + 3] * (1 - nb * 0.16));
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        g.putImageData(im, 0, 0);
        // trim the empty margin
        const tw = x1 - x0 + 1, th = y1 - y0 + 1, t = document.createElement('canvas'); t.width = tw; t.height = th; t.getContext('2d').drawImage(c, x0, y0, tw, th, 0, 0, tw, th);
        const blob = await new Promise(res => t.toBlob(res, 'image/webp', .9));
        const url = blob ? URL.createObjectURL(blob) : ''; done.set(src, url);
        if (url) { const S = window.CTSealedSrc || (window.CTSealedSrc = new Set()); S.add(url); }
        return url;
      } catch (e) { done.set(src, ''); return ''; } finally { busy.delete(src); }
    })();
    busy.set(src, p); return p;
  }
  function check(img) {
    if (!img || img.tagName !== 'IMG' || !img.matches(SEL)) return;
    const src = img.currentSrc || img.src; if (!src || src.startsWith('blob:') || src.startsWith('data:') || img.dataset.cut === src) return;
    img.dataset.cut = src;
    if (done.has(src)) { const u = done.get(src); if (u) { img.src = u; img.classList.add('ct-cut'); } else img.classList.add('ct-nocut'); return; }
    cut(src).then(u => { if (img.isConnected && (img.currentSrc === src || img.src === src)) { if (u) { img.src = u; img.classList.add('ct-cut'); } else img.classList.add('ct-nocut'); } });
  }
  document.addEventListener('load', e => { if (e.target && e.target.tagName === 'IMG') check(e.target); }, true);
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue;
    const imgs = n.tagName === 'IMG' ? [n] : n.querySelectorAll ? n.querySelectorAll('img') : [];
    for (const img of imgs) { if (!img.matches(SEL)) continue; const s = img.getAttribute('src'), abs = s && new URL(s, location.href).href, u = abs && done.get(abs);
      if (u) { img.dataset.cut = abs; img.src = u; img.classList.add('ct-cut'); } else if (img.complete && img.naturalWidth) check(img); } } })
    .observe(document.documentElement, { childList: true, subtree: true });
  window.CTCutout = { cut };
})();
