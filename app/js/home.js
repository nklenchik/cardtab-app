/* The main screen's job is logging cards and a quick glance at the month (v33, "Concept 2").
   - Each of the four tiles gets one small line that says how you're doing, not just a number.
   - The monthly budget lives in the Spent tile: it fills from the bottom as you spend, says "On track · 43% of $150",
     and tapping it opens the budget window (the ruler).
   - Entries · Board · Stories: a bottom bar on phones, icon tabs beside the logo on desktop. Charts live in Board.
   Everything is exact to the cent. */
(function () {
  'use strict';
  let opener = null;
  const S = window.CTStore, $ = id => document.getElementById(id);
  const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const NF0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const money = c => '$' + NF.format(Math.abs(c) / 100);
  const round$ = c => '$' + (c % 100 ? NF.format(c / 100) : NF0.format(c / 100));
  const pad = n => String(n).padStart(2, '0');
  const keyOf = (y, m) => { const d = new Date(y, m, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const shortName = k => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleString('en-US', { month: 'short' });
  const monthTotals = k => S.totals(S.all().filter(e => e.date.startsWith(k)));

  function line(tile, text, kind) {
    let el = tile.querySelector('.ct-line');
    if (!el) { el = document.createElement('span'); el.className = 'ct-line'; tile.appendChild(el); }
    el.className = 'ct-line' + (kind ? ' is-' + kind : '');
    el.textContent = text; el.hidden = !text;
  }

  let last = null;
  // called by the dashboard each time the totals change: t = totals for what the tiles show, list = those entries, p = the period picked
  function paint(a) {
    if (a) last = a; a = last; if (!a) return;
    const { t, list, p, prem } = a, now = new Date(), cur = keyOf(now.getFullYear(), now.getMonth());
    const tileOf = id => $(id) && $(id).parentElement;
    const sales = tileOf('ct-sales'), after = tileOf('ct-after'), spent = tileOf('ct-spent'), profit = tileOf('ct-profit');
    if (!sales) return;
    // the month the tiles show (null for All time / 30 days)
    const prevOf = k => keyOf(+k.slice(0, 4), +k.slice(5, 7) - 2);
    const sel = p && p.slice(0, 2) === 'm:' ? p.slice(2) : p === 'month' || !prem ? cur : p === 'last' ? prevOf(cur) : null;
    const thisMonth = sel === cur;

    const n = list.filter(e => e.type === 'sale').length;
    line(sales, n ? n + (n === 1 ? ' sale' : ' sales') : 'No sales yet');
    // fees and shipping only; a refund you gave is named on its own, not counted as a fee
    if (t.refunds) line(after, (t.sales ? money(t.fees) + ' in fees\n' : '') + money(t.refunds) + ' refunded', 'two');
    else line(after, t.sales ? money(t.fees) + ' in fees' : '');

    // --- budget, inside the Spent tile ---
    const b = S.budget();
    spent.classList.add('ct-budtile'); spent.setAttribute('role', 'button'); spent.tabIndex = 0;
    if (b) {
      const bk = sel || cur, used = monthTotals(bk).spent, pct = Math.round(used / b.cents * 100), over = used > b.cents, warn = !over && pct >= 80;
      const kind = over ? 'over' : warn ? 'warn' : 'ok';
      const txt = thisMonth ? (over ? 'Over by ' + money(used - b.cents) : (warn ? 'Getting close' : 'On track') + ' · ' + pct + '% of ' + round$(b.cents))
        : sel ? (over ? 'Over by ' + money(used - b.cents) : pct + '% of ' + round$(b.cents))
        : shortName(cur) + (over ? ' · over by ' + money(used - b.cents) : ' · ' + pct + '% of ' + round$(b.cents));
      line(spent, txt, kind);
      spent.style.setProperty('--fill', sel ? Math.min(1, used / b.cents).toFixed(4) : '0');
      spent.dataset.bud = kind;
      spent.setAttribute('aria-label', 'Spent ' + money(t.spent) + '. Budget: ' + money(used) + ' of ' + round$(b.cents) + (thisMonth ? ' this month, ' : ' in ' + shortName(bk) + ', ') + pct + '% used. Edit budget');
    } else {
      line(spent, 'Set a monthly budget', 'set');
      spent.style.setProperty('--fill', '0'); delete spent.dataset.bud;
      spent.setAttribute('aria-label', 'Spent ' + money(t.spent) + '. Set a monthly budget');
    }

    // --- profit: compared with the month before when the tiles show one month, otherwise as a share of sales ---
    let shown = false;
    if (sel) {
      const base = sel, prevK = prevOf(sel);
      const prev = monthTotals(prevK);
      if (prev.entries) { const d = monthTotals(base).profit - prev.profit; line(profit, (d < 0 ? '▼ ' : '▲ ') + money(d) + ' vs ' + shortName(prevK), d < 0 ? 'dn' : 'up'); shown = true; }
    }
    if (!shown) line(profit, t.sales ? Math.round(t.profit / t.sales * 100) + '% of sales' : '');
  }

  // Profit: tap the word for what it means. It's money in minus money out, not profit on each card.
  (function () {
    const btn = document.querySelector('.ct-why'); if (!btn) return;
    const pop = document.createElement('div'); pop.id = 'ct-whypop'; pop.className = 'ct-whypop'; pop.setAttribute('role', 'note'); pop.hidden = true;
    pop.innerHTML = '<b>Money in minus money out</b><p>What your sales brought in after fees and shipping, minus what you spent and any refunds. Cards you still own aren\'t counted, so a month of buying shows below zero.</p>';
    document.body.appendChild(pop);
    let open = false;
    function place() {
      const r = btn.getBoundingClientRect(), w = Math.min(280, innerWidth - 24);
      pop.style.width = w + 'px';
      pop.style.left = Math.max(12, Math.min(r.left - 8, innerWidth - w - 12)) + 'px';
      pop.style.top = (r.bottom + 8) + 'px';
    }
    function set(on) {
      if (on === open) return; open = on; btn.setAttribute('aria-expanded', String(on));
      if (on) { pop.hidden = false; place(); requestAnimationFrame(() => pop.classList.add('in')); }
      else { pop.classList.remove('in'); setTimeout(() => { if (!open) pop.hidden = true; }, 180); }
    }
    btn.addEventListener('click', e => { e.stopPropagation(); set(!open); });
    document.addEventListener('pointerdown', e => { if (open && !e.target.closest('.ct-why,.ct-whypop')) set(false); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { set(false); btn.focus(); } });
    addEventListener('scroll', () => set(false), { passive: true }); addEventListener('resize', () => set(false));
  })();

  // phones: while you search, the four tiles fade away and the list slides up into their place, so results and the
  // search box are both in view; they come back the same way when the search is empty and closed. Transform and
  // opacity only: the tiles fade, then everything below glides from where it was to where it lands.
  (function () {
    const PHQ = matchMedia('(max-width:760px)'), calmQ = matchMedia('(prefers-reduced-motion: reduce)');
    const tiles = document.querySelector('.ct-stats'), q = $('ct-search'), sh = document.querySelector('.ct-shell'); if (!tiles || !q) return;
    const fq = sh && sh.querySelector('.sh-field input');
    let hidden = false, busy = null;
    const below = () => { const out = []; let n = tiles.nextElementSibling; while (n) { out.push(n); n = n.nextElementSibling; }
      let p = tiles.parentElement; n = p && p.nextElementSibling; while (n) { out.push(n); n = n.nextElementSibling; } return out.filter(x => x.offsetParent); };
    const searching = () => PHQ.matches && (!!q.value.trim() || document.activeElement === q || (fq && document.activeElement === fq) || (sh && sh.classList.contains('q-on')));
    function glide(els, before) { els.forEach((el, i) => { const dy = before[i] - el.getBoundingClientRect().top; if (Math.abs(dy) < 1) return;
      el.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }); }); }
    function set(v) {
      if (v === hidden) return; hidden = v; if (busy) { busy.cancel(); busy = null; }
      const els = below();
      if (calmQ.matches) { tiles.classList.toggle('q-hide', v); return; }
      if (v) {
        busy = tiles.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px) scale(.98)' }], { duration: 170, easing: 'ease-in', fill: 'forwards' });
        busy.onfinish = () => { busy = null; const before = els.map(el => el.getBoundingClientRect().top); tiles.classList.add('q-hide'); tiles.getAnimations().forEach(a => a.cancel()); glide(els, before); };
      } else {
        const before = els.map(el => el.getBoundingClientRect().top); tiles.classList.remove('q-hide'); glide(els, before);
        tiles.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 120, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      }
    }
    const check = () => setTimeout(() => set(searching()), 0);
    ['focusin', 'focusout'].forEach(t => document.addEventListener(t, e => { if (e.target === q || e.target === fq) check(); }));
    q.addEventListener('input', check);
    if (sh) new MutationObserver(check).observe(sh, { attributes: true, attributeFilter: ['class'] });
    PHQ.addEventListener('change', check);
  })();

  // the Spent tile opens the budget window, growing out of the tile
  document.addEventListener('click', e => { const tile = e.target.closest('.ct-budtile'); if (tile && window.CTBudget) window.CTBudget.open(tile); });
  document.addEventListener('keydown', e => { const tile = e.target.closest && e.target.closest('.ct-budtile'); if (tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (window.CTBudget) window.CTBudget.open(tile); } });

  // Entries · Board · Stories: the bottom bar on phones (on every page, over Card Board and Stories too) and the tabs on desktop
  const PH = () => matchMedia('(max-width:760px)').matches;
  const cbOpen = () => { const c = document.querySelector('.cbx'); return !!c && !c.classList.contains('off'); };
  const stOpen = () => { const x = document.getElementById('csx'); return !!x && x.classList.contains('in'); };
  // the page name gets its own box, so it can fade and rise on its own when you switch pages (the logo stays put)
  (function () { const br = document.querySelector('.ct-demo-top .ct-brand'); if (!br || br.querySelector('.ct-bname')) return; const n = [...br.childNodes].find(x => x.nodeType === 3 && x.textContent.trim()); if (n) { const sp = document.createElement('span'); sp.className = 'ct-bname'; sp.textContent = n.textContent.trim(); br.replaceChild(sp, n); } })();
  // the parts of the Entries page that move together when the pages slide (the bottom bar stays put)
  window.CTPageEls = () => [document.querySelector('#view-app .ct-app'), document.querySelector('.ct-phead.on'), document.querySelector('.ct-sumbar.on')].filter(Boolean);
  // desktop: while the pages slide, the tabs hold still. One copy sits on top in the same spot and its highlight glides
  // from the page you left to the one you picked; the real tabs on both pages step aside until the slide ends.
  const tabsOf = pg => { if (pg === 'entries') return document.querySelector('.ct-demo-top .ct-tabs'); if (pg === 'board') return document.querySelector('.cbx .cb-tabs');
    const f = document.querySelector('#csx iframe'); try { return f && f.contentDocument && f.contentDocument.querySelector('.cstabs'); } catch (e) { return null; } };
  const rectOf = (el, pg) => { const r = el.getBoundingClientRect(); if (pg !== 'stories') return r; const f = document.querySelector('#csx iframe').getBoundingClientRect(); return { top: r.top + f.top, left: r.left, width: r.width, height: r.height }; };
  window.CTNavHold = function (from, to, ms) {
    if (PH() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const src = tabsOf('entries'), a = tabsOf(from), b = tabsOf(to); if (!src || !a || (!b && to === 'entries')) return;
    // Stories may still be loading the first time; its tabs always sit in the standard spot, same as the board's
    const ra = rectOf(a, from), rb = b ? rectOf(b, to) : ra;
    if (!ra.width || Math.abs(ra.top - rb.top) > 3 || ra.top < -10 || ra.top > 140) return;  // only when both sit in the same spot on screen
    const c = src.cloneNode(true); c.className = 'ct-tabs ct-navhold'; c.setAttribute('aria-hidden', 'true');
    c.querySelectorAll('[aria-current]').forEach(x => x.removeAttribute('aria-current'));
    Object.assign(c.style, { left: ra.left + 'px', top: ra.top + 'px', width: ra.width + 'px', height: ra.height + 'px' });
    const pill = document.createElement('i'); pill.className = 'nh-pill'; c.prepend(pill); document.body.appendChild(c);
    const btn = t => c.querySelector('[data-tab="' + t + '"]'), fb = btn(from), tb = btn(to); if (!fb || !tb) { c.remove(); return; }
    pill.style.width = tb.offsetWidth + 'px';
    pill.animate([{ transform: 'translateX(' + fb.offsetLeft + 'px) scaleX(' + (fb.offsetWidth / tb.offsetWidth) + ')' }, { transform: 'translateX(' + tb.offsetLeft + 'px)' }], { duration: ms, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    fb.classList.add('nh-on'); setTimeout(() => { fb.classList.remove('nh-on'); tb.classList.add('nh-on'); }, ms * .3);
    const fr = document.querySelector('#csx iframe'), fdoc = (() => { try { return fr && fr.contentDocument; } catch (e) { return null; } })();
    document.documentElement.classList.add('navhold'); if (fdoc) fdoc.documentElement.classList.add('navhold');
    clearTimeout(window.__nhT); if (window.__nh) window.__nh.remove(); window.__nh = c;
    window.__nhT = setTimeout(() => { c.remove(); window.__nh = null; document.documentElement.classList.remove('navhold'); if (fdoc) fdoc.documentElement.classList.remove('navhold'); }, ms + 40);
  };
  function go(g, from) {
    if (from) opener = from;
    if (window.ctBuzz) window.ctBuzz('tap');
    if (g === 'entries') {
      // from Stories: the board steps out of the way underneath first, so Stories slides straight back to your list
      // from Stories: the board steps away underneath (out of sight), and Stories slides back straight to your list
      if (stOpen() && window.cbStoriesBack) { if (cbOpen() && window.CTBoard) { window.cbInstant = true; window.CTBoard.close(); } window.cbStoriesBack(true); return; }
      if (cbOpen() && window.CTBoard) window.CTBoard.close(); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (g === 'board') { if (stOpen() && window.cbStoriesBack) { window.cbStoriesBack(); return; } if (cbOpen()) { const c = document.querySelector('.cbx'); c.scrollTo({ top: 0, behavior: 'smooth' }); return; } }
    // Free: Stories is Premium, so its window opens right here (no board opening underneath it)
    // Free users get a taste of Stories too (last month, two themes, one video a month), so everyone goes straight in
    if (g === 'stories' && cbOpen()) { if (!stOpen()) { const b = document.getElementById('cb-stories'); if (b) b.click(); } return; }
    // phones, Premium: Entries straight to Stories is one slide (the board opens underneath without its own slide)
    // Premium: Entries straight to Stories is one page slide (phones and desktop); the board opens underneath without its own
    if (g === 'stories' && window.CTBoardLoader) { window.CTBoardLoader.load().then(() => { window.cbInstant = true; window.cbFromEntries = true; if (!window.cbDataVer) window.CTBoard.refresh(); window.CTBoard.open(); const b = document.getElementById('cb-stories'); if (b) b.click(); }).catch(() => {}); return; }
    const m = document.querySelector('#app-menu [data-go="' + g + '"]'); if (m) m.click();
  }
  window.CTTabGo = go;
  document.addEventListener('click', e => { const a = e.target.closest('[data-tab]'); if (!a) return; go(a.dataset.tab, a); });
  document.addEventListener('click', e => { if (e.target.closest('#ct-fab')) { e.preventDefault(); if (window.CTOpenAdd) window.CTOpenAdd(); else { const a = $('ct-add'); if (a) a.click(); } } });
  // keep the bar's highlight on the page you're on
  function syncTabs() {
    const cur = stOpen() ? 'stories' : cbOpen() ? 'board' : 'entries';
    document.querySelectorAll('#ct-tbar [data-tab], .sh-tabs .ct-tabs [data-tab], .ct-demo-top .ct-tabs [data-tab]').forEach(b => { if (b.dataset.tab === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  const watch = () => { const c = document.querySelector('.cbx'), x = document.getElementById('csx'); const mo = new MutationObserver(syncTabs); if (c) mo.observe(c, { attributes: true, attributeFilter: ['class'] }); if (x) mo.observe(x, { attributes: true, attributeFilter: ['class'] }); return !!(c && x); };
  if (!watch()) { const t = setInterval(() => { if (document.querySelector('.cbx') && document.getElementById('csx')) { clearInterval(t); watch(); syncTabs(); } }, 600); }

  // Card Board grows out of whatever opened it: the tab you tapped, or your avatar when it came from the profile menu
  document.addEventListener('click', e => { if (e.isTrusted && e.target.closest('#app-menu [data-go]')) opener = $('app-avatar'); }, true);
  window.CTBoardFrom = () => (opener && opener.getClientRects().length ? opener : null);

  // ---------- one profile menu on every page, with an "On this page" section ----------
  const IC = {
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    share: '<path d="M13.8 5.6v3.1C8.5 9.2 5.3 12.6 4.6 18.4c2-3 5-4.4 9.2-4.5v3.1c0 .5.6.8 1 .4l5.2-5.1c.3-.3.3-.8 0-1.1L14.8 6c-.4-.4-1-.1-1 .4z"/>',
    ask: '<path d="M12 3.5l2.1 5.6 5.9 2-5.9 2.1L12 19l-2.1-5.8L4 11.1l5.9-2z"/>',
    save: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
    themes: '<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="10" r="1.3" fill="currentColor"/><circle cx="12.5" cy="7.8" r="1.3" fill="currentColor"/><circle cx="15.8" cy="10.8" r="1.3" fill="currentColor"/><path d="M12 20.5c-1.2 0-2-.8-2-1.8 0-1.6 1.6-1.6 1.6-3.2"/>'
  };
  const svg = p => '<svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const storyDoc = () => { const f = document.querySelector('#csx iframe'); try { return f && f.contentDocument; } catch (e) { return null; } };
  const clickIn = (doc, sel) => { const el = doc && doc.querySelector(sel); if (el) el.click(); };
  const PAGE = {
    board: ['On Card Board', [['edit', 'Edit board', () => clickIn(document, '#cb-edit')], ['share', 'Share board', () => clickIn(document, '#cb-share')], ['ask', 'Ask your board', () => clickIn(document, '#cb-ask')]]],
    stories: ['On Card Stories', [['save', 'Save all stories', () => clickIn(storyDoc(), '#svall')], ['themes', 'Story themes', () => clickIn(storyDoc(), '[data-all]')], ['share', 'Play stories', () => { try { const f = document.querySelector('#csx iframe'); f && f.contentWindow.csPlay && f.contentWindow.csPlay(0); } catch (e) {} }]]]
  };
  window.CTHomeMenu = function () {
    window.CTMePaint();
    const cur = stOpen() ? 'stories' : cbOpen() ? 'board' : 'entries';
    document.querySelectorAll('#app-menu .amgo [data-go]').forEach(b => { const on = b.dataset.go === cur; b.classList.toggle('here', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const g = $('am-page'); if (!g) return; g.querySelectorAll('.am-pact').forEach(x => x.remove());
    const t = $('am-page-t'), im = $('am-import'), ex = $('am-export');
    if (cur === 'entries') { t.hidden = true; ex.hidden = false; return; }
    im.hidden = true; ex.hidden = true;
    const [title, acts] = PAGE[cur]; t.textContent = title; t.hidden = false;
    acts.forEach(([ic, label, run]) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.className = 'am-pact'; b.innerHTML = svg(IC[ic]) + '<span>' + label + '</span>';
      b.addEventListener('click', e => { e.stopPropagation(); if (window.CTMenu) window.CTMenu.close(); setTimeout(run, matchMedia('(max-width:760px)').matches ? 300 : 160); }); g.appendChild(b); });
  };
  // Card Board's avatar opens this same menu (its own menu is retired)
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('.cbx #cb-av'); if (!a) return; const btn = a.closest('button') || a; e.preventDefault(); e.stopImmediatePropagation(); if (window.CTMenu) window.CTMenu.open(btn); }, true);
  // admin: show the first-time tips again
  // Admin: compare the two desktop page switches (fade is the default; slide is the phone's)
  const fxBtn = () => document.querySelector('[data-dev="pagefx"]');
  const FX = ['glide', 'fade', 'slide'], FXN = { glide: 'Glide', fade: 'Fade', slide: 'Slide' };
  const fxNow = () => { try { const v = localStorage.getItem('ct.pagefx'); return FX.includes(v) ? v : 'glide'; } catch (e) { return 'glide'; } };
  const fxPaint = () => { const b = fxBtn(); if (b) b.textContent = 'Desktop page switch: ' + FXN[fxNow()]; };
  fxPaint();
  document.addEventListener('click', e => { if (!e.target.closest('[data-dev="pagefx"]')) return; e.stopPropagation(); const n = FX[(FX.indexOf(fxNow()) + 1) % FX.length]; try { localStorage.setItem('ct.pagefx', n); } catch (er) {} fxPaint(); if (window.CTDash) window.CTDash.toast('Desktop page switch: ' + FXN[n]); }, true);
  document.addEventListener('click', e => { if (!e.target.closest('[data-dev="tips"]')) return; try { localStorage.removeItem('cb.hint'); } catch (er) {} if (window.CTDash) window.CTDash.toast('First-time tips will show again'); });


  // ---------- you: one avatar and name everywhere (from the profile you save in Edit profile) ----------
  const inkFor = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff'; const n = parseInt(m[1], 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#1a1918' : '#fff'; };
  window.CTMePaint = function () {
    let a = {}, pr = {}; try { a = JSON.parse(localStorage.getItem('cb.avatar')) || {}; pr = JSON.parse(localStorage.getItem('cb.profile')) || {}; } catch (e) {}
    const first = (pr.first || '').trim(), name = pr.show === 'full' && pr.last ? first + ' ' + pr.last : first;
    if (!a.photo && !a.color) a.color = '#a50e37';   // the board's default color, so the avatar looks the same on every page
    ['app-avatar', 'am-av'].forEach(id => { const el = $(id); if (!el) return; if (a.photo) { el.style.background = 'url(' + a.photo + ') center/cover'; el.textContent = ''; } else if (a.color) { el.style.background = a.color; el.style.color = inkFor(a.color); if (first) el.textContent = first[0].toUpperCase(); } });
    const nm = document.querySelector('#am-name .am-nm'); if (nm && name) nm.textContent = name;
  };
  setTimeout(() => window.CTMePaint(), 0); addEventListener('storage', e => { if (/^cb\.(avatar|profile)$/.test(e.key || '')) window.CTMePaint(); });
  // tapping your name at the top of the menu opens Edit profile
  document.addEventListener('click', e => { const h = e.target.closest('#app-menu .am-who'); if (!h || e.target.closest('.am-x')) return; e.stopPropagation(); if (window.CTMenu) window.CTMenu.close();
    if (window.CTBoardLoader) window.CTBoardLoader.load().then(() => setTimeout(() => window.CTProfileOpen && window.CTProfileOpen(), 180)).catch(() => {}); });

  // phones: swipe the profile sheet down to close it (only when it's scrolled to the top)
  (function () { const m = $('app-menu'); if (!m) return; let y0 = null, dy = 0, t0 = 0;
    m.addEventListener('touchstart', e => { if (!matchMedia('(max-width:760px)').matches || m.scrollTop > 0) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; t0 = performance.now(); }, { passive: true });
    m.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { m.style.animation = 'none'; m.style.transform = 'translateY(' + dy + 'px)'; if (e.cancelable) e.preventDefault(); } }, { passive: false });
    m.addEventListener('touchend', () => { if (y0 == null) return; const v = dy / Math.max(1, performance.now() - t0); y0 = null;
      if (dy > 90 || v > .6) { if (window.CTMenu) window.CTMenu.close(); return; }
      if (dy > 0) { const a = m.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' }); m.style.transform = ''; a.onfinish = () => { m.style.animation = ''; }; } }, { passive: true });
  })();

  // ---------- your avatar rides along in each slim bar, so settings are one tap away at any scroll ----------
  const meBtns = new Set();
  function mkMe() { const b = document.createElement('button'); b.type = 'button'; b.className = 'app-avatar ct-me'; b.tabIndex = -1; b.setAttribute('aria-label', 'Account'); meBtns.add(b); syncMe(); return b; }
  function syncMe() { const src = $('app-avatar'); if (!src) return; meBtns.forEach(b => { b.style.cssText = src.style.cssText; b.textContent = src.textContent; }); }
  const avSrc = $('app-avatar'); if (avSrc) new MutationObserver(syncMe).observe(avSrc, { attributes: true, attributeFilter: ['style'], childList: true, characterData: true, subtree: true });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.ct-me'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation(); if (window.CTMenu) window.CTMenu.open(b); }, true);
  // Entries' slim bar and Board's slim bar get one as soon as they exist
  const fit = setInterval(() => {
    const st = document.querySelector('.ct-phead .ph-r'); if (st && !st.querySelector('.ct-me')) st.appendChild(mkMe());
    const sic = document.querySelector('.cbslim .sic'); if (sic && !sic.querySelector('.ct-me')) sic.appendChild(mkMe());
    if (st && st.querySelector('.ct-me') && sic && sic.querySelector('.ct-me')) clearInterval(fit);
  }, 700);
  window.CTHome = { paint };
  S.on(() => paint());
})();
