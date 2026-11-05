/* Card Tab dashboard (Drop 1). Same layout and behavior as the cardtab.app demo, wired to the device store.
   Free: the four totals, the chart and platform fees cover this month (the chart shows the last 3 months);
         every entry stays visible in the list, with all filters.
   Premium: totals and insights for all time or any of the date ranges. */
(function () {
  'use strict';
  const S = window.CTStore;
  const root = document.getElementById('view-app');
  const $ = id => document.getElementById(id), $$ = sel => Array.from(root.querySelectorAll(sel));
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // One formatter reused for every amount (building a new one per row was the slowest part of redrawing the list); same output, to the cent
  const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = c => (c < 0 ? '−' : '') + '$' + NF.format(Math.abs(c) / 100);
  const pad = n => String(n).padStart(2, '0');
  const phone = matchMedia('(max-width:760px)'), calm = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
  const tapWord = () => (fine() ? 'Click' : 'Tap');

  // ---------- dates (recomputed on each render so a tab left open over midnight stays right) ----------
  let D = {};
  function dates() {
    const now = new Date(), Y = now.getFullYear(), M = now.getMonth();
    const pm = new Date(Y, M - 1, 1), f30 = new Date(Y, M, now.getDate() - 29);
    D = {
      now, monthPrefix: Y + '-' + pad(M + 1), monthLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      prevPrefix: pm.getFullYear() + '-' + pad(pm.getMonth() + 1), prevLabel: pm.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      from30: S.ymd(f30)
    };
  }
  const inPeriod = (t, p) => p === 'all' || (p === 'month' ? t.date.startsWith(D.monthPrefix) : p === 'last' ? t.date.startsWith(D.prevPrefix) : t.date >= D.from30);
  const periodLabel = p => (p === 'all' ? 'All time' : p === 'month' ? D.monthLabel : p === 'last' ? D.prevLabel : 'Last 30 days');
  const YM = new Map();
  const ymLabel = (k, fmt) => { const key = k + JSON.stringify(fmt); let v = YM.get(key); if (v == null) { v = new Date(k + '-15T12:00:00').toLocaleString('en-US', fmt); YM.set(key, v); } return v; };
  const shortDate = d => Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) + '/' + d.slice(0, 4);
  const premium = () => S.plan() === 'premium';

  // ---------- view state (filters remembered per browser) ----------
  let type = 'all', view = 'monthly', selected = null, expanded = null, showEarlier = false, justAdded = null;
  const pref = {
    get(k, d) { try { return localStorage.getItem('ct.f.' + k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ct.f.' + k, v); } catch (e) {} }
  };

  // ---------- toasts ----------
  let toastEl = null, toastT = 0;
  function toast(text, opts) {
    opts = opts || {};
    const box = $('app-toasts');
    if (toastEl) toastEl.remove(); clearTimeout(toastT);
    const t = document.createElement('div'); t.className = 'app-toast'; t.setAttribute('role', 'status');
    const span = document.createElement('span'); span.textContent = text; t.appendChild(span);
    if (opts.undo) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Undo';
      b.addEventListener('click', doUndo);
      t.appendChild(b);
    }
    box.appendChild(t); toastEl = t;
    toastT = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 220); if (toastEl === t) toastEl = null; }, opts.undo ? 6000 : 2800);
  }
  const upgradeNote = () => toast('Upgrading opens at launch. For now, switch plans under Testing tools in the account menu.');

  // ---------- data shaping (all in cents) ----------
  function tileScope() { const all = S.all(); return premium() ? all.filter(t => inPeriod(t, $('ct-period').value)) : all.filter(t => t.date.startsWith(D.monthPrefix)); }
  function monthKeys(fromKey, toKey) { const out = []; let [y, m] = fromKey.split('-').map(Number); for (let i = 0; i < 400; i++) { const k = y + '-' + pad(m); out.push(k); if (k >= toKey) break; m++; if (m > 12) { m = 1; y++; } } return out; }
  function monthsData() {
    let list, keys;
    if (!premium()) { // last 3 months, ending this month
      const n = D.now; keys = [2, 1, 0].map(i => { const x = new Date(n.getFullYear(), n.getMonth() - i, 1); return x.getFullYear() + '-' + pad(x.getMonth() + 1); });
      list = S.all();
    } else {
      list = tileScope(); const ks = [...new Set(list.map(t => t.date.slice(0, 7)))].sort(); if (!ks.length) return [];
      const last = ks[ks.length - 1] > D.monthPrefix ? ks[ks.length - 1] : D.monthPrefix;
      const p = $('ct-period').value;
      keys = p === 'all' ? monthKeys(ks[0], last).slice(-12) : ks; // all time shows up to the latest 12 months
    }
    return keys.map(k => Object.assign({ m: ymLabel(k, { month: 'short' }), key: k, full: ymLabel(k, { month: 'long', year: 'numeric' }) }, S.totals(list.filter(t => t.date.startsWith(k)))));
  }
  function feesData() { const map = {}; tileScope().filter(t => t.type === 'sale').forEach(t => { const k = t.platform || 'No platform'; map[k] = (map[k] || 0) + t.amount - t.net; }); return Object.keys(map).sort((a, b) => map[b] - map[a]).map(k => ({ m: k, key: k, full: k, fees: map[k] })); }

  // ---------- totals ----------
  function stats() {
    const t = S.totals(tileScope());
    $('ct-sales').textContent = money(t.sales); $('ct-after').textContent = money(t.after); $('ct-spent').textContent = money(t.spent); $('ct-profit').textContent = money(t.profit);
    const tile = $('ct-profit').parentElement; tile.classList.toggle('ct-positive', t.profit >= 0); tile.classList.toggle('ct-negative', t.profit < 0);
    const note = $('app-scope'), p = $('ct-period').value;
    note.hidden = premium() || p === 'month' || !S.all().length;
    if (!note.hidden) note.innerHTML = 'Totals show ' + esc(D.monthLabel) + ' · <button type="button" data-upgrade>All time with Premium</button>';
    $('ct-ins-scope').textContent = premium() ? periodLabel(p) : 'This month';
    if (window.CTHome) window.CTHome.paint({ t, list: tileScope(), p, prem: premium() });
  }

  // ---------- chart (same interaction as the demo) ----------
  let chartData = [];
  function chart() {
    chartData = view === 'monthly' ? monthsData() : feesData();
    const key = view === 'monthly' ? 'profit' : 'fees', max = Math.max(1, ...chartData.map(d => Math.abs(d[key])));
    const cap = Math.max(30, Math.round(($('ct-chart').clientHeight || 190) / 2 - 20));
    const hasAny = chartData.some(d => view === 'fees' || d.entries);
    const range = !chartData.length ? 'No entries yet' : chartData.length === 1 ? chartData[0].full : (chartData[0].key.slice(0, 4) === chartData[chartData.length - 1].key.slice(0, 4) ? chartData[0].m + ' – ' + chartData[chartData.length - 1].m + ' ' + chartData[0].key.slice(0, 4) : chartData[0].m + ' ' + chartData[0].key.slice(0, 4) + ' – ' + chartData[chartData.length - 1].m + ' ' + chartData[chartData.length - 1].key.slice(0, 4));
    $('ct-chart-range').textContent = view === 'monthly' ? range : (chartData.length ? 'Platform fees by marketplace' : 'No sales yet');
    $('ct-chart').innerHTML = chartData.map(d => {
      const n = d[key], h = n === 0 ? 0 : Math.max(6, Math.round(Math.abs(n) / max * cap)), color = view === 'fees' ? 'cf' : n < 0 ? 'cl' : 'cg';
      return '<div class="ct-chart-col"><div class="ct-chart-half"><button type="button" data-month="' + esc(d.key) + '" class="' + color + (n >= 0 ? ' ct-positive-bar' : '') + '" style="height:' + (n >= 0 ? h : 0) + 'px" aria-label="' + esc(d.full) + ' ' + money(n) + '"></button></div><div class="ct-chart-half bottom"><button type="button" data-month="' + esc(d.key) + '" class="' + (n < 0 ? 'loss' : '') + '" style="height:' + (n < 0 ? h : 0) + 'px" aria-label="' + esc(d.full) + ' ' + money(n) + '"></button></div><span>' + esc(d.m) + '</span></div>';
    }).join('');
    $$('.ct-chart-col').forEach(col => { const k = col.querySelector('button').dataset.month; ['mouseenter', 'focusin', 'click'].forEach(evt => col.addEventListener(evt, () => select(k))); });
    if (!hasAny && view === 'monthly') $('ct-chart').innerHTML = '';
    select(selected && chartData.some(d => d.key === selected) ? selected : null);
  }
  $('ct-chart').addEventListener('mouseleave', () => { if (matchMedia('(hover: hover)').matches) select(null); });
  $('ct-chart').addEventListener('focusout', e => { if (!$('ct-chart').contains(e.relatedTarget)) select(null); });
  function select(k) {
    selected = k; const monthly = view === 'monthly', d = chartData.find(x => x.key === k), all = S.totals(tileScope());
    const scopeLabel = premium() ? periodLabel($('ct-period').value) : D.monthLabel;
    $('ct-chart-caption').textContent = (d ? d.full : scopeLabel) + ' · ' + (monthly ? 'Profit' : 'Platform fees');
    const val = d ? d[monthly ? 'profit' : 'fees'] : all[monthly ? 'profit' : 'fees'];
    $('ct-chart-total').textContent = money(val);
    $('ct-chart-total').style.color = monthly && val < 0 ? '#e45256' : '';
    const ent = n => n + (n === 1 ? ' entry' : ' entries');
    $('ct-chart-subtotal').textContent = monthly ? ('Sales ' + money(d ? d.sales : all.sales) + ' · Spent ' + money(d ? d.spent : all.spent) + ' · ' + ent(d ? d.entries : all.entries)) : (d ? d.full + ' · ' + money(d.fees) + ' in fees' : 'Across ' + chartData.length + (chartData.length === 1 ? ' platform' : ' platforms'));
    $('ct-chart-detail').textContent = !chartData.length || !$('ct-chart').children.length ? (monthly ? 'Your months show up here as you add entries' : 'Fees show up here once you log a sale') : d ? (d.full + ' selected · ' + (monthly ? 'Profit ' : 'Fees ') + money(val)) : tapWord() + ' or hover a bar to explore ' + (monthly ? 'a month' : 'fees');
    $$('.ct-chart-col button').forEach(b => b.classList.toggle('ct-bar-active', !!d && b.dataset.month === k && parseFloat(b.style.height) > 0));
  }

  // ---------- entries list ----------
  function artHtml(t, open) {
    if (t.art && (t.art.list || t.art.detail)) return '<img class="ct-card-art" src="' + esc(open ? (t.art.detail || t.art.list) : (t.art.list || t.art.detail)) + '" data-full="' + esc(t.art.detail || t.art.list) + '" alt="" width="44" height="61" loading="lazy">';
    const letter = (t.name.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase();
    return '<span class="ct-card-art ct-art-ph" aria-hidden="true"><i>' + esc(letter) + '</i></span>';
  }
  function detailsHtml(t) {
    // Small labeled stats, like the board's tiles: label on top, the number under it
    let pctLine = '';
    const st = [], cell = (l, v, sub) => st.push('<div><small>' + l + '</small><span>' + v + '</span>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>');
    if (t.type === 'sale') {
      const fee = t.amount - t.net, pct = t.amount ? Math.round(fee / t.amount * 1000) / 10 : 0;
      if (t.fees != null) { cell('Fees', money(t.fees)); cell('Shipping', money(t.ship || 0)); }
      else cell('Fees + ship', money(fee));
      if (t.amount) pctLine = '<div class="ct-pct">Fees and shipping are ' + pct + '% of the sale</div>';
    }
    if (t.qty > 1) cell('Quantity', String(t.qty), money(Math.round(t.amount / t.qty)) + ' each');
    if (t.condition) cell('Condition', esc(t.condition));
    return '<div class="ct-open-actions"><div class="ct-row-expanded-info">' + (st.length ? '<div class="ct-stats-row">' + st.join('') + '</div>' : '') + pctLine + (t.note ? '<div class="ct-row-note">' + esc(t.note) + '</div>' : '') + '<div class="ct-demo-actions"><button type="button" data-act="edit">Edit</button><button type="button" data-act="dup">Duplicate</button><button type="button" data-act="del">Delete</button></div></div></div>';
  }
  const fullArt = img => { if (!img || img.tagName !== 'IMG' || img.dataset.loaded) return; img.dataset.loaded = 1; const u = img.dataset.full, pre = new Image(), t0 = performance.now(); pre.src = u; (pre.decode ? pre.decode() : new Promise((r, j) => { pre.onload = r; pre.onerror = j; })).then(() => setTimeout(() => { if (img.isConnected) img.src = u; }, Math.max(0, 380 - (performance.now() - t0)))).catch(() => { delete img.dataset.loaded; }); };
  function setBtn(btn, open) { const t = S.get(btn.dataset.tx); if (!t) return; btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', (open ? 'Collapse ' : 'Expand ') + t.name); btn.querySelector('.ct-row-chevron').textContent = open ? '−' : '+'; }

  // Open/close in place: final layout first, then the art scales into place and the row height animates (as in the demo)
  function flip(row, apply, keep) {
    if (calm.matches) { apply(); return 0; }
    const art = row.querySelector('.ct-card-art'), txt = row.querySelector('.ct-expanded-right');
    if (row._flipT) { clearTimeout(row._flipT); row.style.transition = 'none'; row.style.height = ''; row.style.minHeight = ''; row.style.overflow = ''; row.style.transition = ''; art.style.transform = ''; art.style.transition = ''; txt.style.opacity = ''; txt.style.transition = ''; }
    const r0 = row.getBoundingClientRect(), a0 = art.getBoundingClientRect();
    row.classList.add('ct-noanim'); apply();
    const r1 = row.getBoundingClientRect(), a1 = art.getBoundingClientRect();
    if (keep) { keep.style.gridTemplateRows = '1fr'; keep.style.opacity = '1'; keep.style.marginBottom = '12px'; }
    row.style.minHeight = '0'; row.style.height = r0.height + 'px'; row.style.overflow = 'hidden';
    art.style.transformOrigin = '0 0'; art.style.transform = 'translate(' + ((a0.left - r0.left) - (a1.left - r1.left)) + 'px,' + ((a0.top - r0.top) - (a1.top - r1.top)) + 'px) scale(' + (a0.width / a1.width) + ')';
    txt.style.opacity = '0';
    void row.offsetWidth; row.classList.remove('ct-noanim');
    const ease = 'cubic-bezier(.2,.7,.2,1)';
    row.style.transition = 'height .32s ' + ease; art.style.transition = 'transform .32s ' + ease; txt.style.transition = 'opacity .22s ease .08s';
    row.style.height = r1.height + 'px'; art.style.transform = ''; txt.style.opacity = '';
    row._flipT = setTimeout(() => { row._flipT = 0; if (keep && !row.classList.contains('expanded')) keep.remove(); row.style.transition = 'none'; row.style.height = ''; row.style.minHeight = ''; row.style.overflow = ''; void row.offsetWidth; row.style.transition = ''; art.style.transition = ''; txt.style.transition = ''; fadeSync(); }, 340);
    return r1.height - r0.height;
  }
  function pinList(delta, ms) {
    const l = $('ct-rows'); if (!phone.matches || calm.matches || l._skipPin) return; const now = performance.now();
    const base = (l._pinEnd || 0) > now ? l._pinTarget : l.getBoundingClientRect().height; l._pinTarget = Math.max(0, base + delta);
    l.style.height = l._pinTarget + 'px'; l.style.overflow = 'hidden';
    l._pinEnd = Math.max(l._pinEnd || 0, now + ms); clearTimeout(l._pinT);
    l._pinT = setTimeout(() => { l.style.height = ''; l.style.overflow = ''; l._pinEnd = 0; }, l._pinEnd - now);
  }
  function toggle(id) {
    const list = $('ct-rows'), prevId = expanded; expanded = expanded === id ? null : id;
    let pinDelta = 0;
    if (prevId != null) { const btn = list.querySelector('[data-tx="' + prevId + '"]'); if (btn) { const row = btn.parentElement; const box0 = row.querySelector('.ct-open-actions'); pinDelta += flip(row, () => row.classList.remove('expanded'), box0) || 0; setBtn(btn, false); const box = row.querySelector('.ct-open-actions'); if (box) setTimeout(() => { if (!row.classList.contains('expanded')) box.remove(); fadeSync(); }, 360); } }
    if (expanded != null) {
      const btn = list.querySelector('[data-tx="' + id + '"]'), t = S.get(id); if (!btn || !t) return;
      const row = btn.parentElement; const old = row.querySelector('.ct-open-actions'); if (old) old.remove();
      row.insertAdjacentHTML('beforeend', detailsHtml(t));
      pinDelta += flip(row, () => row.classList.add('expanded')) || 0; setBtn(btn, true); fullArt(btn.querySelector('.ct-card-art'));
      setTimeout(() => { if (phone.matches) { fadeSync(); return; } const l = $('ct-rows'); if (l.scrollHeight <= l.clientHeight + 1) { fadeSync(); return; } const rb = row.getBoundingClientRect(), lb = l.getBoundingClientRect(); if (rb.bottom > lb.bottom) l.scrollBy({ top: Math.min(rb.bottom - lb.bottom + 10, rb.top - lb.top - 4), behavior: calm.matches ? 'auto' : 'smooth' }); fadeSync(); }, 360);
    }
    pinList(pinDelta, 360);
  }
  function fadeSync() { const l = $('ct-rows'); l.classList.toggle('ct-at-end', l.scrollTop + l.clientHeight >= l.scrollHeight - 2); }

  function platformsSelect() {
    const sel = $('ct-platform'), cur = sel.value, ps = S.platforms();
    sel.innerHTML = '<option value="all">' + (phone.matches ? 'Platform' : 'All platforms') + '</option>' + ps.map(p => '<option>' + esc(p) + '</option>').join('');
    sel.value = ps.includes(cur) ? cur : 'all';
  }

  // Older months behind "Show ..." aren't built until you open them, so the page stays light (sheets open faster, filters redraw faster)
  let earlierHTML = '';
  function render() {
    dates();
    const all = S.all(), empty = !all.length;
    $('app-first-wrap').hidden = !empty; $('app-grid').classList.toggle('is-empty', empty); root.querySelector('.ct-demo-right:not(.app-first-wrap)').hidden = empty;
    limits(); firstRun(); askPanel(); platformsSelect();
    $('ct-type').value = type;
    const q = $('ct-search').value.trim().toLowerCase(), platform = $('ct-platform').value, period = $('ct-period').value, sort = $('ct-sort').value;
    let rows = all.filter(t => (type === 'all' || t.type === type) && (platform === 'all' || t.platform === platform) && (!q || (t.name + ' ' + t.platform + ' ' + t.note).toLowerCase().includes(q)) && inPeriod(t, period));
    rows.sort((a, b) => sort === 'high' ? b.amount - a.amount : sort === 'old' ? a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) : b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    stats(); chart();
    if (empty) return;
    const listFiltered = !!(q || type !== 'all' || platform !== 'all'), ft = S.totals(rows);
    const nw = x => '<span class="ct-nw">' + x + '</span>';
    $('ct-count').innerHTML = esc(periodLabel(period)) + ' · ' + nw(rows.length + (rows.length === 1 ? ' entry' : ' entries')) + (listFiltered ? ' · ' + nw('Spent ' + money(ft.spent)) + ' · ' + nw('Profit ' + money(ft.profit)) : '');
    // Phones: newest entries stay visible (this month's, never fewer than three); older months tuck behind a "Show ..." button
    const cur = t => t.date.startsWith(D.monthPrefix);
    const keepN = Math.max(3, rows.filter(cur).length);
    const collapse = phone.matches && period === 'all' && sort === 'new' && rows.length > keepN && !listFiltered;
    const earlier = [...new Set(rows.slice(keepN).map(t => t.date.slice(0, 7)))].map(k => ymLabel(k, { month: 'long' })).filter((v, i, a) => a.indexOf(v) === i);
    const earlierNames = earlier.length > 3 ? 'earlier months' : earlier.length < 2 ? earlier.join('') : earlier.slice(0, -1).join(', ') + ' and ' + earlier[earlier.length - 1];
    const perMonth = {}; rows.forEach(t => { const k = t.date.slice(0, 7); perMonth[k] = (perMonth[k] || 0) + 1; });
    let marked = false; const chunks = []; let current = '', lastRow = -1;
    // The last row of each month gets a class here (the torn receipt edge), so the browser never has to search for it
    const endGroup = () => { if (lastRow > -1) { chunks[lastRow] = chunks[lastRow].replace('<div class="ct-row ', '<div class="ct-row ct-last '); lastRow = -1; } };
    if (expanded && !rows.some(t => t.id === expanded)) expanded = null;
    rows.forEach((t, i) => {
      const k = t.date.slice(0, 7), m = ymLabel(k, { month: 'long', year: 'numeric' });
      if (collapse && !marked && i >= keepN) { endGroup(); marked = true; chunks.push('\u0000'); current = ''; }
      if (sort !== 'high' && m !== current) { endGroup(); current = m; chunks.push('<div class="ct-month">' + m + ' <span>' + perMonth[k] + (perMonth[k] === 1 ? ' entry' : ' entries') + '</span></div>'); }
      const open = expanded === t.id, badge = t.type === 'sale' ? 'Sale' : t.type === 'refund' ? 'Refund' : 'Purchase';
      const after = t.type === 'sale' ? ' &nbsp; After fees <em>' + money(t.net) + '</em>' : '';
      const verb = t.type === 'sale' ? 'Sold' : t.type === 'refund' ? 'Refunded to buyer' : 'Paid';
      chunks.push('<div class="ct-row ' + (open ? 'expanded' : '') + (t.id === justAdded ? ' ct-new' : '') + '"><button type="button" class="ct-row-toggle" data-tx="' + t.id + '" aria-expanded="' + open + '" aria-label="' + (open ? 'Collapse' : 'Expand') + ' ' + esc(t.name) + '">' + artHtml(t, open) + '<div class="ct-expanded-right"><div class="ct-row-meta">' + shortDate(t.date) + (t.platform ? ' · ' + esc(t.platform) : '') + '</div><div class="ct-row-name">' + esc(t.name) + (t.qty > 1 ? ' ×' + t.qty : '') + '</div><div class="ct-row-bottom">' + verb + ' <strong>' + money(t.amount) + '</strong>' + after + '</div></div><span class="ct-tag ' + t.type + '">' + badge + '</span><span class="ct-row-chevron" aria-hidden="true">' + (open ? '−' : '+') + '</span></button>' + (open ? detailsHtml(t) : '') + '</div>');
      lastRow = chunks.length - 1;
    });
    endGroup();
    justAdded = null;
    let html = chunks.join('');
    if (collapse) { const parts = html.split('\u0000'); html = parts[0] + '<button type="button" class="ct-earlier-btn" aria-expanded="' + showEarlier + '" data-names="' + esc(earlierNames) + '"><span>' + (showEarlier ? 'Hide ' : 'Show ') + esc(earlierNames) + '</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="ct-earlier' + (showEarlier ? ' open' : '') + '"' + (showEarlier ? '' : ' inert') + '><div>' + (showEarlier ? parts[1] : '') + '</div></div>'; earlierHTML = parts[1]; } else earlierHTML = '';
    const list = $('ct-rows'), keepScroll = list.scrollTop;
    list.innerHTML = html || '<div class="ct-empty"><p>No entries match.</p><button type="button" data-clear-filters>Clear filters</button></div>';
    list.scrollTop = keepScroll;
    fadeSync();
  }

  // One listener for everything in the list (rows are redrawn often)
  $('ct-rows').addEventListener('click', async e => {
    const eb = e.target.closest('.ct-earlier-btn');
    if (eb) {
      const list = $('ct-rows'), box = list.querySelector('.ct-earlier'), opening = !showEarlier;
      if (opening && box.firstElementChild && !box.firstElementChild.firstChild) box.firstElementChild.innerHTML = earlierHTML;
      clearTimeout(box._empty); if (!opening) box._empty = setTimeout(() => { if (!showEarlier && box.isConnected && box.firstElementChild) box.firstElementChild.innerHTML = ''; }, 520);
      const inner = box.firstElementChild ? box.firstElementChild.scrollHeight : 0; pinList(opening ? inner : -inner, 420);
      showEarlier = opening; box.classList.toggle('open', opening); box.toggleAttribute('inert', !opening);
      eb.setAttribute('aria-expanded', String(opening)); eb.querySelector('span').textContent = (opening ? 'Hide ' : 'Show ') + eb.dataset.names;
      if (!opening && expanded != null && box.querySelector('[data-tx="' + expanded + '"]')) { list._skipPin = true; toggle(expanded); list._skipPin = false; }
      return;
    }
    if (e.target.closest('[data-clear-filters]')) { clearFilters(); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation();
      const id = act.closest('.ct-row').querySelector('.ct-row-toggle').dataset.tx, t = S.get(id); if (!t) return;
      if (act.dataset.act === 'edit') window.CTEditor.open(t, afterEditor);
      else if (act.dataset.act === 'del') removeAnimated(id);
      else if (act.dataset.act === 'dup') {
        if (S.usage().blocked) { limitToast(); return; }
        const c = await S.duplicate(id); justAdded = c.id; expanded = null; render(); usageToast('Entry duplicated');
      }
      return;
    }
    const tg = e.target.closest('.ct-row-toggle'); if (tg) toggle(tg.dataset.tx);
  });
  $('ct-rows').addEventListener('pointerover', e => { const tg = e.target.closest && e.target.closest('.ct-row-toggle'); const a = tg && tg.querySelector('img.ct-card-art'); if (a && !a.dataset.warm && !a.dataset.loaded) { a.dataset.warm = 1; const w = new Image(); w.src = a.dataset.full; } }, { passive: true });
  $('ct-rows').addEventListener('scroll', fadeSync, { passive: true });

  function clearFilters() {
    type = 'all'; $('ct-search').value = ''; $('ct-search').dispatchEvent(new Event('input')); $('ct-platform').value = 'all'; $('ct-period').value = 'all';
    $$('[data-ct-type]').forEach(x => x.classList.toggle('ct-selected', x.dataset.ctType === 'all')); expanded = null; render();
  }

  // ---------- filters ----------
  $$('[data-ct-type]').forEach(b => b.addEventListener('click', () => { type = b.dataset.ctType; expanded = null; $$('[data-ct-type]').forEach(x => x.classList.toggle('ct-selected', x === b)); render(); }));
  $('ct-type').addEventListener('change', e => { const b = root.querySelector('[data-ct-type="' + e.target.value + '"]'); if (b) b.click(); });
  phone.addEventListener('change', () => { expanded = null; render(); });
  ['ct-search', 'ct-platform', 'ct-period', 'ct-sort'].forEach(id => $(id).addEventListener(id === 'ct-search' ? 'input' : 'change', () => {
    expanded = null; if (id === 'ct-period' || id === 'ct-sort') pref.set(id, $(id).value); render();
  }));
  $$('[data-ct-view]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.ctView; $$('[data-ct-view]').forEach(x => x.classList.toggle('ct-selected', x === b));
    root.querySelector('.ct-insight').classList.toggle('ct-ask-on', v === 'ask'); $('ct-ask').inert = v !== 'ask'; root.querySelector('.ct-ins-chart').inert = v === 'ask';
    if (v === 'ask') return; view = v; selected = null; chart();
  }));
  $('ct-ask').inert = true;

  // Search hint: "Search" plus a word that slides up every 3 seconds
  const hint = $('ct-qhint'), wordBox = hint.querySelector('.ct-qword'), words = ['cards', 'sets', 'platforms']; let wi = 0;
  const qclear = $('ct-qclear'); const hintSync = () => { const has = !!$('ct-search').value; hint.classList.toggle('ct-hide', has); qclear.hidden = !has; };
  qclear.addEventListener('click', e => { e.preventDefault(); const q = $('ct-search'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); q.focus(); });
  $('ct-search').addEventListener('input', hintSync);
  setInterval(() => { if (document.hidden || root.hidden || $('ct-search').value || calm.matches) return; const old = wordBox.querySelector('.w:not(.above)'); wi = (wi + 1) % words.length; const next = document.createElement('span'); next.className = 'w below'; next.textContent = words[wi]; wordBox.appendChild(next); void next.offsetWidth; next.classList.remove('below'); if (old) { old.classList.add('above'); setTimeout(() => old.remove(), 600); } }, 3000);

  // ---------- Premium notes: full-screen Card Board, Ask ----------
  const xb = $('ct-expand'), xp = $('ct-prem-pop'); let xt;
  const xset = o => { xp.hidden = !o; xb.setAttribute('aria-expanded', o ? 'true' : 'false'); clearTimeout(xt); if (o) xt = setTimeout(() => xset(false), 6000); };
  xb.addEventListener('click', e => {
    e.stopPropagation();
    // Card Board grows out of this panel on both plans (Free gets 4 widgets on the last 3 months)
    if (window.CTBoardLoader) { xset(false); window.CTBoardLoader.open(); return; }
    $('ct-prem-pop-t').innerHTML = premium() ? 'Full-screen Card Board is coming in a later update.' : 'Full-screen Card Board is part of Premium. <a href="#" data-upgrade>Upgrade &rarr;</a>';
    xset(xp.hidden);
  });
  document.addEventListener('click', e => { if (!xp.hidden && !e.target.closest('#ct-prem-pop')) xset(false); });
  function askPanel() {
    $('ct-ask-intro').innerHTML = premium() ? 'Ask is on its way. Soon you’ll be able to ask things like “What was my best month?” and Card Tab does the math from your own entries.' : 'Ask questions about your own entries, like “What was my best month?” or “How much did I make on eBay this month?”';
    $('ct-ask-note').innerHTML = premium() ? 'Coming in a later update' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg> Ask is part of Card Tab Premium · <a href="#" data-upgrade>Upgrade</a>';
  }

  // ---------- plan limits ----------
  function limits() {
    const u = S.usage(), free = u.plan === 'free';
    const block = free && u.blocked;
    $('ct-add').disabled = block; $('ct-add').title = block ? 'You’ve used all 20 free entries this month' : '';
    $('app-banner').hidden = !block;
    if (block) $('app-banner-t').textContent = 'You’ve used all 20 free entries this month. Everything you’ve logged stays here, and you can add more on ' + u.resetsOn + '.';
    $('app-avatar').classList.toggle('dot', free && (u.warn || u.blocked));
  }
  function limitToast() { toast('You’ve used all 20 free entries this month. More on ' + S.usage().resetsOn + '.'); }
  function usageToast(msg) {
    const u = S.usage();
    if (u.plan === 'free' && u.warn) toast(msg + ' · ' + u.left + (u.left === 1 ? ' free entry' : ' free entries') + ' left this month', { undo: true });
    else if (u.plan === 'free' && u.blocked) toast(msg + ' · That was your last free entry this month', { undo: true });
    else toast(msg, { undo: true });
  }

  // ---------- first run ----------
  function firstRun() {
    const prem = premium(), sec = $('af-secondary');
    $('af-ic').textContent = prem ? '↥' : '+';
    $('af-h').textContent = prem ? 'Bring in what you’ve got' : 'Add your first card';
    $('af-p').innerHTML = prem ? 'Upload a CSV or Excel file and Card Tab matches your dates, cards and platforms for you.' : 'Log what you bought or sold, like <em>Charizard ex - 199/165</em>, and Card Tab keeps your totals to the cent.';
    $('af-primary').textContent = prem ? 'Import a spreadsheet' : '+ Add New';
    $('af-primary').disabled = !prem && S.usage().blocked;
    sec.hidden = !prem && !S.showImport();
    sec.innerHTML = prem ? 'Or add your first card' : 'Import a spreadsheet <span class="af-lock">Premium</span>';
  }

  // ---------- add / edit ----------
  function afterEditor(result, entry) {
    if (result === 'added') { justAdded = entry.id; expanded = null; render(); usageToast('Entry added'); }
    else if (result === 'edited') toast('Changes saved', { undo: true });
    else if (result === 'delete') removeAnimated(entry);
    else if (result === 'deleted') toast('Entry deleted', { undo: true });
    else if (result === 'limit') limitToast();
  }
  function openAdd() {
    if (S.usage().blocked) { limitToast(); return; }
    window.CTAddSheet.open((result, n) => {
      if (result === 'session') { expanded = null; render(); usageToast(n === 1 ? '1 entry added' : n + ' entries added'); }
      else afterEditor(result, n);
    });
  }
  $('ct-add').addEventListener('click', openAdd);
  $('af-primary').addEventListener('click', () => { if (premium()) openImport(); else openAdd(); });
  $('af-secondary').addEventListener('click', () => { if (premium()) openAdd(); else toast('Import is part of Premium. Upgrading opens at launch.'); });

  // ---------- delete and undo, animated ----------
  // The entry folds away (and its month heading too, if it was the last one), then it's removed from the store.
  function removeAnimated(id) {
    const btn = $('ct-rows').querySelector('[data-tx="' + id + '"]'), row = btn && btn.closest('.ct-row');
    const done = async () => { if (expanded === id) expanded = null; await S.remove(id); toast('Entry deleted', { undo: true }); };
    if (!row || calm.matches) { done(); return; }
    const prev = row.previousElementSibling, next = row.nextElementSibling;
    const lastInMonth = prev && prev.classList.contains('ct-month') && (!next || next.classList.contains('ct-month') || next.classList.contains('ct-earlier-btn'));
    const els = lastInMonth ? [row, prev] : [row];
    els.forEach(el => { el.style.height = el.getBoundingClientRect().height + 'px'; el.style.minHeight = '0px'; el.style.contentVisibility = 'visible'; });
    void row.offsetWidth;
    els.forEach(el => { el.classList.add('ct-leaving'); el.style.height = '0px'; el.style.paddingTop = '0px'; el.style.paddingBottom = '0px'; el.style.borderColor = 'transparent'; });
    setTimeout(done, 300);
  }
  // Undo brings the entry back with the same slide-in a new entry gets
  async function doUndo() {
    const before = new Set(S.all().map(e => e.id));
    const label = await S.undo();
    if (!label) { toast('Nothing to undo'); return; }
    const back = S.all().find(e => !before.has(e.id));
    if (back) { justAdded = back.id; render(); }
    toast('Undone');
  }

  // ---------- import (Premium) ----------
  function openImport() {
    if (!premium()) { toast('Import is part of Premium. Upgrading opens at launch.'); return; }
    window.CTImportUI.open((n, file) => { expanded = null; showEarlier = false; render(); toast('Imported ' + n + (n === 1 ? ' entry' : ' entries') + (file ? ' from ' + file : ''), { undo: true }); });
  }

  // ---------- export ----------
  function exportCSV() {
    if (!S.all().length) { toast('Nothing to export yet'); return; }
    const blob = new Blob(['﻿' + S.exportCSV()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'card-tab-' + S.today() + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Exported ' + S.all().length + ' entries');
  }
  $('ct-export').addEventListener('click', exportCSV);

  // Upgrade links anywhere
  document.addEventListener('click', e => { if (e.target.closest('[data-upgrade]')) { e.preventDefault(); xset(false); upgradeNote(); } });

  // Keyboard: Cmd/Ctrl+Z undoes, "/" jumps to search
  document.addEventListener('keydown', async e => {
    if (root.hidden || window.CTEditor.isOpen || (window.CTAddSheet && window.CTAddSheet.isOpen) || (window.CTImportUI && window.CTImportUI.isOpen)) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); doUndo(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); $('ct-search').focus(); }
    else if (e.key === 'Escape' && !xp.hidden) { xset(false); xb.focus(); }
  });

  // ---------- mount ----------
  let off = null;
  function mount() {
    dates();
    $('ct-period').value = pref.get('ct-period', 'all');
    $('ct-sort').value = pref.get('ct-sort', 'new');
    if (off) off();
    off = S.on(reason => {
      if (reason === 'plan') { selected = null; }
      if (reason === 'clear' || reason === 'sample' || reason === 'remote') { expanded = null; showEarlier = false; }
      render();
    });
    render();
  }

  window.CTDash = { mount, render, toast, exportCSV, upgradeNote, openImport };
})();
