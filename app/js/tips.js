/* First-time tips (v52.25): one short tip per page, the first time it matters, then never again.
   Entries: tap an entry to open it (once you have one). Ask: the ✦ button (on a later visit than the Entries tip).
   Stories: how to play and move through a story. Board: press and hold to move or resize (that tip lives in board.js and asks
   here first). Rules: one tip on screen at a time, never over a sheet or menu, a beat after the page settles; "Got it" retires
   that tip, "Don't show tips" retires them all. Settings → Help → "Show tips again" brings them back.
   What's been seen is kept in ct.tips, which follows the account (prefs.js), so a second phone doesn't repeat them. */
(function () {
  'use strict';
  const K = 'ct.tips', S = window.CTStore;
  const get = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } };
  const put = v => { try { localStorage.setItem(K, JSON.stringify(v)); } catch (e) {} };
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const tap = () => matchMedia('(hover:hover) and (pointer:fine)').matches ? 'Click' : 'Tap';   // the right word for a mouse or a finger
  let cur = null, shownThisVisit = 0, active = null;   // active: closes the tip on screen
  const busy = () => !!document.querySelector('dialog[open]') || (document.getElementById('app-menu') && !document.getElementById('app-menu').hidden) || !!document.querySelector('.sk:not([hidden]), .pdw:not([hidden])');
  const T = window.CTPageTips = {
    off: () => !!get().off,
    seen: id => !!(get().seen || {})[id],
    // may this tip show now?
    allow(id) { return !T.off() && !T.seen(id) && !cur && !busy(); },
    begin(id) { cur = id; shownThisVisit++; },
    end(id, retire) { if (cur === id) cur = null; if (retire) { const s = get(); s.seen = Object.assign({}, s.seen, { [id]: 1 }); put(s); } },
    offAll() { const s = get(); s.off = 1; put(s); cur = null; },
    reset() { put({}); try { localStorage.removeItem('cb.hint'); } catch (e) {} },
    get visits() { return shownThisVisit; },
    get current() { return cur; }
  };
  const ICON = {
    tap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5a5.5 5.5 0 0 1-5.5 5.5h-.8a5 5 0 0 1-3.9-1.9L5 14.5a1.5 1.5 0 0 1 2.3-1.9L9 14.5"/></svg>',
    ask: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/></svg>'
  };
  // show(id, {text, icon, anchor(): element to ring, done: selector whose tap counts as "got it"})
  function show(id, o) {
    if (!T.allow(id)) return false; const a = o.anchor && o.anchor(); if (o.anchor && (!a || !a.getClientRects().length)) return false;
    T.begin(id);
    const tip = document.createElement('div'); tip.className = 'pt' + (a ? '' : ' free'); tip.setAttribute('role', 'status');
    tip.innerHTML = '<div class="pt-t"><i aria-hidden="true">' + ICON[o.icon || 'tap'] + '</i><span>' + o.text + '</span></div><div class="pt-a"><button type="button" class="pt-off">Don’t show tips</button><button type="button" class="pt-ok">Got it</button></div>';
    const ring = a ? document.createElement('div') : null; if (ring) { ring.className = 'pt-ring'; document.body.appendChild(ring); }
    document.body.appendChild(tip);
    let raf = 0;
    const place = () => { raf = 0; if (!ring || !a.isConnected) return; const r = a.getBoundingClientRect(), pad = 6;
      const bar = innerWidth <= 760 ? 100 : 0, whole = r.top >= 8 && r.bottom <= innerHeight - bar; ring.style.visibility = whole ? '' : 'hidden';   // the ring only when the thing is fully in view (not under the tab bar)
      ring.style.transform = 'translate(' + (r.left - pad) + 'px,' + (r.top - pad) + 'px)'; ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px'; ring.style.borderRadius = Math.min(22, (r.height + pad * 2) / 2) + 'px';
      // the card sits under the thing it points at, or above it when there's no room below
      const W = innerWidth, H = innerHeight, tw = tip.offsetWidth, th = tip.offsetHeight, left = Math.max(14, Math.min(W - tw - 14, r.left + r.width / 2 - tw / 2));
      const below = r.bottom + 14 + th < H - 12, top = below ? r.bottom + 14 : Math.max(12, r.top - th - 14);
      tip.style.left = left + 'px'; tip.style.top = top + 'px'; tip.style.bottom = 'auto'; };
    const onMove = () => { if (!raf) raf = requestAnimationFrame(place); };
    const finish = retire => { if (!tip.isConnected) return; if (active === finish) active = null; T.end(id, retire); tip.classList.remove('on'); if (ring) ring.classList.remove('on');
      removeEventListener('scroll', onMove, true); removeEventListener('resize', onMove); document.removeEventListener('click', onDone, true);
      setTimeout(() => { tip.remove(); if (ring) ring.remove(); }, calm.matches ? 0 : 320); };
    const onDone = e => { if (o.done && e.target.closest(o.done)) finish(true); };
    tip.querySelector('.pt-ok').onclick = () => finish(true);
    tip.querySelector('.pt-off').onclick = () => { T.offAll(); finish(false); };
    addEventListener('scroll', onMove, { passive: true, capture: true }); addEventListener('resize', onMove); document.addEventListener('click', onDone, true);
    place(); requestAnimationFrame(() => { tip.classList.add('on'); if (ring) ring.classList.add('on'); });
    o.close = finish; active = finish; return true;
  }
  T.show = show;

  // ---------- when each tip comes up ----------
  const onEntries = () => { const v = document.getElementById('view-app'); if (!v || v.hidden) return false; const c = document.querySelector('.cbx'); if (c && !c.classList.contains('off')) return false; const x = document.getElementById('csx'); return !(x && x.classList.contains('in')); };
  const ITEM = '#ct-rows .ct-row, #ct-rows .ct-tile';   // a row in the list, or a tile in the grid (computers start on grid)
  const firstItem = () => [...document.querySelectorAll(ITEM)].find(x => x.getClientRects().length);
  const hasRows = () => !!firstItem();
  let timer = 0;
  function check() {
    clearTimeout(timer); if (T.off()) return;
    timer = setTimeout(() => {
      if (!onEntries() || busy() || cur) return;
      if (!T.seen('entries') && hasRows()) { show('entries', { text: tap() + ' any entry to see its details and edit it.', anchor: firstItem, done: '.ct-row, .ct-tile' }); return; }
      // Ask: only on a visit after the Entries tip, so they never come one after the other
      if (T.seen('entries') && !T.seen('ask') && !T.visits && hasRows()) {
        const b = [...document.querySelectorAll('.sh-ask')].find(x => x.getClientRects().length);
        if (b) show('ask', { icon: 'ask', text: tap() + ' ✦ to ask about your numbers, like your best sale this month.', anchor: () => b, done: '.sh-ask' });
      }
    }, calm.matches ? 400 : 1300);
  }
  // each tip belongs to its page: leaving the page puts it away (not retired), and coming back brings it again
  function sync() { const x = document.getElementById('csx'), st = !!(x && x.classList.contains('in'));
    if (((cur === 'entries' || cur === 'ask') && !onEntries()) || (cur === 'stories' && !st)) { if (active) active(false); }
    const c = document.querySelector('.cbx'); if (cur === 'board' && (st || !c || c.classList.contains('off'))) { const h = document.querySelector('.cbhint.on'); if (h) h.classList.remove('on'); cur = null; }   // the Board's own tip (board.js)
    if (!cur) check(); }   // check waits for the page to settle and only shows on Entries
  document.addEventListener('click', e => { if (e.target.closest('[data-tab], [data-go]')) setTimeout(sync, 450); }, true);
  // Stories: when the Stories page slides in
  function watchStories() {
    const x = document.getElementById('csx'); if (!x) return setTimeout(watchStories, 400);
    let was = false;
    const look = () => { const on = x.classList.contains('in'); sync();
      if (on && cur === 'board') { const h = document.querySelector('.cbhint.on'); if (h) h.classList.remove('on'); cur = null; }   // the Board's tip, left underneath Stories, steps aside
      if (on && !was) setTimeout(() => { if (x.classList.contains('in')) show('stories', { icon: 'play', text: tap() + ' a story to play it. ' + tap() + ' right or left to move through it, and hold to pause.' }); }, calm.matches ? 300 : 1100); was = on; };
    new MutationObserver(look).observe(x, { attributes: true, attributeFilter: ['class'] }); look();   // also if Stories was already open when the page loaded its files
  }
  // Settings → Help → Show tips again
  document.addEventListener('click', e => { const b = e.target.closest('[data-tipsreset]'); if (!b) return; T.reset(); cur = null; if (window.CTMenu) window.CTMenu.close(); if (window.CTDash && window.CTDash.toast) window.CTDash.toast('Tips will show again as you go.'); setTimeout(check, 600); });
  function start() { check(); watchStories(); if (S && S.on) S.on(() => { if (!T.seen('entries')) check(); }); const v = document.getElementById('view-app'); if (v) new MutationObserver(check).observe(v, { attributes: true, attributeFilter: ['hidden'] }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
