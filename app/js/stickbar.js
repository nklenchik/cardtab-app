/* Phones: once the header has scrolled away, scrolling up brings back a slim bar with search and the round +,
   sliding like the marketing site's header (in over 0.8s, away over 0.8s). Scrolling down tucks it away again. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), PH = matchMedia('(max-width:760px)');
  const real = $('ct-search'), add = $('ct-add'), head = document.querySelector('.ct-demo-top');
  if (!real || !add || !head) return;
  const bar = document.createElement('div');
  bar.className = 'ct-stick'; bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<label class="ct-search ct-stick-q"><svg class="ct-qicon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.5-4.5"/></svg>' +
    '<input type="search" placeholder="Search cards" aria-label="Search cards, sets and platforms" autocomplete="off" enterkeyhint="search" tabindex="-1"></label>' +
    '<button type="button" class="ct-add ct-stick-add" aria-label="Add New" tabindex="-1"><svg class="ct-ic" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>';
  document.body.appendChild(bar);
  const q = bar.querySelector('input');
  // the bar's search is the same search: typing in either one updates the list
  q.addEventListener('input', () => { real.value = q.value; real.dispatchEvent(new Event('input', { bubbles: true })); });
  real.addEventListener('input', () => { if (q.value !== real.value) q.value = real.value; });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') q.blur(); });
  bar.querySelector('.ct-stick-add').addEventListener('click', () => add.click());
  const realPill = head.querySelector('.ct-search'), barPill = bar.querySelector('.ct-stick-q');
  let lastY = window.scrollY, tick = false, on = false;
  function set(v, snap) {
    if (v === on) return; on = v;
    if (snap) { bar.classList.add('snap'); requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.remove('snap'))); }
    bar.classList.toggle('on', v); bar.setAttribute('aria-hidden', String(!v)); q.tabIndex = bar.lastChild.tabIndex = v ? 0 : -1;
    // while the bar is out, the header's own search and + step aside, so there is only ever one of each on screen
    head.classList.toggle('stick-away', v);
    if (!v) bar.style.setProperty('--dock', 0);
  }
  function update() {
    tick = false; const y = window.scrollY;
    const off = !PH.matches || document.documentElement.classList.contains('cbopen') || ($('view-app') && $('view-app').hidden);
    if (off) { set(false, true); lastY = y; return; }
    const rTop = realPill.getBoundingClientRect().top, bTop = barPill.getBoundingClientRect().top;
    if (on) {
      // scrolling back to the top: the bar's background melts away as the header comes down to meet it, and the
      // moment the header's search lines up with the bar's, they swap in place: the bar becomes the header
      bar.style.setProperty('--dock', Math.max(0, Math.min(1, 1 - (bTop - rTop) / 70)).toFixed(3));
      if (rTop >= bTop - 0.5) { set(false, true); lastY = y; return; }
    }
    if (rTop + realPill.offsetHeight > 0) { if (!on) { lastY = y; return; } }  // the header's search is still on screen
    if (document.activeElement === q) set(true);                      // never slide away while you're typing in it
    else if (y > lastY + 6) set(false);                               // reading down: tuck it away
    else if (y < lastY - 6) set(true);                                // a little scroll up: bring it back
    if (Math.abs(y - lastY) > 6) lastY = y;
  }
  window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
  PH.addEventListener ? PH.addEventListener('change', update) : PH.addListener(update);
})();
