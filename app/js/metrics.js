/* Quick metrics (v36.2): a short card of single numbers under the four boxes, for the date range you picked.
   Best sale shows the card's art softly across its row: strongest in the middle, fading out under the name on the left
   and the amount on the right, so the words always sit on a clean background (light and dark).
   "Edit" lets you choose which ones show (saved on this device). Everything is exact to the cent. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = c => (c < 0 ? '−' : '') + '$' + NF.format(Math.abs(c) / 100);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const short = n => String(n || '').split(' - ')[0];
  const I = p => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = {
    tag: I('<path d="M3.5 12.5l8-8h7v7l-8 8z"/><circle cx="15" cy="9" r="1.3"/>'), pct: I('<path d="M6 18L18 6"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>'),
    bars: I('<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'), up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'), down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    cal: I('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>'), card: I('<rect x="6" y="3" width="12" height="18" rx="2.5"/>'), star: I('<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6-5-2.9-5 2.9 1.2-5.6L4 9.6l5.6-.6z"/>')
  };
  const sales = l => l.filter(e => e.type === 'sale'), buys = l => l.filter(e => e.type === 'purchase');
  const sum = (l, f) => l.reduce((s, e) => s + f(e), 0);
  // each metric: a name for the list, and what its row shows for the entries in range (null hides the row)
  const M = {
    best: { name: 'Best sale', row: l => { const b = sales(l).sort((a, z) => z.net - a.net)[0]; return b && { art: b.art && (b.art.detail || b.art.list), label: 'Best sale', title: short(b.name), value: '+' + money(b.net), green: 1, sub: 'sold ' + money(b.amount) }; } },
    platform: { name: 'Top platform', row: l => { const m = {}; sales(l).forEach(e => { const k = e.platform || 'No platform'; m[k] = m[k] || { a: 0, n: 0 }; m[k].a += e.amount; m[k].n++; }); const t = Object.entries(m).sort((a, z) => z[1].a - a[1].a)[0]; return t && { icon: IC.tag, label: 'Top platform', title: t[0], value: money(t[1].a), sub: t[1].n + (t[1].n === 1 ? ' sale' : ' sales') }; } },
    fees: { name: 'Fees and shipping', row: l => { const s = sales(l), a = sum(s, e => e.amount), f = sum(s, e => e.amount - e.net); return a ? { icon: IC.pct, label: 'Fees and shipping', title: 'of what you sold', value: (Math.round(f / a * 1000) / 10) + '%', sub: money(f) } : null; } },
    avg: { name: 'Average sale', row: l => { const s = sales(l); return s.length ? { icon: IC.bars, label: 'Average sale', title: s.length + (s.length === 1 ? ' sale' : ' sales'), value: money(Math.round(sum(s, e => e.amount) / s.length)) } : null; } },
    bigbuy: { name: 'Biggest buy', row: l => { const b = buys(l).sort((a, z) => z.amount - a.amount)[0]; return b && { icon: IC.down, label: 'Biggest buy', title: short(b.name), value: money(b.amount), sub: b.platform || '' }; } },
    sold: { name: 'Cards sold', row: l => { const s = sales(l), n = sum(s, e => e.qty || 1); return s.length ? { icon: IC.up, label: 'Cards sold', title: money(sum(s, e => e.amount)) + ' in sales', value: String(n) } : null; } },
    bought: { name: 'Cards bought', row: l => { const s = buys(l), n = sum(s, e => e.qty || 1); return s.length ? { icon: IC.card, label: 'Cards bought', title: money(sum(s, e => e.amount)) + ' spent', value: String(n) } : null; } },
    avgbuy: { name: 'Average buy', row: l => { const s = buys(l); return s.length ? { icon: IC.bars, label: 'Average buy', title: s.length + (s.length === 1 ? ' purchase' : ' purchases'), value: money(Math.round(sum(s, e => e.amount) / s.length)) } : null; } },
    busiest: { name: 'Busiest day', row: l => { const m = {}; l.forEach(e => { m[e.date] = (m[e.date] || 0) + 1; }); const t = Object.entries(m).sort((a, z) => z[1] - a[1] || (z[0] > a[0] ? 1 : -1))[0]; return t && t[1] > 1 ? { icon: IC.cal, label: 'Busiest day', title: new Date(t[0] + 'T12:00:00').toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), value: String(t[1]), sub: 'entries' } : null; } },
    margin: { name: 'Profit margin', row: l => { const s = sales(l), a = sum(s, e => e.amount); if (!a) return null; const spent = sum(buys(l), e => e.amount), refunds = sum(l.filter(e => e.type === 'refund'), e => e.amount); const p = sum(s, e => e.net) - spent - refunds; return { icon: IC.star, label: 'Profit margin', title: 'of what you sold', value: Math.round(p / a * 100) + '%', sub: money(p) }; } }
  };
  const DEFAULT = ['best', 'platform', 'fees', 'avg'];
  const get = () => { try { const v = JSON.parse(localStorage.getItem('ct.qm')); return Array.isArray(v) && v.length ? v.filter(k => M[k]) : DEFAULT.slice(); } catch (e) { return DEFAULT.slice(); } };
  const put = v => { try { localStorage.setItem('ct.qm', JSON.stringify(v)); } catch (e) {} };

  const left = document.querySelector('.ct-demo-left'); if (!left) return;
  const card = document.createElement('section'); card.className = 'ct-qm'; card.setAttribute('aria-label', 'Quick numbers');
  card.innerHTML = '<div class="qm-h"><span>At a glance</span><button type="button" class="qm-edit" aria-haspopup="true" aria-expanded="false">Edit</button></div><div class="qm-rows"></div>';
  left.appendChild(card);
  let last = [];
  function paint(list) {
    if (list) last = list;
    const rows = get().map(k => M[k].row(last)).filter(Boolean);
    card.hidden = !rows.length && !last.length;
    card.querySelector('.qm-rows').innerHTML = rows.length ? rows.map(r => '<div class="qm-row' + (r.art ? ' qm-art' : '') + '">' + (r.art ? '<div class="qm-bg" style="background-image:url(\'' + esc(r.art) + '\')"></div>' : '<span class="qm-ic">' + r.icon + '</span>') +
      '<div class="qm-tx"><small>' + esc(r.label) + '</small><em>' + esc(r.title) + '</em></div><div class="qm-v"><strong' + (r.green ? ' class="g"' : '') + '>' + esc(r.value) + '</strong>' + (r.sub ? '<span>' + esc(r.sub) + '</span>' : '') + '</div></div>').join('')
      : '<p class="qm-none">Nothing in this range yet.</p>';
    fit();
  }
  // How many fit: when the left column is pinned (wide screens), it must stay fully in view, so rows that would run past
  // the bottom of the window step aside. Zoom in or use a shorter window and fewer show; zoom out or go taller and more do.
  const WIDE = matchMedia('(min-width:1100px)');
  let shownN = 0;
  function fit() {
    const rows = [...card.querySelectorAll('.qm-row')]; rows.forEach(r => { r.hidden = false; });
    shownN = rows.length;
    if (!WIDE.matches || !rows.length || card.hidden) { note(); return; }
    const col = card.parentElement, stuck = parseFloat(getComputedStyle(col).top) || 0;
    const room = innerHeight - 18;   // a little breathing room under the column
    let k = rows.length;
    while (k > 1 && stuck + card.offsetTop + card.offsetHeight > room) { rows[--k].hidden = true; }
    shownN = k; note();
  }
  function note() { const n = card.querySelector('.qm-fitnote'); if (n) { const t = get().length; n.textContent = t > shownN ? shownN + ' of ' + t + ' fit your screen' : 'As many as fit your screen'; } }
  let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(fit); });
  WIDE.addEventListener('change', fit);
  // Edit: pick which ones show
  let pop = null;
  const btn = card.querySelector('.qm-edit');
  function closePop() { if (pop) { pop.remove(); pop = null; btn.setAttribute('aria-expanded', 'false'); } }
  // The picker: what's showing sits on top in the order it shows, with a grip to drag it up or down (or the arrow keys
  // on the grip). Tap the check to hide one; the rest sit underneath to add. New picks join at the bottom.
  const GRIP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
  function drawPop(focusK) {
    const on = get(), off = Object.keys(M).filter(k => !on.includes(k));
    pop.innerHTML = '<p class="qm-fitnote"></p><div class="qm-on">' + on.map(k => '<div class="qm-it" data-row="' + k + '"><span class="qm-grip" role="button" tabindex="0" aria-label="Move ' + M[k].name + ' (use arrow keys)">' + GRIP + '</span><button type="button" role="menuitemcheckbox" aria-checked="true" data-k="' + k + '"><span>' + M[k].name + '</span><i></i></button></div>').join('') + '</div>' +
      (off.length ? '<small class="qm-more">More numbers</small>' + off.map(k => '<div class="qm-it"><span class="qm-grip qm-nogrip"></span><button type="button" role="menuitemcheckbox" aria-checked="false" data-k="' + k + '"><span>' + M[k].name + '</span><i></i></button></div>').join('') : '');
    note();
    if (focusK) { const g = pop.querySelector('[data-row="' + focusK + '"] .qm-grip'); if (g) g.focus(); }
  }
  function setOrder(v, focusK) { put(v); drawPop(focusK); paint(); }
  btn.addEventListener('click', () => {
    if (pop) { closePop(); return; }
    pop = document.createElement('div'); pop.className = 'qm-pop'; pop.setAttribute('role', 'menu');
    card.appendChild(pop); btn.setAttribute('aria-expanded', 'true'); drawPop();
    pop.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b || dragging) return; let v = get(); const k = b.dataset.k;
      if (v.includes(k)) { if (v.length > 1) v = v.filter(x => x !== k); } else v.push(k);
      setOrder(v);
    });
    pop.addEventListener('keydown', e => {
      const g = e.target.closest('.qm-grip'); if (!g || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault(); const k = g.parentElement.dataset.row, v = get(), i = v.indexOf(k), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (j < 0 || j >= v.length) return; v.splice(i, 1); v.splice(j, 0, k); setOrder(v, k);
    });
    // drag to reorder: the held row follows your finger; the others slide out of its way (transform only, so it stays smooth)
    pop.addEventListener('pointerdown', e => {
      const g = e.target.closest('.qm-grip:not(.qm-nogrip)'); if (!g) return;
      e.preventDefault(); const row = g.parentElement, list = [...pop.querySelectorAll('.qm-on .qm-it')], from = list.indexOf(row);
      const h = row.offsetHeight, y0 = e.clientY; let to = from; dragging = true;
      row.classList.add('qm-held'); try { g.setPointerCapture(e.pointerId); } catch (er) {}
      const move = ev => {
        const dy = Math.max(-from * h, Math.min((list.length - 1 - from) * h, ev.clientY - y0));
        row.style.transform = 'translate3d(0,' + dy + 'px,0)';
        to = Math.max(0, Math.min(list.length - 1, from + Math.round(dy / h)));
        list.forEach((r, i) => { if (r === row) return; const sh = (i > from && i <= to) ? -h : (i < from && i >= to) ? h : 0; r.style.transform = sh ? 'translate3d(0,' + sh + 'px,0)' : ''; });
      };
      const up = () => {
        g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
        const v = get(), k = row.dataset.row; if (to !== from) { v.splice(from, 1); v.splice(to, 0, k); setOrder(v); } else { list.forEach(r => { r.style.transform = ''; }); row.classList.remove('qm-held'); }
        setTimeout(() => { dragging = false; }, 0);
      };
      g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    });
  });
  let dragging = false;
  document.addEventListener('pointerdown', e => { if (pop && !e.target.closest('.ct-qm')) closePop(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { closePop(); btn.focus(); } });
  window.CTMetrics = { paint, rows: list => get().map(k => M[k].row(list || [])).filter(Boolean) };   // rows: the Board's At a glance widget uses the same picks
})();
