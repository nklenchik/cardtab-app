/* Card Tab dashboard (Drop 1). Same layout and behavior as the cardtab.app demo, wired to the device store.
   Free: the four totals, insights and platform fees follow the date range inside the last 3 months (v52.9; the chart
         shows the last 3 months); every entry stays visible in the list, and search looks through every month.
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
  // a period is 'all', 'd30', or one month as 'm:YYYY-MM' (older saved values 'month'/'last' still work)
  const monthOf = p => p && p.slice(0, 2) === 'm:' ? p.slice(2) : p === 'month' ? D.monthPrefix : p === 'last' ? D.prevPrefix : null;
  // other ranges: 'r7:/r30:/rc:FROM:TO' (days, both ends included) and 'y:YYYY'
  const rangeOf = p => { let r = /^r(?:7|30|c):(\d{4}-\d\d-\d\d):(\d{4}-\d\d-\d\d)$/.exec(p || ''); if (r) return [r[1], r[2]]; r = /^y:(\d{4})$/.exec(p || ''); return r ? [r[1] + '-01-01', r[1] + '-12-31'] : null; };
  const rangeLabel = p => { const r = rangeOf(p); if (/^y:/.test(p)) return r[0].slice(0, 4); const f = d => new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' }); return r[0] === r[1] ? f(r[0]) : f(r[0]) + ' – ' + f(r[1]) + (r[1].slice(0, 4) !== String(new Date().getFullYear()) ? ', ' + r[1].slice(0, 4) : ''); };
  const inPeriod = (t, p) => p === 'all' || (rangeOf(p) ? t.date >= rangeOf(p)[0] && t.date <= rangeOf(p)[1] : monthOf(p) ? t.date.startsWith(monthOf(p)) : p === 'month' ? t.date.startsWith(D.monthPrefix) : p === 'last' ? t.date.startsWith(D.prevPrefix) : t.date >= D.from30);
  const periodLabel = p => (rangeOf(p) ? rangeLabel(p) : monthOf(p) ? ymLabel(monthOf(p), { month: 'long', year: 'numeric' }) : p === 'all' ? 'All time' : p === 'month' ? D.monthLabel : p === 'last' ? D.prevLabel : 'Last 30 days');
  const YM = new Map();
  const ymLabel = (k, fmt) => { const key = k + JSON.stringify(fmt); let v = YM.get(key); if (v == null) { v = new Date(k + '-15T12:00:00').toLocaleString('en-US', fmt); YM.set(key, v); } return v; };
  const niceDate = d => { const dt = new Date(d + 'T12:00:00'); return dt.toLocaleString('en-US', dt.getFullYear() === new Date().getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }); };
  const shortDate = d => Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) + '/' + d.slice(0, 4);
  const premium = () => S.plan() === 'premium';

  // ---------- view state (filters remembered per browser) ----------
  let type = 'all', view = 'monthly', selected = null, expanded = null, justAdded = null;
  // The list draws the newest entries first (FIRST), then adds STEP more just before you reach the bottom, so it scrolls on without a button
  const FIRST = 18, STEP = 15; let shown = FIRST, listSig = '', moreIO = null, moreCtx = null;
  const pref = {
    get(k, d) { try { return localStorage.getItem('ct.f.' + k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ct.f.' + k, v); } catch (e) {} }
  };

  // ---------- toasts ----------
  let toastEl = null, toastT = 0;
  function toast(text, opts) {
    opts = opts || {};
    // a Free user who tapped something that's part of Premium (feeds the occasional Premium tip)
    if (/Premium/.test(text) && S.plan() === 'free' && window.CTNotify) window.CTNotify.premiumTap();
    const box = $('app-toasts');
    if (toastEl) toastEl.remove(); clearTimeout(toastT);
    const t = document.createElement('div'); t.className = 'app-toast'; t.setAttribute('role', 'status');
    const span = document.createElement('span'); span.textContent = text; t.appendChild(span);
    if (opts.go) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'View'; b.addEventListener('click', () => { opts.go(); t.remove(); }); t.appendChild(b); }
    if (opts.undo) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Undo';
      b.addEventListener('click', doUndo);
      t.appendChild(b);
    }
    box.appendChild(t); toastEl = t;
    toastT = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 220); if (toastEl === t) toastEl = null; }, opts.undo ? 6000 : 2800);
  }
  // v50.96: every Upgrade button on the entries screen (the entry limit, All time, the banner, tips) opens the Premium sheet
  const upgradeNote = () => {
    const ctx = (window.CTTrack && window.CTTrack.premCtx) || 'upgrade button', go = () => window.CTPremiumOpen && window.CTPremiumOpen(ctx);
    if (window.CTPremiumOpen) go(); else if (window.CTBoardLoader) window.CTBoardLoader.load().then(() => setTimeout(go, 60)); else toast('Premium is coming soon.');
  };

  // ---------- data shaping (all in cents) ----------
  // v52.9: Free totals follow the range too, inside the last 3 months (the switcher keeps Free there); anything else falls back to this month
  const freeOk = p => !!(window.CTMonth && window.CTMonth.allowed ? window.CTMonth.allowed(p) : monthOf(p));
  function tileScope() { const all = S.all(), p = $('ct-period').value; return premium() || freeOk(p) ? all.filter(t => inPeriod(t, p)) : all.filter(t => t.date.startsWith(D.monthPrefix)); }
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
  // When a total changes (a new month, a new entry), the number counts up or down to its new value in about half a second,
  // then lands exactly on the cent. The tile itself never changes.
  const tweens = new Map();
  function countTo(el, c) {
    const old = el.dataset.c != null ? +el.dataset.c : null; el.dataset.c = c;
    cancelAnimationFrame(tweens.get(el) || 0);
    // v50.88: the first real total after the app opens counts up from $0 and slides in, up for a gain, down for a loss
    const first = !el._rose && c !== 0 && !calm.matches && !document.hidden && el.getClientRects().length > 0;
    if (first) { el._rose = 1; el.animate([{ transform: 'translateY(' + (c < 0 ? -14 : 14) + 'px)', opacity: 0, offset: 0 }, { opacity: 1, offset: .35 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
    else if (old === null || old === c || calm.matches || document.hidden || !el.getClientRects().length) { el.textContent = money(c); return; }
    const t0 = performance.now(), D = first ? 900 : 560, from = first ? 0 : old;
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = money(k < 1 ? Math.round(from + (c - from) * e) : c); if (k < 1) tweens.set(el, requestAnimationFrame(step)); };
    tweens.set(el, requestAnimationFrame(step));
  }
  function stats() {
    const t = S.totals(tileScope());
    countTo($('ct-sales'), t.sales); countTo($('ct-after'), t.after); countTo($('ct-spent'), t.spent); countTo($('ct-profit'), t.profit);
    const tile = $('ct-profit').parentElement; tile.classList.toggle('ct-positive', t.profit >= 0); tile.classList.toggle('ct-negative', t.profit < 0);
    const note = $('app-scope'), p = $('ct-period').value;
    const edge = !premium() && window.CTMonth && window.CTMonth.atEdge && window.CTMonth.atEdge(p);
    note.hidden = premium() || !S.all().length || (freeOk(p) && !edge);
    if (!note.hidden) note.innerHTML = freeOk(p) ? 'Free totals cover your last 3 months · <button type="button" data-upgrade>Older months with Premium</button>' : 'Totals show ' + esc(D.monthLabel) + ' · <button type="button" data-upgrade>All time with Premium</button>';
    $('ct-ins-scope').textContent = premium() || freeOk(p) ? periodLabel(p) : 'This month';
    if (window.CTHome) window.CTHome.paint({ t, list: tileScope(), p, prem: premium() });
    if (window.CTMetrics) window.CTMetrics.paint(tileScope());
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
  const G = window.CTGrade;
  const nmOf = t => G ? G.title(t) : t.name; // graded: the grade leaves the name and shows as the chip
  function artHtml(t, open) {
    // v50.29: a graded card sits in a slab drawn in code; the art goes in its well
    if (G && G.on() && G.of(t)) {
      const has = t.art && (t.art.list || t.art.detail);
      const inner = has ? '<img class="sl-img" src="' + esc(open ? (t.art.detail || t.art.list) : (t.art.list || t.art.detail)) + '" data-full="' + esc(t.art.detail || t.art.list) + '" alt="" loading="lazy" decoding="async">' : '<i class="sl-ph"></i>';
      return '<span class="ct-card-art ct-slab-art">' + G.slab(t, inner) + '</span>';
    }
    if (t.art && (t.art.list || t.art.detail)) return '<img class="ct-card-art" src="' + esc(open ? (t.art.detail || t.art.list) : (t.art.list || t.art.detail)) + '" data-full="' + esc(t.art.detail || t.art.list) + '" alt="" width="44" height="61" loading="lazy" onerror="window.CTArtBroken&&CTArtBroken(this)">';
    const letter = (t.name.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase();
    return '<span class="ct-card-art ct-art-ph" aria-hidden="true"><i>' + esc(letter) + '</i></span>';
  }
  // v37: the open row keeps only what the row doesn't already show, each fact under a small label (the date, the
  // amounts and "after fees" are in the row itself). Sales: fees, shipping, condition. Purchases: condition. Plus any note.
  // v37.1: the open row, like the website's card: the money as a short receipt beside the art (Sold, Fees and
  // shipping, then what you kept), and only condition and any note under it. The right-hand amount steps aside so the
  // card's name gets the full width.
  const keptRow = t => t.type === 'sale' ? '<div class="ct-mr kept"><span>You kept</span><b>' + money(t.net) + '</b></div>' : '<div class="ct-mr paid"><span>' + (t.type === 'refund' ? 'Refunded to buyer' : 'Paid') + '</span><b>−' + money(t.amount) + '</b></div>';
  // the receipt beside the art. Phones (and the gallery panel) end it with the total; on desktop the total sits on the
  // last line instead, across from Edit, Duplicate and Delete, so the open row is no taller than the card
  function moneyHtml(t) {
    const r = (l, v, cls) => '<div class="ct-mr' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b>' + v + '</b></div>';
    const fee = t.amount - t.net, each = t.qty > 1 ? r('Each', money(Math.round(t.amount / t.qty))) : '';
    const top = t.type === 'sale' ? r('Sold', money(t.amount)) + r('Fees and shipping', (fee ? '−' : '') + money(fee), fee ? 'neg' : '') : each;
    return '<div class="ct-money' + (top ? '' : ' ct-money-solo') + '">' + top + '<div class="ct-mtot"><i class="ct-mdash"></i>' + keptRow(t) + '</div></div>';
  }
  // a note that only repeated the grade ("Graded CGC 10 Pristine", from before grades had their own field) isn't shown twice
  function factsHtml(t) { let n = t.note || ''; if (G && G.of(t)) n = n.replace(/^\s*graded\s+(psa|bgs|beckett|cgc|sgc|tag)\s*\d[^\n]*\n?/i, '').trim(); return n ? '<div class="ct-row-note">' + esc(n) + '</div>' : ''; }
  const COND = { 'near mint': 'NM', 'mint': 'M', 'lightly played': 'LP', 'moderately played': 'MP', 'heavily played': 'HP', 'damaged': 'DMG' };
  const condShort = c => c ? (COND[String(c).toLowerCase()] || c) : '';
  // v50.34: the card's state sits in a pill after its name: graded = filled (CGC 10 Pristine), raw = outline (NM, LP ...)
  const pillOf = t => (G && G.of(t)) ? G.chip(t) : t.condition ? '<span class="sl-chip sl-raw" title="' + esc(t.condition) + '">' + esc(condShort(t.condition)) + '</span>' : '';
  // v51.6: the open entry's buttons. On phones they sit on one line: Edit with its label, then Change card, Duplicate and
  // Delete as round icons (their names stay for screen readers and show on hover). Desktop and the gallery keep full labels.
  const AI = p => '<svg class="ct-ai" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const ACTS = '<div class="ct-demo-actions ct-acts4">' +
    '<button type="button" data-act="edit">' + AI('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>') + '<span class="ct-al">Edit</span></button>' +
    '<button type="button" data-act="card" aria-label="Change card" title="Change card">' + AI('<rect x="3" y="3" width="5.8" height="7.8" rx="1.5"/><rect x="15.2" y="13.2" width="5.8" height="7.8" rx="1.5"/><path d="M19.6 10.6V8.8a2.2 2.2 0 0 0-2.2-2.2H12.2M14.2 4.6l-2 2 2 2"/><path d="M4.4 13.4v1.8a2.2 2.2 0 0 0 2.2 2.2h5.2M9.8 15.4l2 2-2 2"/>') + '<span class="ct-al">Change card</span></button>' +
    '<button type="button" data-act="dup" aria-label="Duplicate" title="Duplicate">' + AI('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>') + '<span class="ct-al">Duplicate</span></button>' +
    '<button type="button" data-act="del" aria-label="Delete" title="Delete">' + AI('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>') + '<span class="ct-al">Delete</span></button></div>';
  function detailsHtml(t) {
    return '<div class="ct-open-actions"><div class="ct-row-expanded-info"><div class="ct-dtot"><i class="ct-mdash"></i><div class="ct-dtrow">' + ACTS + keptRow(t) + '</div></div>' + factsHtml(t) + '<div class="ct-pacts">' + ACTS + '</div></div></div>';
  }
  const badgeOf = t => t.type === 'sale' ? 'Sale' : t.type === 'refund' ? 'Refund' : 'Purchase';
  // a sale's big number: what you kept after fees (default), or the full sale price if you picked that in your profile
  const soldPref = () => { try { return localStorage.getItem('ct.amt') === 'sold'; } catch (e) { return false; } };
  const amtText = t => t.type === 'sale' ? '+' + money(soldPref() ? t.amount : t.net) : '−' + money(t.amount);
  addEventListener('ct-amt', () => render());
  const subText = t => t.type === 'sale' ? money(t.net) + ' after fees' : t.type === 'refund' ? 'Refunded' : 'Paid';
  // v52.14: a picture already fetched and decoded ahead of time goes in at once; one still loading waits until the opening glide is done
  const fullArt = img => { if (!img || img.tagName !== 'IMG' || img.dataset.loaded) return; img.dataset.loaded = 1; const u = img.dataset.full, pre = new Image(), t0 = performance.now(); pre.src = u;
    const w = warmedU.get(u); if ((w && w.complete && w.naturalWidth) || (pre.complete && pre.naturalWidth)) { img.src = u; return; } (pre.decode ? pre.decode() : new Promise((r, j) => { pre.onload = r; pre.onerror = j; })).then(() => setTimeout(() => { if (img.isConnected) img.src = u; }, Math.max(0, 380 - (performance.now() - t0)))).catch(() => { delete img.dataset.loaded; }); };
  function setBtn(btn, open) { const t = S.get(btn.dataset.tx); if (!t) return; btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', (open ? 'Collapse ' : 'Expand ') + t.name); btn.querySelector('.ct-row-chevron').textContent = open ? '−' : '+'; }

  // Open/close in place (v51.0: transform and opacity only, so it stays at 60 fps on phones).
  // The final layout is applied at once; then everything is slid from where it was to where it lands:
  //  - the art scales from its small spot into place (transform),
  //  - opening: the entry is revealed downward with a clip (no height animation), its details fade in right away,
  //  - closing: a copy of the open entry's details sits where they were and fades while the entries below slide up over it,
  //  - the entries below slide from their old place to their new one (transform), instead of the whole list re-laying out every frame.
  const FLIP_MS = 340, FLIP_EASE = 'cubic-bezier(.2,.8,.2,1)';
  function flip(row, apply) {
    if (calm.matches || !row.animate) { apply(); return 0; }
    (row._anims || []).forEach(a => a.finish()); row._anims = []; clearTimeout(row._flipT);
    if (row._ghost) { row._ghost.remove(); row._ghost = null; }
    const art = row.querySelector('.ct-card-art'), list = row.parentElement, opening = !row.classList.contains('expanded');
    const vh = innerHeight, r0 = row.getBoundingClientRect(), a0 = art ? art.getBoundingClientRect() : null;
    // the entries (and month headings) below that are on screen, and where they are now
    const below = []; for (let n = row.nextElementSibling; n && below.length < 40; n = n.nextElementSibling) { const r = n.getBoundingClientRect(); if (r.top > vh + 400) break; below.push([n, r.top]); }
    // closing: keep a picture of the open entry's lower part where it was, to fade out
    let ghost = null;
    if (!opening) { ghost = row.cloneNode(true); ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      Object.assign(ghost.style, { position: 'absolute', top: row.offsetTop + 'px', left: row.offsetLeft + 'px', width: row.offsetWidth + 'px', height: r0.height + 'px', margin: '0', pointerEvents: 'none' }); ghost.setAttribute('aria-hidden', 'true'); ghost.classList.add('ct-noanim'); ghost.querySelectorAll('*').forEach(x => x.style.setProperty('transition', 'none', 'important')); }
    row.classList.add('ct-noanim'); apply();
    const r1 = row.getBoundingClientRect(), dh = r1.height - r0.height, an = [];   // ct-noanim stays on until the motion ends, so no CSS transition starts
    const rad = getComputedStyle(row).borderRadius || '0px';
    if (art && a0) { const a1 = art.getBoundingClientRect();
      if (a1.width) an.push(art.animate([{ transformOrigin: '0 0', transform: 'translate(' + ((a0.left - r0.left) - (a1.left - r1.left)) + 'px,' + ((a0.top - r0.top) - (a1.top - r1.top)) + 'px) scale(' + (a0.width / a1.width) + ')' }, { transformOrigin: '0 0', transform: 'none' }], { duration: FLIP_MS, easing: FLIP_EASE })); }
    if (opening && dh > 0) {
      an.push(row.animate([{ clipPath: 'inset(0 0 ' + dh + 'px 0 round ' + rad + ')' }, { clipPath: 'inset(0 0 0 0 round ' + rad + ')' }], { duration: FLIP_MS, easing: FLIP_EASE }));
      const txt = row.querySelector('.ct-expanded-right'); if (txt) an.push(txt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }));
      const acts = row.querySelector('.ct-open-actions'); if (acts) an.push(acts.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 60, easing: FLIP_EASE, fill: 'backwards' }));
    }
    if (ghost && dh < 0) {
      ghost.style.clipPath = 'inset(' + r1.height + 'px 0 0 0)';   // only the part below the closed entry shows, from the very first frame
      list.insertBefore(ghost, row.nextSibling); row._ghost = ghost;
      const g = ghost.animate([{ opacity: 1, clipPath: 'inset(' + r1.height + 'px 0 0 0)' }, { opacity: 0, clipPath: 'inset(' + r1.height + 'px 0 0 0)' }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
      g.onfinish = () => { if (row._ghost === ghost) row._ghost = null; ghost.remove(); }; an.push(g);
      // the closed entry's text comes in as the art shrinks back, instead of sitting on top of the big art
      const txt = row.querySelector('.ct-expanded-right'); if (txt) an.push(txt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 90, easing: 'ease-out', fill: 'backwards' }));
    }
    // the entries below glide to their new places (only those that are or will be on screen)
    if (dh) below.forEach(([n, t0]) => { const t1 = n.getBoundingClientRect().top, d = t0 - t1; if (!d || (t1 > vh && t0 > vh)) return;
      an.push(n.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: FLIP_MS, easing: FLIP_EASE })); });
    row._anims = an; clearTimeout(row._flipT); row._flipT = setTimeout(() => { row._flipT = 0; row.classList.remove('ct-noanim'); fadeSync(); }, FLIP_MS + 20);
    return dh;
  }
  function pinList(delta, ms) {
    const l = $('ct-rows'); if (!phone.matches || calm.matches || l._skipPin) return; const now = performance.now();
    const base = (l._pinEnd || 0) > now ? l._pinTarget : l.getBoundingClientRect().height; l._pinTarget = Math.max(0, base + delta);
    l.style.height = l._pinTarget + 'px'; l.style.overflow = 'hidden';
    l._pinEnd = Math.max(l._pinEnd || 0, now + ms); clearTimeout(l._pinT);
    l._pinT = setTimeout(() => { l.style.height = ''; l.style.overflow = ''; l._pinEnd = 0; }, l._pinEnd - now);
  }
  // v50.57: an entry that opens stays put. While the one above it closes, the page (phones) or the list (computers) scrolls
  // along so the opening entry keeps its place on screen; once open, it scrolls just enough to show the whole entry, but its
  // top never goes above the top of the visible area (under the header)
  function scrollerOf() { const l = $('ct-rows'); return !phone.matches && l.scrollHeight > l.clientHeight + 1 ? l : null; }
  function viewBox(sc) {
    if (sc) { const r = sc.getBoundingClientRect(); return { top: r.top + 6, bottom: r.bottom - 10 }; }
    const hd = document.querySelector('.sh-in'), tb = document.getElementById('ct-tbar');
    const top = Math.max(0, hd ? hd.getBoundingClientRect().bottom : 0) + 8;
    const tbt = tb && tb.offsetParent ? tb.getBoundingClientRect().top : innerHeight; return { top, bottom: Math.min(innerHeight, tbt) - 12 };
  }
  const quiet = ms => { window.CTQuietScroll = Math.max(window.CTQuietScroll || 0, performance.now() + ms); };
  const scrollBy2 = (sc, dy, smooth) => { if (!dy) return; quiet(smooth ? 900 : 200); const o = { top: dy, behavior: smooth && !calm.matches ? 'smooth' : 'auto' }; if (sc) sc.scrollBy(o); else window.scrollBy(o); };
  // v50.59: show the whole entry in the same motion as it opens: its final size is known as soon as it starts opening, so the
  // page (or list) starts one native smooth scroll right away instead of a second scroll after the opening finishes
  function fitRow(row) {
    const sc = scrollerOf(), v = viewBox(sc), r = row.getBoundingClientRect(), h = parseFloat(row.style.height) || r.height, bottom = r.top + h;
    const l = $('ct-rows'); l.style.overflowAnchor = 'none'; document.documentElement.style.overflowAnchor = 'none';
    setTimeout(() => { l.style.overflowAnchor = ''; document.documentElement.style.overflowAnchor = ''; fadeSync(); }, 400);
    if (r.top < v.top) scrollBy2(sc, r.top - v.top, true);
    else if (bottom > v.bottom) scrollBy2(sc, Math.min(bottom - v.bottom, r.top - v.top), true);
  }
  function holdRow(row, ms) {
    const sc = scrollerOf(), vb = viewBox(sc), y0 = Math.max(vb.top, row.getBoundingClientRect().top), end = performance.now() + ms;
    const l = $('ct-rows'); l.style.overflowAnchor = 'none'; document.documentElement.style.overflowAnchor = 'none';
    const step = () => { if (!row.isConnected) return done(); const dy = row.getBoundingClientRect().top - y0; if (Math.abs(dy) > .5) scrollBy2(sc, dy);
      if (performance.now() < end) requestAnimationFrame(step); else done(); };
    const done = () => { l.style.overflowAnchor = ''; document.documentElement.style.overflowAnchor = '';
      if (!row.isConnected || !row.classList.contains('expanded')) return; const v = viewBox(scrollerOf()), r = row.getBoundingClientRect();
      if (r.top < v.top) scrollBy2(scrollerOf(), r.top - v.top, true);
      else if (r.bottom > v.bottom) scrollBy2(scrollerOf(), Math.min(r.bottom - v.bottom, r.top - v.top), true);
      fadeSync(); };
    requestAnimationFrame(step);
  }
  function toggle(id) {
    const list = $('ct-rows'), prevId = expanded; expanded = expanded === id ? null : id; let prevIdDone = false;
    let pinDelta = 0;
    // v50.58: the open entry is above the one being opened: close it in one step and move the page by exactly as much in the
    // same frame, so the tapped entry doesn't move at all (scrolling along an animation every frame looked jittery on iPhone)
    if (prevId != null && expanded != null) { const pb = list.querySelector('[data-tx="' + prevId + '"]'), nb = list.querySelector('[data-tx="' + id + '"]');
      if (pb && nb && (pb.compareDocumentPosition(nb) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        const prow = pb.parentElement, nrow = nb.parentElement, sc = scrollerOf(), y0 = nrow.getBoundingClientRect().top, h0 = list.getBoundingClientRect().height;
        // the list keeps its height until the new entry has opened, so a page near its end can't run out of room and shift
        list.style.minHeight = h0 + 'px'; clearTimeout(list._mhT); list._mhT = setTimeout(() => { list.style.minHeight = ''; }, 420);
        if (prow._flipT) { clearTimeout(prow._flipT); prow._flipT = 0; } (prow._anims || []).forEach(x => x.cancel()); prow._anims = []; if (prow._ghost) { prow._ghost.remove(); prow._ghost = null; }
        prow.classList.add('ct-noanim', 'ct-snap'); ['height', 'minHeight', 'overflow', 'transition'].forEach(k => { prow.style[k] = ''; });
        prow.classList.remove('expanded'); setBtn(pb, false); const bx = prow.querySelector('.ct-open-actions'); if (bx) bx.remove(); const mm = prow.querySelector('.ct-money'); if (mm) mm.remove();
        void prow.offsetWidth; prow.classList.remove('ct-noanim'); requestAnimationFrame(() => requestAnimationFrame(() => {
          // the closed entry settles to its real height once its transitions come back; correct by whatever is left, before that frame paints
          prow.classList.remove('ct-snap'); const d2 = nrow.getBoundingClientRect().top - y0; if (Math.abs(d2) > .5) { if (sc) sc.scrollTop += d2; else window.scrollTo(0, window.scrollY + d2); }
          if (nrow.classList.contains('expanded')) fitRow(nrow); }));   // then show the whole entry (starting it earlier would be cut off by the correction)
        quiet(500); const dy = nrow.getBoundingClientRect().top - y0; if (dy) { if (sc) sc.scrollTop += dy; else window.scrollTo(0, window.scrollY + dy); }
        prevIdDone = true; } }
    if (prevId != null && !prevIdDone) { const btn = list.querySelector('[data-tx="' + prevId + '"]'); if (btn) { const row = btn.parentElement; const box0 = row.querySelector('.ct-open-actions'); pinDelta += flip(row, () => { row.classList.remove('expanded'); setBtn(btn, false); if (box0) box0.remove(); const m0 = row.querySelector('.ct-money'); if (m0) m0.remove(); }) || 0; const box = row.querySelector('.ct-open-actions'); if (box) setTimeout(() => { if (!row.classList.contains('expanded')) { box.remove(); const m = row.querySelector('.ct-money'); if (m) m.remove(); } fadeSync(); }, 360); } }
    if (expanded != null) {
      const btn = list.querySelector('[data-tx="' + id + '"]'), t = S.get(id); if (!btn || !t) return;
      const row = btn.parentElement; const old = row.querySelector('.ct-open-actions'); if (old) old.remove();
      row.insertAdjacentHTML('beforeend', detailsHtml(t));
      { const er = row.querySelector('.ct-expanded-right'), om = er.querySelector('.ct-money'); if (om) om.remove(); er.insertAdjacentHTML('beforeend', moneyHtml(t)); }
      pinDelta += flip(row, () => { row.classList.add('expanded'); setBtn(btn, true); }) || 0; fullArt(btn.querySelector('img.ct-card-art,.ct-slab-art img'));
      if (!prevIdDone) fitRow(row);
    }
    pinList(pinDelta, 360);
  }
  function fadeSync() { const l = $('ct-rows'); l.classList.toggle('ct-at-end', l.scrollTop + l.clientHeight >= l.scrollHeight - 2); }

  function platformsSelect() {
    const sel = $('ct-platform'), cur = sel.value, ps = S.platforms();
    sel.innerHTML = '<option value="all">' + (phone.matches ? 'Platform' : 'All platforms') + '</option>' + ps.map(p => '<option>' + esc(p) + '</option>').join('');
    sel.value = ps.includes(cur) ? cur : 'all';
  }

  // ---------- gallery view (v37): the card art, big. Same range, filters, platform and sort as the list ----------
  // v50.27: computers start on grid, phones on list, until someone picks (their pick follows the account, per kind of device)
  let gal = false; try { const v0 = localStorage.getItem('ct.view'); gal = v0 ? v0 === 'gallery' : !matchMedia('(max-width:760px)').matches; } catch (e) {}
  // v50.28: three grid sizes (small, medium, large), kept separately for phones and computers like list or grid
  let gsz = 'm'; try { const g0 = localStorage.getItem('ct.gsize'); if (g0 === 's' || g0 === 'l') gsz = g0; } catch (e) {}
  // v50.51: the short caption is the card itself (same picker as the slab label), so "Set - Card - 199/165" names don't show the set
  const shortName = n => { const s = window.CTGrade ? CTGrade.cardName({ name: n }) : ''; return s || String(n || '').split(' - ')[0]; };
  // v52.68 card pictures aren't all exactly card-shaped: each picture's box takes the picture's own shape once it loads
  // (remembered per picture, so redraws don't jump), so nothing is trimmed off its edges or corners
  const artAR = new Map(), arStyle = src => { const r = src && artAR.get(src); return r ? ' style="--ar:' + r + '"' : ''; };
  const fitArt = img => { const box = img.parentElement; if (!box || !box.matches('.ct-tile-art:not(.ct-slabbed),.gp-art:not(.ct-slabbed)') || !img.naturalWidth) return;
    let r = img.naturalWidth / img.naturalHeight; if (r > 0.95) return;   // a sideways picture: it gets turned first (artrot.js)
    r = Math.max(0.62, Math.min(0.8, r)).toFixed(4); artAR.set(img.getAttribute('src'), r); if (box.style.getPropertyValue('--ar') !== r) box.style.setProperty('--ar', r); };
  document.addEventListener('load', e => { if (e.target && e.target.tagName === 'IMG') fitArt(e.target); }, true);
  window.CTFitArt = fitArt;
  function tileHtml(t) {
    const src = t.art && (t.art.detail || t.art.list);
    return '<button type="button" class="ct-tile' + (t.id === justAdded ? ' ct-new' : '') + '" data-tile="' + t.id + '" aria-label="' + esc(t.name) + ', ' + badgeOf(t) + ', ' + amtText(t) + '">' +
      (G && G.on() && G.of(t) ? '<span class="ct-tile-art ct-slabbed">' + G.slab(t, src ? '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async">' : '<i class="sl-ph"></i>') + '</span>'
        : '<span class="ct-tile-art"' + arStyle(src) + '>' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async">' : '<i>' + esc(t.name) + '</i>') + '</span>') +
      '<b class="ct-tile-nm"><span class="ct-tile-full">' + esc(nmOf(t)) + (t.qty > 1 ? ' ×' + t.qty : '') + '</span><span class="ct-tile-short">' + esc(shortName(nmOf(t))) + '</span></b>' +
      '<small class="ct-tile-ln"><span class="ct-dot ' + t.type + '" aria-hidden="true"></span><span class="ct-tile-meta">' + badgeOf(t) + ' · ' + niceDate(t.date) + '</span><span class="ct-tile-pl">' + esc(t.platform || badgeOf(t)) + '</span></small>' +
      '<strong class="ct-tile-amt ' + t.type + '">' + amtText(t) + '</strong></button>';
  }
  const paintView = () => { fbar.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === 'list' ? !gal : gal && b.dataset.gs === gsz)));
    // v50.56: phones show one button with the current view's icon; it opens the four choices
    const t = fbar.querySelector('.fb-vbtn'), on = fbar.querySelector('.fb-vopts [aria-pressed="true"]');
    if (t && on) { t.querySelector('.fb-vi').innerHTML = on.querySelector('svg').outerHTML; t.setAttribute('aria-label', 'View: ' + on.getAttribute('aria-label') + '. Change view'); } };
  function setView(v, gs) {
    gal = v === 'gallery'; try { localStorage.setItem('ct.view', v); } catch (e) {}
    if (gal && gs && gs !== gsz) { gsz = gs; try { localStorage.setItem('ct.gsize', gs); } catch (e) {} }
    paintView();
    expanded = null; const l = $('ct-rows');
    if (calm.matches) { render(); return; }
    l.classList.add('ct-swap'); setTimeout(() => { render(); requestAnimationFrame(() => l.classList.remove('ct-swap')); }, 140);
  }

  // ---------- the details panel for a gallery card: centered on desktop, a sheet from the bottom on phones ----------
  const gp = document.createElement('dialog'); gp.className = 'ct-gp'; gp.setAttribute('aria-label', 'Entry details');
  document.body.appendChild(gp);
  let gpId = null;
  const gpList = () => [...$('ct-rows').querySelectorAll('[data-tile]')].map(b => b.dataset.tile);
  function paintGP() {
    const t = S.get(gpId); if (!t) { gp.close(); return; }
    const src = t.art && (t.art.detail || t.art.list), ids = gpList(), i = ids.indexOf(gpId);
    const X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const A = d => '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (d < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6') + '"/></svg>';
    gp.innerHTML = '<div class="gp-in"><i class="gp-grab" aria-hidden="true"></i><button type="button" class="gp-x" data-gx aria-label="Close">' + X + '</button>' +
      (G && G.on() && G.of(t) ? '<div class="gp-art ct-slabbed">' + G.slab(t, src ? '<img src="' + esc(src) + '" alt="">' : '<i class="sl-ph"></i>') + '</div>'
        : '<div class="gp-art"' + arStyle(src) + '>' + (src ? '<img src="' + esc(src) + '" alt="">' : '<i>' + esc(t.name) + '</i>') + '</div>') +
      '<div class="gp-body"><small class="gp-line"><span class="ct-dot ' + t.type + '" aria-hidden="true"></span>' + badgeOf(t) + ' · ' + (t.platform ? esc(t.platform) + ' · ' : '') + niceDate(t.date) + '</small>' +
      '<h2 class="gp-nm">' + esc(nmOf(t)) + (t.qty > 1 ? ' ×' + t.qty : '') + (pillOf(t) ? ' ' + pillOf(t) : '') + '</h2>' +
      moneyHtml(t) + '<div class="ct-row-expanded-info">' + factsHtml(t) + ACTS.replace(/data-act=/g, 'data-gact=') + '</div></div>' +
      (ids.length > 1 ? '<button type="button" class="gp-nav gp-prev" data-gstep="-1" aria-label="Previous card"' + (i <= 0 ? ' disabled' : '') + '>' + A(-1) + '</button><button type="button" class="gp-nav gp-next" data-gstep="1" aria-label="Next card"' + (i >= ids.length - 1 ? ' disabled' : '') + '>' + A(1) + '</button>' : '') + '</div>';
  }
  function openGP(id) { gpId = id; paintGP(); gp.classList.remove('out'); if (!gp.open) gp.showModal(); const x = gp.querySelector('[data-gx]'); if (x) x.focus({ preventScroll: true }); }
  function closeGP(then) { if (!gp.open) { if (then) then(); return; } if (calm.matches) { gp.close(); if (then) then(); return; } gp.classList.add('out'); setTimeout(() => { gp.close(); gp.classList.remove('out'); gp.style.removeProperty('--dy'); if (then) then(); }, 200); }
  function stepGP(d) { const ids = gpList(), i = ids.indexOf(gpId) + d; if (i < 0 || i >= ids.length) return; gpId = ids[i]; paintGP(); }
  gp.addEventListener('click', e => {
    const zart = e.target.closest('.gp-art img'); if (zart && window.CTZoom) { window.CTZoom.open(zart.src, zart); return; }
    if (e.target === gp) { closeGP(); return; }
    if (e.target.closest('[data-gx]')) { closeGP(); return; }
    const st = e.target.closest('[data-gstep]'); if (st) { stepGP(+st.dataset.gstep); return; }
    const a = e.target.closest('[data-gact]'); if (a) { if (a.dataset.gact === 'del' && armDel(a)) return; const id = gpId, k = a.dataset.gact; closeGP(() => doAct(k, id)); }
  });
  gp.addEventListener('cancel', e => { e.preventDefault(); closeGP(); });
  gp.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepGP(e.key === 'ArrowLeft' ? -1 : 1); } });
  // phones: dragging the sheet down is handled for every sheet in js/sheetdrag.js
  S.on(() => { if (gp.open) paintGP(); });

  // Older entries aren't built until you scroll toward them, so the page stays light (sheets open faster, filters redraw faster)
  // v52.33: each entry's searchable text, worked out once per version of the entry (entries are replaced when they change)
  const qText = new WeakMap(), hay = t => { let h = qText.get(t); if (h == null) { h = (t.name + ' ' + t.platform + ' ' + t.note).toLowerCase(); qText.set(t, h); } return h; };
  function render(listOnly) {
    // listOnly: typing in search only changes which entries show; the totals and chart don't depend on it
    if (listOnly !== true) listOnly = false;
    dates();
    const all = S.all(), empty = !all.length;
    $('app-first-wrap').hidden = !empty; $('app-grid').classList.toggle('is-empty', empty); root.querySelector('.ct-demo-right:not(.app-first-wrap)').hidden = empty;
    if (!listOnly) { limits(); firstRun(); askPanel(); platformsSelect(); }
    $('ct-type').value = type;
    const q = $('ct-search').value.trim().toLowerCase(), platform = $('ct-platform').value, period = $('ct-period').value, sort = $('ct-sort').value;
    let rows = all.filter(t => (type === 'all' || t.type === type) && (platform === 'all' || t.platform === platform) && (!q || hay(t).includes(q)) && (q || inPeriod(t, period)));   // search always looks through every month
    { const base = all.filter(t => (platform === 'all' || t.platform === platform) && (!q || hay(t).includes(q)) && (q || inPeriod(t, period)));
      const n = { all: base.length, sale: 0, purchase: 0, refund: 0 }; base.forEach(t => { n[t.type] = (n[t.type] || 0) + 1; });
      fbar.querySelectorAll('[data-fb]').forEach(c => { const k = c.dataset.fb; c.querySelector('em').textContent = n[k] ? n[k] : ''; c.classList.toggle('on', k === type); c.setAttribute('aria-pressed', String(k === type)); }); }
    if (sort !== 'new') rows.sort((a, b) => sort === 'high' ? b.amount - a.amount : sort === 'old' ? a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) : b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    if (!listOnly) { stats(); chart(); }
    if (empty) return;
    const listFiltered = !!(q || type !== 'all' || platform !== 'all'), ft = S.totals(rows);
    const nw = x => '<span class="ct-nw">' + x + '</span>';
    const oneMonth = !q && !!monthOf(period) && sort !== 'high';
    $('ct-rows').classList.toggle('ct-onemonth', oneMonth);
    $('ct-rows').classList.toggle('ct-gal', gal); $('ct-rows').classList.toggle('gs-s', gal && gsz === 's'); $('ct-rows').classList.toggle('gs-l', gal && gsz === 'l');
    $('ct-count').innerHTML = esc(q ? 'All months' : periodLabel(period)) + ' · ' + nw(rows.length + (rows.length === 1 ? ' entry' : ' entries')) + (listFiltered ? ' · ' + nw('Spent ' + money(ft.spent)) + ' · ' + nw('Profit ' + money(ft.profit)) : '');
    const sg = [period, type, platform, q, sort, gal].join('|'); if (sg !== listSig) { listSig = sg; shown = FIRST; }
    if (expanded != null) { const ix = rows.findIndex(t => t.id === expanded); if (ix >= shown) shown = ix + 1; }
    const perMonth = {}; rows.forEach(t => { const k = t.date.slice(0, 7); perMonth[k] = (perMonth[k] || 0) + 1; });
    if (expanded && !rows.some(t => t.id === expanded)) expanded = null;
    const heads = sort !== 'high' && !oneMonth;
    // Rows from..to-1 as HTML. The last row of each month gets a class (the torn receipt edge), so the browser never has to search for it.
    const build = (from, to) => {
      let out = '';
      for (let i = from; i < to; i++) {
        const t = rows[i], k = t.date.slice(0, 7);
        if (heads && (i === 0 || rows[i - 1].date.slice(0, 7) !== k)) out += '<div class="ct-month">' + ymLabel(k, { month: 'long', year: 'numeric' }) + ' <span>' + perMonth[k] + (perMonth[k] === 1 ? ' entry' : ' entries') + '</span></div>';
        if (gal) { out += tileHtml(t); continue; }
        const last = i === rows.length - 1 || (heads && rows[i + 1].date.slice(0, 7) !== k);
        const open = expanded === t.id, badge = t.type === 'sale' ? 'Sale' : t.type === 'refund' ? 'Refund' : 'Purchase';
        const after = t.type === 'sale' ? ' &nbsp; After fees <em>' + money(t.net) + '</em>' : '';
        const verb = t.type === 'sale' ? 'Sold' : t.type === 'refund' ? 'Refunded to buyer' : 'Paid';
        out += '<div class="ct-row ' + (last ? 'ct-last ' : '') + (open ? 'expanded' : '') + (t.id === justAdded ? ' ct-new' : '') + '"><button type="button" class="ct-row-toggle" data-tx="' + t.id + '" aria-expanded="' + open + '" aria-label="' + (open ? 'Collapse' : 'Expand') + ' ' + esc(t.name) + '">' + artHtml(t, open) + '<div class="ct-expanded-right"><div class="ct-row-meta">' + shortDate(t.date) + (t.platform ? ' · ' + esc(t.platform) : '') + '</div>' + (pillOf(t) ? '<div class="ct-row-name ct-rn-g"><span class="ct-rn">' + esc(nmOf(t)) + (t.qty > 1 ? ' ×' + t.qty : '') + '</span> ' + pillOf(t) + '</div>' : '<div class="ct-row-name">' + esc(t.name) + (t.qty > 1 ? ' ×' + t.qty : '') + '</div>') + '<div class="ct-row-bottom">' + verb + ' <strong>' + money(t.amount) + '</strong>' + after + '</div>' +
          // desktop: one quiet line under the name (type, platform, date) and the money on the right edge
          '<div class="ct-row-line"><span class="ct-dot ' + t.type + '" aria-hidden="true"></span>' + badge + ' · ' + (t.platform ? esc(t.platform) + ' · ' : '') + niceDate(t.date) + '</div>' + (open ? moneyHtml(t) : '') + '</div>' +
          '<span class="ct-row-amt ' + t.type + '"><strong>' + amtText(t) + '</strong><small>' + (t.type === 'sale' ? money(t.net) + ' after fees' : t.type === 'refund' ? 'Refunded' : 'Paid') + '</small></span><span class="ct-tag ' + t.type + '">' + badge + '</span><span class="ct-row-chevron" aria-hidden="true">' + (open ? '−' : '+') + '</span></button>' + (open ? detailsHtml(t) : '') + '</div>';
      }
      return out;
    };
    justAdded = null;
    moreCtx = { rows, build };
    const html = build(0, Math.min(shown, rows.length)) + (shown < rows.length ? '<div class="ct-more" aria-hidden="true"></div>' : '');
    const list = $('ct-rows'), keepScroll = list.scrollTop;
    list.innerHTML = html || (oneMonth && !listFiltered ? '<div class="ct-empty ct-empty-month"><p>No entries in ' + esc(ymLabel(monthOf(period), { month: 'long' })) + ' yet.</p>' + (monthOf(period) === D.monthPrefix ? '<button type="button" data-empty-add>+ Add New</button>' : '') + '</div>' : '<div class="ct-empty"><p>No entries match.</p><button type="button" data-clear-filters>Clear filters</button></div>');
    list.scrollTop = keepScroll;
    watchMore(list);
    fadeSync();
    warmBig(list);
  }
  // Adds the next STEP entries once the end of the list is within about a screen and a half of the view
  function watchMore(list) {
    if (moreIO) { moreIO.disconnect(); moreIO = null; }
    const sent = list.querySelector('.ct-more'); if (!sent || !('IntersectionObserver' in window)) { if (sent) loadMore(true); return; }
    const own = list.scrollHeight > list.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(list).overflowY);
    moreIO = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) loadMore(); }, { root: own ? list : null, rootMargin: '0px 0px 1100px 0px' });
    moreIO.observe(sent);
  }
  function loadMore(all) {
    const list = $('ct-rows'), sent = list.querySelector('.ct-more'); if (!sent || !moreCtx) return;
    const from = shown; shown = all ? moreCtx.rows.length : Math.min(moreCtx.rows.length, shown + STEP);
    sent.insertAdjacentHTML('beforebegin', moreCtx.build(from, shown));
    if (shown >= moreCtx.rows.length) { sent.remove(); if (moreIO) { moreIO.disconnect(); moreIO = null; } }
    else if (moreIO) { moreIO.unobserve(sent); moreIO.observe(sent); }   // still near the end: check again
    fadeSync();
    warmBig(list);
  }
  // v52.14 the bigger picture an opened entry shows, fetched and decoded quietly for rows on (or near) the screen, so
  // opening one on a phone shows it sharp right away (hover did this only with a mouse). Skipped with Data Saver on.
  let warmIO = null; const warmedU = new Map();   // picture address -> the loaded picture
  function warmOne(img) { const u = img.dataset.full; if (!u || img.dataset.warm || img.dataset.loaded || u === img.getAttribute('src') || warmedU.has(u)) return; img.dataset.warm = 1;
    const w = new Image(); w.decoding = 'async'; w.src = u; warmedU.set(u, w); if (w.decode) w.decode().catch(() => {}); }
  function warmBig(list) {
    if (!('IntersectionObserver' in window) || (navigator.connection && navigator.connection.saveData)) return;
    if (!warmIO) warmIO = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; warmIO.unobserve(e.target);
      const go = () => warmOne(e.target); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 300); }), { rootMargin: '300px 0px' });
    list.querySelectorAll('img.ct-card-art[data-full]:not([data-warm]),.ct-slab-art img[data-full]:not([data-warm])').forEach(i => warmIO.observe(i));
  }

  // v51.9: Delete takes two taps. The first turns it into a red "Delete?" for 3 seconds; the second deletes (and Undo still
  // follows). A stray tap on the small trash icon does nothing.
  function disarmDel(btn) { clearTimeout(btn._armT); btn.classList.remove('ct-arm'); const al = btn.querySelector('.ct-al'); if (al && al.dataset.t) al.textContent = al.dataset.t; btn.setAttribute('aria-label', 'Delete'); }
  function armDel(btn) {
    if (btn.classList.contains('ct-arm')) { disarmDel(btn); return false; }
    document.querySelectorAll('.ct-arm').forEach(disarmDel);
    btn.classList.add('ct-arm'); const al = btn.querySelector('.ct-al'); if (al) { al.dataset.t = al.dataset.t || al.textContent; al.textContent = 'Delete?'; }
    btn.setAttribute('aria-label', 'Tap again to delete'); btn._armT = setTimeout(() => disarmDel(btn), 3000); return true;
  }
  async function doAct(a, id) {
    const t = S.get(id); if (!t) return;
    if (a === 'edit') window.CTEditor.open(t, afterEditor);
    else if (a === 'del') removeAnimated(id);
    else if (a === 'card') { if (window.CTNotify) window.CTNotify.change(t); }
    else if (a === 'dup') {
      if (S.usage().blocked) { limitToast(); return; }
      const c = await S.duplicate(id); justAdded = c.id; expanded = null; render(); usageToast('Entry duplicated');
    }
  }
  // One listener for everything in the list (rows are redrawn often)
  $('ct-rows').addEventListener('click', async e => {
    if (e.target.closest('[data-empty-add]')) { $('ct-add').click(); return; }
    if (e.target.closest('[data-clear-filters]')) { clearFilters(); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation();
      if (act.dataset.act === 'del' && armDel(act)) return;
      doAct(act.dataset.act, act.closest('.ct-row').querySelector('.ct-row-toggle').dataset.tx);
      return;
    }
    // the card art in an open entry opens the art viewer (instead of closing the entry)
    const zart = e.target.closest('.ct-row.expanded img.ct-card-art,.ct-row.expanded .ct-slab-art img');
    if (zart && window.CTZoom) { e.stopPropagation(); window.CTZoom.open(zart.dataset.full || zart.src, zart); return; }
    const tile = e.target.closest('[data-tile]'); if (tile) { openGP(tile.dataset.tile); return; }
    const tg = e.target.closest('.ct-row-toggle'); if (tg) toggle(tg.dataset.tx);
  });
  $('ct-rows').addEventListener('pointerover', e => { const tg = e.target.closest && e.target.closest('.ct-row-toggle'); const a = tg && tg.querySelector('img.ct-card-art,.ct-slab-art img'); if (a && !a.dataset.warm && !a.dataset.loaded) { a.dataset.warm = 1; const w = new Image(); w.src = a.dataset.full; } }, { passive: true });
  $('ct-rows').addEventListener('scroll', fadeSync, { passive: true });

  function clearFilters() {
    type = 'all'; $('ct-search').value = ''; $('ct-search').dispatchEvent(new Event('input')); $('ct-platform').value = 'all';
    $$('[data-ct-type]').forEach(x => x.classList.toggle('ct-selected', x.dataset.ctType === 'all')); expanded = null; render();
  }

  // ---------- the filter row (v36.2): chips with counts, then Platform and Sort, right above the list ----------
  const fbar = document.createElement('div'); fbar.className = 'ct-fbar';
  fbar.innerHTML = '<div class="fb-chips" role="group" aria-label="Show">' + [['all', 'All'], ['sale', 'Sales'], ['purchase', 'Purchases'], ['refund', 'Refunds']].map(x => '<button type="button" data-fb="' + x[0] + '" aria-pressed="false">' + x[1] + ' <em></em></button>').join('') + '</div><div class="fb-dds"></div>';
  $('ct-rows').parentElement.insertBefore(fbar, $('ct-rows'));
  fbar.querySelector('.fb-dds').append($('ct-platform'), $('ct-sort'));
  { const v = document.createElement('div'); v.className = 'fb-view'; v.setAttribute('role', 'group'); v.setAttribute('aria-label', 'View');
    const I = p => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
    // v50.28: one control for list and the three grid sizes
    v.innerHTML = '<button type="button" data-view="list" aria-label="List" aria-pressed="' + !gal + '">' + I('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>') + '</button>' +
      '<button type="button" data-view="gallery" data-gs="s" aria-label="Small grid" aria-pressed="false">' + I('<rect x="3.5" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="16" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="3.5" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="16" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="3.5" y="16" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="16" width="4.5" height="4.5" rx="1"/><rect x="16" y="16" width="4.5" height="4.5" rx="1"/>') + '</button>' +
      '<button type="button" data-view="gallery" data-gs="m" aria-label="Grid" aria-pressed="false">' + I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>') + '</button>' +
      '<button type="button" data-view="gallery" data-gs="l" aria-label="Large grid" aria-pressed="false">' + I('<rect x="5.5" y="3.5" width="13" height="17" rx="2.2"/>') + '</button>';
    // v50.56: labels for the phone menu, the four choices in one group, and the phone's single button in front
    v.querySelectorAll('button').forEach(b => b.insertAdjacentHTML('beforeend', '<span class="fb-vl">' + b.getAttribute('aria-label') + '</span><i class="fb-vck" aria-hidden="true"></i>'));
    v.innerHTML = '<button type="button" class="fb-vbtn" aria-haspopup="true" aria-expanded="false"><span class="fb-vi"></span><i class="fb-vch" aria-hidden="true"></i></button><div class="fb-vopts">' + v.innerHTML + '</div>';
    const vOpen = on => { v.classList.toggle('open', on); v.querySelector('.fb-vbtn').setAttribute('aria-expanded', String(on)); };
    v.querySelector('.fb-vbtn').addEventListener('click', e => { e.stopPropagation(); vOpen(!v.classList.contains('open')); });
    document.addEventListener('click', e => { if (v.classList.contains('open') && !v.contains(e.target)) vOpen(false); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && v.classList.contains('open')) { vOpen(false); v.querySelector('.fb-vbtn').focus(); } });
    addEventListener('scroll', () => { if (v.classList.contains('open')) vOpen(false); }, { passive: true });
    v.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (!b) return; vOpen(false); const gs = b.dataset.gs; if (b.dataset.view === 'list' ? gal : (!gal || gs !== gsz)) setView(b.dataset.view, gs); });
    fbar.appendChild(v); paintView(); }
  // phones: pinch the grid to change its size, like Photos (spread for bigger cards, pinch for more of them)
  { const rows = $('ct-rows'), SZ = ['s', 'm', 'l']; let d0 = 0, k = 1;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    rows.addEventListener('touchstart', e => { if (gal && e.touches.length === 2) { d0 = dist(e.touches); k = 1; } }, { passive: true });
    rows.addEventListener('touchmove', e => { if (d0 && e.touches.length === 2) k = dist(e.touches) / d0; }, { passive: true });
    rows.addEventListener('touchend', () => { if (!d0) return; const i = SZ.indexOf(gsz), n = k > 1.25 ? i + 1 : k < .8 ? i - 1 : i; d0 = 0; if (n !== i && SZ[n]) setView('gallery', SZ[n]); }); }
  fbar.addEventListener('click', e => { const c = e.target.closest('[data-fb]'); if (!c) return; const b = root.querySelector('.ct-filters [data-ct-type="' + c.dataset.fb + '"]'); if (b) b.click(); });
  // v50.87 phones: one row of controls (All / Sales / Bought and a Filters button). The Filters card holds type (with Refunds),
  // platform, sort and view; it drives the same controls as the full row, so filtering works exactly the same.
  { const SL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
    const m = document.createElement('div'); m.className = 'fb-m';
    m.innerHTML = '<div class="fb-mseg" role="group" aria-label="Show">' + [['all', 'All'], ['sale', 'Sales'], ['purchase', 'Bought']].map(x => '<button type="button" data-fb="' + x[0] + '" aria-pressed="false">' + x[1] + '<em></em></button>').join('') + '</div><button type="button" class="fb-fbtn" aria-label="Filters" aria-haspopup="dialog" aria-expanded="false">' + SL + '<i class="fb-dot" hidden></i></button>';
    fbar.prepend(m);
    const card = document.createElement('div'); card.className = 'fb-fs'; card.hidden = true; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Filters');
    document.body.appendChild(card);
    const btn = m.querySelector('.fb-fbtn'), plat = $('ct-platform'), sortSel = $('ct-sort');
    const typeNow = () => { const c = fbar.querySelector('.fb-chips [aria-pressed="true"]'); return c ? c.dataset.fb : 'all'; };
    const viewNow = () => { const c = fbar.querySelector('.fb-vopts [aria-pressed="true"]'); return c ? (c.dataset.gs || 'list') : 'list'; };
    const count = k => { const c = fbar.querySelector('.fb-chips [data-fb="' + k + '"] em'); return c && c.textContent ? '<em>' + c.textContent + '</em>' : ''; };
    const opts = (k, list) => '<div class="fb-fo" role="group">' + list.map(o => '<button type="button" data-k="' + k + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (o[2] ? 'true' : 'false') + '">' + o[1] + '</button>').join('') + '</div>';
    const shown = () => { const n = $('ct-rows').querySelectorAll('[data-tx]').length; return n; };
    function paint() {
      const t = typeNow(), v = viewNow();
      card.innerHTML = '<button type="button" class="fb-fx" aria-label="Close">×</button>' +
        '<h6>Type</h6>' + opts('ty', [['all', 'All' + count('all'), t === 'all'], ['sale', 'Sales' + count('sale'), t === 'sale'], ['purchase', 'Purchases' + count('purchase'), t === 'purchase'], ['refund', 'Refunds' + count('refund'), t === 'refund']]) +
        '<h6>Platform</h6>' + opts('plat', [...plat.options].map(o => [o.value, o.value === 'all' ? 'All' : esc(o.textContent), plat.value === o.value])) +
        '<h6>Sort</h6>' + opts('sort', [['new', 'Newest', sortSel.value === 'new'], ['old', 'Oldest', sortSel.value === 'old'], ['high', 'Highest', sortSel.value === 'high']]) +
        '<h6>View</h6>' + opts('view', [['list', 'List', v === 'list'], ['s', 'Small grid', v === 's'], ['m', 'Grid', v === 'm'], ['l', 'Large grid', v === 'l']]) +
        '<button type="button" class="fb-fdone">Done</button>';
    }
    const dot = () => { const on = typeNow() === 'refund' || plat.value !== 'all' || sortSel.value !== 'new'; btn.querySelector('.fb-dot').hidden = !on; btn.setAttribute('aria-label', on ? 'Filters (some are on)' : 'Filters'); };
    // the card sits under the row and stops above the bottom bar (it scrolls inside if the screen is short)
    const barTop = () => { const tb = document.getElementById('ct-tbar'); return tb && tb.offsetParent ? tb.getBoundingClientRect().top : innerHeight; };
    const headBottom = () => { const hd = document.querySelector('.sh-in'); return Math.max(0, hd ? hd.getBoundingClientRect().bottom : 0); };
    function place() { const r = btn.getBoundingClientRect(), w = Math.min(380, innerWidth - 24); card.style.width = w + 'px'; card.style.left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12)) + 'px';
      const top = Math.max(headBottom() + 8, r.bottom + 8); card.style.top = top + 'px'; card.style.maxHeight = Math.max(200, Math.min(innerHeight, barTop()) - top - 12) + 'px'; }
    // opening brings the row up under the header first, so the whole card fits; the card follows the scroll
    function lift() { const r = m.getBoundingClientRect(), dy = r.top - (headBottom() + 10); if (dy > 4) { quiet(900); scrollBy({ top: dy, behavior: calm.matches ? 'auto' : 'smooth' }); } }
    let raf = 0; addEventListener('scroll', () => { if (card.hidden || raf) return; raf = requestAnimationFrame(() => { raf = 0; place(); }); }, { passive: true });
    function open() { paint(); lift(); card.classList.remove('out'); card.hidden = false; place(); card.classList.add('anim'); clearTimeout(card._at); card._at = setTimeout(() => card.classList.remove('anim'), 420); btn.setAttribute('aria-expanded', 'true'); const b = card.querySelector('[aria-pressed="true"]'); if (b) b.focus({ preventScroll: true }); }
    function close(focus) { if (card.hidden || card.classList.contains('out')) return; btn.setAttribute('aria-expanded', 'false'); if (calm.matches) card.hidden = true; else { card.classList.add('out'); setTimeout(() => { card.hidden = true; card.classList.remove('out'); }, 140); } if (focus) btn.focus({ preventScroll: true }); }
    btn.addEventListener('click', e => { e.stopPropagation(); (card.hidden || card.classList.contains('out')) ? open() : close(); });
    card.addEventListener('click', e => {
      e.stopPropagation(); if (e.target.closest('.fb-fx, .fb-fdone')) { close(true); return; }
      const o = e.target.closest('[data-k]'); if (!o) return; const k = o.dataset.k, v = o.dataset.v; card.classList.remove('anim');
      if (k === 'ty') { const c = fbar.querySelector('.fb-chips [data-fb="' + v + '"]'); if (c) c.click(); }
      else if (k === 'plat' || k === 'sort') { const sel = k === 'plat' ? plat : sortSel; sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (k === 'view') { const b = fbar.querySelector('.fb-vopts ' + (v === 'list' ? '[data-view="list"]' : '[data-gs="' + v + '"]')); if (b) b.click(); }
      paint(); dot();
    });
    document.addEventListener('click', e => { if (e.isTrusted && !card.hidden && !card.contains(e.target) && !btn.contains(e.target)) close(); });   // only real taps outside (the card itself clicks the row's chips)
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) close(true); });
    addEventListener('resize', () => { if (!card.hidden) place(); });
    phone.addEventListener('change', () => close());
    new MutationObserver(dot).observe(fbar, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    [plat, sortSel].forEach(x => x.addEventListener('change', dot)); dot(); }

  // ---------- filters ----------
  $$('[data-ct-type]').forEach(b => b.addEventListener('click', () => { type = b.dataset.ctType; expanded = null; $$('[data-ct-type]').forEach(x => x.classList.toggle('ct-selected', x === b)); render(); }));
  $('ct-type').addEventListener('change', e => { const b = root.querySelector('[data-ct-type="' + e.target.value + '"]'); if (b) b.click(); });
  phone.addEventListener('change', () => { expanded = null; render(); });
  // v52.17: typing in search redraws once you pause (about a tenth of a second), not on every letter; clearing is instant
  let qT = 0;
  ['ct-search', 'ct-platform', 'ct-period', 'ct-sort'].forEach(id => $(id).addEventListener(id === 'ct-search' ? 'input' : 'change', e => {
    if (id === 'ct-search' && e.isTrusted && $(id).value) { clearTimeout(qT); qT = setTimeout(() => { expanded = null; render(true); }, 110); return; }
    clearTimeout(qT); expanded = null; if (id === 'ct-period' || id === 'ct-sort') pref.set(id, $(id).value); render();
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
  setInterval(() => { if (document.hidden || root.hidden || $('ct-search').value || calm.matches || (window.CTPage && CTPage.cur !== 'entries') || document.querySelector('dialog[open]')) return; const old = wordBox.querySelector('.w:not(.above)'); wi = (wi + 1) % words.length; const next = document.createElement('span'); next.className = 'w below'; next.textContent = words[wi]; wordBox.appendChild(next); void next.offsetWidth; next.classList.remove('below'); if (old) { old.classList.add('above'); setTimeout(() => old.remove(), 600); } }, 3000);

  // ---------- Card Board opens from here on both plans; Ask note ----------
  const xb = $('ct-expand'), xp = $('ct-prem-pop'); let xt;
  const xset = o => { xp.hidden = !o; xb.setAttribute('aria-expanded', o ? 'true' : 'false'); clearTimeout(xt); if (o) xt = setTimeout(() => xset(false), 6000); };
  xb.addEventListener('click', e => {
    e.stopPropagation();
    // Card Board grows out of this panel on both plans (Free gets 4 widgets on the last 3 months)
    if (window.CTBoardLoader) { xset(false); window.CTBoardLoader.open(); return; }
    $('ct-prem-pop-t').innerHTML = 'Card Board is still loading. Try again in a moment.';
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
    $('af-p').innerHTML = prem ? 'Upload a CSV or Excel file and Card Tab matches your dates, cards and platforms for you.' : 'Log what you bought or sold, like <em>Charizard ex - 199/165</em>, and Card Tab keeps your totals for you.';
    $('af-primary').textContent = prem ? 'Import a spreadsheet' : '+ Add New';
    $('af-primary').disabled = !prem && S.usage().blocked;
    sec.hidden = !prem && !S.showImport();
    sec.innerHTML = prem ? 'Or add your first card' : 'Import a spreadsheet <span class="af-lock">Premium</span>';
  }

  // ---------- add / edit ----------
  function afterEditor(result, entry) {
    if (result === 'added') {
      justAdded = entry.id; expanded = null; render();
      // saved into a month you're not looking at: say where it went, and offer to go there (the page never jumps on its own)
      const pm = monthOf($('ct-period').value), em = entry.date.slice(0, 7);
      if (pm && pm !== em && window.CTMonth) toast('Added to ' + ymLabel(em, { month: 'long' }), { go: () => window.CTMonth.set('m:' + em) });
      else usageToast('Entry added');
    }
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
  window.CTOpenAdd = openAdd;   // the phone's round + calls this directly, from any page
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
    window.CTImportUI.open((n, file) => { expanded = null; shown = FIRST; render(); toast('Imported ' + n + (n === 1 ? ' entry' : ' entries') + (file ? ' from ' + file : ''), { undo: true }); });
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
  // v50.27: which entries show first (Settings → Display), and choices arriving from the account
  function showFirst() { let f = 'all'; try { f = localStorage.getItem('ct.filter') || 'all'; } catch (e) {} const b = root.querySelector('.ct-filters [data-ct-type="' + f + '"]'); if (b && type !== f) b.click(); }
  addEventListener('ct-prefs', e => { const ks = (e.detail && e.detail.keys) || [];
    if (ks.includes('ct.gsize')) { let g = 'm'; try { g = localStorage.getItem('ct.gsize') || 'm'; } catch (er) {} if (g !== gsz) { gsz = g; paintView(); render(); } }
    if (ks.includes('ct.view')) { let v = 'list'; try { v = localStorage.getItem('ct.view') || (matchMedia('(max-width:760px)').matches ? 'list' : 'gallery'); } catch (er) {} if ((v === 'gallery') !== gal) setView(v); }
    if (ks.includes('ct.f.ct-sort')) { $('ct-sort').value = pref.get('ct-sort', 'new'); render(); }
    if (ks.includes('ct.filter')) showFirst(); });
  let off = null, periodPicked = false, applyingStart = false;
  // v50.41: the account's plan and Start on can arrive a moment after the app opens (sign-in, a new device, the first sync),
  // so the start range is applied again when they do, until you pick a range yourself
  function applyStart() {
    if (periodPicked) return;
    const so = premium() ? (S.meta('startOn') || 'month') : 'month';
    const first = so === 'year' ? 'y:' + D.monthPrefix.slice(0, 4) : so === 'all' ? 'all' : 'm:' + D.monthPrefix;
    if ($('ct-period').value === first) return;
    applyingStart = true; try { if (window.CTMonth) window.CTMonth.set(first, true); else $('ct-period').value = first; } finally { applyingStart = false; }
    return true;
  }
  $('ct-period').addEventListener('change', () => { if (!applyingStart) periodPicked = true; });
  function mount() {
    dates();
    // opens on the range picked in Settings → Start on (Premium: This year or All time); otherwise the month you're in
    periodPicked = false; applyStart();
    $('ct-sort').value = pref.get('ct-sort', 'new');
    showFirst();
    if (off) off();
    off = S.on(reason => {
      if (reason === 'plan') { selected = null; }
      if (reason === 'open' || reason === 'sync' || reason === 'plan' || reason === 'remote' || reason === 'meta') applyStart();
      if (reason === 'clear' || reason === 'sample' || reason === 'remote') { expanded = null; shown = FIRST; }
      render();
    });
    render();
  }

  // a card picture that won't load: show the placeholder in its place
  window.CTArtBroken = img => { if (img.dataset.failed) return; img.dataset.failed = '1'; const ph = document.createElement('span'); ph.className = (img.className || '') + ' ct-art-ph'; ph.style.width = (img.width || 44) + 'px'; ph.style.height = (img.height || 61) + 'px'; img.replaceWith(ph); };
  window.CTDash = { monthOf: p => { dates(); return monthOf(p); }, mount, render, toast, exportCSV, upgradeNote, openImport };
})();
