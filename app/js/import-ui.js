/* Import screens (Premium): 1 pick a file, 2 check the match, 3 review and import. One Undo removes the import. */
(function () {
  'use strict';
  const S = window.CTStore, I = window.CTImport;
  const $ = id => document.getElementById(id);
  const dlg = $('imp');
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = c => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const longDate = d => (d ? new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', year: 'numeric' }) : '');
  let step = 1, book = null, table = null, map = null, res = null, sum = null, onDone = null, fileName = '';

  // What each Card Tab field is called on the match screen
  const LABELS = [['date', 'Date'], ['type', 'Sale or purchase'], ['platform', 'Platform'], ['name', 'Card'], ['gross', 'Sold for'], ['net', 'After fees'], ['purchase', 'Total paid'], ['fees', 'Transaction fees'], ['ship', 'Shipping'], ['qty', 'Quantity'], ['condition', 'Condition'], ['note', 'Notes'], ['image', 'Image link']];

  function go(n) {
    step = n;
    [1, 2, 3].forEach(i => { $('imp-s' + i).hidden = i !== n; });
    $('imp-steps').querySelectorAll('span').forEach((s, i) => { s.classList.toggle('on', i === n - 1); s.classList.toggle('done', i < n - 1); });
    $('imp-back').hidden = n === 1;
    const nx = $('imp-next');
    nx.textContent = n === 3 ? (sum && sum.total ? 'Import ' + sum.total + (sum.total === 1 ? ' entry' : ' entries') : 'Nothing new to import') : 'Continue';
    nx.disabled = n === 1 ? !book : n === 2 ? !(res && res.ok && res.rows.length) : !(sum && sum.total);
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
      setupMatch(); go(2);
    } catch (e) {
      book = null; $('imp-drop-t').textContent = 'Drop your spreadsheet here';
      err.textContent = e.code === 'old-xls' ? 'That’s an older Excel file (.xls). Open it and save it as .xlsx or CSV, then try again.'
        : e.code === 'no-table' ? 'Couldn’t find a table with a header row (like Date, Item, Price). Check the file has column names at the top, or try a CSV.'
        : 'Couldn’t read that file. Try saving it as .xlsx or CSV.';
      err.hidden = false; go(1);
    }
  }
  $('imp-file').addEventListener('change', e => take(e.target.files[0]));
  const drop = $('imp-drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => take(e.dataTransfer.files[0]));

  // ---------- step 2: match ----------
  function setupMatch() {
    $('imp-sheet').innerHTML = book.sheets.map((s, i) => '<option value="' + i + '">' + esc(s.name) + '</option>').join('');
    $('imp-sheet').value = table.sheet;
    map = I.mapColumns(book.sheets[table.sheet].rows[table.header]);
    rebuild();
  }
  $('imp-sheet').addEventListener('change', e => {
    const si = +e.target.value, sh = book.sheets[si];
    let best = null; for (let r = 0; r < Math.min(25, sh.rows.length); r++) { const m = I.mapColumns(sh.rows[r]); const n = Object.keys(m).length; if (!best || n > best.n) best = { r, n }; }
    table = { sheet: si, header: best ? best.r : 0 }; map = I.mapColumns(sh.rows[table.header]); rebuild();
  });
  function rebuild() {
    const sh = book.sheets[table.sheet], header = sh.rows[table.header] || [];
    res = I.build(book, { table, map });
    $('imp-found').textContent = res.ok ? res.rows.length + ' rows found · headers on row ' + (table.header + 1) : '';
    const opts = '<option value="">Not in my file</option>' + header.map((h, i) => (h == null || h === '' ? '' : '<option value="' + i + '">' + esc(h) + '</option>')).join('');
    $('imp-map').innerHTML = LABELS.map(([f, label]) => '<label class="imp-m' + (map[f] != null ? ' set' : '') + '"><span>' + label + '</span><select data-f="' + f + '">' + opts + '</select></label>').join('');
    $('imp-map').querySelectorAll('select').forEach(sel => { const f = sel.dataset.f; sel.value = map[f] != null ? String(map[f]) : ''; sel.addEventListener('change', () => { if (sel.value === '') delete map[f]; else map[f] = +sel.value; rebuild(); }); });
    const rows = res.ok ? res.rows.slice(0, 5) : [];
    $('imp-prev').innerHTML = rows.length ? rows.map(({ entry: e }) => '<div class="imp-pr"><span class="d">' + esc(e.date || '—') + '</span><span class="ct-tag ' + e.type + '">' + (e.type === 'sale' ? 'Sale' : e.type === 'refund' ? 'Refund' : 'Purchase') + '</span><span class="n">' + esc(e.name) + (e.qty > 1 ? ' ×' + e.qty : '') + '</span><span class="a">' + money(e.amount || 0) + '</span></div>').join('') : '<p class="imp-fine">No rows yet. Pick the columns above.</p>';
    const err = $('imp-err2'); err.hidden = res.ok && map.date != null && (map.gross != null || map.net != null || map.purchase != null || map.amount != null);
    err.textContent = map.date == null ? 'Pick which column has the date.' : 'Pick at least one money column (Sold for, After fees or Total paid).';
    go(2);
  }

  // ---------- step 3: review ----------
  function review() {
    sum = I.summarize(res, S);
    const ent = sum.fresh.map(x => x.entry);
    const t = S.totals(ent.map(e => Object.assign({}, e, { net: e.type === 'sale' ? (e.net != null ? e.net : e.amount - (e.fees || 0) - (e.ship || 0)) : null })));
    $('imp-big').innerHTML = sum.total ? '<b>' + sum.total + ' entries</b> · ' + sum.sales + ' sales · ' + sum.purchases + ' purchases' + (sum.refunds ? ' · ' + sum.refunds + ' refunds' : '') + (sum.from ? ' · ' + longDate(sum.from) + ' – ' + longDate(sum.to) : '') : '<b>Everything in this file is already in Card Tab.</b>';
    $('imp-tiles').innerHTML = sum.total ? [['Sales', t.sales], ['After fees', t.after], ['Spent', t.spent], ['Profit', t.profit]].map(([k, v], i) => '<div' + (i === 3 ? ' class="' + (v >= 0 ? 'pos' : 'neg') + '"' : '') + '><small>' + k + '</small><strong>' + money(v) + '</strong></div>').join('') : '';
    const facts = [];
    if (sum.total) {
      facts.push('<b>' + sum.exact + '</b> can be matched to the exact card from your image links, <b>' + sum.byName + '</b> by name' + (sum.typed ? ', and <b>' + sum.typed + '</b> stay as you typed them' : '') + '. Card art and matching switch on once card search is live.');
      if (sum.sales) facts.push('<b>' + sum.split + '</b> sales have fees and shipping split from your notes' + (sum.combined ? '; <b>' + sum.combined + '</b> keep them together as one amount (no note, or the note doesn’t add up)' : '') + '. Every total matches your sheet to the cent.');
    }
    if (sum.dupes) facts.push('<b>' + sum.dupes + '</b> already in Card Tab, so they’ll be skipped.');
    if (res.skipped.length) facts.push('<b>' + res.skipped.length + '</b> rows skipped: ' + esc(res.skipped.slice(0, 3).map(s => 'row ' + s.row + ' (' + s.why.toLowerCase() + ')').join(', ')) + (res.skipped.length > 3 ? '…' : ''));
    $('imp-facts').innerHTML = facts.map(f => '<li>' + f + '</li>').join('');
    const fl = sum.flagged;
    $('imp-check').hidden = !fl.length;
    $('imp-check-s').textContent = fl.length + ' rows worth a look (optional)';
    $('imp-check-l').innerHTML = fl.map(x => '<div class="imp-ck"><span class="r">Row ' + x.row + '</span><span class="n">' + esc(x.entry.name) + '</span><span class="w">' + esc(x.flags.join(' ')) + '</span></div>').join('');
    go(3);
  }

  async function doImport() {
    const list = sum.fresh.map(x => { const e = Object.assign({}, x.entry); if (!e.date) e.date = S.today(); delete e.combined; return e; });
    $('imp-next').disabled = true; $('imp-next').textContent = 'Importing…';
    const n = await S.importMany(list);
    const done = onDone; close(); if (done) done(n, fileName);
  }

  $('imp-next').addEventListener('click', () => { if (step === 1) return; if (step === 2) review(); else doImport(); });
  $('imp-back').addEventListener('click', () => go(step - 1));
  dlg.querySelectorAll('[data-imp-close]').forEach(b => b.addEventListener('click', close));
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  function open(cb) {
    onDone = cb || null; book = null; res = null; sum = null; $('imp-file').value = ''; $('imp-err1').hidden = true;
    $('imp-drop-t').textContent = 'Drop your spreadsheet here'; go(1); dlg.showModal();
  }
  function close() { if (dlg.open) dlg.close(); }
  window.CTImportUI = { open, close, get isOpen() { return dlg.open; } };
})();
