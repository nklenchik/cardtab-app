/* Sheets and the keyboard on iPhone and iPad (v50.89).
   On iOS the keyboard covers the page instead of shrinking it, so a sheet's text box (Ask, notes, names) ends up behind the
   keyboard, and Safari then scrolls the whole page to dig it out: the jump. Here the sheet makes room itself, the moment the
   text box gets focus (before the keyboard is even up), using the keyboard height measured last time. The sheet gets shorter
   from the bottom, its contents slide up with the keyboard (transform only), and since the text box is already in view Safari
   has nothing to scroll. When the real keyboard size is known the sheet settles to it; when the keyboard goes, it slides back.
   Other phones resize the page for the keyboard on their own, so this only runs on iOS. */
(function () {
  'use strict';
  const vv = window.visualViewport;
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!vv || !IOS) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const TYPE = 'textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]):not([type=color])';
  const SHEET = 'dialog.sheet[open]';
  let kbh = 0; try { kbh = +localStorage.getItem('ct.kbh') || 0; } catch (e) {}
  let on = null, guess = 0;                                         // the sheet making room, and a pending guess's timer
  const panel = d => d.querySelector(':scope > .awp') || d.firstElementChild;
  const kbNow = () => Math.max(0, innerHeight - vv.height - vv.offsetTop);
  const up = () => innerHeight - vv.height > 120;                   // is a keyboard showing

  // move the sheet to a new size, and slide what's inside from where it was to where it lands
  function lay(d, top, h) {
    const p = panel(d); if (!p) return;
    const pt = p.getBoundingClientRect().top;                       // its top edge stays put (no jump of the header)
    const kids = [...p.children].filter(k => !k.matches('.awh')), was = kids.map(k => k.getBoundingClientRect().top);
    const sc = [...p.querySelectorAll('*'), p].filter(el => el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY));
    const pin = sc.map(el => el.scrollHeight - el.scrollTop - el.clientHeight);   // keep lists anchored to the bottom (the newest answer)
    // the Board sizes its sheets from --vvh (the visible height); with no keyboard that's the whole visible area again
    const rest = h == null;
    if (rest) { top = Math.round(vv.offsetTop); h = Math.round(vv.height); }
    d.style.top = top + 'px'; d.style.height = h + 'px'; d.style.setProperty('--vvh', h + 'px');
    // a sheet pinned to the bottom of the screen (Ask on phones) sits on top of the keyboard, a little shorter
    ['bottom', 'height', 'max-height'].forEach(k => p.style.removeProperty(k));
    if (!rest && getComputedStyle(p).position === 'fixed') { const ph = Math.max(220, Math.min(p.offsetHeight, top + h - Math.max(top + 12, pt)));
      p.style.setProperty('bottom', Math.max(0, innerHeight - top - h) + 'px', 'important');
      p.style.setProperty('height', ph + 'px', 'important'); p.style.setProperty('max-height', ph + 'px', 'important'); }
    sc.forEach((el, i) => { if (pin[i] < 40) el.scrollTop = el.scrollHeight; });
    if (calm.matches) return;
    kids.forEach((k, i) => { const dy = was[i] - k.getBoundingClientRect().top; if (Math.abs(dy) > 2) k.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' }); });
  }
  function room(d, kb, top) { on = d; lay(d, top || 0, innerHeight - kb - (top || 0)); }
  function back() { if (!on) return; const d = on; on = null; clearTimeout(guess); lay(d, 0, null); }

  // a text box in a sheet gets focus: make room right away, before the keyboard comes up, so Safari finds the box in view
  // and doesn't scroll the page (done on focus, not on touch, so the tap still lands on the box)
  document.addEventListener('focusin', e => {
    const t = e.target, d = t && t.matches && t.matches(TYPE) && t.closest(SHEET);
    if (!d || d.classList.contains('closing') || t.disabled || t.readOnly) return;
    if (on === d && up()) return;
    room(d, kbh || Math.round(innerHeight * .44));
    // the tap that focused the box hasn't finished: its click comes next, at the spot where the box was. The box has moved up,
    // so that spot is now outside the sheet, and a tap outside closes it. Swallow that one stray click.
    const pn = panel(d), t0 = Date.now(), eat = ev => { if (Date.now() - t0 > 800) return off(); if (!pn || !pn.contains(ev.target)) { ev.preventDefault(); ev.stopImmediatePropagation(); } };
    const off = () => ['click', 'mouseup', 'pointerup', 'touchend'].forEach(k => window.removeEventListener(k, eat, true));
    ['click', 'mouseup', 'pointerup', 'touchend'].forEach(k => window.addEventListener(k, eat, true)); setTimeout(off, 800);
    clearTimeout(guess); guess = setTimeout(() => { if (!up()) back(); }, 1200);
  }, true);

  // the keyboard's real size (and any scroll Safari did anyway): settle to it, and remember it for next time
  function fit() {
    const d = on || document.querySelector(SHEET); if (!d) return;
    const a = document.activeElement;
    if (up() && a && a.matches(TYPE) && d.contains(a)) {
      const kb = innerHeight - vv.height; if (Math.abs(kb - kbh) > 2) { kbh = kb; try { localStorage.setItem('ct.kbh', String(Math.round(kb))); } catch (e) {} }
      const top = Math.round(vv.offsetTop), h = Math.round(vv.height);
      if (on !== d || Math.abs(parseFloat(d.style.top || 0) - top) > 1 || Math.abs(parseFloat(d.style.height || 0) - h) > 1) { on = d; lay(d, top, h); }
    } else if (on && !up()) back();
  }
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
  document.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (on && !(a && a.matches(TYPE) && on.contains(a)) && !up()) back(); }, 250));
  document.addEventListener('close', e => { if (e.target === on) back(); else if (e.target.matches && e.target.matches('dialog.sheet')) lay(e.target, 0, null); }, true);
})();
