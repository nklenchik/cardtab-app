/* Settings pages in the profile menu (v44).
   The menu lists one row per group, each showing what it's set to. Tapping a row slides its page in from the right; the
   back arrow (or the back gesture, or Esc, or v52.52 a swipe right that follows the finger) slides it out again. The menu keeps its size, so nothing jumps. Transform and
   opacity only.
   Settings that follow the account (saved with the rest of the account's settings): what Add New starts with, the games
   you collect, and the sharing defaults. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), S = window.CTStore, menu = $('app-menu');
  if (!menu || !S) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const toast = t => window.CTDash && window.CTDash.toast(t);
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  // ---------- the games ----------
  const GAMES = [['pokemon', 'Pokémon', /pok/i], ['magic', 'Magic', /magic/i], ['yugioh', 'Yu-Gi-Oh!', /yu-?gi/i], ['onepiece', 'One Piece', /one.?piece/i],
    ['dbs', 'Dragon Ball', /dragon.?ball|fusion/i], ['lorcana', 'Lorcana', /lorcana/i], ['digimon', 'Digimon', /digimon/i], ['flesh', 'Flesh and Blood', /flesh/i]];
  const myGames = () => { const g = S.meta('games'); return Array.isArray(g) ? g : []; };
  // card search ranks these first when everything else is equal (lookup.js asks for this)
  window.CTGamePref = c => { const g = myGames(); if (!g.length || !c || !c.g) return 0; return GAMES.some(([k, , re]) => g.includes(k) && re.test(c.g)) ? 1 : 0; };

  // ---------- sharing defaults: applied each time the app opens, so every visit starts from them ----------
  function applySharing() {
    const sh = S.meta('sharing') || {}, mine = get('ct.hideamt', '0') === '1'; if (!S.meta('sharing') && !mine) return;
    put('cs.hide', sh.amt || mine ? '1' : '0');
    try { const c = JSON.parse(localStorage.getItem('cb.share') || '{}') || {}; c.amt = !sh.amt; c.names = !sh.names; localStorage.setItem('cb.share', JSON.stringify(c)); } catch (e) {}
  }

  // ---------- v50.55: hide amounts in the app (this device): dollar amounts blur everywhere in the app, and Stories show % ----------
  function applyHide() { document.documentElement.classList.toggle('ct-hideamt', get('ct.hideamt', '0') === '1'); }
  applyHide();
  // ---------- what each row says it's set to ----------
  const THEME = { light: 'Light', dark: 'Dark', auto: 'Auto' }, START = { month: 'Month', year: 'Year', all: 'All time' };
  function paint() {
    const sess = (window.CTSession && window.CTSession.current && window.CTSession.current()) || {};
    const sv = (k, t) => menu.querySelectorAll('[data-sv="' + k + '"]').forEach(x => { x.textContent = t; });
    const nmEl = $('am-name'), name = nmEl ? ((nmEl.querySelector('.am-nm') || nmEl).firstChild || {}).textContent || sess.name || '' : sess.name || '', email = ($('am-email') || {}).textContent || sess.email || '';
    sv('account', name || email || 'Profile and sign-in'); sv('prof', name || email);
    sv('plan', S.plan() === 'premium' ? 'Premium' : 'Free');
    const df = S.meta('addDefaults') || {};
    sv('entries', (df.plat || 'Last platform used') + ' · ' + (df.cond || 'NM') + (myGames().length ? ' · ' + myGames().length + (myGames().length === 1 ? ' game' : ' games') : ''));
    const b = S.budget(); let amt = 'kept'; amt = get('ct.amt', 'kept');
    sv('money', (b ? '$' + Math.round(b.cents / 100).toLocaleString('en-US') + ' budget' : 'No budget') + ' · sales show ' + (amt === 'sold' ? 'sold for' : 'after fees'));
    const so = S.plan() === 'premium' ? (S.meta('startOn') || 'month') : 'month';
    sv('display', THEME[get('cb.theme', 'auto')] + ' · starts on ' + START[so]);
    const sh = S.meta('sharing') || {};
    sv('sharing', sh.amt && sh.names ? 'Amounts and names hidden' : sh.amt ? 'Amounts hidden' : sh.names ? 'Card names hidden' : 'Everything shows');
    const np = Object.assign({ all: true }, (S.meta('notif') || {}).prefs);
    sv('ntf', np.all ? 'On' : 'Off · payment problems still show');
    sv('data', S.showImport() ? 'Import, export, taxes' : 'Export, taxes');
    sv('help', 'Contact, privacy, terms');
    const mine = S.customPlatforms().length; sv('plats', mine ? mine + ' of your own' : 'Add your own');
    const via = $('am-via'); if (via) via.textContent = (sess.via === 'google' ? 'Google' : sess.via === 'passkey' ? (window.CTPasskey ? window.CTPasskey.kindName() : 'Passkey') : 'Email link') + (sess.email ? ' · ' + sess.email : '');
    const v = $('am-ver'); if (v) v.textContent = 'Card Tab ' + ((document.querySelector('script[src*="settings.js"]') || {}).src || '').replace(/.*v=/, '');
  }

  // ---------- pages ----------
  let cur = null;
  // v52.52 pages move on a spring (driven by frames, so a slow first frame never makes them skip), can be caught mid-slide,
  // and on touch screens follow the finger back: swipe right anywhere on a page. Reduced motion keeps the plain fade.
  const M = window.CTMotion, live = () => M && !calm.matches;
  const off = pg => (pg.offsetWidth || menu.clientWidth || 360) * 1.04;
  const setX = (pg, x) => { pg.style.transform = 'translate3d(' + x + 'px,0,0)'; };
  const rest = pg => { pg.style.transform = ''; pg.style.transition = ''; };
  function slide(pg, from, to, v, done) {
    if (pg._sp) pg._sp.stop(); pg.style.transition = 'none'; pg._to = to;
    pg._sp = M.spring({ from, to, v, k: 420, c: 41, set: x => setX(pg, x), done: () => { pg._sp = null; done && done(); } });
  }
  const xOf = pg => pg._sp && pg._sp.live ? pg._sp.stop() : (pg.style.transform ? M.at(pg)[0] : null);
  function openPage(id, byKey) {
    const pg = $('amp-' + id); if (!pg || cur === pg) return;
    const was = pg.hidden ? null : (live() ? xOf(pg) : null);   // coming back while it's still sliding out: from right there
    fill(id); paint();
    menu.scrollTop = 0; pg.hidden = false; if (was == null) pg.scrollTop = 0; cur = pg;
    if (live()) { const from = was == null ? off(pg) : was; setX(pg, from); pg.style.transition = 'none'; pg.getBoundingClientRect(); menu.classList.add('am-in'); pg.classList.add('on'); slide(pg, from, 0, 0, () => rest(pg)); }
    else { pg.getBoundingClientRect(); menu.classList.add('am-in'); pg.classList.add('on'); }
    if (window.CTNav) window.CTNav.push('amp', () => closePage(true));
    // keyboard: focus moves to the page's back arrow; a tap or click leaves no focus ring behind
    const f = pg.querySelector('.amp-back'); if (f && byKey) f.focus({ preventScroll: true }); else if (document.activeElement && menu.contains(document.activeElement)) document.activeElement.blur();
  }
  function closePage(fromPop, instant, v) {
    if (!cur) return; const pg = cur; cur = null;
    if (!fromPop && window.CTNav) window.CTNav.done('amp');
    const fin = () => { if (!pg.classList.contains('on')) pg.hidden = true; rest(pg); menu.classList.remove('am-snap'); };
    if (instant) { if (pg._sp) { pg._sp.stop(); pg._sp = null; } pg.style.transition = 'none'; menu.classList.add('am-snap'); }
    if (!instant && live()) { const from = xOf(pg); slide(pg, from == null ? 0 : from, off(pg), v || 0, () => { menu.classList.remove('am-in'); fin(); }); pg.classList.remove('on'); }
    else { menu.classList.remove('am-in'); pg.classList.remove('on'); if (instant || calm.matches) fin(); else setTimeout(fin, 320); }
    if (!instant) { paint(); const row = menu.querySelector('[data-amp="' + pg.dataset.p + '"]'); if (row && pg.contains(document.activeElement)) row.focus({ preventScroll: true }); }
  }
  // swipe right on a page to go back: it follows the finger; let go past halfway or with a flick and it finishes
  (() => {
    let s = null;
    const sideScroller = t => { for (let el = t; el && el !== menu; el = el.parentElement) { if (el.matches && el.matches('input[type=range],[data-noswipe],select,textarea')) return true; const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return true; } return false; };
    menu.addEventListener('touchstart', e => {
      s = null; if (!live() || e.touches.length !== 1) return; const pg = e.target.closest && e.target.closest('.amp'); if (!pg || pg !== cur || sideScroller(e.target)) return;
      const t = e.touches[0], caught = !!(pg._sp && pg._sp.live);
      s = { pg, x: t.clientX, y: t.clientY, x0: caught ? pg._sp.stop() : 0, lock: caught ? 'x' : '', heading: caught ? pg._to : null, moved: 0, tr: M.tracker() }; if (caught) { pg._sp = null; pg.style.transition = 'none'; } s.tr.add(t.clientX);
    }, { passive: true });
    menu.addEventListener('touchmove', e => {
      if (!s) return; const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (!s.lock) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; s.lock = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'; if (s.lock !== 'x') { s = null; return; } s.x = t.clientX; s.pg.style.transition = 'none'; }
      if (e.cancelable) e.preventDefault(); s.tr.add(t.clientX); s.moved = Math.max(s.moved, Math.abs(t.clientX - s.x));
      let x = s.x0 + (t.clientX - s.x); if (x < 0) x = -M.rubber(-x, 30); setX(s.pg, x);
    }, { passive: false });
    const end = () => {
      if (!s) return; const c = s; s = null; if (c.lock !== 'x') return; const v = c.tr.v(), x = M.at(c.pg)[0], w = off(c.pg);
      // caught and let go without moving: it carries on where it was going
      if (c.heading != null && c.moved < 6) { if (c.heading > 0 && cur === c.pg) closePage(false, false, 0); else if (c.heading > 0) slide(c.pg, x, w, 0, () => { c.pg.hidden = true; rest(c.pg); menu.classList.remove('am-in'); }); else slide(c.pg, x, 0, 0, () => rest(c.pg)); return; }
      const away = v > 450 || (x > w * 0.45 && v > -250);
      if (away && cur === c.pg) closePage(false, false, Math.max(0, v));
      else if (away) slide(c.pg, x, w, Math.max(0, v), () => { c.pg.hidden = true; rest(c.pg); menu.classList.remove('am-in'); });
      else { if (cur !== c.pg) { if (cur) closePage(false, true); cur = c.pg; c.pg.classList.add('on'); menu.classList.add('am-in'); if (window.CTNav) window.CTNav.push('amp', () => closePage(true)); }   // caught on its way out and pulled back
        slide(c.pg, x, 0, Math.min(0, v), () => rest(c.pg)); }
    };
    menu.addEventListener('touchend', end, { passive: true }); menu.addEventListener('touchcancel', end, { passive: true });
  })();
  // the menu closing (any way at all) puts it back on its first page for next time
  new MutationObserver(() => { if (menu.hidden || cur) closePage(false, true); if (!menu.hidden) paint(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cur && !menu.hidden) { e.preventDefault(); e.stopImmediatePropagation(); closePage(); } }, true);

  // ---------- filling each page ----------
  function fill(id) {
    if (id === 'entries') {
      const df = S.meta('addDefaults') || {}, sel = $('am-dplat'), plats = S.pickerPlatforms();
      sel.innerHTML = '<option value="">Last one used</option>' + plats.map(p => '<option' + (p === df.plat ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
      $('am-dcond').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.c === (df.cond || 'NM'))));
      $('am-dgco').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.co === (df.gco || 'PSA'))));
      const g = myGames();
      $('am-games').innerHTML = GAMES.map(([k, l]) => '<button type="button" class="am-chip" data-g="' + k + '" aria-pressed="' + g.includes(k) + '">' + esc(l) + '</button>').join('');
    }
    if (id === 'sharing') { const sh = S.meta('sharing') || {}; $('am-shamt').setAttribute('aria-checked', String(!!sh.amt)); $('am-shnames').setAttribute('aria-checked', String(!!sh.names)); }
    if (id === 'data') {
      $('am-usage').setAttribute('aria-checked', String(S.meta('shareUsage') !== false));
      const ys = [...new Set(S.all().map(e => e.date.slice(0, 4)))].sort().reverse(), now = String(new Date().getFullYear());
      if (!ys.includes(now)) ys.unshift(now);
      const pick = ys.includes(String(+now - 1)) && new Date().getMonth() < 4 ? String(+now - 1) : ys[0];
      $('am-taxy').innerHTML = ys.map(y => '<option' + (y === pick ? ' selected' : '') + '>' + y + '</option>').join('');
    }
    if (id === 'billing' && window.CTBilling) { window.CTBilling.paint(); window.CTBilling.load(true).then(() => window.CTBilling.paint()); }   // v50.63
    if (id === 'display') { pdev = window.CTPrefs ? window.CTPrefs.kind() : 'desk'; paintDev(); }
    if (id === 'display') { $('am-slabs').setAttribute('aria-checked', String(S.meta('slabs') !== false)); $('am-hideamt').setAttribute('aria-checked', String(get('ct.hideamt', '0') === '1')); }
    if (id === 'display') { const r = $('am-rboard'); r.classList.remove('confirm'); $('am-rboard-s').textContent = 'Back to the starting widgets for your plan'; }
    if (id === 'account') { if (window.CTPasskey) { window.CTPasskey.reset(); window.CTPasskey.paint(); } const o = $('am-outall'); o.classList.remove('confirm'); $('am-outall-s').textContent = 'Your phone, computer and anywhere else'; }
  }
  // ---------- phones and computers each keep their own: opens to, list or grid, show first ----------
  let pdev = 'desk';
  function paintDev() {
    const P = window.CTPrefs; if (!P) return;
    const chk = (id, attr, v) => $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset[attr] === v)));
    chk('am-pdev', 'pd', pdev); chk('am-open', 'op', P.get('ct.open', pdev) || 'entries'); { const vv = P.get('ct.view', pdev) || (pdev === 'phone' ? 'list' : 'gallery'); chk('am-view', 'vw', vv === 'list' ? 'list' : (P.get('ct.gsize', pdev) || 'm')); }
    $('am-filter').value = P.get('ct.filter', pdev) || 'all'; $('am-sort').value = get('ct.f.ct-sort', 'new');
  }
  async function saveMeta(k, patch) { await S.setMeta(k, Object.assign({}, S.meta(k) || {}, patch)); }

  menu.addEventListener('click', async e => {
    const t = e.target;
    const go = t.closest('[data-amp]'); if (go) { e.stopPropagation(); openPage(go.dataset.amp, e.detail === 0); return; }
    if (t.closest('.amp-back')) { e.stopPropagation(); closePage(); return; }
    const pd = t.closest('#am-pdev button'); if (pd) { e.stopPropagation(); pdev = pd.dataset.pd; paintDev(); return; }
    const op = t.closest('#am-open button'); if (op && window.CTPrefs) { e.stopPropagation(); await window.CTPrefs.set('ct.open', op.dataset.op === 'entries' ? null : op.dataset.op, pdev); paintDev(); return; }
    const vw = t.closest('#am-view button'); if (vw && window.CTPrefs) { e.stopPropagation(); const x = vw.dataset.vw; if (x !== 'list') await window.CTPrefs.set('ct.gsize', x === 'm' ? null : x, pdev); await window.CTPrefs.set('ct.view', x === 'list' ? 'list' : 'gallery', pdev); paintDev(); return; }
    const c = t.closest('#am-dcond button'); if (c) { $('am-dcond').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === c))); await saveMeta('addDefaults', { cond: c.dataset.c }); return; }
    const gc = t.closest('#am-dgco button'); if (gc) { $('am-dgco').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === gc))); await saveMeta('addDefaults', { gco: gc.dataset.co }); return; }
    const sl = t.closest('#am-slabs'); if (sl) { const on = sl.getAttribute('aria-checked') !== 'true'; sl.setAttribute('aria-checked', String(on)); await S.setMeta('slabs', on); return; }
    const ha = t.closest('#am-hideamt'); if (ha) { const on = ha.getAttribute('aria-checked') !== 'true'; ha.setAttribute('aria-checked', String(on)); put('ct.hideamt', on ? '1' : '0'); applyHide(); applySharing(); return; }
    const g = t.closest('.am-chip'); if (g) { const on = g.getAttribute('aria-pressed') !== 'true'; g.setAttribute('aria-pressed', String(on)); const list = myGames().filter(x => x !== g.dataset.g); if (on) list.push(g.dataset.g); await S.setMeta('games', list); return; }
    const us = t.closest('#am-usage'); if (us) { const on = us.getAttribute('aria-checked') !== 'true'; us.setAttribute('aria-checked', String(on)); await S.setMeta('shareUsage', on); return; }
    const sw = t.closest('#am-shamt, #am-shnames'); if (sw) { const on = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(on)); await saveMeta('sharing', sw.id === 'am-shamt' ? { amt: on } : { names: on }); applySharing(); return; }
    if (t.closest('#am-prof')) { e.stopPropagation(); if (window.CTMenu) window.CTMenu.close(); if (window.CTBoardLoader) window.CTBoardLoader.load().then(() => setTimeout(() => window.CTProfileOpen && window.CTProfileOpen(), 180)).catch(() => {}); return; }
    if (t.closest('#am-del')) { e.stopPropagation(); if (window.CTMenu) window.CTMenu.close(); setTimeout(() => window.CTDeleteAccount && window.CTDeleteAccount(), matchMedia('(max-width:760px)').matches ? 280 : 60); return; }
    // the two that can't be undone ask once more, in place (no pop-up)
    const oa = t.closest('#am-outall'); if (oa) { e.stopPropagation();
      if (!oa.classList.contains('confirm')) { oa.classList.add('confirm'); $('am-outall-s').textContent = 'Tap again to sign out everywhere'; return; }
      $('am-outall-s').textContent = 'Signing out…';
      try { if (window.CTSession && window.CTSession.signOutAll) await window.CTSession.signOutAll(); } catch (er) { oa.classList.remove('confirm'); $('am-outall-s').textContent = 'Couldn’t reach your account. Try again in a moment.'; return; }
      location.reload(); return; }
    const rb = t.closest('#am-rboard'); if (rb) { e.stopPropagation();
      if (!rb.classList.contains('confirm')) { rb.classList.add('confirm'); $('am-rboard-s').textContent = 'Tap again to reset. Your entries don’t change.'; return; }
      ['cb.layout.v4', 'cb.layout.phone.v2', 'cb.layout.v4.free', 'cb.layout.phone.v2.free', 'cb.custom'].forEach(k => { try { localStorage.removeItem(k); } catch (er) {} });
      if (window.cbResetLayout) window.cbResetLayout();
      rb.classList.remove('confirm'); $('am-rboard-s').textContent = 'Done. Card Board is back to its starting widgets.'; return; }
    if (t.closest('#am-tax')) { e.stopPropagation(); taxExport($('am-taxy').value); return; }
    if (t.closest('#am-copymail')) { e.stopPropagation(); const b = $('am-copymail');
      try { await navigator.clipboard.writeText('hello@cardtab.app'); b.textContent = 'Copied'; } catch (er) { b.textContent = 'hello@cardtab.app'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1600); return; }
  });
  $('am-dplat').addEventListener('change', e => saveMeta('addDefaults', { plat: e.target.value }));
  $('am-filter').addEventListener('change', e => { if (window.CTPrefs) window.CTPrefs.set('ct.filter', e.target.value === 'all' ? null : e.target.value, pdev); });
  $('am-sort').addEventListener('change', e => { put('ct.f.ct-sort', e.target.value); dispatchEvent(new CustomEvent('ct-prefs', { detail: { keys: ['ct.f.ct-sort'] } })); });

  // ---------- one year, for taxes ----------
  function taxExport(y) {
    const list = S.all().filter(e => e.date.slice(0, 4) === y).slice().reverse();
    if (!list.length) { toast('No entries in ' + y); return; }
    const m = c => c == null ? '' : (c / 100).toFixed(2), q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const sales = list.filter(e => e.type === 'sale'), buys = list.filter(e => e.type === 'purchase'), refunds = list.filter(e => e.type === 'refund');
    const sum = (a, f) => a.reduce((t, e) => t + (f(e) || 0), 0);
    const tot = [['Card Tab, ' + y], [], ['Total sales', m(sum(sales, e => e.amount))], ['Fees and shipping', m(sum(sales, e => (e.fees || 0) + (e.ship || 0)))],
      ['Kept after fees', m(sum(sales, e => e.net))], ['Spent on cards', m(sum(buys, e => e.amount))], ['Refunds received', m(sum(refunds, e => e.amount))], ['Sales', sales.length], ['Purchases', buys.length], []];
    const cols = ['date', 'type', 'platform', 'card', 'qty', 'amount', 'fees', 'shipping', 'kept_after_fees', 'condition', 'note'];
    const rows = list.map(e => [e.date, e.type, e.platform, e.name, e.qty, m(e.amount), e.type === 'sale' ? m(e.fees) : '', e.type === 'sale' ? m(e.ship) : '', e.type === 'sale' ? m(e.net) : '', e.condition, e.note]);
    const csv = tot.concat([cols], rows).map(r => r.map(q).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'card-tab-' + y + '-taxes.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Downloaded ' + y + ': ' + sales.length + ' sales, ' + buys.length + ' purchases');
  }

  // ---------- search (v50.28): every setting, including the ones inside each page, by its name or the words people use ----------
  const SYN = {
    'Appearance': 'dark mode light theme night colors', 'Start on': 'default range period month year all time opens', 'Set for': 'phone computer desktop mobile device',
    'Opens to': 'start page home landing first page launch', 'Entries view': 'grid list gallery cards layout size small medium large thumbnails', 'Show first': 'filter default sales purchases refunds',
    'Sort': 'order newest oldest highest amount', 'Reset Card Board layout': 'widgets default board start over', 'Platform': 'default platform ebay tcgplayer marketplace add new',
    'Condition': 'nm mint near mint grade default', 'Your platforms': 'custom platforms add my own stores', 'Games you collect': 'pokemon magic yugioh one piece lorcana tcg games',
    'Monthly budget': 'budget limit spending allowance alert', 'Sales show': 'after fees kept gross sold price fees net amount', 'Hide amounts': 'privacy dollars money share stories percent',
    'Hide card names': 'privacy share names', 'Graded by': 'grading company psa bgs cgc sgc tag beckett default graded', 'Show graded cards as slabs': 'slab graded case label psa bgs plain art', 'Hide amounts in the app': 'privacy blur hide money dollars amounts public', 'Share anonymous usage': 'analytics tracking privacy data opt out', 'Import a spreadsheet': 'import csv excel upload sheet google',
    'Export everything': 'export download backup csv', 'One year of sales and purchases': 'taxes tax irs csv export year 1099', 'Profile': 'name photo picture avatar edit profile',
    'Signed in with': 'google email login account', 'Sign out of all devices': 'log out logout sign out password security devices', 'Delete account': 'remove close delete account erase',
    'Help and feedback': 'help support feedback bug', 'Contact support': 'email contact help support hello', 'Notifications': 'alerts reminders email notify', 'Plan and billing': 'premium subscription cancel upgrade payment price billing plan'
  };
  const qIn = $('am-q'), qRes = $('am-sres'), qX = $('am-qx');
  let IDX = null;
  function index() {
    const out = [];
    menu.querySelectorAll('section.amp').forEach(pg => {
      const id = pg.dataset.p, title = (pg.querySelector('.amp-h b') || {}).textContent || '';
      const add = (el, lab) => { lab = (lab || '').trim(); if (!lab || out.some(o => o.el === el)) return; out.push({ el, lab, page: id, title, words: (SYN[lab] || '') + ' ' + title }); };
      pg.querySelectorAll('.amr, button[role=menuitem]').forEach(r => { const g = r.querySelector('.amgt, span'); add(r, g ? ((g.childNodes[0] || {}).textContent || '') : ''); });
      const games = pg.querySelector('#am-games'); if (games) add(games, 'Games you collect');
    });
    ['#am-ntf', '[data-amp="billing"]'].forEach(sel => { const b = menu.querySelector(sel); if (b) out.push({ el: b, lab: b.id === 'am-ntf' ? 'Notifications' : 'Plan and billing', page: null, title: '', words: SYN[b.id === 'am-ntf' ? 'Notifications' : 'Plan and billing'] }); });
    return out;
  }
  const near = (a, b) => { if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, e = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return e + (a.length - i) + (b.length - j) <= 1; };
  function score(o, q) {
    const L = o.lab.toLowerCase(), W = o.words.toLowerCase(), terms = q.split(/\s+/).filter(Boolean); let s = 0;
    for (const t of terms) { if (L.startsWith(t)) s += 6; else if (L.includes(t)) s += 4; else if (W.split(/\s+/).some(w => w.startsWith(t))) s += 3; else if (W.includes(t)) s += 2;
      else if (t.length >= 5 && (L + ' ' + W).split(/\s+/).some(w => near(w, t))) s += 1; else return 0; }
    return s;
  }
  function search() {
    const q = qIn.value.trim().toLowerCase(); qX.hidden = !q;
    menu.classList.toggle('am-searching', !!q); qRes.hidden = !q; if (!q) { qRes.innerHTML = ''; return; }
    if (!IDX) IDX = index();
    const hits = IDX.map(o => ({ o, s: score(o, q) })).filter(x => x.s).sort((a, b) => b.s - a.s).slice(0, 8);
    qRes.innerHTML = hits.length ? hits.map((h, i) => '<button type="button" role="option" data-hit="' + IDX.indexOf(h.o) + '"><span class="amgt">' + esc(h.o.lab) + '<small class="am-sv">' + esc(h.o.title || 'Menu') + '</small></span></button>').join('')
      : '<p class="am-snone">No setting matches “' + esc(qIn.value.trim()) + '”. Try a word like budget, dark mode or export.</p>';
  }
  function go(o) {
    qIn.value = ''; search(); qIn.blur();
    if (!o.page) { o.el.click(); return; }
    openPage(o.page);
    setTimeout(() => { // v50.42: only the settings page scrolls, and only as far as it takes to show the match whole (scrollIntoView also
      // scrolled the sheet itself, which slid the page off its frame and showed the main list behind it)
      { const pg = o.el.closest('.amp'), m = document.getElementById('app-menu'); if (m) m.scrollTop = 0;
        if (pg) { const er = o.el.getBoundingClientRect(), pr = pg.getBoundingClientRect(), pad = 16;
          let top = pg.scrollTop; if (er.bottom > pr.bottom - pad) top += er.bottom - pr.bottom + pad + 40; if (er.top - (top - pg.scrollTop) < pr.top + pad) top = pg.scrollTop + er.top - pr.top - pad - 40;
          top = Math.max(0, Math.min(top, pg.scrollHeight - pg.clientHeight)); if (top !== pg.scrollTop) pg.scrollTo({ top, behavior: calm.matches ? 'auto' : 'smooth' }); } } o.el.classList.remove('am-flash'); void o.el.offsetWidth; o.el.classList.add('am-flash'); setTimeout(() => o.el.classList.remove('am-flash'), 1700); }, calm.matches ? 0 : 340);
  }
  qIn.addEventListener('input', search);
  qIn.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = qRes.querySelector('[data-hit]'); if (f) { e.preventDefault(); go(IDX[+f.dataset.hit]); } } if (e.key === 'Escape' && qIn.value) { e.stopPropagation(); qIn.value = ''; search(); } });
  qX.addEventListener('click', e => { e.stopPropagation(); qIn.value = ''; search(); qIn.focus(); });
  qRes.addEventListener('click', e => { const b = e.target.closest('[data-hit]'); if (!b) return; e.stopPropagation(); go(IDX[+b.dataset.hit]); });
  new MutationObserver(() => { if (menu.hidden && qIn.value) { qIn.value = ''; search(); } }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });

  applySharing();
  S.on(r => { if (r === 'remote' || r === 'meta' || r === 'prefs') { if (r === 'remote') applySharing(); if (!menu.hidden) paint(); } }, true);
})();
