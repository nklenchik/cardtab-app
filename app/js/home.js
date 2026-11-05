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
    const thisMonth = !prem || p === 'month';

    const n = list.filter(e => e.type === 'sale').length;
    line(sales, n ? n + (n === 1 ? ' sale' : ' sales') : 'No sales yet');
    line(after, t.sales ? money(t.sales - t.after) + ' in fees' : '');

    // --- budget, inside the Spent tile ---
    const b = S.budget();
    spent.classList.add('ct-budtile'); spent.setAttribute('role', 'button'); spent.tabIndex = 0;
    if (b) {
      const used = monthTotals(cur).spent, pct = Math.round(used / b.cents * 100), over = used > b.cents, warn = !over && pct >= 80;
      const kind = over ? 'over' : warn ? 'warn' : 'ok';
      const txt = thisMonth ? (over ? 'Over by ' + money(used - b.cents) : (warn ? 'Getting close' : 'On track') + ' · ' + pct + '% of ' + round$(b.cents))
        : shortName(cur) + (over ? ' · over by ' + money(used - b.cents) : ' · ' + pct + '% of ' + round$(b.cents));
      line(spent, txt, kind);
      spent.style.setProperty('--fill', thisMonth ? Math.min(1, used / b.cents).toFixed(4) : '0');
      spent.dataset.bud = kind;
      spent.setAttribute('aria-label', 'Spent ' + money(t.spent) + '. Budget: ' + money(used) + ' of ' + round$(b.cents) + ' this month, ' + pct + '% used. Edit budget');
    } else {
      line(spent, 'Set a monthly budget', 'set');
      spent.style.setProperty('--fill', '0'); delete spent.dataset.bud;
      spent.setAttribute('aria-label', 'Spent ' + money(t.spent) + '. Set a monthly budget');
    }

    // --- profit: compared with the month before when the tiles show one month, otherwise as a share of sales ---
    let shown = false;
    if (thisMonth || p === 'last') {
      const base = thisMonth ? cur : keyOf(now.getFullYear(), now.getMonth() - 1), prevK = thisMonth ? keyOf(now.getFullYear(), now.getMonth() - 1) : keyOf(now.getFullYear(), now.getMonth() - 2);
      const prev = monthTotals(prevK);
      if (prev.entries) { const d = monthTotals(base).profit - prev.profit; line(profit, (d < 0 ? '▼ ' : '▲ ') + money(d) + ' vs ' + shortName(prevK), d < 0 ? 'dn' : 'up'); shown = true; }
    }
    if (!shown) line(profit, t.sales ? Math.round(t.profit / t.sales * 100) + '% of sales' : '');
  }

  // the Spent tile opens the budget window, growing out of the tile
  document.addEventListener('click', e => { const tile = e.target.closest('.ct-budtile'); if (tile && window.CTBudget) window.CTBudget.open(tile); });
  document.addEventListener('keydown', e => { const tile = e.target.closest && e.target.closest('.ct-budtile'); if (tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (window.CTBudget) window.CTBudget.open(tile); } });

  // Entries · Board · Stories: the bottom bar on phones (on every page, over Card Board and Stories too) and the tabs on desktop
  const cbOpen = () => { const c = document.querySelector('.cbx'); return !!c && !c.classList.contains('off'); };
  const stOpen = () => { const x = document.getElementById('csx'); return !!x && x.classList.contains('in'); };
  function go(g, from) {
    if (from) opener = from;
    if (window.ctBuzz) window.ctBuzz('tap');
    if (g === 'entries') { if (stOpen() && window.cbStoriesBack) window.cbStoriesBack(); if (cbOpen() && window.CTBoard) { setTimeout(() => window.CTBoard.close(), stOpen() ? 0 : 0); } else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (g === 'board') { if (stOpen() && window.cbStoriesBack) { window.cbStoriesBack(); return; } if (cbOpen()) { const c = document.querySelector('.cbx'); c.scrollTo({ top: 0, behavior: 'smooth' }); return; } }
    if (g === 'stories' && cbOpen()) { if (!stOpen()) { const b = document.getElementById('cb-stories'); if (b) b.click(); } return; }
    const m = document.querySelector('#app-menu [data-go="' + g + '"]'); if (m) m.click();
  }
  window.CTTabGo = go;
  document.addEventListener('click', e => { const a = e.target.closest('[data-tab]'); if (!a) return; go(a.dataset.tab, a); });
  document.addEventListener('click', e => { if (e.target.closest('#ct-fab')) { const a = $('ct-add'); if (a) a.click(); } });
  // keep the bar's highlight on the page you're on
  function syncTabs() {
    const cur = stOpen() ? 'stories' : cbOpen() ? 'board' : 'entries';
    document.querySelectorAll('#ct-tbar [data-tab], .ct-demo-top .ct-tabs [data-tab]').forEach(b => { if (b.dataset.tab === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  const watch = () => { const c = document.querySelector('.cbx'), x = document.getElementById('csx'); const mo = new MutationObserver(syncTabs); if (c) mo.observe(c, { attributes: true, attributeFilter: ['class'] }); if (x) mo.observe(x, { attributes: true, attributeFilter: ['class'] }); return !!(c && x); };
  if (!watch()) { const t = setInterval(() => { if (document.querySelector('.cbx') && document.getElementById('csx')) { clearInterval(t); watch(); syncTabs(); } }, 600); }

  // Card Board grows out of whatever opened it: the tab you tapped, or your avatar when it came from the profile menu
  document.addEventListener('click', e => { if (e.isTrusted && e.target.closest('#app-menu [data-go]')) opener = $('app-avatar'); }, true);
  window.CTBoardFrom = () => (opener && opener.getClientRects().length ? opener : null);
  window.CTHome = { paint };
  S.on(() => paint());
})();
