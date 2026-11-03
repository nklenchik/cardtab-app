/* Import screens (Premium): 1 pick a file, 2 one "here's what we found" review, then import.
   Columns are matched automatically and shown through the first rows. "Fix columns" is there for the rare file
   that needs it, and opens by itself only when Card Tab can't find a date or an amount.
   One Undo removes the whole import. */
(function () {
  'use strict';
  const S = window.CTStore, I = window.CTImport;
  const $ = id => document.getElementById(id);
  const dlg = $('imp');
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = c => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monYear = d => (d ? new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', year: 'numeric' }) : '');
  const monDay = d => (d ? new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' }) : '—');
  let step = 1, book = null, table = null, map = null, res = null, sum = null, onDone = null, fileName = '', showMore = false;

  // The five columns that matter most come first; the rest sit behind "Show more columns"
  const CORE = [['date', 'Date'], ['name', 'Card'], ['gross', 'Sold for'], ['net', 'After fees'], ['purchase', 'Total paid']];
  const MORE = [['type', 'Sale or purchase'], ['platform', 'Platform'], ['fees', 'Transaction fees'], ['ship', 'Shipping'], ['qty', 'Quantity'], ['condition', 'Condition'], ['note', 'Notes column'], ['image', 'Image link']];
  const missingCore = () => map.date == null || (map.gross == null && map.net == null && map.purchase == null && map.amount == null);

  function go(n) {
    step = n;
    [1, 2].forEach(i => { $('imp-s' + i).hidden = i !== n; });
    $('imp-steps').querySelectorAll('span').forEach((s, i) => { s.classList.toggle('on', i === n - 1); s.classList.toggle('done', i < n - 1); });
    $('imp-back').hidden = n === 1; $('imp-fixbtn').hidden = n === 1 || !$('imp-fix').hidden;
    const nx = $('imp-next');
    if (n === 1) { nx.textContent = 'Continue'; nx.disabled = true; }
    else { nx.textContent = sum && sum.total ? 'Import ' + sum.total + (sum.total === 1 ? ' entry' : ' entries') : 'Nothing new to import'; nx.disabled = !(sum && sum.total) || missingCore(); }
  }

  // ---------- step 1: file ----------
  async function take(file) {
    if (!file) return;
    const err = $('imp-err1'); err.hidden = true; fileName = file.name;
    $('imp-drop-t').textContent = 'Reading ' + file.name + '…';
    try {
      book = await window.CTSheet.read(file);
      table = I.findTable(book);
      if (!table) { book = null; throw Object.assign(new Error('x'), { code: 'no-table' }); }
      $('imp-drop-t').textContent = file.name;
      $('imp-sheet').innerHTML = book.sheets.map((s, i) => '<option value="' + i + '">' + esc(s.name) + '</option>').join('');
      $('imp-sheet').value = table.sheet; $('imp-tab').hidden = true; $('imp-tab-btn').hidden = book.sheets.length < 2;
      map = I.mapColumns(book.sheets[table.sheet].rows[table.header]);
      $('imp-fix').hidden = true; showMore = false;
      refresh();
    } catch (e) {
      book = null; $('imp-drop-t').textContent = 'Drop your spreadsheet here';
      err.textContent = e.code === 'old-xls' ? 'That’s an older Excel file (.xls). Open it and save it as .xlsx or CSV, then try again.'
        : e.code === 'no-table' ? 'Couldn’t find a table with column names at the top (like Date, Item, Price). Check the file has a header row, or try a CSV.'
        : 'Couldn’t read that file. Try saving it as .xlsx or CSV.';
      err.hidden = false; go(1);
    }
  }
  $('imp-file').addEventListener('change', e => take(e.target.files[0]));
  const drop = $('imp-drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => take(e.dataTransfer.files[0]));

  // ---------- change tab ----------
  $('imp-tab-btn').addEventListener('click', () => { $('imp-tab').hidden = false; $('imp-tab-btn').hidden = true; $('imp-sheet').focus(); });
  $('imp-sheet').addEventListener('change', e => {
    const si = +e.target.value, sh = book.sheets[si];
    let best = null; for (let r = 0; r < Math.min(25, sh.rows.length); r++) { const n = Object.keys(I.mapColumns(sh.rows[r])).length; if (!best || n > best.n) best = { r, n }; }
    table = { sheet: si, header: best ? best.r : 0 }; map = I.mapColumns(sh.rows[table.header]); refresh();
  });

  // ---------- fix columns (only when needed) ----------
  function fixPanel() {
    const sh = book.sheets[table.sheet], header = sh.rows[table.header] || [];
    const opts = '<option value="">Not in my file</option>' + header.map((h, i) => (h == null || h === '' ? '' : '<option value="' + i + '">' + esc(h) + '</option>')).join('');
    const fields = CORE.concat(showMore ? MORE : []);
    $('imp-map').innerHTML = fields.map(([f, label]) => '<label class="imp-m' + (map[f] != null ? ' set' : '') + '"><span>' + label + '</span><select data-f="' + f + '">' + opts + '</select></label>').join('');
    $('imp-map').querySelectorAll('select').forEach(sel => { const f = sel.dataset.f; sel.value = map[f] != null ? String(map[f]) : ''; sel.addEventListener('change', () => { if (sel.value === '') delete map[f]; else map[f] = +sel.value; refresh(true); }); });
    $('imp-more').textContent = showMore ? 'Show fewer columns' : 'Show more columns';
    $('imp-fix-h').textContent = missingCore() ? (map.date == null ? 'Which column has the date?' : 'Which column has the amounts?') : 'Tell Card Tab which column is which';
  }
  $('imp-fixbtn').addEventListener('click', () => { $('imp-fix').hidden = false; fixPanel(); go(2); $('imp-fix').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  $('imp-more').addEventListener('click', () => { showMore = !showMore; fixPanel(); });

  // ---------- step 2: what we found ----------
  function refresh(keepFix) {
    res = I.build(book, { table, map });
    if (missingCore()) $('imp-fix').hidden = false; // can't import without a date and an amount, so ask
    if (!$('imp-fix').hidden && !keepFix) fixPanel(); else if (keepFix) fixPanel();
    const sh = book.sheets[table.sheet];
    $('imp-from').innerHTML = 'We read the <b>' + esc(sh.name) + '</b> ' + (book.sheets.length > 1 ? 'tab' : 'file');
    sum = res.ok ? I.summarize(res, S) : { total: 0, fresh: [], flagged: [] };
    const ent = sum.fresh.map(x => x.entry);
    const t = S.totals(ent.map(e => Object.assign({}, e, { net: e.type === 'sale' ? (e.net != null ? e.net : e.amount - (e.fees || 0) - (e.ship || 0)) : null })));
    $('imp-big').innerHTML = sum.total ? '<b>' + sum.total + ' entries</b> · ' + sum.sales + ' sales · ' + sum.purchases + ' purchases' + (sum.refunds ? ' · ' + sum.refunds + ' refunds' : '') + (sum.from ? ' · ' + monYear(sum.from) + ' – ' + monYear(sum.to) : '')
      : res.ok && res.rows.length ? '<b>Everything in this file is already in Card Tab.</b>' : '<b>No entries found yet.</b>';
    $('imp-tiles').innerHTML = sum.total ? [['Sales', t.sales], ['After fees', t.after], ['Spent', t.spent], ['Profit', t.profit]].map(([k, v], i) => '<div' + (i === 3 ? ' class="' + (v >= 0 ? 'pos' : 'neg') + '"' : '') + '><small>' + k + '</small><strong>' + money(v) + '</strong></div>').join('') : '';
    // first rows, as Card Tab reads them (sales show what was taken from the cell note)
    const rows = (res.ok ? res.rows : []).slice(0, 5);
    $('imp-prev').innerHTML = rows.length ? rows.map(x => {
      const e = x.entry, tag = e.type === 'sale' ? 'Sale' : e.type === 'refund' ? 'Refund' : 'Purchase';
      let sub = '';
      if (e.type === 'sale' && e.fees != null) sub = 'Fees ' + money(e.fees) + ' · Shipping ' + money(e.ship || 0) + (x.fromNote ? ' <span class="imp-note">✎ from your note</span>' : '');
      else if (e.type === 'sale' && e.amount !== e.net) sub = 'Fees and shipping ' + money(e.amount - e.net);
      return '<div class="imp-pr"><span class="d">' + monDay(e.date) + '</span><span class="ct-tag ' + e.type + '">' + tag + '</span><span class="n">' + esc(e.name) + (e.qty > 1 ? ' ×' + e.qty : '') + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="a">' + money(e.amount || 0) + '</span></div>';
    }).join('') : '<p class="imp-fine" style="padding:12px">Nothing to show yet.</p>';
    // plain-language facts
    const facts = [];
    if (res.ok && res.notesRead) facts.push('<span class="imp-note">✎</span> <b>' + res.notesRead + '</b> cell notes read' + (res.notesSplit ? ': fees and shipping split on <b>' + res.notesSplit + '</b> sales' : '') + '.');
    if (sum.total) {
      if (sum.combined) facts.push('<b>' + sum.combined + '</b> sales keep fees and shipping together as one amount (no note, or the note doesn’t add up). Totals still match your sheet to the cent.');
      facts.push('<b>' + sum.exact + '</b> can be matched to the exact card from your image links and <b>' + sum.byName + '</b> by name. Card art fills in once card search is live.');
    }
    if (sum.dupes) facts.push('<b>' + sum.dupes + '</b> are already in Card Tab, so they’ll be skipped.');
    if (res.ok && res.skipped.length) facts.push('<b>' + res.skipped.length + '</b> rows skipped: ' + esc(res.skipped.slice(0, 3).map(s => 'row ' + s.row + ' (' + s.why.toLowerCase() + ')').join(', ')) + (res.skipped.length > 3 ? '…' : '') + '.');
    $('imp-facts').innerHTML = facts.map(f => '<li>' + f + '</li>').join('');
    const fl = sum.flagged || [];
    $('imp-check').hidden = !fl.length;
    $('imp-check-s').textContent = fl.length + ' rows worth a look (optional)';
    $('imp-check-l').innerHTML = fl.map(x => '<div class="imp-ck"><span class="r">Row ' + x.row + '</span><span class="n">' + esc(x.entry.name) + '</span><span class="w">' + esc(x.flags.join(' ')) + '</span></div>').join('');
    const err = $('imp-err2'); err.hidden = !missingCore();
    err.textContent = map.date == null ? 'Pick which column has the date to continue.' : 'Pick at least one money column (Sold for, After fees or Total paid) to continue.';
    go(2);
  }

  async function doImport() {
    const list = sum.fresh.map(x => { const e = Object.assign({}, x.entry); if (!e.date) e.date = S.today(); delete e.combined; return e; });
    $('imp-next').disabled = true; $('imp-next').textContent = 'Importing…';
    const n = await S.importMany(list);
    const done = onDone; close(); if (done) done(n, fileName);
  }

  $('imp-next').addEventListener('click', () => { if (step === 2) doImport(); });
  $('imp-back').addEventListener('click', () => { book = null; $('imp-file').value = ''; $('imp-drop-t').textContent = 'Drop your spreadsheet here'; go(1); });
  dlg.querySelectorAll('[data-imp-close]').forEach(b => b.addEventListener('click', close));
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  function open(cb) {
    onDone = cb || null; book = null; res = null; sum = null; $('imp-file').value = ''; $('imp-err1').hidden = true; $('imp-fix').hidden = true;
    $('imp-drop-t').textContent = 'Drop your spreadsheet here'; go(1); dlg.showModal();
  }
  function close() { if (dlg.open) dlg.close(); }
  window.CTImportUI = { open, close, get isOpen() { return dlg.open; } };
})();
