/* Phones (v35.8): the top row (logo, Card Tab, avatar) stays where it is while the page scrolls under it, the way the
   Settings or Photos header does on an iPhone. As content passes under it, a frosted background fades in; once the big
   search bar has scrolled away, a search icon fades into the row. Tapping it opens search right in the row.
   There is only ever one copy of anything on screen: at the very top the real header shows; the moment you scroll,
   this row takes over in exactly the same spot, so nothing jumps, slides over, or doubles up. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), PH = matchMedia('(max-width:760px)');
  const real = $('ct-search'), head = document.querySelector('.ct-demo-top'), brand = head && head.querySelector('.ct-brand'), av = $('app-avatar');
  if (!real || !head || !brand || !av) return;
  const realPill = head.querySelector('.ct-search');
  const bar = document.createElement('div');
  bar.className = 'ct-phead'; bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<div class="ph-row"><span class="ph-brand"></span><div class="ph-r"><button type="button" class="ph-q" aria-label="Search" tabindex="-1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg></button></div></div>' +
    '<label class="ph-field"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg><input type="search" placeholder="Search all months" aria-label="Search cards, sets and platforms" autocomplete="off" enterkeyhint="search" tabindex="-1"><button type="button" class="ph-x" aria-label="Close search">Cancel</button></label>';
  bar.querySelector('.ph-brand').innerHTML = brand.innerHTML;
  document.body.appendChild(bar);
  const q = bar.querySelector('.ph-field input'), qBtn = bar.querySelector('.ph-q');

  // line the row up with the real header row, so the hand-off is pixel-exact
  function align() {
    if (!PH.matches) return;
    const y = window.scrollY, br = brand.getBoundingClientRect(), ar = av.getBoundingClientRect(), cs = getComputedStyle(brand);
    bar.style.setProperty('--ph-top', (br.top + y + br.height / 2).toFixed(1) + 'px');
    bar.style.setProperty('--ph-avtop', (ar.top + y + ar.height / 2).toFixed(1) + 'px');
    const pb = bar.querySelector('.ph-brand'); Object.assign(pb.style, { fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, gap: cs.gap, fontFamily: cs.fontFamily, color: cs.color });
    bar.style.setProperty('--ph-left', Math.round(br.left) + 'px');
    bar.style.setProperty('--ph-right', Math.round(innerWidth - ar.right) + 'px');
    bar.style.setProperty('--ph-av', Math.round(ar.width) + 'px');
  }
  let on = null, tick = false, searching = false;
  function update() {
    tick = false;
    const off = !PH.matches || document.documentElement.classList.contains('cbopen') || ($('view-app') && $('view-app').hidden);
    const y = off ? 0 : window.scrollY, v = y > 0.5 || searching;
    if (v !== on) { on = v; bar.classList.toggle('on', v); head.classList.toggle('ph-away', v); bar.setAttribute('aria-hidden', String(!v)); bar.querySelectorAll('button,input').forEach(x => { x.tabIndex = v ? 0 : -1; }); }
    // the frosted background fades in over the first few pixels of scroll
    bar.style.setProperty('--ph-bg', Math.min(1, y / 18).toFixed(3));
    // the search icon fades in as the big search bar slides up under the row
    const pr = realPill.getBoundingClientRect(), rowB = bar.getBoundingClientRect().height;
    const k = Math.max(0, Math.min(1, (rowB - pr.top) / Math.max(1, pr.height)));
    bar.style.setProperty('--ph-q', k.toFixed(3)); qBtn.style.pointerEvents = k > .6 ? 'auto' : 'none';
  }
  const kick = () => { if (!tick) { tick = true; requestAnimationFrame(update); } };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { align(); kick(); });
  PH.addEventListener ? PH.addEventListener('change', () => { align(); kick(); }) : PH.addListener(() => { align(); kick(); });
  new MutationObserver(kick).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  setTimeout(() => { align(); update(); }, 300); setTimeout(align, 1200);

  // search inside the row: the logo and buttons step aside and the field takes their place (same search as the big bar)
  function openQ() { searching = true; bar.classList.add('q-on'); q.value = real.value; update(); q.focus({ preventScroll: true }); }
  function closeQ() { searching = false; bar.classList.remove('q-on'); q.blur(); kick(); }
  qBtn.addEventListener('click', openQ);
  bar.querySelector('.ph-x').addEventListener('click', e => { e.preventDefault(); if (q.value) { q.value = ''; q.dispatchEvent(new Event('input')); } closeQ(); });
  q.addEventListener('input', () => { real.value = q.value; real.dispatchEvent(new Event('input', { bubbles: true })); });
  real.addEventListener('input', () => { if (q.value !== real.value) q.value = real.value; });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') q.blur(); if (e.key === 'Escape') closeQ(); });
})();
