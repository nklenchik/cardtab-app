/* Card Tab boot: signed out shows the sign-in page, signed in shows the dashboard (the first screen after sign-in).
   Also runs the account menu (usage lives here) and the local-mode testing tools. */
(function () {
  'use strict';
  const S = window.CTStore, Sess = window.CTSession, Dash = window.CTDash;
  const PUBLIC_HOST = /(^|\.)cardtab\.app$|\.pages\.dev$/i.test(location.hostname);   // the real app, as people will see it
  const $ = id => document.getElementById(id);
  const vAuth = $('view-auth'), vApp = $('view-app'), menu = $('app-menu'), av = $('app-avatar');
  let auth = null, whoName = '';
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // a menu button's title (keeps its small line underneath)
  const lab = (b, t) => { const g = b.querySelector('.amgt'); if (g && g.firstChild && g.firstChild.nodeType === 3) g.firstChild.nodeValue = t; else b.textContent = t; };
  const PREM_PILL = '<span class="am-prem"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>Premium</span>';

  const displayName = s => s.name || (s.via === 'google' && s.email.endsWith('.local') ? 'You' : s.email.split('@')[0].replace(/[._+-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

  // v52.55 page-wide states as classes on <html> (instead of :has() checks over the whole page, which slowed every
  // window's first frame): ct-noapp while the app view is hidden, first-on while the get-started panel shows
  (() => { const H = document.documentElement, va = document.getElementById('view-app'), fw = document.getElementById('app-first-wrap'), grid = document.getElementById('app-grid');
    const sync = () => { if (va) H.classList.toggle('ct-noapp', va.hidden); if (grid && fw) grid.classList.toggle('first-on', !fw.hidden); };
    const mo = new MutationObserver(sync); [va, fw].forEach(el => el && mo.observe(el, { attributes: true, attributeFilter: ['hidden'] })); sync(); })();
  async function showApp(session, isNew) {
    // v52.73 lay the page out the way it looked last time (or empty, for a brand-new account) before the entries load, so
    // the get-started panel doesn't appear a moment later and push everything down. The first render corrects any guess.
    try { const e = localStorage.getItem('ct.empty'), fw = document.getElementById('app-first-wrap'), g = document.getElementById('app-grid');
      if (fw && g && (e === '1' || (e === null && isNew))) { fw.hidden = false; g.classList.add('is-empty'); const r = g.querySelector('.ct-demo-right:not(.app-first-wrap)'); if (r) r.hidden = true; } } catch (e) {}
    vAuth.hidden = true; vApp.hidden = false; document.title = 'Card Tab';
    await S.open({ email: session.email });
    av.textContent = (displayName(session)[0] || '?').toUpperCase();
    if (window.CTMePaint) window.CTMePaint();   // v42.12: a profile photo, when there is one, replaces the letter right away
    whoName = displayName(session); $('am-name').textContent = whoName; $('am-email').textContent = session.email.endsWith('.local') ? 'Signed in on this device' : session.email;
    applyServer(session);
    if (window.CTSync && Sess.REAL) window.CTSync.start();
    if (window.CTArtFill && Sess.REAL) window.CTArtFill.start();
    Dash.mount();
    if (!S.persistent) Dash.toast('This browser isn’t letting Card Tab save on the device, so entries last until you close the tab.');
    else if (isNew && !S.all().length) Dash.toast('Welcome to Card Tab');
    history.replaceState(null, '', location.pathname);
    emailGo();
  }
  // v52.49: buttons in Card Tab's emails open a spot in the app (?go=add|budget|board|stories|ask|home|premium). Kept
  // through sign-in, then run once the app is on screen.
  const GO_OK = /^(add|budget|board|stories|ask|home|premium|emails)$/;
  try { const g = new URLSearchParams(location.search).get('go'); if (g && GO_OK.test(g)) sessionStorage.setItem('ct.go', g); } catch (e) {}
  // v53.03 the QR code on a computer's Add from photo opens ?scan=<code> on the phone, kept through sign-in the same way
  try { const c = new URLSearchParams(location.search).get('scan'); if (c && /^[A-Za-z0-9_-]{16,64}$/.test(c)) sessionStorage.setItem('ct.scanpair', c); } catch (e) {}
  function emailGo() {
    let g = ''; try { g = sessionStorage.getItem('ct.go') || ''; sessionStorage.removeItem('ct.go'); } catch (e) {}
    let pc = ''; try { pc = sessionStorage.getItem('ct.scanpair') || ''; sessionStorage.removeItem('ct.scanpair'); } catch (e) {}
    if (pc) { setTimeout(() => { if (window.CTScan) window.CTScan.paired(pc); }, 500); return; }
    goTo(g, 700);
  }
  // v52.87 also used by What's new notifications (window.CTGo)
  function goTo(g, wait) {
    if (!GO_OK.test(g)) return;
    setTimeout(() => { try {
      if (g === 'add') { if (window.CTOpenAdd) window.CTOpenAdd(); }
      else if (g === 'budget') { if (window.CTBudget) window.CTBudget.open(); }
      else if (g === 'board' || g === 'stories') { if (window.CTTabGo) window.CTTabGo(g); }
      else if (g === 'ask') { if (window.CTAskOpen) window.CTAskOpen(); else if (window.CTBoardLoader) window.CTBoardLoader.load().then(() => window.CTAskOpen && window.CTAskOpen()).catch(() => {}); }
      else if (g === 'home') { if (window.CTInstall) window.CTInstall.open(); }
      else if (g === 'emails') { if (window.CTNotify) { window.CTNotify.open('settings'); setTimeout(() => { const el = document.getElementById('ntf-email'); if (el) el.scrollIntoView({ block: 'center' }); }, 120); } }
      else if (g === 'premium') { if (window.CTDash && window.CTDash.upgradeNote) window.CTDash.upgradeNote(); }
    } catch (e) {} }, wait || 0);
  }
  window.CTGo = goTo;
  // what the server says about you: admin tools only for admins (decided on the server), and your plan
  function applyServer(session) {
    $('am-dev').hidden = !((session && session.role === 'admin') || (Sess.LOCAL_MODE && !PUBLIC_HOST));
    $('am-cd').hidden = !(Sess.REAL && session && session.role === 'admin');
    document.querySelectorAll('[data-cd]').forEach(x => { x.hidden = $('am-cd').hidden; });   // the Card data label goes with it
    if (Sess.REAL && session && session.plan && S.plan && S.plan() !== session.plan) S.setPlan(session.plan);
    if (S.setBonus) S.setBonus(session && session.bonus);   // v52.8: extra Free entries from an admin
    if (session && window.CTNotify && window.CTNotify.pull) window.CTNotify.pull(true);   // v52.10: messages from Card Tab
  }
  // after a message from Card Tab (a gift, extras): who you are and your plan, fresh from the server
  window.CTRecheck = () => { if (!Sess.REAL) return; Sess.check().then(c => { if (!c) return; $('am-dev').hidden = !(c.role === 'admin'); if (c.plan && S.plan && S.plan() !== c.plan) S.setPlan(c.plan); if (S.setBonus) S.setBonus(c.bonus); }).catch(() => {}); };
  function showAuth() {
    if (window.CTSync) window.CTSync.stop();
    if (window.CTArtFill) window.CTArtFill.stop();
    S.close(); closeMenu();
    vApp.hidden = true; vAuth.hidden = false; document.title = 'Sign in · Card Tab';
    if (!auth) auth = window.CTAuth.mount(vAuth, (s, isNew) => showApp(s, isNew)); else auth.reset();
    if (!matchMedia('(pointer:coarse)').matches) setTimeout(() => $('auth-email').focus({ preventScroll: true }), 50);   // phones: don't pre-focus (no keyboard opens, and the next tap wouldn't register as a focus)
  }

  // ---------- sync status: a line in the profile menu; a small cloud on your picture only when offline or not saved yet ----------
  (function () {
    if (!window.CTSync) return;
    const line = $('am-sync'), TXT = { syncing: 'Saving to your account…', synced: 'All changes saved to your account', pending: 'Saving to your account…', offline: 'Offline. Everything here is saved on this device.', 'offline-pending': 'Offline. Changes will save to your account when you’re back online.', error: 'Couldn’t reach your account. Changes are safe on this device and will save soon.' };
    let errT = 0;
    const paint = s => {
      const show = Sess.REAL && TXT[s];
      line.hidden = !show; if (!show) { av.classList.remove('sync-off'); return; }
      line.dataset.s = s; line.querySelector('span').textContent = TXT[s];
      clearTimeout(errT);
      // the cloud only shows when something's actually waiting: offline with changes, or an error that lasts
      if (s === 'offline-pending') av.classList.add('sync-off');
      else if (s === 'error') errT = setTimeout(() => { if (window.CTSync.status() === 'error') av.classList.add('sync-off'); }, 20000);
      else av.classList.remove('sync-off');
    };
    window.CTSync.onChange(paint);
    window.CTSync.onSignedOut = () => { Sess.check().then(c => { if (!c) { Sess.signOut(); showAuth(); if (auth) auth.error('You were signed out. Sign in again to keep your changes in sync.'); } }); };
  })();

  // card art progress, in the profile menu while it runs
  if (window.CTArtFill) window.CTArtFill.onChange(pg => {
    const el = $('am-art'); if (!el) return;
    el.hidden = !(pg.running && pg.total > 0);
    if (!el.hidden) el.querySelector('span').textContent = 'Adding card art: ' + pg.done + ' of ' + pg.total + ' cards checked, ' + pg.found + (pg.found === 1 ? ' entry' : ' entries') + ' filled in';
  });

  // ---------- Admin: card data use this billing month (JustTCG requests), loaded when the Admin section opens ----------
  const cdFmt = d => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  // v52.26: Admin is its own page in the menu now; card data loads each time that page opens
  const cdLoad = async () => {
    if ($('am-cd').hidden) return;
    try { const r = await Sess.api('/auth/usage'), t = r.days[0] && r.days[0].day === new Date().toISOString().slice(0, 10) ? r.days[0] : { type: 0, fill: 0 };
      $('am-cd-v').textContent = r.month.toLocaleString() + ' of ' + r.limit.toLocaleString();
      $('am-cd-s').textContent = 'Resets ' + cdFmt(r.resets) + ' · today ' + r.today + ' (typing ' + t.type + ', art ' + t.fill + ') · today’s share ' + r.todayShare + ' · ' + r.savedPct + '% answered from saved lookups'
        + (r.cat ? ' · catalog fill ' + (r.cat.active ? 'on: today ' + r.cat.today.calls + ' requests, ' + r.cat.today.cards.toLocaleString() + ' cards, ' + r.cat.today.art + ' art' : 'starts in ' + r.cat.startsIn + ' days') + ' · saved ' + r.cat.cards.toLocaleString() + ' cards from ' + r.cat.setsDone + ' of ' + r.cat.sets + ' sets' : '');
    } catch (e) { $('am-cd-v').textContent = 'Couldn’t load'; $('am-cd-s').textContent = ''; }
  };
  { const pg = $('amp-admin'); if (pg) new MutationObserver(() => { if (!pg.hidden) cdLoad(); }).observe(pg, { attributes: true, attributeFilter: ['hidden'] }); }

  // ---------- Admin: fill missing card art now (past the daily share), with a report of what the card database returned ----------
  let artRep = [];
  $('am-artnow').addEventListener('click', async () => {
    const b = $('am-artnow'), r = $('am-art-r'); if (!window.CTArtFill || b.disabled) return;
    b.disabled = true; lab(b, 'Filling in card art…'); r.hidden = false; r.textContent = 'Checking every entry without art. This can take a few minutes; you can keep using the app.';
    const off = window.CTArtFill.onChange(pg => { if (pg.running && pg.total) r.textContent = pg.done + ' of ' + pg.total + ' cards checked, ' + pg.found + ' entries filled in' + (pg.waiting ? ' · the card database asked us to slow down, continuing in a few seconds' : ''); });
    try { artRep = (await window.CTArtFill.force()) || []; } finally { off(); b.disabled = false; lab(b, 'Fill missing card art now'); }
    const c = k => artRep.filter(x => x.result === k).length;
    r.textContent = artRep.length ? 'Done: ' + c('filled') + ' filled, ' + c('unclear') + ' with several possible cards, ' + c('not found') + ' not found' + (c('lookup failed') ? ', ' + c('lookup failed') + ' lookups failed' : '') + (c('monthly limit reached') ? '. Stopped: this month’s card lookups are used up' : '') + '.' : 'Every entry already has art (or a card you picked).';
    $('am-art-copy').hidden = !artRep.length;
  });
  $('am-art-copy').addEventListener('click', async () => {
    const t = artRep.map(x => x.result.toUpperCase() + ' (' + x.n + ')  ' + x.entry + '\n   looked up: ' + x.looked + '\n   ' + (Array.isArray(x.got) ? (x.got.length ? 'card database returned:\n     - ' + x.got.join('\n     - ') : 'card database returned nothing') : 'used: ' + x.got)).join('\n');
    try { await navigator.clipboard.writeText(t); $('am-art-copy').textContent = 'Copied'; } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (er) {} ta.remove(); $('am-art-copy').textContent = 'Copied'; }
    setTimeout(() => { $('am-art-copy').textContent = 'Copy art report'; }, 1600);
  });

  // ---------- Admin: check that every entry's card picture actually loads ----------
  let picRep = [];
  $('am-pic').addEventListener('click', async () => {
    const b = $('am-pic'), r = $('am-pic-r'); if (b.disabled) return; b.disabled = true; r.hidden = false;
    const seen = new Map(); S.all().forEach(e => { if (!e.deleted && e.art && e.art.list && !seen.has(e.art.list)) seen.set(e.art.list, e); });
    const list = [...seen.entries()]; picRep = []; let done = 0;
    for (const [url, e] of list) {
      try { const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) picRep.push({ entry: e.name, card: e.cardName || '', url, why: res.headers.get('x-art-why') || ('status ' + res.status) }); }
      catch (er) { picRep.push({ entry: e.name, card: e.cardName || '', url, why: 'could not reach the server' }); }
      done++; if (done % 5 === 0 || done === list.length) r.textContent = done + ' of ' + list.length + ' pictures checked, ' + picRep.length + ' not loading';
    }
    r.textContent = list.length + ' pictures checked, ' + picRep.length + ' not loading.'; b.disabled = false; $('am-pic-copy').hidden = !picRep.length;
  });
  $('am-pic-copy').addEventListener('click', async () => {
    const t = picRep.map(x => 'NO PICTURE  ' + x.entry + '\n   card: ' + x.card + '\n   why: ' + x.why + '\n   ' + x.url).join('\n');
    try { await navigator.clipboard.writeText(t); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (er) {} ta.remove(); }
    $('am-pic-copy').textContent = 'Copied'; setTimeout(() => { $('am-pic-copy').textContent = 'Copy picture report'; }, 1600);
  });

  // ---------- Delete account (from Edit profile) ----------
  (function () {
    const d = $('dela'); if (!d) return; const ok = $('dela-ok'), go = $('dela-go');
    window.CTDeleteAccount = () => { ok.checked = false; go.disabled = true; $('dela-prem').hidden = S.plan() !== 'premium'; $('dela-exp').hidden = !S.all().length; d.showModal(); };
    ok.addEventListener('change', () => { go.disabled = !ok.checked; });
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    $('dela-exp').addEventListener('click', () => Dash.exportCSV());
    go.addEventListener('click', async () => {
      if (!ok.checked) return; go.disabled = true; go.textContent = 'Deleting…';
      if (Sess.REAL) { try { await Sess.api('/auth/delete', {}); } catch (e) { go.disabled = false; go.textContent = 'Delete account'; Dash.toast(e.status === 401 ? 'Sign in again, then delete your account.' : 'Couldn’t delete your account right now. Try again.'); return; } }
      try { await S.deleteAccount(); } catch (e) { console.error(e); }
      // everything this device kept for Card Tab: profile, avatar, board layout, stories, notifications, settings
      try { Object.keys(localStorage).filter(k => /^(cb|ct)\./.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      d.close(); go.textContent = 'Delete account'; Sess.signOut(); showAuth();
      Dash.toast('Your account was deleted.');
    });
  })();

  // ---------- account menu ----------
  function renderMenu() {
    const u = S.usage(), p = $('am-plan'), n = $('am-note');
    // A Premium account shows a cranberry Premium pill beside the owner's name
    $('am-name').innerHTML = '<span class="am-nm">' + esc(whoName) + '</span>' + (u.plan === 'premium' ? PREM_PILL : '');
    if (u.plan === 'premium') {
      p.innerHTML = ''; p.hidden = true;
      n.hidden = true;
    } else {
      p.hidden = false; p.innerHTML = '<div class="r"><b>Free plan</b><button type="button" class="up" data-upgrade>Upgrade</button></div><div class="am-meter' + (u.warn || u.blocked ? ' warn' : '') + '"><i style="width:' + Math.min(100, u.used / u.limit * 100) + '%"></i></div><small>' + u.used + ' of ' + u.limit + ' entries this month · resets ' + u.resetsOn + '</small>';
      n.hidden = !(u.warn || u.blocked);
      n.textContent = u.blocked ? 'You’ve used all 20 free entries. They reset on ' + u.resetsOn + '.' : 'You’re nearing your limit: ' + u.left + (u.left === 1 ? ' entry' : ' entries') + ' left this month.';
    }
    menu.querySelectorAll('[data-plan]').forEach(b => { b.classList.toggle('on', b.dataset.plan === u.plan); b.setAttribute('aria-checked', String(b.dataset.plan === u.plan)); });
    // Import: Premium sees it from day one; Free only sees a Premium-tagged link later (see store.showImport)
    const im = $('am-import'); im.hidden = !S.showImport();
    im.querySelector('span').innerHTML = 'Import a spreadsheet' + (u.plan === 'premium' ? '' : ' <span class="af-lock">Premium</span>');
    const ai = $('am-av'); ai.textContent = av.textContent; ai.style.cssText = av.style.cssText; if (window.CTMePaint) window.CTMePaint();
    if (window.CTHomeMenu) window.CTHomeMenu();
  }
  function placeMenu() {
    let r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null; if (!r || !r.width) r = av.getBoundingClientRect(); const w = menu.offsetWidth;
    menu.style.top = (r.bottom + 8) + 'px';
    menu.style.left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12)) + 'px';
  }
  const PHONE = matchMedia('(max-width:760px)'), bd = $('am-bd');
  let anchor = null;
  function openMenu(src) { anchor = src || null; renderMenu(); menu.hidden = false; placeMenu(); if (PHONE.matches) { bd.hidden = false; document.documentElement.classList.add('am-lock'); } window.CTNav.push('menu', () => closeMenu(false, true)); av.setAttribute('aria-expanded', 'true'); const f = menu.querySelector('[role="menuitem"]'); if (f) f.focus({ preventScroll: true }); }
  document.querySelector('#app-menu .am-x').addEventListener('click', e => { e.stopPropagation(); closeMenu(true); });
  const calmM = matchMedia('(prefers-reduced-motion: reduce)');
  function closeMenu(focus, fromPop) {
    if (menu.hidden) return;
    // phones: the sheet slides back down (from wherever a swipe left it)
    if (PHONE.matches && !calmM.matches && !menu.dataset.closing) { menu.dataset.closing = '1'; const from = menu.style.transform || 'none'; menu.style.animation = 'none';
      // v52.53 the dimmed background fades from where it is now: after a swipe it has already faded, so it must not pop back
      // to full dim first (that was the flash); a menu already swiped off screen finishes right away
      const bo = parseFloat(getComputedStyle(bd).opacity), gone = window.CTMotion && window.CTMotion.at(menu)[1] >= menu.offsetHeight - 2, ms = gone ? 60 : 220;
      const a = menu.animate([{ transform: from }, { transform: 'translateY(100%)' }], { duration: ms, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }); bd.animate([{ opacity: isNaN(bo) ? 1 : bo }, { opacity: 0 }], { duration: ms, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
      a.onfinish = () => { delete menu.dataset.closing; menu.style.transform = ''; menu.style.animation = ''; a.cancel(); bd.getAnimations().forEach(x => x.cancel()); reallyClose(focus, fromPop); }; return; }
    // v50.98 computers: a quick fade instead of vanishing
    if (!PHONE.matches && !calmM.matches && !menu.dataset.closing) { menu.dataset.closing = '1'; menu.classList.add('am-out');
      setTimeout(() => { delete menu.dataset.closing; menu.classList.remove('am-out'); reallyClose(focus, fromPop); }, 140); return; }
    reallyClose(focus, fromPop);
  }
  function reallyClose(focus, fromPop) { if (menu.hidden) return; menu.hidden = true; menu.style.removeProperty('animation'); menu.style.removeProperty('transition'); menu.style.transform = ''; bd.style.opacity = ''; bd.hidden = true; document.documentElement.classList.remove('am-lock'); if (!fromPop) window.CTNav.done('menu'); av.setAttribute('aria-expanded', 'false'); if (focus) av.focus(); }
  av.addEventListener('click', e => { e.stopPropagation(); menu.hidden ? openMenu() : closeMenu(); });
  // one profile menu everywhere: Card Board's and Stories' avatars open this same menu
  window.CTMenu = { open: src => { if (menu.hidden) openMenu(src); else closeMenu(); }, close: () => closeMenu(), get open_() { return !menu.hidden; } };
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#app-menu')) closeMenu(); });
  // Appearance and haptics: the same settings as Card Board and Stories (shared keys, so one choice applies everywhere)
  const touchDev = matchMedia('(hover:none)').matches;
  function applyTheme(th, save) { if (th === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th; if (save) { try { localStorage.setItem('cb.theme', th); } catch (e) {} } $('am-theme').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.th === th)); }
  let th0 = 'auto'; try { th0 = localStorage.getItem('cb.theme') || 'auto'; } catch (e) {} applyTheme(th0, false);
  window.CTApplyTheme = applyTheme;   // v50.27: appearance follows the account (prefs.js)
  // v43.3: no haptics (iPhones don't allow web pages to vibrate, so the setting did nothing for most people). Kept as a no-op
  // so the places that call it don't need to change.
  window.ctBuzz = () => {}; try { localStorage.removeItem('cb.haptics'); } catch (e) {}
  // Sales show: what you kept after fees (the default) or the full sale price, in the list and the gallery
  const paintAmt = () => { let v = 'kept'; try { v = localStorage.getItem('ct.amt') || 'kept'; } catch (e) {} $('am-amt').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.amt === v))); };
  paintAmt(); addEventListener('ct-amt', paintAmt);
  $('am-amt').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (!b) return; try { localStorage.setItem('ct.amt', b.dataset.amt); } catch (er) {} paintAmt(); window.ctBuzz(); dispatchEvent(new Event('ct-amt')); });
  // Start on: which range Entries, Board and Stories open on. Follows the account to every device. Year and All time are Premium.
  const soPrem = () => window.CTStore && CTStore.plan() === 'premium';
  const paintStart = () => { const v = soPrem() ? ((window.CTStore && CTStore.meta('startOn')) || 'month') : 'month';
    $('am-start').querySelectorAll('button').forEach(b => { b.setAttribute('aria-checked', String(b.dataset.so === v)); b.classList.toggle('solk', !soPrem() && b.dataset.so !== 'month'); }); };
  paintStart(); if (window.CTStore) CTStore.on(r => { if (r === 'plan' || r === 'meta' || r === 'remote') paintStart(); });
  $('am-start').addEventListener('click', async e => { e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
    if (!soPrem() && b.dataset.so !== 'month') { if (window.CTPremiumOpen) window.CTPremiumOpen('range'); return; }
    window.ctBuzz(); b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    if (window.CTStore) await CTStore.setMeta('startOn', b.dataset.so); });
  $('am-theme').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) { applyTheme(b.dataset.th, true); window.ctBuzz(); } });
  document.addEventListener('keydown', e => {
    if (menu.hidden) return;
    if (e.key === 'Escape') { closeMenu(true); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); const items = [...menu.querySelectorAll('button:not([hidden]), summary')].filter(x => x.offsetParent);
      const i = items.indexOf(document.activeElement); const n = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]; if (n) n.focus();
    }
  });
  addEventListener('resize', () => { if (!menu.hidden) placeMenu(); });
  S.on(() => { if (!menu.hidden) renderMenu(); });

  menu.addEventListener('click', async e => {
    const b = e.target.closest('button, summary'); if (!b) return;
    if (b.closest('#am-theme') || b.id === 'am-hap') return;
    if (b.dataset.go) { closeMenu(); const g = b.dataset.go; if (g === 'entries') return; if (window.CTBoardLoader) window.CTBoardLoader.open(g === 'stories' ? 'stories' : null); else Dash.toast((g === 'board' ? 'Card Board' : 'Card Stories') + ' is still loading. Try again in a moment.'); return; }
    if (b.dataset.feedback != null) { closeMenu(); if (window.CTFeedback) setTimeout(() => window.CTFeedback.open(), PHONE.matches ? 250 : 0); return; }   // v52.23
    if (b.dataset.soon) { closeMenu(); Dash.toast(b.dataset.soon + ' arrives in a later update.'); return; }
    if (b.id === 'am-budget') { closeMenu(); if (window.CTBudget) window.CTBudget.open(document.getElementById('ct-budget').hidden ? null : document.getElementById('ct-budget')); return; }
    if (b.id === 'am-plats') { closeMenu(); if (window.CTNotify) setTimeout(() => window.CTNotify.open('plats'), PHONE.matches ? 250 : 0); return; }
    if (b.id === 'am-ntf' || b.id === 'am-ntfset') { closeMenu(); if (window.CTNotify) setTimeout(() => window.CTNotify.open(b.id === 'am-ntfset' ? 'settings' : 'list'), PHONE.matches ? 250 : 0); return; }
    if (b.id === 'am-export') { closeMenu(); Dash.exportCSV(); return; }
    if (b.id === 'am-import') { closeMenu(); Dash.openImport(); return; }
    if (b.id === 'am-out') { Sess.signOut(); showAuth(); return; }
    if (b.dataset.plan) { if (Sess.REAL) { try { const j = await Sess.api('/auth/plan', { plan: b.dataset.plan }); Sess.fromUser(j.user, (Sess.current() || {}).via); } catch (er) { Dash.toast(er.message); return; } } await S.setPlan(b.dataset.plan); Dash.toast(b.dataset.plan === 'premium' ? 'Now testing as Premium' : 'Now testing as Free'); return; }
    const d = b.dataset.dev; if (!d) return;
    if (d === 'sample') { await S._loadSample(sampleEntries()); Dash.toast('Loaded ' + sampleEntries().length + ' sample entries (they don’t count toward the limit)'); }
    else if (d === 'ntfdemo') { await window.CTNotify.demo(); Dash.toast('Sample notifications added. Look for the dot on your picture.'); }
    else if (d === 'ntfclear') { await window.CTNotify.clearDemo(); Dash.toast('Notifications cleared'); }
    else if (d === 'near') { await S._setUsage(17); Dash.toast('Usage set to 17 of 20'); }
    else if (d === 'full') { await S._setUsage(20); Dash.toast('Usage set to 20 of 20'); }
    else if (d === 'usage0') { await S._setUsage(0); Dash.toast('Usage reset to 0'); }
    else if (d === 'days') { const t = new Date(); await S._setSigninDays([-2, -1, 0].map(i => S.ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i)))); Dash.toast('Counted as 3 sign-in days. The Import link shows on the first-run screen for Free.'); }
    else if (d === 'clear') { if (b.dataset.armed) { delete b.dataset.armed; lab(b, 'Clear all data'); closeMenu(); await S._clearAll(); Dash.toast('All entries cleared on this device'); } else { b.dataset.armed = 1; lab(b, 'Tap again to clear everything'); setTimeout(() => { delete b.dataset.armed; lab(b, 'Clear all data'); }, 4000); } }
  });

  // Sample entries for testing, dated around today so every view has something to show (art from the site demo)
  // Preview helper (local mode + ?preview only): one tap loads the sample entries as Premium
  if (Sess.LOCAL_MODE && !PUBLIC_HOST && /[?&]preview\b/.test(location.search)) {
    const pv = document.createElement('button'); pv.type = 'button'; pv.className = 'pv-chip'; pv.textContent = 'Load sample entries';
    pv.addEventListener('click', async () => { if (S.setPlan) await S.setPlan('premium'); await S._loadSample(sampleEntries()); clearInterval(pvT); pv.remove(); Dash.toast(S.plan() === 'premium' ? 'Sample entries loaded. Tap Board for Card Board.' : 'Sample entries loaded. You’re on Free: tap ⤢ on Insights for the free Card Board.'); });
    const show = () => { if (!document.querySelector('.pv-chip') && !$('view-app').hidden) document.body.appendChild(pv); };
    const pvT = setInterval(show, 800); show();
  }
  function sampleEntries() {
    const now = new Date(), Y = now.getFullYear(), M = now.getMonth(), D = now.getDate();
    const at = (mBack, day) => { const last = new Date(Y, M - mBack + 1, 0).getDate(); const d = mBack === 0 ? Math.min(day, D) : Math.min(day, last); return S.ymd(new Date(Y, M - mBack, d)); };
    const art = k => ({ list: 'assets/card-art/' + k + '-sm.webp?v=3', detail: 'assets/card-art/' + k + '.webp?v=3' });
    return [
      { date: at(0, Math.ceil(D * .9)), type: 'sale', platform: 'eBay', name: 'Pikachu ex - 238/191 - SV08: Surging Sparks', amount: '255.00', fees: '33.80', ship: '6.70', condition: 'Near Mint', art: art('pikachu-ex') },
      { date: at(0, Math.ceil(D * .45)), type: 'purchase', platform: 'eBay', name: 'Gengar ex - 154/128 - ME: 30th Celebration', amount: '64.80', condition: 'Near Mint', art: art('gengar-ex') },
      { date: at(0, Math.ceil(D * .2)), type: 'sale', platform: 'TCGplayer', name: 'Chi-Yu ex - 259/193 - SV02: Paldea Evolved', qty: 2, amount: '85.90', fees: '10.57', ship: '1.11', condition: 'Near Mint', art: art('chi-yu-ex') },
      { date: at(1, 26), type: 'purchase', platform: 'eBay', name: 'Son Gohan : Youth - FB03-139 (Alternate Art) - Raging Roar', amount: '142.88', condition: 'Near Mint', art: art('son-gohan-youth') },
      { date: at(1, 23), type: 'sale', platform: 'TCGplayer', name: 'Charizard ex - 199/165 - SV: Scarlet & Violet 151', amount: '277.04', fees: '31.83', ship: '5.18', condition: 'Lightly Played', art: art('charizard-ex') },
      { date: at(1, 9), type: 'refund', platform: 'eBay', name: 'Houndoom - 4/64 - Neo Revelation', amount: '18.40', note: 'Arrived creased, seller refunded', art: { list: 'assets/card-art/houndoom-sm.webp', detail: 'assets/card-art/houndoom.webp' } },
      { date: at(2, 17), type: 'purchase', platform: 'TCGplayer', name: 'Greninja ex - 214/167 - SV06: Twilight Masquerade', amount: '227.75', condition: 'Near Mint', art: art('greninja-ex') },
      { date: at(2, 11), type: 'sale', platform: 'Card Show', name: 'Blastoise - 2/102 - Base Set Unlimited', amount: '120.00', fees: '0', ship: '0', condition: 'Lightly Played', art: art('blastoise') },
      { date: at(2, 4), type: 'purchase', platform: 'Whatnot', name: 'Houndoom - 4/64 - Neo Revelation', amount: '18.40', condition: 'Near Mint', art: { list: 'assets/card-art/houndoom-sm.webp', detail: 'assets/card-art/houndoom.webp' } },
      { date: at(3, 20), type: 'purchase', platform: 'Local game store', name: 'Surging Sparks booster bundle', amount: '32.39', condition: 'Sealed' },
      // HD samples with an artwork-only copy (wall), so Featured card shows full art in the preview
      { date: at(1, 14), type: 'sale', platform: 'eBay', name: 'Mega Gengar ex - 284/217 - Ascended Heroes', amount: '421.50', fees: '27.83', ship: '1.27', condition: 'Near Mint', art: { list: 'assets/card-art/mega-gengar-ex-sm.webp?v=3', detail: 'assets/card-art/mega-gengar-ex.webp?v=3', wall: 'assets/card-art/mega-gengar-ex-wall.webp', focus: [50, 50] } },
      { date: at(4, 2), type: 'purchase', platform: 'TCGplayer', name: 'Mega Gengar ex - 284/217 - Ascended Heroes', amount: '180.00', condition: 'Near Mint', art: { list: 'assets/card-art/mega-gengar-ex-sm.webp?v=3', detail: 'assets/card-art/mega-gengar-ex.webp?v=3', wall: 'assets/card-art/mega-gengar-ex-wall.webp', focus: [50, 50] } },
      { date: at(0, Math.ceil(D * .6)), type: 'sale', platform: 'eBay', name: 'Articuno ex - 036/082 - Japanese', amount: '170.00', fees: '22.11', ship: '1.27', condition: 'Lightly Played', art: { list: 'assets/card-art/articuno-ex-sm.webp?v=3', detail: 'assets/card-art/articuno-ex.webp?v=3', wall: 'assets/card-art/articuno-ex-wall.webp', focus: [50, 62] } },
      { date: at(2, 6), type: 'purchase', platform: 'Card Show', name: 'Articuno ex - 036/082 - Japanese', amount: '40.00', condition: 'Lightly Played', art: { list: 'assets/card-art/articuno-ex-sm.webp?v=3', detail: 'assets/card-art/articuno-ex.webp?v=3', wall: 'assets/card-art/articuno-ex-wall.webp', focus: [50, 62] } },
      { date: at(1, 3), type: 'purchase', platform: 'TCGplayer', name: 'Magby - 186/182 - Paradox Rift', amount: '48.99', condition: 'Near Mint', art: { list: 'assets/card-art/magby-sm.webp?v=3', detail: 'assets/card-art/magby.webp?v=3', wall: 'assets/card-art/magby-wall.webp', focus: [52, 52] } }
    ];
  }

  // ---------- go ----------
  // 1) a sign-in link or the return from Google, 2) the copy of who you are (checked with the server in the background),
  // 3) a session cookie without a copy (new device after Google), 4) the sign-in page
  (async () => {
    const fromUrl = await Sess.fromUrl();
    if (fromUrl && fromUrl.session) { showApp(fromUrl.session, fromUrl.isNew); return; }
    const s = Sess.current();
    if (s) { await showApp(s, false); if (Sess.REAL) Sess.check().then(c => { if (!c) { showAuth(); if (fromUrl && fromUrl.error && auth) auth.error(fromUrl.error); } else applyServer(c); }); return; }
    if (Sess.REAL) { const c = await Sess.check(); if (c) { showApp(c, false); return; } }
    showAuth(); if (fromUrl && fromUrl.error && auth) auth.error(fromUrl.error);
  })();
})();
