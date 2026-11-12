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
    const eb = document.createElement('button'); eb.type = 'button'; eb.className = 'sh-pillbtn sh-edit';
    // v47.3: desktop: Edit turns into + Add widget while editing (with Done beside it); phones keep Edit in the round button
    // and show only Done here. The pencil and the + cross-fade in place.
    const PEN = '<svg class="ebi ebi-e" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16z"/></svg>';
    const PLUS = '<svg class="ebi ebi-a" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    eb.innerHTML = '<span class="ebic">' + PEN + PLUS + '</span><span class="ebt"><span class="ebt-e">Edit</span><span class="ebt-a">Add widget</span></span>';
    const db = document.createElement('button'); db.type = 'button'; db.className = 'sh-pillbtn sh-done'; db.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>Done</span>';
    const paintEdit = () => { const on = edit.classList.contains('on'); eb.classList.toggle('on', on); db.classList.toggle('on', on); eb.setAttribute('aria-label', on ? 'Add widget' : 'Edit board'); };
    paintEdit(); new MutationObserver(paintEdit).observe(edit, { attributes: true, attributeFilter: ['class'] });
    eb.addEventListener('click', () => { if (edit.classList.contains('on')) { const a = $('addw'); if (a) a.click(); } else edit.click(); });
    db.addEventListener('click', () => { if (edit.classList.contains('on')) edit.click(); });
    // v46: Layouts (saved boards), beside Edit. Free sees a Premium tag; it opens the Premium sheet.
    const lb = document.createElement('button'); lb.type = 'button'; lb.className = 'sh-pillbtn sh-lay'; lb.setAttribute('aria-haspopup', 'dialog');
    lb.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="4.5" rx="1.4"/><rect x="13" y="11" width="7" height="9" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/></svg><span>Layouts</span><em class="sh-pm" hidden>Premium</em>';
    lb.setAttribute('aria-label', 'Layouts');
    const paintLay = () => { const free = window.CTBoardPlan && window.CTBoardPlan() === 'free'; lb.querySelector('.sh-pm').hidden = !free; lb.classList.toggle('lockd', !!free); };
    paintLay(); if (window.CTStore) CTStore.on(r => { if (r === 'plan') paintLay(); });
    lb.addEventListener('click', () => { if (window.cbLayoutsOpen) window.cbLayoutsOpen(lb); });
    G('board').append(db, eb, lb, proxy('Share your board', share.querySelector('svg').outerHTML, () => share.click()));
    const saveAll = document.createElement('button'); saveAll.type = 'button'; saveAll.className = 'sh-pillbtn sh-save';
    saveAll.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/></svg><span>Save all</span>';
    // v42.27: Save all asks how: photos (free and Premium) or videos (Premium), for all of your stories
    saveAll.setAttribute('aria-haspopup', 'menu'); saveAll.setAttribute('aria-expanded', 'false');
    const saveWrap = document.createElement('span'); saveWrap.className = 'sh-dd sh-savew';
    let saveMenu = null;
    const closeSave = () => { if (!saveMenu) return; const m = saveMenu; saveMenu = null; saveAll.setAttribute('aria-expanded', 'false'); saveAll.classList.remove('open'); m.classList.add('out'); setTimeout(() => m.remove(), 160); };
    saveAll.addEventListener('click', () => {
      if (saveMenu) { closeSave(); return; }
      const fw = (() => { try { return document.querySelector('#csx iframe').contentWindow; } catch (e) { return null; } })();
      const prem = window.CTBoardPlan ? window.CTBoardPlan() === 'premium' : true, canV = !fw || !fw.csCanVideo || fw.csCanVideo();
      const m = document.createElement('div'); m.className = 'ms-pop ms-menu sh-ddm sh-savem'; m.setAttribute('role', 'menu');
      m.innerHTML = '<button type="button" role="menuitem" data-k="photos"><b>Photos</b><small>One image per story' + (matchMedia('(max-width:760px)').matches ? '' : ', in a .zip') + '</small></button>' +
        (canV ? '<button type="button" role="menuitem" data-k="videos"><b>Videos' + (prem ? '' : ' <i class="pm">Premium</i>') + '</b><small>One vertical clip per story' + (matchMedia('(max-width:760px)').matches ? '' : ', in a .zip') + '</small></button>' : '');
      saveWrap.appendChild(m); saveAll.setAttribute('aria-expanded', 'true'); saveAll.classList.add('open'); saveMenu = m;
      m.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; closeSave(); try { const w = document.querySelector('#csx iframe').contentWindow; if (w.csSaveAll) w.csSaveAll(b.dataset.k); else { const x = frameDoc().getElementById('svall'); if (x) x.click(); } } catch (er) {} });
    });
    document.addEventListener('pointerdown', e => { if (saveMenu && !e.target.closest('.sh-savew')) closeSave(); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && saveMenu) { closeSave(); saveAll.focus(); } });
    // v39.6: the stories play from here; each one has its own Share inside the player
    const sShare = proxy('Play stories', '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>', () => { try { const f = document.querySelector('#csx iframe'); f && f.contentWindow.csPlay && f.contentWindow.csPlay(0); } catch (e) {} });
    saveWrap.appendChild(saveAll);
    // v49: on wide screens the story plays on the page, and Style opens its panel (theme, background, Hide amounts)
    const sStyle = document.createElement('button'); sStyle.type = 'button'; sStyle.className = 'sh-pillbtn sh-style'; sStyle.setAttribute('aria-expanded', 'false');
    sStyle.innerHTML = '<i class="sh-sdot" aria-hidden="true"></i><span>Style</span>';
    sStyle.addEventListener('click', () => { try { const w = document.querySelector('#csx iframe').contentWindow; if (w.csStyle) w.csStyle(); } catch (e) {} });
    window.CTStyleState = (open, bg, acc) => { sStyle.setAttribute('aria-expanded', open ? 'true' : 'false'); sStyle.classList.toggle('on', !!open); if (bg) sStyle.style.cssText = '--tb:' + bg + ';--ta:' + acc; };
    G('stories').append(sStyle, saveWrap, sShare);
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
  // where each tab sits, measured once (and again after a resize), so switching pages never waits on a layout pass
  const geo = new Map(); const at = b => { let g = geo.get(b); if (!g || !g[1]) { g = [b.offsetLeft, b.offsetWidth]; if (g[1]) geo.set(b, g); } return g; };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => geo.clear());
  function syncTb(animate) {
    if (!tbPill) return; const b = tbar.querySelector('[data-tab="' + cur + '"]'); if (!b) return; const g = at(b); if (!g[1]) return;
    tbPill.style.transition = animate && !calm() ? '' : 'none';
    tbPill.style.width = g[1] + 'px'; tbPill.style.transform = 'translateX(' + g[0] + 'px)';
    if (!animate) requestAnimationFrame(() => { tbPill.style.transition = ''; });
  }
  function syncPill(animate) {
    syncTb(animate);
    if (!tabs) return; const pill = tabs.querySelector('.sh-pill'), b = tabs.querySelector('[data-tab="' + cur + '"]'); if (!pill || !b) return;
    pill.style.transition = animate && !calm() ? '' : 'none';
    const g = at(b); pill.style.width = g[1] + 'px'; pill.style.transform = 'translateX(' + g[0] + 'px)';
    if (!animate) requestAnimationFrame(() => { pill.style.transition = ''; });
  }

  // ---------- the pages, side by side ----------
  const layerOf = p => p === 'entries' ? [document.querySelector('#view-app .ct-app')].filter(Boolean) : p === 'board' ? [document.querySelector('.cbx')].filter(Boolean) : [$('csx')].filter(Boolean);
  // the screen width is read once and kept (reading it mid-switch forced the whole page to be measured again)
  let vw = 0; const W = () => vw || (vw = document.documentElement.clientWidth || innerWidth);
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
  addEventListener('resize', () => { vw = 0; geo.clear(); if (!moving) placeAll(); syncPill(false); });

  // ---------- the frosted background, from the page you're on ----------
  const scrollOf = p => { if (p === 'entries') return window.scrollY; if (p === 'board') { const c = document.querySelector('.cbx'); return c ? c.scrollTop : 0; } const d = frameDoc(); return d && d.defaultView ? d.defaultView.scrollY : 0; };
  let fk = false;
  // phones: the tab bar slides away while you scroll down (you're reading) and comes back the moment you scroll up,
  // at the top or bottom of a page, and whenever you switch pages. The + button stays put.
  const extentOf = p => { if (p === 'entries') return [document.documentElement.scrollHeight, innerHeight];
    if (p === 'board') { const c = document.querySelector('.cbx'); return c ? [c.scrollHeight, c.clientHeight] : [0, 0]; }
    const d = frameDoc(); return d && d.documentElement ? [d.documentElement.scrollHeight, d.defaultView.innerHeight] : [0, 0]; };
  let tbY = 0, tbPage = null, tbHidden = false;
  // v50.18: in a browser tab (not the installed app) the bar shrinks to icons instead of hiding, since the browser's own
  // toolbar hides at the same moment. Installed = standalone, fullscreen or minimal-ui (Home Screen apps on iPhone and Android).
  const installedQ = ['standalone', 'fullscreen', 'minimal-ui'].map(m => matchMedia('(display-mode: ' + m + ')'));
  const inBrowser = () => !(navigator.standalone === true || installedQ.some(q => q.matches));
  const HTML = document.documentElement;
  const webMode = () => { const w = inBrowser(); HTML.classList.toggle('tb-web', w); if (!w) HTML.classList.remove('tb-mini'); return w; };
  installedQ.forEach(q => q.addEventListener && q.addEventListener('change', () => { webMode(); tbHidden = false; HTML.classList.remove('tb-away', 'tb-mini'); }));
  webMode();
  // the small bar: each tab slides left and narrows to about 52px, its icon kept its own shape, all inside a 46px pill
  if (tbar) tbar.querySelectorAll('button').forEach(b => { [...b.childNodes].forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) { const l = document.createElement('b'); l.className = 'tbl'; l.style.fontWeight = 'inherit'; l.textContent = n.textContent; n.replaceWith(l); } }); });
  // v50.19: the pill as pieces (shadows underneath, then the round ends and the middle), so it can change shape smoothly
  let tbg = null;
  if (tbar) { tbg = document.createElement('div'); tbg.className = 'tbg'; tbg.setAttribute('aria-hidden', 'true'); tbg.innerHTML = '<i class="s c l"></i><i class="s m"></i><i class="s c r"></i><i class="b c l"></i><i class="b c r"></i><i class="b m"></i>'; tbar.prepend(tbg); }
  function miniGeo() {
    if (!tbar || !tbg) return; const H0 = tbar.offsetHeight, W0 = tbar.offsetWidth; if (!H0) return;
    // the small pill: 168 × 46 (three 52px tabs), sitting on the same bottom-left corner
    const k = 46 / H0, Wm = 168 / k;
    tbar.style.setProperty('--th', H0 + 'px'); tbar.style.setProperty('--tk', k.toFixed(4));
    tbar.style.setProperty('--tsx', ((Wm - H0) / Math.max(1, W0 - H0)).toFixed(4)); tbar.style.setProperty('--trx', (Wm - W0).toFixed(1) + 'px');
    const cy = H0 - 23 - 1;
    [...tbar.querySelectorAll('button')].forEach((b, i) => { const sp = b.querySelector('span'); if (!sp) return;
      const scx = b.offsetLeft + sp.offsetLeft + sp.offsetWidth / 2, scy = b.offsetTop + sp.offsetTop + sp.offsetHeight / 2;
      b.style.setProperty('--mx', (31 + 52 * i - scx).toFixed(1) + 'px'); b.style.setProperty('--my', (cy - scy).toFixed(1) + 'px'); });
  }
  requestAnimationFrame(miniGeo);
  addEventListener('resize', () => requestAnimationFrame(miniGeo));
  function tbSet(hide) { if (hide === tbHidden) return; tbHidden = hide;
    if (webMode()) { if (hide) miniGeo(); HTML.classList.toggle('tb-mini', hide); } else HTML.classList.toggle('tb-away', hide); }
  function tbScroll() {
    if (!PH() || document.querySelector('dialog[open]')) { tbY = scrollOf(cur); return; }
    // v50.60: scrolling the app does by itself (keeping an opening entry in place, showing all of it) doesn't show or hide the bar
    if ((window.CTQuietScroll || 0) > performance.now()) { tbY = scrollOf(cur); return; }
    const y = scrollOf(cur), [sh2, vh] = extentOf(cur);
    if (tbPage !== cur) { tbPage = cur; tbY = y; tbSet(false); return; }
    // v47.2: iPhone's bounce at either end and the last flick of a fling scroll back a few pixels on their own; only a
    // real change of direction (30px down to hide, 20px up to show) moves the bar, so it never jitters
    if (y < 0 || y + vh > sh2 + 1) return;
    if (y < 40) { tbSet(false); tbY = y; return; }
    const dy = y - tbY;
    if (tbHidden ? dy > 0 : dy < 0) { tbY = y; return; }   // still going the same way: keep the anchor with the scroll
    if (!tbHidden && dy > 30) { tbSet(true); tbY = y; } else if (tbHidden && dy < -20) { tbSet(false); tbY = y; }
  }
  // v52.33: every size and position is read first, then the styles are written, and only when they change, so a scroll
  // frame never makes the browser work out the layout twice
  let lastBg = '', lastK = '';
  function frost() {
    fk = false;
    const onQ = PH() && search && cur === 'entries', qr = onQ ? search.getBoundingClientRect() : null, hb = onQ ? sh.getBoundingClientRect().bottom : 0;
    const bg = Math.max(0, Math.min(1, (scrollOf(cur) - 3) / 18)).toFixed(3); /* v42.11: no frost until really scrolled (a Home Screen app can sit a pixel or two off the top) */
    tbScroll();
    if (bg !== lastBg) { lastBg = bg; sh.style.setProperty('--sh-bg', bg); }
    // phones, Entries: the search icon fades in as the big search bar slides up under the header
    if (onQ) { const raw = (hb - qr.top) / Math.max(1, qr.height);
      // v42.10: a small dead zone, so the last few pixels of a scroll (or iPhone's bounce) never leave a faint icon behind
      const k = Math.max(0, Math.min(1, (raw - .15) / .8)), ks = k.toFixed(3);
      if (ks !== lastK) { lastK = ks; qBtn.style.setProperty('--k', ks); qBtn.style.pointerEvents = k > .6 ? 'auto' : 'none'; qBtn.style.visibility = k > 0 ? '' : 'hidden'; } }
    else if (qBtn.style.visibility !== 'hidden') { lastK = '0.000'; qBtn.style.setProperty('--k', '0'); qBtn.style.visibility = 'hidden'; qBtn.style.pointerEvents = 'none'; }
    // v50.52: once the big search bar is mostly back in view, the header search hands over to it (same text, one bar at a time)
    if (sh.classList.contains('q-on') && PH() && search && cur === 'entries' && +qBtn.style.getPropertyValue('--k') < .35) {
      const had = document.activeElement === fq; sh.classList.remove('q-on'); fq.blur(); if (had) $('ct-search').focus({ preventScroll: true }); }
  }
  let fEnd = 0;
  // ...and once more after scrolling settles, since iPhone can stop a fling without a final scroll event
  const kick = () => { if (!fk) { fk = true; requestAnimationFrame(frost); } clearTimeout(fEnd); fEnd = setTimeout(() => requestAnimationFrame(frost), 140); };
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
