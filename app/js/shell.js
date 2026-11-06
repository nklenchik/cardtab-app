/* The app shell (v36): one header for Entries, Board and Stories, and the page switcher.
   - All three pages stay drawn, side by side: Entries, then Board, then Stories. Switching slides the page you're on out
     and the next one in, in step, like turning pages. Nothing is hidden, shown, rebuilt or repainted on the way, so the
     slide only moves pictures that are already drawn (the same reason swiping between phone home screens never stutters).
   - The header never moves. On desktop: logo and Card Tab, the tabs (their highlight glides to the page you pick), that
     page's own buttons, Ask, your avatar. On phones: the page's name, its buttons, Ask, your avatar; the tabs are at the
     bottom. Only the parts that differ between pages change, with a short fade.
   - A frosted background fades into the header once the page you're on scrolls under it.
   Animations are transform and opacity only. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const PH = () => matchMedia('(max-width:760px)').matches;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const head = document.querySelector('.ct-demo-top'); if (!head) return;
  const tabs = head.querySelector('.ct-tabs'), search = head.querySelector('.ct-search'), add = $('ct-add'), av = $('app-avatar');
  const ORDER = { entries: 0, board: 1, stories: 2 }, NAMES = { entries: 'Card Tab', board: 'Board', stories: 'Stories' };
  // desktop always says Card Tab (the tabs say where you are); phones name the page, since the tabs are at the bottom
  const NAME = new Proxy(NAMES, { get: (o, k) => PH() ? o[k] : 'Card Tab' });
  const SPARK = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2 5.3 5.5 1.9-5.5 2-2 5.3-2-5.3-5.5-2 5.5-1.9z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>';
  const QI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>';

  // any open window or sheet (dialog) marks the page, so phones can switch off the glass blur underneath while it's up
  (function () {
    // while a window is open, a drag only scrolls what can scroll inside it (results, a long form, the date chips);
    // anywhere else it does nothing, so the page behind never moves and the window stays put
    const canScroll = (el, stop) => { for (; el && el !== stop.parentElement; el = el.parentElement) { const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
      if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return true; } return false; };
    document.addEventListener('touchmove', e => { const d = document.querySelector('dialog[open]'); if (!d || !e.cancelable) return;
      if (!d.contains(e.target) || !canScroll(e.target, d)) e.preventDefault(); }, { passive: false });
    const sync = () => document.documentElement.classList.toggle('sheet-up', !!document.querySelector('dialog[open]'));
    new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  })();
  // ---------- the header ----------
  const sh = document.createElement('header'); sh.className = 'ct-shell'; sh.dataset.page = 'entries';
  sh.innerHTML = '<div class="sh-in"><div class="sh-brand"><img src="assets/logo-128.webp" alt="" width="30" height="30"><span class="sh-name"><span>Card Tab</span></span></div>' +
    '<div class="sh-tabs"></div><div class="sh-acts"><div class="sha on" data-p="entries"></div><div class="sha" data-p="board"></div><div class="sha" data-p="stories"></div></div>' +
    '<button type="button" class="sh-bell sh-ic" aria-label="Notifications"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 004 0"/></svg></button>' +
    '<button type="button" class="sh-ask sh-ic" aria-label="Ask about your numbers">' + SPARK + '</button><div class="sh-me"></div></div>' +
    '<label class="sh-field">' + QI + '<input type="search" placeholder="Search all months" aria-label="Search cards, sets and platforms" autocomplete="off" enterkeyhint="search"><button type="button" class="sh-x">Cancel</button></label>';
  document.body.appendChild(sh);
  const G = p => sh.querySelector('.sha[data-p="' + p + '"]');

  // the real tabs move into the header, with one highlight that glides between them
  if (tabs) { sh.querySelector('.sh-tabs').appendChild(tabs); const pill = document.createElement('i'); pill.className = 'sh-pill'; tabs.prepend(pill); }
  if (av) sh.querySelector('.sh-me').appendChild(av);
  // Entries: the big search and Add New sit in the header on desktop; on phones the search stays at the top of the page
  // and a search icon joins the header once it has scrolled away
  const qBtn = document.createElement('button'); qBtn.type = 'button'; qBtn.className = 'sh-q sh-ic'; qBtn.setAttribute('aria-label', 'Search'); qBtn.innerHTML = QI;
  const homeOf = { search: search && { p: search.parentElement, n: search.nextSibling } };
  function placeSearch() {
    if (!search) return;
    if (PH()) { if (search.parentElement !== homeOf.search.p) homeOf.search.p.insertBefore(search, homeOf.search.n); if (!qBtn.isConnected) G('entries').prepend(qBtn); }
    else { G('entries').append(search); if (add) G('entries').append(add); qBtn.remove(); }
  }
  placeSearch(); matchMedia('(max-width:760px)').addEventListener('change', () => { placeSearch(); placeAll(); setPage(cur, false); });

  // Board and Stories: their buttons, as header buttons that press the real ones
  const proxy = (label, svg, fn, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sh-ic' + (cls ? ' ' + cls : ''); b.setAttribute('aria-label', label); b.innerHTML = svg; b.addEventListener('click', e => { e.preventDefault(); fn(); }); return b; };
  const frameDoc = () => { try { const f = document.querySelector('#csx iframe'); return f && f.contentDocument; } catch (e) { return null; } };
  let wired = false;
  function wireBoard() {
    if (wired || !$('cb-edit')) return; wired = true;
    const edit = $('cb-edit'), share = $('cb-share');
    const eb = document.createElement('button'); eb.type = 'button'; eb.className = 'sh-pillbtn';
    const paintEdit = () => { const on = edit.classList.contains('on'); eb.classList.toggle('on', on); eb.innerHTML = (edit.querySelector('svg') ? edit.querySelector('svg').outerHTML : '') + '<span>' + (on ? 'Done' : 'Edit') + '</span>'; };
    paintEdit(); new MutationObserver(paintEdit).observe(edit, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    eb.addEventListener('click', () => edit.click());
    G('board').append(eb, proxy('Share your board', share.querySelector('svg').outerHTML, () => share.click()));
    const saveAll = document.createElement('button'); saveAll.type = 'button'; saveAll.className = 'sh-pillbtn sh-save';
    saveAll.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/></svg><span>Save all</span>';
    saveAll.addEventListener('click', () => { const d = frameDoc(); const b = d && (PH() ? d.querySelector('#csdock [data-d="save"]') : d.getElementById('svall')); if (b) b.click(); });
    const sShare = proxy('Share this story', '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.8 5.6v3.1C8.5 9.2 5.3 12.6 4.6 18.4c2-3 5-4.4 9.2-4.5v3.1c0 .5.6.8 1 .4l5.2-5.1c.3-.3.3-.7 0-1l-5.2-5.1c-.4-.4-1-.1-1 .4z"/></svg>', () => { const d = frameDoc(); const b = d && d.querySelector('#csdock [data-d="share"]'); if (b) b.click(); }, 'sh-sshare');
    G('stories').append(saveAll, sShare);
    placeAll();
  }
  sh.querySelector('.sh-bell').addEventListener('click', () => { if (window.CTNotify) window.CTNotify.open('list'); });
  sh.querySelector('.sh-ask').addEventListener('click', () => { if (window.CTAskOpen) window.CTAskOpen(); else if (window.CTBoardLoader) window.CTBoardLoader.load().then(() => window.CTAskOpen && window.CTAskOpen()).catch(() => {}); });

  // ---------- which page, and the header for it ----------
  let cur = 'entries';
  function setPage(p, animate) {
    const was = sh.dataset.page; sh.dataset.page = p;
    sh.querySelectorAll('.sha').forEach(g => g.classList.toggle('on', g.dataset.p === p));
    // the tab you picked lights up right away, top and bottom
    document.querySelectorAll('.sh-tabs [data-tab], #ct-tbar [data-tab]').forEach(b => { if (b.dataset.tab === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const nm = sh.querySelector('.sh-name');
    if (PH() && was !== p && animate && !calm()) {
      // the page name: the old one fades up and out, the new one rises in
      const old = nm.firstElementChild, nu = document.createElement('span'); nu.textContent = NAME[p]; nu.className = 'nin';
      if (old) { old.className = 'nout'; setTimeout(() => old.remove(), 220); }
      nm.appendChild(nu); requestAnimationFrame(() => requestAnimationFrame(() => nu.className = ''));
    } else nm.innerHTML = '<span>' + NAME[p] + '</span>';
    syncPill(animate); frost();
  }
  // phones: one highlight behind the whole tab (icon and label) that slides to the page you pick
  const tbar = $('ct-tbar'); let tbPill = null;
  if (tbar) { tbPill = document.createElement('i'); tbPill.className = 'tb-pill'; tbar.prepend(tbPill); }
  function syncTb(animate) {
    if (!tbPill) return; const b = tbar.querySelector('[data-tab="' + cur + '"]'); if (!b || !b.offsetWidth) return;
    tbPill.style.transition = animate && !calm() ? '' : 'none';
    tbPill.style.width = b.offsetWidth + 'px'; tbPill.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    if (!animate) requestAnimationFrame(() => { tbPill.style.transition = ''; });
  }
  function syncPill(animate) {
    syncTb(animate);
    if (!tabs) return; const pill = tabs.querySelector('.sh-pill'), b = tabs.querySelector('[data-tab="' + cur + '"]'); if (!pill || !b) return;
    pill.style.transition = animate && !calm() ? '' : 'none';
    pill.style.width = b.offsetWidth + 'px'; pill.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    if (!animate) requestAnimationFrame(() => { pill.style.transition = ''; });
  }

  // ---------- the pages, side by side ----------
  const layerOf = p => p === 'entries' ? [document.querySelector('#view-app .ct-app')].filter(Boolean) : p === 'board' ? [document.querySelector('.cbx')].filter(Boolean) : [$('csx')].filter(Boolean);
  const W = () => document.documentElement.clientWidth || innerWidth;
  const restX = (p, c) => (ORDER[p] - ORDER[c]) * W();
  const tx = x => x ? 'translate3d(' + x + 'px,0,0)' : 'none';
  function placeAll() {
    Object.keys(ORDER).forEach(p => layerOf(p).forEach(el => { el.style.transform = tx(restX(p, cur)); }));
    const app = document.querySelector('#view-app .ct-app'); if (app) app.inert = cur !== 'entries';
  }
  let moving = null;
  // from -> to: the page you're on slides out, the next slides in beside it; any page in between waits off screen
  function move(from, to, done) {
    if (moving) { moving.forEach(a => a.finish()); }
    if (from === to || !ORDER.hasOwnProperty(to)) { cur = to; setPage(to, false); placeAll(); if (done) done(); return; }
    const dir = ORDER[to] > ORDER[from] ? 1 : -1, w = W(), ms = calm() ? 0 : (PH() ? 460 : 560);
    cur = to; setPage(to, true);
    const H = document.documentElement; H.classList.add('pg-moving');
    // pages not in the slide go straight to where they'll rest (always off screen, so you never see them move)
    Object.keys(ORDER).forEach(p => { if (p !== from && p !== to) layerOf(p).forEach(el => { el.style.transform = tx(restX(p, to)); }); });
    const ease = { duration: ms, easing: 'cubic-bezier(.4,0,.2,1)' }, anims = [];
    layerOf(to).forEach(el => { el.style.transform = 'none'; if (ms) anims.push(el.animate([{ transform: tx(dir * w) }, { transform: 'none' }], ease)); });
    layerOf(from).forEach(el => { el.style.transform = tx(-dir * w); if (ms) anims.push(el.animate([{ transform: 'none' }, { transform: tx(-dir * w) }], ease)); });
    moving = anims;
    const end = () => { if (moving === anims) moving = null; H.classList.remove('pg-moving'); placeAll(); if (done) done(); };
    if (ms) setTimeout(end, ms); else end();
  }
  window.CTPage = { move, place: placeAll, get cur() { return cur; } };
  addEventListener('resize', () => { if (!moving) placeAll(); syncPill(false); });

  // ---------- the frosted background, from the page you're on ----------
  const scrollOf = p => { if (p === 'entries') return window.scrollY; if (p === 'board') { const c = document.querySelector('.cbx'); return c ? c.scrollTop : 0; } const d = frameDoc(); return d && d.defaultView ? d.defaultView.scrollY : 0; };
  let fk = false;
  // phones: the tab bar slides away while you scroll down (you're reading) and comes back the moment you scroll up,
  // at the top or bottom of a page, and whenever you switch pages. The + button stays put.
  const extentOf = p => { if (p === 'entries') return [document.documentElement.scrollHeight, innerHeight];
    if (p === 'board') { const c = document.querySelector('.cbx'); return c ? [c.scrollHeight, c.clientHeight] : [0, 0]; }
    const d = frameDoc(); return d && d.documentElement ? [d.documentElement.scrollHeight, d.defaultView.innerHeight] : [0, 0]; };
  let tbY = 0, tbPage = null, tbHidden = false;
  function tbSet(hide) { if (hide === tbHidden) return; tbHidden = hide; document.documentElement.classList.toggle('tb-away', hide); }
  function tbScroll() {
    if (!PH() || document.querySelector('dialog[open]')) { tbY = scrollOf(cur); return; }
    const y = scrollOf(cur), [sh2, vh] = extentOf(cur);
    if (tbPage !== cur) { tbPage = cur; tbY = y; tbSet(false); return; }
    const dy = y - tbY;
    if (y < 40 || y + vh >= sh2 - 6) { tbSet(false); tbY = y; return; }
    if (dy > 8) { tbSet(true); tbY = y; } else if (dy < -6) { tbSet(false); tbY = y; }
  }
  function frost() {
    fk = false; sh.style.setProperty('--sh-bg', Math.min(1, scrollOf(cur) / 18).toFixed(3)); tbScroll();
    // phones, Entries: the search icon fades in as the big search bar slides up under the header
    if (PH() && search && cur === 'entries') { const r = search.getBoundingClientRect(), hb = sh.getBoundingClientRect().bottom; const k = Math.max(0, Math.min(1, (hb - r.top) / Math.max(1, r.height))); qBtn.style.setProperty('--k', k.toFixed(3)); qBtn.style.pointerEvents = k > .6 ? 'auto' : 'none'; }
  }
  const kick = () => { if (!fk) { fk = true; requestAnimationFrame(frost); } };
  addEventListener('scroll', kick, { passive: true });
  document.addEventListener('scroll', kick, { passive: true, capture: true });
  let fdBound = null;
  setInterval(() => { const d = frameDoc(); if (d && d !== fdBound && d.defaultView) { fdBound = d; d.defaultView.addEventListener('scroll', kick, { passive: true }); } }, 1000);

  // phones: search right in the header (same search as the big bar)
  const fq = sh.querySelector('.sh-field input');
  qBtn.addEventListener('click', () => { sh.classList.add('q-on'); fq.value = $('ct-search').value; fq.focus({ preventScroll: true }); });
  const closeQ = () => { sh.classList.remove('q-on'); fq.blur(); };
  sh.querySelector('.sh-x').addEventListener('click', e => { e.preventDefault(); if (fq.value) { fq.value = ''; fq.dispatchEvent(new Event('input')); } closeQ(); });
  fq.addEventListener('input', () => { const r = $('ct-search'); r.value = fq.value; r.dispatchEvent(new Event('input', { bubbles: true })); });
  fq.addEventListener('keydown', e => { if (e.key === 'Enter') fq.blur(); if (e.key === 'Escape') closeQ(); });

  // the board arrives a few seconds after the app (or the first time you open it): wire its buttons and park it off screen
  const wait = setInterval(() => { if (document.querySelector('.cbx') && $('cb-edit')) { clearInterval(wait); wireBoard(); placeAll(); } }, 300);
  setPage('entries', false); setTimeout(() => { syncPill(false); frost(); }, 400);
})();
