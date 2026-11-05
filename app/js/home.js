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
  const PH = () => matchMedia('(max-width:760px)').matches;
  const cbOpen = () => { const c = document.querySelector('.cbx'); return !!c && !c.classList.contains('off'); };
  const stOpen = () => { const x = document.getElementById('csx'); return !!x && x.classList.contains('in'); };
  function go(g, from) {
    if (from) opener = from;
    if (window.ctBuzz) window.ctBuzz('tap');
    if (g === 'entries') {
      // from Stories: the board steps out of the way underneath first, so Stories slides straight back to your list
      if (stOpen() && window.cbStoriesBack) { if (cbOpen() && window.CTBoard) { window.cbInstant = PH(); window.CTBoard.close(); } window.cbStoriesBack(); return; }
      if (cbOpen() && window.CTBoard) window.CTBoard.close(); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (g === 'board') { if (stOpen() && window.cbStoriesBack) { window.cbStoriesBack(); return; } if (cbOpen()) { const c = document.querySelector('.cbx'); c.scrollTo({ top: 0, behavior: 'smooth' }); return; } }
    // Free: Stories is Premium, so its window opens right here (no board opening underneath it)
    if (g === 'stories' && S.plan() !== 'premium' && !cbOpen() && window.CTBoardLoader) { window.CTBoardLoader.load().then(() => { if (window.CTPremiumOpen) window.CTPremiumOpen('stories'); }).catch(() => {}); return; }
    if (g === 'stories' && cbOpen()) { if (!stOpen()) { const b = document.getElementById('cb-stories'); if (b) b.click(); } return; }
    // phones, Premium: Entries straight to Stories is one slide (the board opens underneath without its own slide)
    if (g === 'stories' && PH() && S.plan() === 'premium' && window.CTBoardLoader) { window.CTBoardLoader.load().then(() => { window.cbInstant = true; window.CTBoard.refresh(); window.CTBoard.open(); const b = document.getElementById('cb-stories'); if (b) b.click(); }).catch(() => {}); return; }
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
    stories: ['On Card Stories', [['save', 'Save all stories', () => clickIn(storyDoc(), '#svall')], ['themes', 'Story themes', () => clickIn(storyDoc(), '[data-all]')], ['share', 'Share this story', () => clickIn(storyDoc(), '#csdock [data-d="share"]')]]]
  };
  window.CTHomeMenu = function () {
    const cur = stOpen() ? 'stories' : cbOpen() ? 'board' : 'entries';
    document.querySelectorAll('#app-menu .amgo [data-go]').forEach(b => { const on = b.dataset.go === cur; b.classList.toggle('here', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const g = $('am-page'); if (!g) return; g.querySelectorAll('.am-pact').forEach(x => x.remove());
    const t = $('am-page-t'), im = $('am-import'), ex = $('am-export');
    if (cur === 'entries') { t.hidden = true; ex.hidden = false; return; }
    im.hidden = true; ex.hidden = true;
    const [title, acts] = PAGE[cur]; t.textContent = title; t.hidden = false;
    acts.forEach(([ic, label, run]) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.className = 'am-pact'; b.innerHTML = svg(IC[ic]) + '<span>' + label + '</span>';
      b.addEventListener('click', e => { e.stopPropagation(); if (window.CTMenu) window.CTMenu.close(); setTimeout(run, 160); }); g.appendChild(b); });
  };
  // Card Board's avatar opens this same menu (its own menu is retired)
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('.cbx #cb-av'); if (!a) return; const btn = a.closest('button') || a; e.preventDefault(); e.stopImmediatePropagation(); if (window.CTMenu) window.CTMenu.open(btn); }, true);
  // admin: show the first-time tips again
  document.addEventListener('click', e => { if (!e.target.closest('[data-dev="tips"]')) return; try { localStorage.removeItem('cb.hint'); } catch (er) {} if (window.CTDash) window.CTDash.toast('First-time tips will show again'); });

  window.CTHome = { paint };
  S.on(() => paint());
})();
