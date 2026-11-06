/* Import (Premium), kept as simple as a sign-up screen.
   1. Choose a file.  2. "199 entries found", three rows, profit, one button.  3. A checkmark, then the dashboard.
   Everything Card Tab works out on its own (column matching, cell notes, fees and shipping) happens quietly.
   When it truly needs an answer, it asks one question at a time with tappable choices. One Undo removes the import. */
(function () {
  'use strict';
  const S = window.CTStore, I = window.CTImport;
  const $ = id => document.getElementById(id);
  const dlg = $('imp'), form = $('imp-form');
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = c => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monYear = d => (d ? new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', year: 'numeric' }) : '');
  const monDay = d => (d ? new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' }) : '');
  let step = 1, book = null, table = null, map = null, res = null, sum = null, onDone = null, fileName = '';
  let qs = [], qi = 0, qFrom = 1; // question flow

  const Q = {
    date: { q: 'Which column has the date?', sub: 'Card Tab sorts everything by it.' },
    name: { q: 'Which column has the card?', sub: 'The card or item name.', none: true },
    gross: { q: 'Which column has what you sold for?', sub: 'The sale price, before fees.', none: true },
    net: { q: 'And what you kept after fees?', sub: 'What reached you after fees and shipping.', none: true },
    purchase: { q: 'Which column has what you paid?', none: true },
    amount: { q: 'Which column has the amounts?', sub: 'Sale prices and what you paid.' }
  };
  const missing = () => { const m = []; if (map.date == null) m.push('date'); if (map.gross == null && map.net == null && map.purchase == null && map.amount == null) m.push('amount'); return m; };

  // A dropdown normally sizes to its longest option; size the tab picker to the tab that's chosen
  function fitTab() {
    const sel = $('imp-sheet'); if (!sel.options.length) return;
    const m = document.createElement('span'), cs = getComputedStyle(sel);
    m.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + cs.font;
    m.textContent = sel.options[sel.selectedIndex].text; document.body.appendChild(m);
    sel.style.width = Math.ceil(m.getBoundingClientRect().width + 16) + 'px'; m.remove();
  }
  function show(n) {
    step = n; [1, 2, 3, 4].forEach(i => { $('imp-s' + i).hidden = i !== n; }); form.classList.toggle('s1', n === 1);
    $('imp-back').hidden = n === 1 || n === 4;
  }

  // ---------- 1. choose a file ----------
  async function take(file) {
    if (!file) return;
    $('imp-err').hidden = true; fileName = file.name; $('imp-choose').textContent = 'Reading…';
    try {
      book = await window.CTSheet.read(file);
      table = I.findTable(book);
      if (!table) throw Object.assign(new Error('x'), { code: 'no-table' });
      $('imp-sheet').innerHTML = book.sheets.map((s, i) => '<option value="' + i + '">' + esc(s.name) + '</option>').join('');
      $('imp-sheet').value = table.sheet; $('imp-tabwrap').hidden = book.sheets.length < 2;
      map = I.mapColumns(book.sheets[table.sheet].rows[table.header]);
      next();
    } catch (e) {
      book = null;
      $('imp-err').textContent = e.code === 'old-xls' ? 'That’s an older Excel file (.xls). Save it as .xlsx or CSV and try again.'
        : e.code === 'no-table' ? 'Couldn’t find any entries in that file. Make sure it has column names at the top, like Date and Price.'
        : 'Couldn’t open that file. Try saving it as .xlsx or CSV.';
      $('imp-err').hidden = false;
    }
    $('imp-choose').textContent = 'Choose file'; $('imp-file').value = '';
  }
  // after reading: ask only what's missing, otherwise go straight to the summary
  function next() { const m = missing(); if (m.length) ask(m, 1); else summary(); }
  $('imp-file').addEventListener('change', e => take(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(t => form.addEventListener(t, e => { if (step !== 1) return; e.preventDefault(); form.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => form.addEventListener(t, e => { if (step !== 1) return; e.preventDefault(); form.classList.remove('over'); }));
  form.addEventListener('drop', e => { if (step === 1 && e.dataTransfer && e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });

  // ---------- one question at a time ----------
  function ask(fields, from) { qs = fields; qi = 0; qFrom = from; question(); }
  function question() {
    const f = qs[qi], d = Q[f], header = book.sheets[table.sheet].rows[table.header] || [];
    $('imp-q').textContent = d.q; $('imp-qsub').textContent = d.sub || ''; $('imp-qsub').hidden = !d.sub;
    const cur = map[f];
    $('imp-pills').innerHTML = header.map((h, i) => (h == null || h === '' ? '' : '<button type="button" data-i="' + i + '"' + (cur === i ? ' class="on" aria-pressed="true"' : '') + '>' + esc(h) + '</button>')).join('') + (d.none ? '<button type="button" class="none' + (cur == null ? ' on' : '') + '" data-i="">Not in my file</button>' : '');
    show(3);
  }
  $('imp-pills').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const f = qs[qi]; if (b.dataset.i === '') delete map[f]; else map[f] = +b.dataset.i;
    $('imp-pills').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    setTimeout(() => { if (qi < qs.length - 1) { qi++; question(); } else { const m = missing(); if (m.length) ask(m, qFrom); else summary(); } }, 160);
  });

  // ---------- 2. what we found ----------
  function summary() {
    res = I.build(book, { table, map });
    sum = res.ok ? I.summarize(res, S) : { total: 0, fresh: [], dupes: 0 };
    const none = !sum.total;
    $('imp-count').textContent = none ? (sum.dupes ? 'You’re all caught up' : 'No entries found') : sum.total + (sum.total === 1 ? ' entry found' : ' entries found');
    $('imp-range').textContent = none ? (sum.dupes ? 'Everything in this file is already in Card Tab.' : 'Try another tab, or fix the columns.') : (sum.from ? (sum.from.slice(0, 7) === sum.to.slice(0, 7) ? monYear(sum.from) : monYear(sum.from) + ' – ' + monYear(sum.to)) : '');
    const first = sum.fresh.slice(0, 3);
    $('imp-rows').hidden = none;
    $('imp-rows').innerHTML = first.map(({ entry: e }) => {
      const letter = (e.name.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase(), sale = e.type === 'sale';
      const meta = [monDay(e.date), e.platform, sale ? 'Sale' : e.type === 'refund' ? 'Refund' : 'Purchase'].filter(Boolean).join(' · ');
      return '<div class="imp-r"><span class="ct-card-art ct-art-ph" aria-hidden="true"><i>' + esc(letter) + '</i></span><div class="tx"><div class="n">' + esc(e.name) + (e.qty > 1 ? ' ×' + e.qty : '') + '</div><div class="m">' + esc(meta) + '</div></div><div class="a' + (sale ? ' in' : '') + '">' + (sale ? '+' : '') + money(e.amount || 0) + '</div></div>';
    }).join('') + (sum.total > 3 ? '<div class="imp-more">and ' + (sum.total - 3) + ' more</div>' : '');
    const t = S.totals(sum.fresh.map(x => Object.assign({}, x.entry, { net: x.entry.type === 'sale' ? (x.entry.net != null ? x.entry.net : x.entry.amount - (x.entry.fees || 0) - (x.entry.ship || 0)) : null })));
    $('imp-profit').hidden = none;
    $('imp-profit').innerHTML = 'Profit <b class="' + (t.profit >= 0 ? 'pos' : 'neg') + '">' + money(t.profit) + '</b>';
    $('imp-go').textContent = none ? 'Done' : 'Import ' + sum.total + (sum.total === 1 ? ' entry' : ' entries');
    $('imp-fix').hidden = none && sum.dupes > 0;
    show(2); fitTab();
  }
  $('imp-sheet').addEventListener('change', e => {
    const si = +e.target.value, sh = book.sheets[si];
    let best = null; for (let r = 0; r < Math.min(25, sh.rows.length); r++) { const n = Object.keys(I.mapColumns(sh.rows[r])).length; if (!best || n > best.n) best = { r, n }; }
    table = { sheet: si, header: best ? best.r : 0 }; map = I.mapColumns(sh.rows[table.header]); next();
  });
  $('imp-fix').addEventListener('click', () => ask(['date', 'name', 'gross', 'net', 'purchase'], 2));

  // ---------- 3. import ----------
  $('imp-go').addEventListener('click', async () => {
    if (!sum || !sum.total) { close(); return; }
    const list = sum.fresh.map(x => { const e = Object.assign({}, x.entry); if (!e.date) e.date = S.today(); delete e.combined; return e; });
    $('imp-go').disabled = true;
    const n = await S.importMany(list);
    $('imp-done-t').textContent = n + (n === 1 ? ' entry imported' : ' entries imported');
    show(4);
    const done = onDone;
    setTimeout(() => { close(); if (done) done(n, fileName); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : 1100);
  });

  // ---------- back / close ----------
  $('imp-back').addEventListener('click', () => {
    if (step === 3 && qi > 0) { qi--; question(); return; }
    if (step === 3 && qFrom === 2) { summary(); return; }
    book = null; show(1);
  });
  dlg.querySelectorAll('[data-imp-close]').forEach(b => b.addEventListener('click', close));
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  function open(cb) {
    onDone = cb || null; book = null; res = null; sum = null;
    $('imp-file').value = ''; $('imp-err').hidden = true; $('imp-go').disabled = false; $('imp-choose').textContent = 'Choose file';
    show(1); dlg.showModal(); form.tabIndex = -1; form.style.outline = "none"; form.focus({ preventScroll: true });
  }
  function close() { if (dlg.open) dlg.close(); }
  window.CTImportUI = { open, close, get isOpen() { return dlg.open; } };
})();
