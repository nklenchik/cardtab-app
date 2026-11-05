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
  let lastY = window.scrollY, tick = false, on = false;
  function set(v) { if (v === on) return; on = v; bar.classList.toggle('on', v); bar.setAttribute('aria-hidden', String(!v)); q.tabIndex = bar.lastChild.tabIndex = v ? 0 : -1; }
  function update() {
    tick = false; const y = window.scrollY;
    const off = !PH.matches || document.documentElement.classList.contains('cbopen') || ($('view-app') && $('view-app').hidden);
    if (off) { set(false); lastY = y; return; }
    if (head.getBoundingClientRect().bottom > 0) set(false);           // the real header is still on screen
    else if (document.activeElement === q) set(true);                 // never slide away while you're typing in it
    else if (y > lastY + 6) set(false);                               // reading down: tuck it away
    else if (y < lastY - 6) set(true);                                // a little scroll up: bring it back
    if (Math.abs(y - lastY) > 6) lastY = y;
  }
  window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
  PH.addEventListener ? PH.addEventListener('change', update) : PH.addListener(update);
})();
