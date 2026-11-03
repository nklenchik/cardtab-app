/* Add a card sheet. Parser -> lookup -> (picker) -> price -> save, then reset for the next card. */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var inp = $('in'), chips = $('chips'), res = $('res'), go = $('go'), price = $('price'), sv = $('save');
  var KEY = 'cardtab.add.v1';
  var S = { tok: 0, busy: false, type: 'p', ship: 1.11, cond: 0, qty: 1, sel: -1, list: [], sig: '', rows: [], spent: 0, sold: 0, disp: { spent: 0, sold: 0 }, card: null, parsed: null, why: '' };
  var CONDS = ['NM', 'LP', 'MP', 'HP'];

  function store(get) { try { if (get) return JSON.parse(localStorage.getItem(KEY) || '{}'); localStorage.setItem(KEY, JSON.stringify({ type: S.type, ship: S.ship, plat: $('plat').value })); } catch (e) { return {}; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) { return '$' + n.toFixed(2); }
  function grad(h) { return 'linear-gradient(155deg,hsl(' + h + ' 62% 50%),hsl(' + ((h + 40) % 360) + ' 55% 22%))'; }
  function art(c) { return c.art ? 'url(' + c.art.list + ') center/cover no-repeat, ' + grad(c.h) : grad(c.h); }
  var CK = '<span class="tick"><svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg></span>';

  function chipsFor(p) {
    var c = [];
    if (p.name) c.push(['Card', p.name]); if (p.number) c.push(['No.', p.number]); if (p.set) c.push(['Set', p.set]);
    if (p.rarity) c.push(['Rarity', p.rarity]); if (p.variant) c.push(['Variant', p.variant]);
    if (p.finishes && p.finishes.length) c.push(['Finish', p.finishes[0]]);
    if (p.grade) c.push(['Graded', p.grade]); if (p.condition) c.push(['Cond.', p.condition]);
    if (p.sealed) c.push(['Type', 'Sealed']); if (p.qty) c.push(['Qty', '×' + p.qty]);
    return c;
  }
  function sessionHTML() {
    var h = '<div class="tot"><span class="lab" id="tl">This session</span><b id="tt"></b></div>';
    if (!S.rows.length) return h + '<div class="none" style="margin-top:14px">Nothing yet. Your first card will show up here.</div>';
    S.rows.forEach(function (r) {
      h += '<div class="row' + (r.isNew ? ' new' : '') + '"><span class="art" style="background:' + art(r) + '"></span><div class="tx"><div class="n">' + esc(r.n) + '</div><div class="m">' + esc(r.m) + '</div></div><div class="amt' + (r.type === 's' ? ' in' : '') + '">' + (r.type === 's' ? '+' : '−') + money(r.amt) + '</div></div>';
      r.isNew = false;
    });
    return h;
  }
  function totals() {
    var el = $('tt'); if (!el) return;
    var n = S.rows.reduce(function (a, r) { return a + r.qty; }, 0); $('tl').textContent = 'This session · ' + n + (n === 1 ? ' card' : ' cards');
    var v = S.disp.sold - S.disp.spent; el.textContent = S.rows.length ? (v < 0 ? '−' : '+') + money(Math.abs(v)) : ''; el.style.color = v > 0.004 ? 'var(--green)' : '';
  }
  function tween() {
    var t0 = performance.now(), f = { spent: S.disp.spent, sold: S.disp.sold };
    (function st(n) { var k = Math.min(1, (n - t0) / 450); k = 1 - Math.pow(1 - k, 3); S.disp.spent = f.spent + (S.spent - f.spent) * k; S.disp.sold = f.sold + (S.sold - f.sold) * k; totals(); if (k < 1) requestAnimationFrame(st); })(t0);
  }

  function render(fromLookup) {
    var t = inp.value.trim(), p = CardParser.parse(t);
    chips.innerHTML = t ? chipsFor(p).map(function (c, i) { return '<span class="chip" style="animation-delay:' + i * 45 + 'ms"><i>' + c[0] + '</i>' + esc(c[1]) + '</span>'; }).join('') : '';
    var sig = [p.name, p.number, p.set, p.rarity].join('|');
    if (sig !== S.sig) {
      S.sig = sig;
      if (window.CARDTAB_API) { S.busy = true; var tok = ++S.tok; clearTimeout(S.dt); S.dt = setTimeout(function () { CardLookup.remote(p).then(function (r) { if (tok !== S.tok) return; S.busy = false; S.list = r.list; S.sel = r.pick; S.why = r.why || ''; render(true); }); }, 280); S.list = []; S.sel = -1; }
      else { var r = CardLookup.search(p); S.list = r.list; S.sel = r.pick; S.why = r.why || ''; }
    }
    S.parsed = p;
    var h = '';
    if (!t) { res.innerHTML = sessionHTML(); totals(); go.disabled = true; go.textContent = 'Pick a card'; return; }
    if (!S.list.length && S.busy) { res.innerHTML = '<div class="none">Looking it up\u2026</div>'; go.disabled = true; go.textContent = 'Pick a card'; return; }
    if (!S.list.length) { res.innerHTML = '<div class="none">No match yet. Keep typing, or add the number.</div>'; go.disabled = true; go.textContent = 'Pick a card'; return; }
    if (S.list.length === 1) {
      var c = S.list[0];
      res.innerHTML = '<div class="pick" style="margin-top:12px"><span class="art" style="background:' + art(c) + '"></span><div><div class="n">' + esc(c.n) + '</div><div class="m">' + esc(c.s) + ' · ' + esc(c.num) + '</div><div class="m">' + esc(c.r) + '</div></div></div><div class="why"><b>One match.</b> Press Enter.</div>';
      go.disabled = false; go.textContent = 'Continue to price'; return;
    }
    var pre = S.why && S.why !== 'one';
    h = '<div class="q">Which one is your card?<small>' + S.list.length + ' printings match.</small></div><div class="grid">';
    S.list.forEach(function (c, i) {
      h += '<button type="button" class="tile" data-i="' + i + '" aria-pressed="' + (i === S.sel) + '">' + (pre && i === 0 ? '<span class="best">Best match</span>' : '') + CK + '<span class="art" style="background:' + art(c) + '">ART</span><span class="r">' + esc(c.r) + '</span><span class="s">' + esc(c.s) + '<br>' + esc(c.num) + '</span></button>';
    });
    h += '</div>' + (pre ? '<div class="why"><b>' + esc(S.why) + '</b> in what you typed, so it is pre-selected. Press Enter.</div>' : '<div class="why">Not enough to tell. Tap the art that matches your card.</div>');
    res.innerHTML = h; go.disabled = S.sel < 0; go.textContent = S.sel < 0 ? 'Pick a card' : 'Continue to price';
    Array.prototype.forEach.call(res.querySelectorAll('.tile'), function (b) { b.onclick = function () { S.sel = +b.getAttribute('data-i'); render(); var nb = res.querySelectorAll('.tile')[S.sel]; if (nb) nb.focus({ preventScroll: true }); }; });
  }

  function show(step) { $('s1').style.display = step === 1 ? 'flex' : 'none'; $('s2').style.display = step === 2 ? 'flex' : 'none'; }
  function toPrice() {
    if (S.sel < 0 || !S.list[S.sel]) return;
    var c = S.list[S.sel], p = S.parsed; S.card = c; S.qty = p.qty || 1; S.grade = p.grade || '';
    var ci = p.condition ? CONDS.indexOf(p.condition) : -1; if (ci > -1) setSeg('cond', ci); S.cond = ci > -1 ? ci : S.cond;
    $('pa').style.background = art(c); $('pn').textContent = c.n; $('pm').textContent = c.s + ' · ' + c.num + (S.grade ? ' · ' + S.grade : ''); $('q').textContent = S.qty;
    show(2); price.value = ''; upd(); price.focus();
  }
  function priceVal() { var v = parseFloat(price.value.replace(/[^0-9.]/g, '')); return isNaN(v) ? 0 : v; }
  function net(v) { return Math.max(0, v * (1 - .1325) - .30 - S.ship); }
  function upd() {
    var v = priceVal(), sale = S.type === 's';
    $('plab').textContent = sale ? 'Sold for' : 'Total paid'; $('shipw').hidden = !sale;
    $('sub').innerHTML = sale && v ? 'After fees and shipping you keep <b>' + money(net(v)) + '</b>' : '';
    sv.disabled = !v; sv.textContent = v ? (sale ? 'Save sale · ' : 'Save purchase · ') + money(v) : 'Enter a price';
  }
  function save() {
    var v = priceVal(); if (!v) return;
    var sale = S.type === 's', amt = sale ? net(v) : v, c = S.card;
    S.rows.unshift({ n: c.n, m: c.s + (S.grade ? ' · ' + S.grade : '') + (S.qty > 1 ? ' · ×' + S.qty : '') + ' · ' + CONDS[S.cond], h: c.h, art: c.art, type: S.type, amt: amt, qty: S.qty, isNew: true, id: c.id });
    if (sale) S.sold += amt; else S.spent += amt;
    show(1); inp.value = ''; S.sig = '~'; render(); tween(); inp.focus(); store();
    var t = $('toast'); t.textContent = 'Saved · ready for the next card'; t.classList.add('on'); clearTimeout(save.t); save.t = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }
  function setSeg(id, i) { var el = $(id); el.setAttribute('data-i', i); Array.prototype.forEach.call(el.querySelectorAll('button'), function (b, k) { b.setAttribute('aria-pressed', k === i); }); }
  function seg(id, fn) { var el = $(id); Array.prototype.forEach.call(el.querySelectorAll('button'), function (b, i) { b.onclick = function () { setSeg(id, i); fn(b, i); }; }); }

  seg('type', function (b) { S.type = b.getAttribute('data-v'); upd(); store(); });
  seg('cond', function (b, i) { S.cond = i; });
  seg('ship', function (b) { S.ship = parseFloat(b.getAttribute('data-v')); upd(); store(); });
  $('plat').addEventListener('change', store);
  $('qm').onclick = function () { S.qty = Math.max(1, S.qty - 1); $('q').textContent = S.qty; };
  $('qp').onclick = function () { S.qty++; $('q').textContent = S.qty; };
  $('back').onclick = function () { show(1); inp.focus(); };
  inp.addEventListener('input', render);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); toPrice(); } });
  res.addEventListener('keydown', function (e) { if (e.key === 'Enter' && S.sel > -1 && e.target.classList.contains('tile')) { e.preventDefault(); toPrice(); } });
  go.onclick = toPrice; sv.onclick = save;
  price.addEventListener('input', upd);
  price.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });

  // remembered defaults
  var d = store(true);
  if (d.type === 's') setSeg('type', 1), S.type = 's';
  if (d.ship !== undefined) { S.ship = d.ship; var si = [0, 1.11, 6.04].indexOf(d.ship); if (si > -1) setSeg('ship', si); }
  if (d.plat) $('plat').value = d.plat;
  render();
})();
