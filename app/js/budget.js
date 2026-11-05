/* Monthly budget: a slim card under the totals, a sheet to set it, and a one-time heads-up at 80%.
   Spending = what you paid for cards this month (purchases), in cents. Everything here is exact to the cent. */
(function () {
  'use strict';
  const S = window.CTStore, $ = id => document.getElementById(id);
  const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const NF0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const money = c => '$' + NF.format(Math.abs(c) / 100);
  const round$ = c => '$' + (c % 100 ? NF.format(c / 100) : NF0.format(c / 100));
  const pad = n => String(n).padStart(2, '0');
  function month() { const d = new Date(); return { key: d.getFullYear() + '-' + pad(d.getMonth() + 1), name: d.toLocaleString('en-US', { month: 'long' }), left: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1 }; }
  function spentThisMonth() { const k = month().key; return S.all().reduce((a, t) => a + (t.type === 'purchase' && t.date.startsWith(k) ? t.amount : 0), 0); }
  // the board and Stories read the real budget through this (null when none is set)
  window.CTBudgetCents = () => { const b = S.budget(); return b ? b.cents : null; };

  // ---------- the card ----------
  function paint() {
    const el = $('ct-budget'); if (!el) return;
    const b = S.budget(), m = month();
    if (!b) {
      if (S.budgetFlag('dismissed')) { el.hidden = true; return; }
      el.hidden = false; el.className = 'ct-budget is-unset';
      el.innerHTML = '<button type="button" class="bu-open"><span class="bu-t">Set a monthly budget</span><span class="bu-s">Keep tabs on what you spend on cards each month.</span></button><button type="button" class="bu-x" aria-label="Hide this">✕</button>';
      return;
    }
    const spent = spentThisMonth(), pct = Math.round(spent / b.cents * 100), over = spent > b.cents, warn = !over && pct >= 80;
    const state = over ? 'over' : warn ? 'warn' : 'ok';
    const chip = over ? money(spent - b.cents) + ' over' : pct + '% used';
    const right = over ? m.left + (m.left === 1 ? ' day' : ' days') + ' left' : money(b.cents - spent) + ' left · ' + m.left + (m.left === 1 ? ' day' : ' days');
    el.hidden = false; el.className = 'ct-budget is-' + state;
    el.innerHTML = '<button type="button" class="bu-open" aria-label="' + m.name + ' budget: ' + money(spent) + ' of ' + round$(b.cents) + ' spent. Edit budget">' +
      '<span class="bu-row"><span class="bu-t">' + m.name + ' budget</span><span class="bu-chip">' + chip + '</span></span>' +
      '<span class="bu-bar" aria-hidden="true"><i style="transform:scaleX(' + Math.min(1, spent / b.cents).toFixed(4) + ')"></i></span>' +
      '<span class="bu-row bu-foot"><span><b>' + money(spent) + '</b> of ' + round$(b.cents) + '</span><span>' + right + '</span></span></button>';
    nudge(b, spent, pct, over, m);
  }

  // ---------- the heads-up: once at 80%, once when going over, each month ----------
  const t0 = Date.now();
  function nudge(b, spent, pct, over, m) {
    if (!b.alert) return;
    const k80 = 'warned80:' + m.key, kOver = 'warnedOver:' + m.key;
    // right after opening the app it only records where you are; it never pops a note at you on launch
    if (Date.now() - t0 < 2500) { if (pct >= 80 && !S.budgetFlag(k80)) S.setBudgetFlag(k80, true); if (over && !S.budgetFlag(kOver)) S.setBudgetFlag(kOver, true); return; }
    if (over && !S.budgetFlag(kOver)) { S.setBudgetFlag(kOver, true); S.setBudgetFlag(k80, true); note('Over budget', 'You’re ' + money(spent - b.cents) + ' over ' + m.name + '’s budget.', 'over'); }
    else if (pct >= 80 && !over && !S.budgetFlag(k80)) { S.setBudgetFlag(k80, true); note('Getting close', 'You’ve used ' + pct + '% of ' + m.name + '’s budget, with ' + m.left + (m.left === 1 ? ' day' : ' days') + ' to go.', 'warn'); }
  }
  let noteT = 0;
  function note(title, text, kind) {
    let n = $('bu-note');
    if (!n) { n = document.createElement('div'); n.id = 'bu-note'; n.className = 'bu-note'; n.setAttribute('role', 'status'); document.body.appendChild(n); n.addEventListener('click', () => hide()); }
    n.className = 'bu-note is-' + kind;
    n.innerHTML = '<i aria-hidden="true">!</i><span><b>' + title + '</b><span>' + text + '</span></span>';
    n.hidden = false; void n.offsetWidth; n.classList.add('on');
    if (window.ctBuzz) window.ctBuzz('warn');
    clearTimeout(noteT); noteT = setTimeout(hide, 5200);
    function hide() { n.classList.remove('on'); setTimeout(() => { n.hidden = true; }, 260); }
  }

  // ---------- the sheet ----------
  const dlg = $('bu-sheet'), inp = $('bu-amt');
  function open() {
    const b = S.budget();
    inp.value = b ? (b.cents % 100 ? (b.cents / 100).toFixed(2) : String(b.cents / 100)) : '';
    $('bu-alert').setAttribute('aria-checked', b ? String(b.alert) : 'true');
    $('bu-off').hidden = !b; paintQuick(); fitAmt();
    if (window.CTNav) window.CTNav.push('budget', () => dlg.close());
    dlg.showModal(); const pnl = dlg.querySelector('.bu-p'); pnl.tabIndex = -1; pnl.focus({ preventScroll: true }); if (!matchMedia('(hover:none)').matches) setTimeout(() => inp.focus(), 60);
  }
  const cents = () => { const v = parseFloat(String(inp.value).replace(/[^0-9.]/g, '')); return isFinite(v) ? Math.round(v * 100) : 0; };
  function paintQuick() { const c = cents(); dlg.querySelectorAll('[data-q]').forEach(q => q.setAttribute('aria-pressed', String(+q.dataset.q * 100 === c))); $('bu-save').disabled = c <= 0; }
  function fitAmt() { const n = Math.max(1, inp.value.length || 1); inp.style.width = Math.min(8, n) + 0.4 + 'ch'; }
  inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/^(\d*\.\d{0,2}).*$/, '$1').slice(0, 9); paintQuick(); fitAmt(); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && cents() > 0) { e.preventDefault(); $('bu-save').click(); } });
  dlg.addEventListener('click', async e => {
    if (e.target === dlg || e.target.closest('[data-close]')) { dlg.close(); return; }
    const q = e.target.closest('[data-q]'); if (q) { inp.value = q.dataset.q; paintQuick(); fitAmt(); return; }
    if (e.target.closest('#bu-alert')) { const s = $('bu-alert'); s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true')); return; }
    if (e.target.closest('#bu-save')) { const c = cents(); if (c <= 0) return; await S.setBudget({ cents: c, alert: $('bu-alert').getAttribute('aria-checked') === 'true' }); dlg.close(); if (window.CTDash) window.CTDash.toast('Monthly budget set to ' + round$(c)); return; }
    if (e.target.closest('#bu-off')) { await S.setBudget(null); await S.setBudgetFlag('dismissed', true); dlg.close(); if (window.CTDash) window.CTDash.toast('Budget turned off. You can set one again from your profile menu.'); }
  });
  dlg.addEventListener('close', () => { if (window.CTNav) window.CTNav.done('budget'); });

  document.addEventListener('click', e => {
    const c = e.target.closest('#ct-budget'); if (!c) return;
    if (e.target.closest('.bu-x')) { S.setBudgetFlag('dismissed', true).then(paint); return; }
    if (e.target.closest('.bu-open')) open();
  });
  window.CTBudget = { open, paint };
  // the profile menu shows the current budget
  function paintMenu() { const v = $('am-budget-v'); if (v) { const b = S.budget(); v.textContent = b ? round$(b.cents) : 'Set'; } }
  S.on(() => { paint(); paintMenu(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
  paint(); paintMenu();
})();
