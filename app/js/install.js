/* Add to Home Screen, and the one-tip-at-a-time rule.
   - window.CTTips: at most one first-time tip per visit, and never two within a day, so nobody gets several at once.
   - On phones (not already installed), after you've added a few entries yourself and on a later visit, a card offers to put
     Card Tab on your Home Screen. "Show me how" opens steps for your exact phone and browser; "Don't show again" ends it;
     ✕ means not now (asks again in a few days, at most 3 times). The same steps are always in the profile menu on phones.
   - Android Chrome: a real Install button when the browser offers one. */
(function () {
  'use strict';
  const S = window.CTStore, $ = id => document.getElementById(id);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const DAY = 864e5;

  // ---------- one tip at a time ----------
  let sessionTip = null;
  window.CTTips = {
    can(id) { if (sessionTip && sessionTip !== id) return false; const last = get('ct.tips.last', 0); return sessionTip === id || Date.now() - last > DAY * .8 || !last; },
    mark(id) { sessionTip = id; put('ct.tips.last', Date.now()); }
  };

  // ---------- which phone, which browser ----------
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const phone = () => (iOS || android || matchMedia('(pointer:coarse)').matches) && matchMedia('(max-width:760px)').matches;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const browser = iOS ? (/CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : /Safari\//.test(ua) && !/(FBAN|FBAV|Instagram|Line|GSA)/.test(ua) ? 'safari' : 'inapp')
    : android ? (/SamsungBrowser/.test(ua) ? 'samsung' : /Firefox/.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : 'other') : 'desktop';

  // Android: keep the browser's install offer so our button can use it
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; paintSheet(); });
  addEventListener('appinstalled', () => { deferred = null; put('ct.hs', Object.assign(get('ct.hs', {}), { done: 1 })); hideCard(); paintMenu(); });
  // the offline helper (Android requires it to offer installing); only on the real site, never in previews
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !/[?&]preview\b/.test(location.search)) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} }

  // ---------- the steps for this device ----------
  const I = {
    shareIOS: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    plusSq: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    dots: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>',
    lines: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    safari: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    phone: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 8.5v6M9 11.5h6"/></svg>'
  };
  function steps() {
    // phrased for any browser: people use Safari, Chrome, Edge, Firefox and others
    if (iOS && browser === 'inapp') return { who: 'iPhone', list: [[I.safari, 'Open this page in <b>your browser</b> first (this app’s viewer can’t add it)'], [I.shareIOS, 'Tap <b>Share</b> in your browser'], [I.plusSq, 'Tap <b>Add to Home Screen</b>, then <b>Add</b>']] };
    if (iOS) return { who: 'iPhone', list: [[I.shareIOS, 'Tap <b>Share</b> in your browser (at the bottom or in the address bar)'], [I.plusSq, 'Tap <b>Add to Home Screen</b>'], [I.check, 'Tap <b>Add</b>']] };
    if (android) return { who: 'Android', list: [[I.dots, 'Open <b>your browser’s menu</b> (⋮ or ≡)'], [I.phone, 'Tap <b>Install app</b> or <b>Add to Home screen</b>'], [I.check, 'Confirm with <b>Install</b> or <b>Add</b>']] };
    return { who: 'Your phone', list: [[I.shareIOS, 'Open your browser’s <b>Share</b> or <b>menu</b>'], [I.plusSq, 'Choose <b>Add to Home Screen</b>'], [I.check, 'Confirm']] };
  }

  // ---------- the window with the steps ----------
  const dlg = document.createElement('dialog'); dlg.className = 'hs-sheet'; dlg.id = 'hs-sheet'; dlg.setAttribute('aria-labelledby', 'hs-h');
  dlg.innerHTML = '<div class="hs-p"><div class="hs-hd"><span class="hs-ic" aria-hidden="true"><img src="icon-192.png" alt="" width="44" height="44"></span><div><h2 id="hs-h">Add to Home Screen</h2><p id="hs-who"></p></div><button type="button" class="hs-x" data-close aria-label="Close">✕</button></div>' +
    '<p class="hs-why">Card Tab opens full screen with its own icon, like an app, with no browser bars in the way.</p>' +
    '<button type="button" class="hs-install" id="hs-install" hidden>Install Card Tab</button><ol class="hs-steps" id="hs-steps"></ol><button type="button" class="hs-ok" data-close>Got it</button></div>';
  document.body.appendChild(dlg);
  function paintSheet() {
    const s = steps(); $('hs-who').textContent = s.who;
    $('hs-steps').innerHTML = s.list.map((x, i) => '<li><span class="hs-n">' + (i + 1) + '</span><span class="hs-si" aria-hidden="true">' + x[0] + '</span><span>' + x[1] + '</span></li>').join('');
    $('hs-install').hidden = !deferred;
  }
  function openSheet() { paintSheet(); hideCard(); if (window.CTMenu) window.CTMenu.close(); dlg.showModal(); try { dlg.querySelector('.hs-p').focus({ preventScroll: true }); } catch (e) {} }
  dlg.addEventListener('click', async e => {
    if (e.target === dlg || e.target.closest('[data-close]')) { dlg.close(); return; }
    if (e.target.closest('#hs-install') && deferred) { const d = deferred; deferred = null; d.prompt(); try { const r = await d.userChoice; if (r && r.outcome === 'accepted') dlg.close(); } catch (er) {} paintSheet(); }
  });
  window.CTInstall = { open: openSheet };

  // ---------- the card that offers it ----------
  const card = document.createElement('div'); card.className = 'ct-hint'; card.setAttribute('role', 'status');
  card.innerHTML = '<button type="button" class="ch-x" aria-label="Not now">✕</button><div class="ht"><img src="icon-192.png" alt="" width="40" height="40"><span><b>Put Card Tab on your Home Screen</b><small>It opens full screen, like an app.</small></span></div><div class="ha"><button type="button" class="h1">Don’t show again</button><button type="button" class="h2">Show me how</button></div>';
  document.body.appendChild(card);
  function hideCard() { card.classList.remove('on'); document.documentElement.classList.remove('ct-hinting'); }
  card.querySelector('.ch-x').addEventListener('click', () => { const st = get('ct.hs', {}); st.snooze = Date.now() + 3 * DAY; put('ct.hs', st); hideCard(); });
  card.querySelector('.h1').addEventListener('click', () => { const st = get('ct.hs', {}); st.off = 1; put('ct.hs', st); hideCard(); });
  card.querySelector('.h2').addEventListener('click', openSheet);

  const ownEntries = () => S.all().filter(e => e.counted !== false).length;
  function eligible() {
    const st = get('ct.hs', {});
    if (!phone() || standalone() || st.off || st.done || (st.n || 0) >= 3 || (st.snooze && Date.now() < st.snooze)) return false;
    if (get('ct.visits', 0) < 2 || ownEntries() < 3) return false;
    if ($('view-app') && $('view-app').hidden) return false;
    if (document.querySelector('dialog[open]') || document.documentElement.classList.contains('cbopen')) return false;
    return window.CTTips.can('install');
  }
  function maybeShow() {
    if (card.classList.contains('on') || !eligible()) return;
    const st = get('ct.hs', {}); st.n = (st.n || 0) + 1; put('ct.hs', st); window.CTTips.mark('install');
    document.documentElement.classList.add('ct-hinting'); card.classList.add('on');
  }
  // a visit counts once per day
  (function () { const d = new Date().toDateString(); if (get('ct.visit.day', '') !== d) { put('ct.visit.day', d); put('ct.visits', get('ct.visits', 0) + 1); } })();
  // checked a little after the app settles, and a few seconds after you add an entry (never on top of the add flow)
  setTimeout(maybeShow, 4000);
  let addT = 0; S.on(r => { if (r === 'add' || r === 'create' || r === 'put') { clearTimeout(addT); addT = setTimeout(maybeShow, 5000); } });

  // ---------- the profile menu row (phones, not installed) ----------
  function paintMenu() {
    let row = $('am-hs');
    if (!row) {
      const ref = document.querySelector('#app-menu [data-soon="Plan and billing"]'); if (!ref) return;
      row = document.createElement('button'); row.type = 'button'; row.id = 'am-hs'; row.setAttribute('role', 'menuitem');
      row.innerHTML = '<svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 8.5v6M9 11.5h6"/></svg><span>Add to Home Screen</span>';
      row.addEventListener('click', e => { e.stopPropagation(); openSheet(); });
      ref.parentElement.insertBefore(row, ref);
    }
    row.hidden = !phone() || standalone() || get('ct.hs', {}).done;
  }
  paintMenu(); addEventListener('resize', paintMenu);
})();
