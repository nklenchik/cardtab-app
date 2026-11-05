/* Card Tab boot: signed out shows the sign-in page, signed in shows the dashboard (the first screen after sign-in).
   Also runs the account menu (usage lives here) and the local-mode testing tools. */
(function () {
  'use strict';
  const S = window.CTStore, Sess = window.CTSession, Dash = window.CTDash;
  const $ = id => document.getElementById(id);
  const vAuth = $('view-auth'), vApp = $('view-app'), menu = $('app-menu'), av = $('app-avatar');
  let auth = null, whoName = '';
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PREM_PILL = '<span class="am-prem"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>Premium</span>';

  const displayName = s => s.name || (s.via === 'google' && s.email.endsWith('.local') ? 'You' : s.email.split('@')[0].replace(/[._+-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

  async function showApp(session, isNew) {
    vAuth.hidden = true; vApp.hidden = false; document.title = 'Card Tab';
    await S.open({ email: session.email });
    av.textContent = (displayName(session)[0] || '?').toUpperCase();
    whoName = displayName(session); $('am-name').textContent = whoName; $('am-email').textContent = session.email.endsWith('.local') ? 'Signed in on this device' : session.email;
    $('am-dev').hidden = !Sess.LOCAL_MODE;
    Dash.mount();
    if (!S.persistent) Dash.toast('This browser isn’t letting Card Tab save on the device, so entries last until you close the tab.');
    else if (isNew && !S.all().length) Dash.toast('Welcome to Card Tab');
    history.replaceState(null, '', location.pathname);
  }
  function showAuth() {
    S.close(); closeMenu();
    vApp.hidden = true; vAuth.hidden = false; document.title = 'Sign in · Card Tab';
    if (!auth) auth = window.CTAuth.mount(vAuth, (s, isNew) => showApp(s, isNew)); else auth.reset();
    setTimeout(() => $('auth-email').focus({ preventScroll: true }), 50);
  }

  // ---------- account menu ----------
  function renderMenu() {
    const u = S.usage(), p = $('am-plan'), n = $('am-note');
    // A Premium account shows a cranberry Premium pill beside the owner's name
    $('am-name').innerHTML = '<span class="am-nm">' + esc(whoName) + '</span>' + (u.plan === 'premium' ? PREM_PILL : '');
    if (u.plan === 'premium') {
      p.innerHTML = ''; p.hidden = true;
      n.hidden = true;
    } else {
      p.hidden = false; p.innerHTML = '<div class="r"><b>Free plan</b><button type="button" class="up" data-upgrade>Upgrade</button></div><div class="am-meter' + (u.used >= S.WARN_AT ? ' warn' : '') + '"><i style="width:' + Math.min(100, u.used / u.limit * 100) + '%"></i></div><small>' + u.used + ' of ' + u.limit + ' entries this month · resets ' + u.resetsOn + '</small>';
      n.hidden = !(u.warn || u.blocked);
      n.textContent = u.blocked ? 'You’ve used all 20 free entries. They reset on ' + u.resetsOn + '.' : 'You’re nearing your limit: ' + u.left + (u.left === 1 ? ' entry' : ' entries') + ' left this month.';
    }
    menu.querySelectorAll('[data-plan]').forEach(b => b.classList.toggle('on', b.dataset.plan === u.plan));
    // Import: Premium sees it from day one; Free only sees a Premium-tagged link later (see store.showImport)
    const im = $('am-import'); im.hidden = !S.showImport();
    im.querySelector('span').innerHTML = 'Import a spreadsheet' + (u.plan === 'premium' ? '' : ' <span class="af-lock">Premium</span>');
    const ai = $('am-av'); ai.textContent = av.textContent; ai.style.cssText = av.style.cssText;
  }
  function placeMenu() {
    const r = av.getBoundingClientRect(), w = menu.offsetWidth;
    menu.style.top = (r.bottom + 8) + 'px';
    menu.style.left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12)) + 'px';
  }
  const PHONE = matchMedia('(max-width:760px)'), bd = $('am-bd');
  function openMenu() { renderMenu(); menu.hidden = false; placeMenu(); if (PHONE.matches) { bd.hidden = false; document.documentElement.classList.add('am-lock'); } window.CTNav.push('menu', () => closeMenu(false, true)); av.setAttribute('aria-expanded', 'true'); const f = menu.querySelector('[role="menuitem"]'); if (f) f.focus({ preventScroll: true }); }
  function closeMenu(focus, fromPop) { if (menu.hidden) return; menu.hidden = true; bd.hidden = true; document.documentElement.classList.remove('am-lock'); if (!fromPop) window.CTNav.done('menu'); av.setAttribute('aria-expanded', 'false'); if (focus) av.focus(); }
  av.addEventListener('click', e => { e.stopPropagation(); menu.hidden ? openMenu() : closeMenu(); });
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#app-menu')) closeMenu(); });
  // Appearance and haptics: the same settings as Card Board and Stories (shared keys, so one choice applies everywhere)
  const touchDev = matchMedia('(hover:none)').matches;
  function applyTheme(th, save) { if (th === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th; if (save) { try { localStorage.setItem('cb.theme', th); } catch (e) {} } $('am-theme').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.th === th)); }
  let th0 = 'auto'; try { th0 = localStorage.getItem('cb.theme') || 'auto'; } catch (e) {} applyTheme(th0, false);
  let hapOn = true; try { hapOn = localStorage.getItem('cb.haptics') !== '0'; } catch (e) {}
  window.ctBuzz = () => { if (hapOn && touchDev && navigator.vibrate) try { navigator.vibrate(8); } catch (e) {} };
  const paintHap = () => $('am-hap').setAttribute('aria-checked', hapOn); paintHap(); if (!touchDev) $('am-hapr').hidden = true;
  $('am-theme').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) { applyTheme(b.dataset.th, true); window.ctBuzz(); } });
  $('am-hap').addEventListener('click', e => { e.stopPropagation(); hapOn = !hapOn; try { localStorage.setItem('cb.haptics', hapOn ? '1' : '0'); } catch (e) {} paintHap(); window.ctBuzz(); });
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
    if (b.dataset.go) { closeMenu(); const g = b.dataset.go; if (g === 'entries') return; if (S.plan() === 'premium' && window.CTBoardLoader) window.CTBoardLoader.open(g === 'stories' ? 'stories' : null); else Dash.toast(g === 'board' ? 'Full-screen Card Board is part of Premium' : 'Card Stories is part of Premium'); return; }
    if (b.dataset.soon) { closeMenu(); Dash.toast(b.dataset.soon + ' arrives in a later update.'); return; }
    if (b.id === 'am-export') { closeMenu(); Dash.exportCSV(); return; }
    if (b.id === 'am-import') { closeMenu(); Dash.openImport(); return; }
    if (b.id === 'am-out') { Sess.signOut(); showAuth(); return; }
    if (b.dataset.plan) { await S.setPlan(b.dataset.plan); Dash.toast(b.dataset.plan === 'premium' ? 'Now testing as Premium' : 'Now testing as Free'); return; }
    const d = b.dataset.dev; if (!d) return;
    if (d === 'sample') { await S._loadSample(sampleEntries()); Dash.toast('Loaded ' + sampleEntries().length + ' sample entries (they don’t count toward the limit)'); }
    else if (d === 'near') { await S._setUsage(17); Dash.toast('Usage set to 17 of 20'); }
    else if (d === 'full') { await S._setUsage(20); Dash.toast('Usage set to 20 of 20'); }
    else if (d === 'usage0') { await S._setUsage(0); Dash.toast('Usage reset to 0'); }
    else if (d === 'days') { const t = new Date(); await S._setSigninDays([-2, -1, 0].map(i => S.ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i)))); Dash.toast('Counted as 3 sign-in days. The Import link shows on the first-run screen for Free.'); }
    else if (d === 'clear') { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = 'Clear all data'; closeMenu(); await S._clearAll(); Dash.toast('All entries cleared on this device'); } else { b.dataset.armed = 1; b.textContent = 'Tap again to clear everything'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Clear all data'; }, 4000); } }
  });

  // Sample entries for testing, dated around today so every view has something to show (art from the site demo)
  // Preview helper (local mode + ?preview only): one tap loads the sample entries as Premium
  if (Sess.LOCAL_MODE && /[?&]preview\b/.test(location.search)) {
    const pv = document.createElement('button'); pv.type = 'button'; pv.className = 'pv-chip'; pv.textContent = 'Load sample entries';
    pv.addEventListener('click', async () => { await S._loadSample(sampleEntries()); clearInterval(pvT); pv.remove(); Dash.toast(S.plan() === 'premium' ? 'Sample entries loaded. Tap ⤢ on Insights for Card Board.' : 'Sample entries loaded. You’re on Free: tap ⤢ on Insights for the free Card Board.'); });
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
  const s = Sess.current();
  if (s) showApp(s, false); else showAuth();
})();
