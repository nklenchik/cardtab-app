/* Settings pages in the profile menu (v44).
   The menu lists one row per group, each showing what it's set to. Tapping a row slides its page in from the right; the
   back arrow (or the back gesture, or Esc) slides it out again. The menu keeps its size, so nothing jumps. Transform and
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
    const sh = S.meta('sharing'); if (!sh) return;
    put('cs.hide', sh.amt ? '1' : '0');
    try { const c = JSON.parse(localStorage.getItem('cb.share') || '{}') || {}; c.amt = !sh.amt; c.names = !sh.names; localStorage.setItem('cb.share', JSON.stringify(c)); } catch (e) {}
  }

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
    const via = $('am-via'); if (via) via.textContent = (sess.via === 'google' ? 'Google' : 'Email link') + (sess.email ? ' · ' + sess.email : '');
    const v = $('am-ver'); if (v) v.textContent = 'Card Tab ' + ((document.querySelector('script[src*="settings.js"]') || {}).src || '').replace(/.*v=/, '');
  }

  // ---------- pages ----------
  let cur = null;
  function openPage(id, byKey) {
    const pg = $('amp-' + id); if (!pg || cur === pg) return;
    fill(id); paint();
    menu.scrollTop = 0; pg.hidden = false; pg.scrollTop = 0; cur = pg;
    pg.getBoundingClientRect(); // start from off to the right
    menu.classList.add('am-in'); pg.classList.add('on');
    if (window.CTNav) window.CTNav.push('amp', () => closePage(true));
    // keyboard: focus moves to the page's back arrow; a tap or click leaves no focus ring behind
    const f = pg.querySelector('.amp-back'); if (f && byKey) f.focus({ preventScroll: true }); else if (document.activeElement && menu.contains(document.activeElement)) document.activeElement.blur();
  }
  function closePage(fromPop, instant) {
    if (!cur) return; const pg = cur; cur = null;
    if (!fromPop && window.CTNav) window.CTNav.done('amp');
    if (instant) { pg.style.transition = 'none'; menu.classList.add('am-snap'); }
    menu.classList.remove('am-in'); pg.classList.remove('on');
    const fin = () => { if (!pg.classList.contains('on')) pg.hidden = true; pg.style.transition = ''; menu.classList.remove('am-snap'); };
    if (instant || calm.matches) fin(); else setTimeout(fin, 320);
    if (!instant) { paint(); const row = menu.querySelector('[data-amp="' + pg.dataset.p + '"]'); if (row && pg.contains(document.activeElement)) row.focus({ preventScroll: true }); }
  }
  // the menu closing (any way at all) puts it back on its first page for next time
  new MutationObserver(() => { if (menu.hidden || cur) closePage(false, true); if (!menu.hidden) paint(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cur && !menu.hidden) { e.preventDefault(); e.stopImmediatePropagation(); closePage(); } }, true);

  // ---------- filling each page ----------
  function fill(id) {
    if (id === 'entries') {
      const df = S.meta('addDefaults') || {}, sel = $('am-dplat'), plats = S.pickerPlatforms();
      sel.innerHTML = '<option value="">Last one used</option>' + plats.map(p => '<option' + (p === df.plat ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
      $('am-dcond').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.c === (df.cond || 'NM'))));
      const g = myGames();
      $('am-games').innerHTML = GAMES.map(([k, l]) => '<button type="button" class="am-chip" data-g="' + k + '" aria-pressed="' + g.includes(k) + '">' + esc(l) + '</button>').join('');
    }
    if (id === 'sharing') { const sh = S.meta('sharing') || {}; $('am-shamt').setAttribute('aria-checked', String(!!sh.amt)); $('am-shnames').setAttribute('aria-checked', String(!!sh.names)); }
    if (id === 'data') {
      const ys = [...new Set(S.all().map(e => e.date.slice(0, 4)))].sort().reverse(), now = String(new Date().getFullYear());
      if (!ys.includes(now)) ys.unshift(now);
      const pick = ys.includes(String(+now - 1)) && new Date().getMonth() < 4 ? String(+now - 1) : ys[0];
      $('am-taxy').innerHTML = ys.map(y => '<option' + (y === pick ? ' selected' : '') + '>' + y + '</option>').join('');
    }
    if (id === 'display') { const r = $('am-rboard'); r.classList.remove('confirm'); $('am-rboard-s').textContent = 'Back to the starting widgets for your plan'; }
    if (id === 'account') { const o = $('am-outall'); o.classList.remove('confirm'); $('am-outall-s').textContent = 'Your phone, computer and anywhere else'; }
  }
  async function saveMeta(k, patch) { await S.setMeta(k, Object.assign({}, S.meta(k) || {}, patch)); }

  menu.addEventListener('click', async e => {
    const t = e.target;
    const go = t.closest('[data-amp]'); if (go) { e.stopPropagation(); openPage(go.dataset.amp, e.detail === 0); return; }
    if (t.closest('.amp-back')) { e.stopPropagation(); closePage(); return; }
    const c = t.closest('#am-dcond button'); if (c) { $('am-dcond').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === c))); await saveMeta('addDefaults', { cond: c.dataset.c }); return; }
    const g = t.closest('.am-chip'); if (g) { const on = g.getAttribute('aria-pressed') !== 'true'; g.setAttribute('aria-pressed', String(on)); const list = myGames().filter(x => x !== g.dataset.g); if (on) list.push(g.dataset.g); await S.setMeta('games', list); return; }
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

  applySharing();
  S.on(r => { if (r === 'remote' || r === 'meta') { if (r === 'remote') applySharing(); if (!menu.hidden) paint(); } });
})();
