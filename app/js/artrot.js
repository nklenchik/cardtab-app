/* Sideways card art (v50.45). Some card pictures come in landscape (a vertical card scanned on its side). Wherever a card
   picture is shown as a card (list rows, grid tiles, the details panel, slabs, zoom, Board widgets), a landscape picture
   is turned 90° to the right once, in the browser, and the turned copy is used from then on (this visit). The page
   always lays out the card-shaped box first, so nothing jumps; the picture swaps in when it's ready. */
(function () {
  'use strict';
  const SEL = 'img.ct-card-art,.ct-tile-art img,.gp-art img,.sl-well img,img.zm-img,img.xart,img.xsart,img.xai,img.pimg';
  const done = new Map();   // original src -> turned copy (a blob: URL), or '' when the picture is upright or can't be turned
  const busy = new Map();   // original src -> promise
  const isArt = el => el && el.tagName === 'IMG' && el.matches(SEL) && !el.matches('.ct-sealed,.ct-sealed img') && !(window.CTSealedSrc && window.CTSealedSrc.has(el.getAttribute('src')))   /* v52.75 sealed products stay as they are */;

  function turn(src) {
    if (done.has(src)) return Promise.resolve(done.get(src));
    if (busy.has(src)) return busy.get(src);
    const p = (async () => {
      try {
        const r = await fetch(src, { mode: 'cors', credentials: 'omit' }); if (!r.ok) throw 0;
        const bmp = await createImageBitmap(await r.blob());
        if (!(bmp.width > bmp.height * 1.08)) { done.set(src, ''); return ''; }
        const c = document.createElement('canvas'); c.width = bmp.height; c.height = bmp.width;
        const g = c.getContext('2d'); g.translate(c.width, 0); g.rotate(Math.PI / 2); g.drawImage(bmp, 0, 0);
        const blob = await new Promise(res => c.toBlob(res, 'image/webp', .9));
        const url = blob ? URL.createObjectURL(blob) : ''; done.set(src, url); return url;
      } catch (e) { done.set(src, ''); return ''; } finally { busy.delete(src); }
    })();
    busy.set(src, p); return p;
  }
  function check(img) {
    if (!isArt(img) || img.dataset.rotOf === img.currentSrc) return;
    const src = img.currentSrc || img.src; if (!src || src.startsWith('blob:') || src.startsWith('data:')) return;
    if (done.has(src)) { const u = done.get(src); if (u) { img.dataset.rotOf = u; img.src = u; } return; }
    if (!(img.naturalWidth > img.naturalHeight * 1.08)) return;   // only landscape pictures are worth a look
    turn(src).then(u => { if (u && (img.currentSrc === src || img.src === src)) { img.dataset.rotOf = u; img.src = u; } });
  }
  // every picture that finishes loading anywhere on the page (load doesn't bubble, so listen while it's captured)
  document.addEventListener('load', e => { if (e.target && e.target.tagName === 'IMG') check(e.target); }, true);
  // pictures already turned once swap in straight away when they're drawn again (a list redraw, a tab switch)
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue;
    const imgs = n.tagName === 'IMG' ? [n] : n.querySelectorAll ? n.querySelectorAll('img') : [];
    for (const img of imgs) { const s = img.getAttribute('src'); const u = s && done.get(new URL(s, location.href).href); if (u && isArt(img)) { img.dataset.rotOf = u; img.src = u; } else if (img.complete && img.naturalWidth) check(img); } } })
    .observe(document.documentElement, { childList: true, subtree: true });
  window.CTArtRot = { turn, check };
})();
/* v50.49 (v50.50: also the zoom viewer, which holds the pointer so the click lands on the viewer, not the picture): no "Save image" from right-click or long-press on any picture in the app, and pictures can't be dragged out */
(function () {
  // anything with a picture under the pointer counts (a viewer holding the pointer, or a layer over the art, can hide which one was clicked)
  const pic = e => { const t = e.target; if (t && t.closest && (t.tagName === 'IMG' || t.closest('.zm,.slab,.zm-slab,.fw,.ct-tile-art,.gp-art,.ct-card-art,.au-stage'))) return true;
    if (t && t.closest && t.closest('input,textarea,[contenteditable]')) return false;
    // pictures that let clicks pass through (pointer-events:none) don't show up as the target: look for one under the pointer nearby
    const hit = el => { const r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
    for (let el = t, n = 0; el && el.querySelectorAll && n < 4; el = el.parentElement, n++) if ([...el.querySelectorAll('img,canvas')].some(hit)) return true;
    return false; };
  window.addEventListener('contextmenu', e => { if (pic(e)) e.preventDefault(); }, true);
  document.addEventListener('dragstart', e => { if (e.target && e.target.tagName === 'IMG') e.preventDefault(); }, true);
})();
