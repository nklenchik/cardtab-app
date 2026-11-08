/* Your own card photo (v50.46). From Change card (or Match your card): pick or take a photo, line the card up in a
   card-shaped frame (drag the corners to the card's edges; Straighten turns the frame), and it's squared up and trimmed
   to the card in the browser. It's saved at the same two sizes auto-fill art uses (640 and 240 wide), as WebP where the
   browser can make it (else JPEG), and shows on the entry straight away.
   Sharp photos of cards picked from the search can also be shared as the card's default art: the server runs an automatic
   check first; a pass becomes the default for everyone whose card has no art, anything flagged waits for a quick review. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const AR = 88 / 63, OUT_W = 640, LIST_W = 240, SHARE_W = 600, MAX_SRC = 2400;
  const API = () => window.CARDTAB_API || '';
  const toast = t => window.CTDash && window.CTDash.toast && window.CTDash.toast(t);
  let d = null, entry = null, onDone = null, src = null, srcData = null, quad = null, view = null, ang = 0, out = null;

  function build() {
    d = document.createElement('dialog'); d.className = 'au'; d.setAttribute('aria-label', 'Your card photo');
    d.innerHTML =
      '<div class="au-crop" id="au-crop"><div class="au-top"><button type="button" data-au="cancel">Cancel</button><b>Line up your card</b><button type="button" data-au="reset" class="au-dim">Reset</button></div>' +
        '<div class="au-stage" id="au-stage" data-nodrag><canvas id="au-cv"></canvas>' +
          '<i class="au-h" data-h="0"></i><i class="au-h" data-h="1"></i><i class="au-h" data-h="2"></i><i class="au-h" data-h="3"></i></div>' +
        '<p class="au-tip">Drag the corners to the card’s edges</p>' +
        '<label class="au-sl"><span>Straighten</span><input type="range" id="au-ang" min="-15" max="15" step="0.5" value="0" data-nodrag><span id="au-angv">0°</span></label>' +
        '<button type="button" class="au-go" data-au="use">Use photo</button></div>' +
      '<div class="au-save" id="au-save" hidden><div class="au-sheet"><i class="au-grab" aria-hidden="true"></i><div class="au-hd"><h2>Your photo</h2><button type="button" class="ed-x" data-au="cancel" aria-label="Close">✕</button></div>' +
        '<div class="au-prev"><img id="au-img" alt=""><div><b id="au-nm"></b><small id="au-set"></small><span id="au-q"></span></div></div>' +
        '<label class="au-chk" id="au-shr"><input type="checkbox" id="au-share" checked><span class="au-box" aria-hidden="true"></span><span><b>Share as this card’s default</b><small>Card Tab can show this image as this card’s default art. Thanks for filling the gap.</small></span></label>' +
        '<p class="au-err" id="au-err" hidden></p>' +
        '<button type="button" class="au-go" data-au="save" id="au-savebtn">Save</button><button type="button" class="au-ghost" data-au="retake">Retake</button></div></div>' +
      '';
    document.body.appendChild(d);
    // the photo picker (a file input inside a closed <dialog> won't open)
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.id = 'au-file'; fi.hidden = true; document.body.appendChild(fi);
    d.addEventListener('cancel', e => { e.preventDefault(); close(); });
    d.addEventListener('click', e => { const b = e.target.closest('[data-au]'); if (!b) return; const a = b.dataset.au;
      if (a === 'cancel') close(); else if (a === 'reset') { ang = 0; $('au-ang').value = 0; $('au-angv').textContent = '0°'; quad = startQuad(); paint(); }
      else if (a === 'use') makeCard(); else if (a === 'retake') pick(); else if (a === 'save') save(); });
    $('au-file').addEventListener('change', () => { const f = $('au-file').files[0]; $('au-file').value = ''; if (f) load(f); });
    $('au-ang').addEventListener('input', () => { const v = +$('au-ang').value; rotateQuad(v - ang); ang = v; $('au-angv').textContent = (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '°'; paint(); });
    wireDrag(); addEventListener('resize', () => { if (d.open && !$('au-crop').hidden) layout(); });
  }
  function close() { if (d && d.open) d.close(); document.documentElement.classList.remove('au-open'); }
  // an open window makes everything outside it inert, so the picker moves into the window on top before it's clicked
  function pick() { const fi = $('au-file'), top = [...document.querySelectorAll('dialog[open]')].pop(); (top || document.body).appendChild(fi); fi.click(); }

  // ---- loading the photo (the browser applies the camera's rotation when it decodes) ----
  function load(file) {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, MAX_SRC / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url); src = c; srcData = null; ang = 0; $('au-ang').value = 0; $('au-angv').textContent = '0°';
      $('au-crop').hidden = false; $('au-save').hidden = true;
      if (!d.open) { d.showModal(); document.documentElement.classList.add('au-open'); }
      quad = startQuad(); layout();
    };
    im.onerror = () => { URL.revokeObjectURL(url); toast('That photo couldn’t be opened. Try a JPEG or PNG.'); };
    im.src = url;
  }
  // a card-shaped frame in the middle; a photo that's already card-shaped (a scan) starts on its edges
  function startQuad() {
    const W = src.width, H = src.height, a = H / W;
    if (Math.abs(a - AR) / AR < .025) { const m = Math.min(W, H) * .01; return [[m, m], [W - m, m], [W - m, H - m], [m, H - m]]; }
    let h = H * .8, w = h / AR; if (w > W * .8) { w = W * .8; h = w * AR; }
    const x = (W - w) / 2, y = (H - h) / 2; return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }
  function rotateQuad(deg) {
    const r = deg * Math.PI / 180, cx = quad.reduce((t, p) => t + p[0], 0) / 4, cy = quad.reduce((t, p) => t + p[1], 0) / 4, co = Math.cos(r), si = Math.sin(r);
    quad = quad.map(([x, y]) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co]).map(clampPt);
  }
  const clampPt = ([x, y]) => [Math.max(0, Math.min(src.width, x)), Math.max(0, Math.min(src.height, y))];

  // ---- drawing the photo and the frame ----
  function layout() {
    const st = $('au-stage'), r = st.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), pad = 22;
    const k = Math.min((r.width - pad * 2) / src.width, (r.height - pad * 2) / src.height), w = src.width * k, h = src.height * k;
    view = { k, ox: (r.width - w) / 2, oy: (r.height - h) / 2, w: r.width, h: r.height };
    const cv = $('au-cv'); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    view.dpr = dpr; view.iw = w; view.ih = h; paint();
  }
  const toV = ([x, y]) => [view.ox + x * view.k, view.oy + y * view.k];
  const toS = (x, y) => clampPt([(x - view.ox) / view.k, (y - view.oy) / view.k]);
  function paint() {
    if (!view) return; const P = quad.map(toV), g = $('au-cv').getContext('2d');
    // the photo, the world outside the frame dimmed, and the frame
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); g.clearRect(0, 0, view.w, view.h); g.imageSmoothingQuality = 'high'; g.drawImage(src, view.ox, view.oy, view.iw, view.ih);
    g.beginPath(); g.rect(0, 0, view.w, view.h); g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < 4; i++) g.lineTo(P[i][0], P[i][1]); g.closePath();
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fill('evenodd');
    g.beginPath(); g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < 4; i++) g.lineTo(P[i][0], P[i][1]); g.closePath(); g.lineWidth = 2; g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.stroke();
    d.querySelectorAll('.au-h').forEach((h, i) => { h.style.transform = 'translate(' + P[i][0] + 'px,' + P[i][1] + 'px)'; });
  }
  function wireDrag() {
    const st = d.querySelector('#au-stage'); let drag = null;
    st.addEventListener('pointerdown', e => {
      const r = st.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, P = quad.map(toV);
      let hi = -1, best = 34; P.forEach((p, i) => { const dd = Math.hypot(p[0] - x, p[1] - y); if (dd < best) { best = dd; hi = i; } });
      if (hi < 0 && !inside(P, x, y)) return;
      e.preventDefault(); try { st.setPointerCapture(e.pointerId); } catch (er) {}
      drag = { hi, x, y, q0: quad.map(p => p.slice()), r };
    });
    st.addEventListener('pointermove', e => { if (!drag) return; const x = e.clientX - drag.r.left, y = e.clientY - drag.r.top;
      if (drag.hi >= 0) quad[drag.hi] = toS(x, y);
      else { const dx = (x - drag.x) / view.k, dy = (y - drag.y) / view.k; quad = drag.q0.map(([a, b]) => clampPt([a + dx, b + dy])); }
      paint(); });
    const up = () => { drag = null; }; st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  }
  function inside(P, x, y) { let c = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }

  // ---- squaring it up: map the card-shaped output onto the four corners (a perspective warp), sampled smoothly ----
  function homography(q) { // unit square -> quad
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q, dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0];
    const den = dx1 * dy2 - dx2 * dy1, g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  }
  function warp(q, W, H) {
    if (!srcData) srcData = src.getContext('2d').getImageData(0, 0, src.width, src.height);
    const S0 = srcData.data, sw = src.width, sh = src.height, [a, b, c, dd, e, f, g, h] = homography(q);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g2 = cv.getContext('2d'), img = g2.createImageData(W, H), O = img.data;
    for (let j = 0; j < H; j++) { const v = (j + .5) / H;
      for (let i = 0; i < W; i++) { const u = (i + .5) / W, z = g * u + h * v + 1, x = (a * u + b * v + c) / z - .5, y = (dd * u + e * v + f) / z - .5;
        const x0 = Math.max(0, Math.min(sw - 2, Math.floor(x))), y0 = Math.max(0, Math.min(sh - 2, Math.floor(y))), fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
        const p = (y0 * sw + x0) * 4, q2 = p + sw * 4, o = (j * W + i) * 4;
        for (let k = 0; k < 3; k++) O[o + k] = (S0[p + k] * (1 - fx) + S0[p + 4 + k] * fx) * (1 - fy) + (S0[q2 + k] * (1 - fx) + S0[q2 + 4 + k] * fx) * fy;
        O[o + 3] = 255; } }
    g2.putImageData(img, 0, 0); return cv;
  }
  const down = (cv, W) => { const H = Math.round(W * AR), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, W, H); return c; };
  const enc = (cv, q) => new Promise(res => cv.toBlob(b => { if (b && b.type === 'image/webp') res(b); else cv.toBlob(res, 'image/jpeg', .86); }, 'image/webp', q));

  async function makeCard() {
    const top = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]), bot = Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1]);
    const qw = (top + bot) / 2, W = Math.max(120, Math.min(OUT_W, Math.round(qw)));
    const big = warp(quad, Math.min(Math.round(qw), W * 2), Math.round(Math.min(Math.round(qw), W * 2) * AR)); // a little extra detail, then shrink smoothly
    const detail = down(big, W), list = down(detail, Math.min(LIST_W, W));
    const [bd, bl] = await Promise.all([enc(detail, .82), enc(list, .78)]);
    out = { bd, bl, w: W, url: URL.createObjectURL(bd) };
    const sharp = W >= SHARE_W, canShare = sharp && !!(entry && entry.cardId) && !!API();
    $('au-img').src = out.url; $('au-nm').textContent = (entry && (entry.cardName || entry.name) || '').split(' - ')[0];
    $('au-set').textContent = entry && entry.cardName ? entry.cardName.split(' - ').slice(1).join(' · ') : '';
    $('au-q').className = sharp ? 'au-ok' : 'au-meh'; $('au-q').textContent = sharp ? (canShare ? '✓ Sharp enough to share' : '✓ Sharp and clear') : 'Fine for your entry. Sharing needs a sharper photo.';
    $('au-shr').hidden = !canShare; $('au-share').checked = canShare; $('au-err').hidden = true; $('au-savebtn').disabled = false; $('au-savebtn').textContent = 'Save';
    $('au-crop').hidden = true; $('au-save').hidden = false;
  }

  async function save() {
    if (!out || !entry) return; const b = $('au-savebtn'); b.disabled = true; b.textContent = 'Saving…'; $('au-err').hidden = true;
    const share = !$('au-shr').hidden && $('au-share').checked;
    try {
      let art, res = null;
      if (API()) {
        const fd = new FormData(); fd.set('detail', out.bd, 'detail'); fd.set('list', out.bl, 'list');
        if (entry.cardId) fd.set('card', entry.cardId); fd.set('name', entry.cardName || entry.name || ''); if (share) fd.set('share', '1');
        const r = await fetch(API() + '/api/art/upload', { method: 'POST', credentials: 'include', body: fd }); res = await r.json().catch(() => ({}));
        if (!r.ok || !res.ok) throw new Error(res.error || 'That didn’t save. Try again.');
        art = { list: API() + res.art.list, detail: API() + res.art.detail };
      } else { // previews without the server: keep the picture on this device only
        const rd = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
        art = { list: await rd(out.bl), detail: await rd(out.bd) };
      }
      await window.CTStore._artPatch(entry.id, { art, artFrom: 'upload', artV2: 1 });
      if (window.CTArtFill && window.CTArtFill.learn) window.CTArtFill.learn(entry);
      const st = res && res.share && res.share.status, nm = (entry.cardName || entry.name || '').split(' - ')[0];
      close(); if (onDone) onDone();
      toast(st === 'shared' ? 'Saved, and shared. Your photo is now the default art for ' + nm + '.' : st === 'review' ? 'Saved to your entry. Sharing takes a quick review first.' : 'Saved to your entry.');
    } catch (e) { $('au-err').textContent = e.message || 'That didn’t save. Try again.'; $('au-err').hidden = false; b.disabled = false; b.textContent = 'Save'; }
  }

  window.CTArtUpload = {
    // call from a tap (the photo picker only opens from one)
    open(e, done) { if (!d) build(); entry = (window.CTStore.get(e.id)) || e; onDone = done || null; pick(); }
  };
})();
