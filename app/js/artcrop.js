/* Card art crops in widgets (v42.21; v50.74 trims the side borders and spots secret-rare numbering): show the card's artwork, not its text box.
   Every card keeps its art in about the same band: on Dragon Ball cards roughly 10% to 59% of the way down (Nick's
   measurement), on Pokémon about 10% to 54%. Full-art and alternate-art printings are artwork top to bottom, so their
   band is most of the card. A widget's picture is sized so that band fills the box and is centered in it.
   Works on any element with class qm-bg / glbg (background pictures) or img.fwi (feature tiles), as they appear.
   The card is described by data-meta (card id, card name, entry name), used to tell the game and full-art printings. */
(function () {
  'use strict';
  const FULL = /\((spr|scr|slr|sar|sir|gdr|alt[^)]*|alternate art[^)]*|special[^)]*|secret[^)]*)\)|special illustration|illustration rare|\bart rare|character rare|full art|alt(ernate)? art|secret rare|special rare|special leader|god rare/i;
  // a card numbered past its set's size (199/165) is a secret or special art printing: artwork top to bottom
  const pastSet = t => { const m = t.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/); return !!m && +m[1] > +m[2]; };
  function band(meta) {
    const t = String(meta || '');
    if (FULL.test(t) || pastSet(t)) return [0.165, 0.565];   // below the name bar and the evolution badge (about 6-16% down), above the attack text
    if (/pokemon|pok[eé]mon/i.test(t)) return [0.10, 0.54];
    return [0.096, 0.588];
  }
  // where the picture goes in a W x H box so the band covers the box, centered.
  // v50.74: the card's side borders (about 5% each side) are trimmed too, so the art reaches both edges of the box
  const SIDE = 0.05;
  function layout(W, H, b, aspect, side) {
    const bh = b[1] - b[0], c = (b[0] + b[1]) / 2;
    const iw = Math.max(W / (1 - 2 * (side || 0)), H / (bh * aspect)), ih = iw * aspect;
    const top = Math.min(0, Math.max(H - ih, H / 2 - c * ih));
    return { iw, ih, left: (W - iw) / 2, top };
  }
  function cropBg(el) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const L = layout(r.width, r.height, band(el.dataset.meta), 1.396);
    el.style.backgroundSize = L.iw.toFixed(1) + 'px ' + L.ih.toFixed(1) + 'px';
    el.style.backgroundPosition = L.left.toFixed(1) + 'px ' + L.top.toFixed(1) + 'px';
  }
  function cropImg(img) {
    if (img.dataset.wall === '1' || img.dataset.focus === '1') return;          // your own wallpaper or a set focus: leave it
    const box = img.parentElement; if (!box) return;
    const r = box.getBoundingClientRect(); if (!r.width || !r.height) return;
    const a = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1.396;
    if (a < 1.15) return;                                                          // landscape pictures (sealed products): leave
    const L = layout(r.width, r.height, band(img.dataset.meta), a, SIDE);
    const s = img.style;
    s.setProperty('object-fit', 'fill', 'important'); s.setProperty('inset', 'auto', 'important');
    s.setProperty('width', L.iw.toFixed(1) + 'px', 'important'); s.setProperty('height', L.ih.toFixed(1) + 'px', 'important');
    s.setProperty('left', L.left.toFixed(1) + 'px', 'important'); s.setProperty('top', L.top.toFixed(1) + 'px', 'important');
    s.setProperty('max-width', 'none', 'important'); s.setProperty('transform', 'none', 'important');
  }
  const ro = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => { const f = e.target._ctCrop; if (f) f(); })) : null;
  function take(el) {
    if (el._ctCropOn) return; el._ctCropOn = 1;
    if (el.tagName === 'IMG') {
      const box = el.parentElement, go = () => cropImg(el);
      if (el.complete && el.naturalWidth) go(); else el.addEventListener('load', go, { once: true });
      if (box && ro) { box._ctCrop = go; ro.observe(box); }
    } else { const go = () => cropBg(el); go(); if (ro) { el._ctCrop = go; ro.observe(el); } }
  }
  const SEL = '.qm-bg, .glbg, img.fwi';
  function scan(root) { (root || document).querySelectorAll(SEL).forEach(take); }
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches(SEL)) take(n); if (n.querySelectorAll) scan(n); } })
    .observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') scan(); else document.addEventListener('DOMContentLoaded', () => scan());
  window.CTArtCrop = { scan, band, layout };
})();
