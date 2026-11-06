/* Month by month, plus other ranges (v35.5).
   - The switcher above the tiles: ‹ November 2026 › and a range menu (By month, Last 7 days, Last 30 days, This year,
     All time, Custom dates). The page always opens on the month you're in. Every number on screen (tiles, budget,
     "vs Oct", the list) follows the range you pick, and ‹ › always step by that range: a month, 7 days, 30 days, a year,
     or as many days as your custom pick. Search looks through every month.
   - Desktop: once the tiles scroll away, a slim bar fades in at the top with the range, Spent and the budget, Profit,
     search and + Add, so the numbers and the two things you do are always one glance or one click away.
   - Desktop: ← → move between Entries, Board and Stories (1, 2, 3 jump straight there), whenever you aren't typing
     or using something that already uses the arrows. Ranges change only with the ‹ › buttons, so a key never does two things.
   Period values (kept in the hidden date-range menu the dashboard reads): 'm:2026-11', 'r7:2026-10-30:2026-11-05',
   'r30:…', 'rc:…' (custom), 'y:2026', 'all'. Animations are opacity and transform only. */
(function () {
  'use strict';
  const S = window.CTStore, $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const PH = () => matchMedia('(max-width:760px)').matches;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const day = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const addDays = (s, n) => { const d = day(s); d.setDate(d.getDate() + n); return ymd(d); };
  const daysBetween = (a, b) => Math.round((day(b) - day(a)) / 864e5);
  const today = () => ymd(new Date());
  const curKey = () => today().slice(0, 7);
  const shift = (k, n) => { const d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const label = (k, short) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 15).toLocaleString('en-US', short ? { month: 'short', year: 'numeric' } : { month: 'long', year: 'numeric' });
  const sel = $('ct-period'), stats = document.querySelector('.ct-stats');
  if (!sel || !stats) return;
  const ARROW = d => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (d < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6') + '"/></svg>';
  const CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  // ---------- reading a period ----------
  function parse(v) {
    v = v || 'all';
    if (v.slice(0, 2) === 'm:') return { kind: 'month', m: v.slice(2) };
    if (v === 'month') return { kind: 'month', m: curKey() };
    if (v === 'last') return { kind: 'month', m: shift(curKey(), -1) };
    let r = /^r(7|30|c):(\d{4}-\d\d-\d\d):(\d{4}-\d\d-\d\d)$/.exec(v);
    if (r) return { kind: r[1] === 'c' ? 'custom' : 'd' + r[1], from: r[2], to: r[3], tag: 'r' + r[1] };
    if (v === 'd30') return { kind: 'd30', from: addDays(today(), -29), to: today(), tag: 'r30' };
    r = /^y:(\d{4})$/.exec(v); if (r) return { kind: 'year', y: +r[1] };
    return { kind: 'all' };
  }
  const startOf = p => p.kind === 'month' ? p.m + '-01' : p.kind === 'year' ? p.y + '-01-01' : p.from || '';
  const earliestDay = () => { let m = today(); S.all().forEach(e => { if (e.date < m) m = e.date; }); return m; };
  const short = s => day(s).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  function rangeText(a, b) {
    const ya = a.slice(0, 4), yb = b.slice(0, 4), thisY = today().slice(0, 4);
    if (a === b) return short(a) + (ya !== thisY ? ', ' + ya : '');
    if (ya !== yb) return short(a) + ', ' + ya + ' – ' + short(b) + ', ' + yb;
    const sameM = a.slice(0, 7) === b.slice(0, 7);
    return short(a) + ' – ' + (sameM ? String(+b.slice(8, 10)) : short(b)) + (ya !== thisY ? ', ' + ya : '');
  }
  function textOf(p, mini) {
    if (p.kind === 'month') return label(p.m, mini);
    if (p.kind === 'year') return String(p.y);
    if (p.from) return rangeText(p.from, p.to);
    return 'All time';
  }
  const BTN = { month: 'Month', d7: '7 days', d30: '30 days', year: 'Year', all: 'All time', custom: 'Custom' };
  // one step back (-1) or forward (+1) by the range you're looking at, or null when there's nowhere to go
  function stepped(p, dir) {
    if (p.kind === 'month') { const n = shift(p.m, dir); return n > curKey() || n < earliestDay().slice(0, 7) ? null : 'm:' + n; }
    if (p.kind === 'year') { const y = p.y + dir; return y > +today().slice(0, 4) || y < +earliestDay().slice(0, 4) ? null : 'y:' + y; }
    if (p.from) {
      const n = daysBetween(p.from, p.to) + 1, f = addDays(p.from, dir * n), t = addDays(p.to, dir * n);
      if (dir > 0 && p.to >= today()) return null;
      if (dir < 0 && p.from <= earliestDay()) return null;
      return p.tag + ':' + f + ':' + (t > today() && dir > 0 ? today() : t);
    }
    return null;
  }

  // ---------- the switcher ----------
  // Every switcher on screen (Entries, Board, the desktop toolbar) is one of these, all showing the same range.
  const inst = [];
  function mk(cls, ranged) {
    const el = document.createElement('div'); el.className = 'ct-mstep ' + cls; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Date range');
    el.innerHTML = '<button type="button" class="ms-prev" aria-label="Back">' + ARROW(-1) + '</button><span class="ms-lab" aria-live="polite"><span></span></span><button type="button" class="ms-next" aria-label="Forward">' + ARROW(1) + '</button>' +
      (ranged ? '<div class="ms-rw"><button type="button" class="ms-rng" aria-haspopup="menu" aria-expanded="false"><span>Month</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></div>' : '');
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.closest('.ms-pop')) return;
      if (b.classList.contains('ms-rng')) { togglePop('menu', el); return; }
      const n = stepped(parse(sel.value), b.classList.contains('ms-prev') ? -1 : 1); if (n) set(n);
    });
    inst.push(el);
    return el;
  }
  const main = mk('ms-main', true);
  stats.parentElement.insertBefore(main, stats);

  // ---------- the range menu and the custom-dates calendar ----------
  let pop = null, popKind = null, popEl = null;
  const rngOf = el => el && el.querySelector('.ms-rng');
  function closePop() { if (!pop) return; const p = pop, r = rngOf(popEl); pop = null; popKind = null; if (r) { r.setAttribute('aria-expanded', 'false'); r.classList.remove('open'); } p.classList.add('out'); setTimeout(() => p.remove(), 160); }
  function openPop(kind, html) {
    if (pop) { pop.remove(); pop = null; }
    const r = rngOf(popEl);
    pop = document.createElement('div'); pop.className = 'ms-pop ms-' + kind; pop.setAttribute('role', kind === 'menu' ? 'menu' : 'dialog'); pop.innerHTML = html;
    popEl.querySelector('.ms-rw').appendChild(pop); popKind = kind; r.setAttribute('aria-expanded', 'true'); r.classList.add('open');
    return pop;
  }
  function togglePop(kind, el) { if (popKind === kind && popEl === el) { closePop(); return; } if (pop) closePop(); popEl = el || main; kind === 'menu' ? openMenu() : openCal(); }
  function openMenu() {
    const k = parse(sel.value).kind;
    const item = (id, t) => '<button type="button" role="menuitemradio" aria-checked="' + (k === id) + '" data-r="' + id + '"' + (k === id ? ' class="on"' : '') + '><span>' + t + '</span>' + (k === id ? CHECK : '') + '</button>';
    const p = openPop('menu', item('month', 'By month') + item('d7', 'Last 7 days') + item('d30', 'Last 30 days') + item('year', 'This year') + item('all', 'All time') + '<hr>' + item('custom', 'Custom dates…'));
    p.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b) return; const r = b.dataset.r, t = today();
      if (r === 'custom') { openCal(); return; }
      closePop();
      set(r === 'month' ? 'm:' + curKey() : r === 'd7' ? 'r7:' + addDays(t, -6) + ':' + t : r === 'd30' ? 'r30:' + addDays(t, -29) + ':' + t : r === 'year' ? 'y:' + t.slice(0, 4) : 'all');
    });
    const first = p.querySelector('.on') || p.querySelector('button'); if (first && !PH()) first.focus({ preventScroll: true });
  }
  // custom dates: tap a start day and an end day (or the same day twice), then "Show these days"
  let cal = null;
  function openCal() {
    const cur = parse(sel.value);
    cal = { view: (cur.from || today()).slice(0, 7), a: cur.kind === 'custom' ? cur.from : null, b: cur.kind === 'custom' ? cur.to : null };
    openPop('cal', '<div class="mc-in"><label><small>From</small><input type="text" class="mc-a" placeholder="mm/dd/yyyy" autocomplete="off" enterkeyhint="next" aria-label="From date"></label><label><small>To</small><input type="text" class="mc-b" placeholder="mm/dd/yyyy" autocomplete="off" enterkeyhint="done" aria-label="To date"></label></div>' +
      '<div class="mc-h"><button type="button" class="mc-prev" aria-label="Previous month">' + ARROW(-1) + '</button><b class="mc-t"></b><button type="button" class="mc-next" aria-label="Next month">' + ARROW(1) + '</button></div>' +
      '<div class="mc-wk"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="mc-g"></div>' +
      '<div class="mc-f"><span class="mc-s"></span><button type="button" class="mc-go">Show these days</button></div>');
    paintCal(); syncIn();
    // type the dates instead: 11/5/2026, 11/5/26, 2026-11-05, Nov 5 or Nov 5 2026 all work; the calendar follows as you type
    const ia = pop.querySelector('.mc-a'), ib = pop.querySelector('.mc-b');
    const onType = (el, which) => { const d = typedDay(el.value); el.classList.toggle('bad', !!el.value.trim() && !d); if (!d) return;
      if (which === 'a') { cal.a = d; if (cal.b && cal.b < d) cal.b = null; } else { if (!cal.a) cal.a = d; else if (d < cal.a) { cal.b = cal.a; cal.a = d; } else cal.b = d; }
      cal.view = d.slice(0, 7); paintCal(); };
    ia.addEventListener('input', () => onType(ia, 'a')); ib.addEventListener('input', () => onType(ib, 'b'));
    ia.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ib.focus(); } });
    ib.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const g = pop.querySelector('.mc-go'); if (g && !g.disabled) g.click(); } });
    [ia, ib].forEach(el => el.addEventListener('blur', () => { if (typedDay(el.value)) syncIn(); }));
    if (!PH()) ia.focus({ preventScroll: true });
    pop.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('mc-prev') || b.classList.contains('mc-next')) { const n = shift(cal.view, b.classList.contains('mc-prev') ? -1 : 1); if (n <= curKey()) { cal.view = n; paintCal(); } return; }
      if (b.dataset.d) { const d = b.dataset.d; if (!cal.a || cal.b) { cal.a = d; cal.b = null; } else if (d < cal.a) { cal.b = cal.a; cal.a = d; } else cal.b = d; paintCal(); syncIn(); return; }
      if (b.classList.contains('mc-go') && cal.a) { const a = cal.a, z = cal.b || cal.a; closePop(); set('rc:' + a + ':' + z); }
    });
  }
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function typedDay(v) {
    v = String(v || '').trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' '); if (!v) return null;
    let y, m, d, r;
    if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v))) { y = +r[1]; m = +r[2]; d = +r[3]; }
    else if ((r = /^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2}|\d{4}))?$/.exec(v))) { m = +r[1]; d = +r[2]; y = r[3] ? +r[3] : +today().slice(0, 4); }
    else if ((r = /^([a-z]{3})[a-z]*\.? (\d{1,2})(?: (\d{4}))?$/.exec(v)) && MON.indexOf(r[1]) > -1) { m = MON.indexOf(r[1]) + 1; d = +r[2]; y = r[3] ? +r[3] : +today().slice(0, 4); }
    else return null;
    if (y < 100) y += 2000;
    const dt = new Date(y, m - 1, d); if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    const s = ymd(dt); return s > today() ? null : s;
  }
  const typedText = s => s ? s.slice(5, 7) + '/' + s.slice(8, 10) + '/' + s.slice(0, 4) : '';
  function syncIn() { if (!pop) return; const ia = pop.querySelector('.mc-a'), ib = pop.querySelector('.mc-b'); if (!ia) return;
    if (document.activeElement !== ia) { ia.value = typedText(cal.a); ia.classList.remove('bad'); }
    if (document.activeElement !== ib) { ib.value = typedText(cal.b); ib.classList.remove('bad'); } }
  function paintCal() {
    const [y, m] = cal.view.split('-').map(Number), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate(), t = today();
    pop.querySelector('.mc-t').textContent = label(cal.view);
    pop.querySelector('.mc-next').disabled = cal.view >= curKey();
    let h = ''; for (let i = 0; i < first.getDay(); i++) h += '<span></span>';
    const z = cal.b || cal.a;
    for (let d = 1; d <= n; d++) {
      const s = cal.view + '-' + pad(d), fut = s > t, isA = s === cal.a, isB = cal.b && s === cal.b, inR = cal.a && cal.b && s > cal.a && s < cal.b;
      h += '<button type="button" data-d="' + s + '" class="' + (isA || isB ? 'end' : '') + (inR ? ' in' : '') + (cal.a && cal.b && cal.a !== cal.b ? (isA ? ' first' : isB ? ' last' : '') : '') + (s === t ? ' today' : '') + '"' + (fut ? ' disabled' : '') + '>' + d + '</button>';
    }
    pop.querySelector('.mc-g').innerHTML = h;
    pop.querySelector('.mc-s').textContent = cal.a ? rangeText(cal.a, z) : 'Pick a start day';
    pop.querySelector('.mc-go').disabled = !cal.a;
  }
  document.addEventListener('pointerdown', e => { if (pop && !e.target.closest('.ms-rw')) closePop(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { const r = rngOf(popEl); closePop(); if (r) r.focus(); } });

  const NARROW = matchMedia('(max-width:350px)');
  NARROW.addEventListener('change', () => inst.forEach(el => { el.querySelector('.ms-lab').innerHTML = ''; paintStep(el, 0); }));
  function paintStep(el, dir) {
    const p = parse(sel.value), lab = el.querySelector('.ms-lab');
    const text = textOf(p, el.classList.contains('ms-mini') || NARROW.matches);   // narrow phones say "Nov 2026"
    el.classList.toggle('is-all', p.kind === 'all');
    el.querySelector('.ms-prev').disabled = !stepped(p, -1);
    el.querySelector('.ms-next').disabled = !stepped(p, 1);
    const r = el.querySelector('.ms-rng'); if (r) { r.firstElementChild.textContent = BTN[p.kind]; r.classList.toggle('act', p.kind !== 'month'); }
    const old = lab.firstElementChild;
    if (old && old.textContent === text) return;
    if (!old || !dir || calm()) { lab.innerHTML = '<span></span>'; lab.firstElementChild.textContent = text; return; }
    // the new label slides in from the side you went, the old one slides out the other way
    const nu = document.createElement('span'); nu.textContent = text; nu.className = 'in-' + (dir > 0 ? 'r' : 'l');
    old.className = 'out-' + (dir > 0 ? 'l' : 'r'); lab.appendChild(nu);
    setTimeout(() => { if (old.parentNode) old.remove(); nu.className = ''; }, 260);
  }
  function paint(dir) { inst.forEach(el => paintStep(el, dir)); syncBar(); }

  // set the period: adds it to the (hidden) date-range menu and lets the dashboard redraw
  function set(v, quiet) {
    if (![...sel.options].some(o => o.value === v)) { const o = document.createElement('option'); o.value = v; o.textContent = textOf(parse(v)); sel.appendChild(o); }
    const a = startOf(parse(sel.value)), b = startOf(parse(v));
    const dir = a && b ? (b > a ? 1 : b < a ? -1 : 0) : 0;
    sel.value = v;
    if (!quiet) sel.dispatchEvent(new Event('change', { bubbles: true }));
    paint(dir);
  }
  const monthOfVal = v => { const p = parse(v); return p.kind === 'month' ? p.m : null; };
  // the first and last day a period covers (All time runs from your first entry to today)
  function bounds(v) { const p = parse(v || sel.value); if (p.kind === 'month') { const [y, m] = p.m.split('-').map(Number); const end = ymd(new Date(y, m, 0)); return [p.m + '-01', end > today() ? today() : end]; }
    if (p.kind === 'year') { const e = p.y + '-12-31'; return [p.y + '-01-01', e > today() ? today() : e]; } if (p.from) return [p.from, p.to]; return [earliestDay(), today()]; }
  // another switcher showing the same range (Board, the desktop toolbar)
  function make(cls) { const el = mk(cls || 'ms-main', true); paintStep(el, 0); return el; }
  window.CTMonth = { set, get: () => sel.value, make, bounds, label: v => textOf(parse(v || sel.value)), isAll: v => parse(v || sel.value).kind === 'all', main };

  // ---------- desktop: the summary bar ----------
  const bar = document.createElement('div'); bar.className = 'ct-sumbar'; bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<div class="sb-in"><div class="sb-stats"><span class="sb-sep"></span>' +
    '<button type="button" class="sb-num sb-top" aria-label="Back to the totals"><small>Spent</small><b id="sb-spent"></b></button>' +
    '<span class="sb-bud" id="sb-bud"><i><em></em></i><span></span></span><span class="sb-sep"></span>' +
    '<button type="button" class="sb-num sb-top sb-profit" aria-label="Back to the totals"><small>Profit</small><b id="sb-profit"></b></button></div>' +
    '<label class="sb-q"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg><input type="search" placeholder="Search all months" aria-label="Search cards, sets and platforms" autocomplete="off" tabindex="-1"></label>' +
    '<div class="sb-acts"><button type="button" class="sb-search" aria-label="Search" tabindex="-1"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg></button>' +
    '<button type="button" class="sb-add" tabindex="-1"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add</button></div></div>';
  const mini = mk('ms-mini', false);
  bar.querySelector('.sb-stats').prepend(mini);
  document.body.appendChild(bar);
  const q = bar.querySelector('.sb-q input'), real = $('ct-search');

  function syncBar() {
    const sp = $('ct-spent'), pr = $('ct-profit'); if (!sp) return;
    $('sb-spent').textContent = sp.textContent; $('sb-profit').textContent = pr.textContent;
    bar.querySelector('.sb-profit').classList.toggle('neg', pr.parentElement.classList.contains('ct-negative'));
    const tile = sp.parentElement, b = S.budget(), bud = $('sb-bud'), ln = tile.querySelector('.ct-line');
    const fill = parseFloat(getComputedStyle(tile).getPropertyValue('--fill')) || 0;
    bud.hidden = !b || !monthOfVal(sel.value);
    bud.dataset.bud = tile.dataset.bud || 'ok';
    bud.querySelector('em').style.transform = 'scaleX(' + fill + ')';
    bud.querySelector('span').textContent = ln ? ln.textContent.replace(/^(On track|Getting close) · /, '') : '';
  }
  new MutationObserver(() => syncBar()).observe(stats, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'data-bud'] });

  let shown = false, statsGone = false;
  const keepOpen = () => document.activeElement === q || !!q.value;
  function setBar(v) {
    if (v === shown) return; shown = v;
    bar.classList.toggle('on', v); bar.setAttribute('aria-hidden', String(!v));
    bar.querySelectorAll('button,input').forEach(x => { x.tabIndex = v ? 0 : -1; });
    if (v) syncBar();
  }
  function update() {
    const off = PH() || document.documentElement.classList.contains('cbopen') || ($('view-app') && $('view-app').hidden) || $('app-grid').classList.contains('is-empty');
    setBar(!off && (statsGone || keepOpen()));
  }
  new IntersectionObserver(es => { const e = es[es.length - 1]; statsGone = !e.isIntersecting && e.boundingClientRect.top < 0; update(); }).observe(stats);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', update);

  bar.addEventListener('click', e => {
    if (e.target.closest('.sb-top')) { window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' }); return; }
    if (e.target.closest('.sb-add')) { $('ct-add').click(); return; }
    if (e.target.closest('.sb-search')) { openQ(); }
  });
  // search inside the bar: the numbers step aside and the box takes their place (same search as the header's)
  function openQ() { bar.classList.add('q-on'); q.value = real.value; q.focus({ preventScroll: true }); }
  function closeQ() { bar.classList.remove('q-on'); update(); }
  q.addEventListener('input', () => { real.value = q.value; real.dispatchEvent(new Event('input', { bubbles: true })); });
  real.addEventListener('input', () => { if (q.value !== real.value) q.value = real.value; });
  q.addEventListener('keydown', e => { if (e.key === 'Escape') { if (q.value) { q.value = ''; q.dispatchEvent(new Event('input')); } q.blur(); } if (e.key === 'Enter') q.blur(); });
  q.addEventListener('blur', () => setTimeout(() => { if (!q.value) closeQ(); }, 120));

  // ---------- desktop: arrow keys between Entries, Board and Stories ----------
  const tabNow = () => { const x = $('csx'); if (x && x.classList.contains('in')) return 'stories'; const c = document.querySelector('.cbx'); return c && !c.classList.contains('off') ? 'board' : 'entries'; };
  function tabKey(e, inFrame) {
    if (PH() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
    const k = e.key, idx = { ArrowLeft: -1, ArrowRight: 1 }[k], num = { 1: 0, 2: 1, 3: 2 }[k];
    if (idx == null && num == null) return false;
    if (!inFrame) {
      const a = document.activeElement, tag = a && a.tagName;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (a && a.isContentEditable)) return false;
      // things that already use the arrows: sliders, the budget ruler, tab and radio groups, board widgets
      if (a && a.closest && a.closest('[role=slider],[role=tablist],[role=radiogroup],.bu-ru,.w,#cb-edit.on')) return false;
      if (document.querySelector('dialog[open]') || ($('app-menu') && !$('app-menu').hidden) || document.querySelector('#cb-edit.on')) return false;
    }
    const order = ['entries', 'board', 'stories'];   // Stories is on both plans now
    const i = order.indexOf(tabNow());
    const to = num != null ? order[num] : order[i + idx];
    if (!to || to === order[i]) return false;
    e.preventDefault(); if (window.CTTabGo) window.CTTabGo(to); return true;
  }
  document.addEventListener('keydown', e => tabKey(e));
  window.CTTabKey = e => tabKey(e, true);   // Stories runs in its own frame and passes its keys up

  S.on(() => paint(0));
  set(sel.value || 'm:' + curKey(), true);
})();
