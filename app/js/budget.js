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
  const dlg = $('bu-sheet'), inp = $('bu-amt'), pnl = dlg.querySelector('.bu-p');
  const calm = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(hover:hover) and (pointer:fine)');
  let from = null;// the card it opened from, so the window grows out of it and shrinks back into it
  // keep the window centered in the part of the screen you can see (the keyboard takes the bottom on phones)
  function fit() { const vv = window.visualViewport; if (!vv) return; dlg.style.height = Math.round(vv.height) + 'px'; dlg.style.top = Math.round(vv.offsetTop) + 'px'; }
  function grow(dir) {
    if (calm.matches || !from || !pnl.animate) return null;
    const a = from.getBoundingClientRect(), b = pnl.getBoundingClientRect();
    if (!a.width || !b.width) return null;
    const dx = (a.left + a.width / 2) - (b.left + b.width / 2), dy = (a.top + a.height / 2) - (b.top + b.height / 2), sx = a.width / b.width, sy = Math.min(1, a.height / b.height);
    const k = [{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')', opacity: 0 }, { transform: 'none', opacity: 1, offset: .6 }, { transform: 'none', opacity: 1 }];
    return pnl.animate(dir > 0 ? k : k.slice().reverse(), dir > 0 ? { duration: 500, easing: 'cubic-bezier(.32,.72,0,1)' } : { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  }
  function open(src) {
    from = src || null;
    const b = S.budget();
    inp.value = b ? (b.cents % 100 ? (b.cents / 100).toFixed(2) : String(b.cents / 100)) : '';
    $('bu-alert').setAttribute('aria-checked', b ? String(b.alert) : 'true');
    $('bu-off').hidden = !b; paintQuick(); fitAmt(); paintLast();
    if (window.CTNav) window.CTNav.push('budget', () => shut());
    document.documentElement.classList.add('bu-lock'); fit(); dlg.showModal();
    // the ruler is already sitting on the amount before the window grows, so nothing jumps
    R.place(b ? b.cents / 100 : 150, !b);
    // phones keep the keyboard down (tap the amount to type); with a mouse and keyboard you can type right away
    if (fine.matches) try { inp.focus({ preventScroll: true }); inp.select(); } catch (e) {} else try { pnl.tabIndex = -1; pnl.focus({ preventScroll: true }); } catch (e) {}
    grow(1);
  }
  let closing = false;
  function shut() {
    if (!dlg.open || closing) return; closing = true; inp.blur();
    const an = grow(-1), done = () => { closing = false; dlg.close(); if (an) an.cancel(); };
    if (an) an.onfinish = done; else done();
  }
  const cents = () => { const v = parseFloat(String(inp.value).replace(/[^0-9.]/g, '')); return isFinite(v) ? Math.round(v * 100) : 0; };
  function paintQuick() { $('bu-save').disabled = cents() <= 0; }
  // what you spent on cards last month, shown under the ruler and as a dot on it
  function lastMonth() { const d = new Date(), p = new Date(d.getFullYear(), d.getMonth() - 1, 1), k = p.getFullYear() + '-' + pad(p.getMonth() + 1); return { c: S.all().reduce((a, t) => a + (t.type === 'purchase' && t.date.startsWith(k) ? t.amount : 0), 0), name: p.toLocaleString('en-US', { month: 'long' }) }; }
  function paintLast() { const l = lastMonth(), el = $('bu-last'); el.hidden = !l.c; if (l.c) el.textContent = 'You spent ' + money(l.c) + ' in ' + l.name; R.mark(l.c ? l.c / 100 : null); }

  // ---------- the ruler ----------
  // $5 per tick (10px), stops at every $50. Swipe again and again the same way and it speeds up:
  // 3rd swipe stops only at $100s, 5th at $500s, 7th runs free.
  const R = (() => {
    const sc = $('bu-sc'), fastEl = $('bu-fast'), MAX = 5000, PX = 2;// 2px per dollar
    let h = ''; for (let v = 0; v <= MAX; v += 5) { const c = v % 50 ? (v % 25 ? '' : 'm') : 's' + (v % 100 ? '' : ' h') + (v % 500 ? '' : ' k'); h += '<i' + (c ? ' class="' + c + '"' : '') + '>' + (v % 50 ? '' : '<b>$' + NF0.format(v) + '</b>') + '</i>'; }
    sc.innerHTML = h;
    let touchedAt = 0, val = 150, own = false, glideRaf = 0, lastTick = -1, raf = 0;
    const toX = v => Math.min(MAX, Math.max(0, v)) * PX;
    function show(v) { inp.value = String(v); fitAmt(); paintQuick(); sc.setAttribute('aria-valuenow', v); sc.setAttribute('aria-valuetext', '$' + NF0.format(v)); }
    // place without animation (opening the window)
    function place(v, fromNothing) { stop(); val = v; sc.classList.add('free'); sc.scrollLeft = toX(v); own = true; lastTick = Math.round(v / 50) * 50; if (fromNothing) show(v); }
    // glide to a typed amount, landing exactly on it (even between ticks)
    function glide(v) {
      stop(); const from = sc.scrollLeft, to = toX(v); if (Math.abs(to - from) < 1) { sc.classList.add('free'); sc.scrollLeft = to; own = true; return; }
      sc.classList.add('free'); own = true;
      if (calm.matches) { sc.scrollLeft = to; return; }
      const dur = Math.min(700, 320 + Math.abs(to - from) * .25), t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); sc.scrollLeft = from + (to - from) * e; glideRaf = k < 1 ? requestAnimationFrame(step) : 0; };
      glideRaf = requestAnimationFrame(step);
    }
    function stop() { if (glideRaf) cancelAnimationFrame(glideRaf); glideRaf = 0; }
    // your hand is back on the ruler: it snaps again and follows your swipes
    function take() { touchedAt = performance.now(); stop(); if (own) { own = false; sc.classList.remove('free'); } }
    sc.addEventListener('scroll', () => { lastScroll = performance.now(); if (own || raf) return; raf = requestAnimationFrame(() => {
      raf = 0; const v = Math.max(0, Math.min(MAX, Math.round(sc.scrollLeft / PX / 5) * 5));
      if (v !== val) { val = v; show(v); }
      const t = Math.floor(sc.scrollLeft / PX / 50); if (t !== lastTick) { lastTick = t; if (window.ctBuzz) window.ctBuzz('tick'); }
    }); }, { passive: true });
    // --- speeding up on repeated swipes ---
    let lastScroll = 0, streak = 0, dir = 0, x0 = 0, decided = false, fastT = 0;
    const LV = [[3, 'f1', '$100 steps'], [5, 'f2', '$500 steps'], [7, 'f3', 'Free spin']];
    function level() { let l = null; LV.forEach(x => { if (streak >= x[0]) l = x; }); sc.classList.remove('f1', 'f2', 'f3');
      if (l) { sc.classList.add(l[1]); if (fastEl.textContent !== l[2] || !fastEl.classList.contains('on')) { fastEl.textContent = l[2]; fastEl.classList.add('on'); pnl.classList.add('fast'); } clearTimeout(fastT); fastT = setTimeout(() => { fastEl.classList.remove('on'); pnl.classList.remove('fast'); }, 1400); } }
    sc.addEventListener('touchstart', e => { take(); x0 = e.touches[0].clientX; decided = false; }, { passive: true });
    sc.addEventListener('touchmove', e => { if (decided) return; const dx = e.touches[0].clientX - x0; if (Math.abs(dx) < 8) return; decided = true;
      const d = dx < 0 ? 1 : -1, still = performance.now() - lastScroll < 900;
      streak = d === dir && still ? streak + 1 : 1; dir = d; level(); }, { passive: true });
    // with a mouse: drag the ruler, let go and it settles on the nearest tick; the wheel and trackpad scroll it too
    let md = null;
    sc.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button) return; take(); md = { x: e.clientX, s: sc.scrollLeft }; sc.classList.add('grab'); sc.setPointerCapture(e.pointerId); });
    sc.addEventListener('pointermove', e => { if (md) sc.scrollLeft = md.s - (e.clientX - md.x); });
    const mup = () => { if (!md) return; md = null; sc.classList.remove('grab'); sc.scrollTo({ left: Math.round(sc.scrollLeft / 10) * 10, behavior: calm.matches ? 'auto' : 'smooth' }); };
    sc.addEventListener('pointerup', mup); sc.addEventListener('pointercancel', mup);
    sc.addEventListener('wheel', () => take(), { passive: true });
    sc.addEventListener('keydown', e => { const k = e.key, step = e.shiftKey ? 50 : 5; let v = null;
      if (k === 'ArrowRight' || k === 'ArrowUp') v = Math.floor(val / step) * step + step; else if (k === 'ArrowLeft' || k === 'ArrowDown') v = Math.ceil(val / step) * step - step; else return;
      e.preventDefault(); v = Math.max(0, Math.min(MAX, v)); val = v; show(v); glide(v); });
    function mark(v) { sc.querySelectorAll('.lm').forEach(x => x.classList.remove('lm')); if (v == null) return; const i = Math.round(Math.min(MAX, v) / 5); if (sc.children[i]) sc.children[i].classList.add('lm'); }
    return { place, glide, mark, set: v => { val = v; }, touched: () => performance.now() - touchedAt < 500 };
  })();
  function fitAmt() { const n = Math.max(1, inp.value.length || 1); inp.style.width = Math.min(8, n) + 0.4 + 'ch'; }
  let typeT = 0;
  inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/^(\d*\.\d{0,2}).*$/, '$1').slice(0, 9); paintQuick(); fitAmt();
    clearTimeout(typeT); typeT = setTimeout(() => { const d = cents() / 100; R.set(d); R.glide(d); }, 260); });
  inp.addEventListener('blur', () => { clearTimeout(typeT); if (dlg.open && !closing && !R.touched()) { const d = cents() / 100; R.set(d); R.glide(d); } });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && cents() > 0) { e.preventDefault(); $('bu-save').click(); } });
  dlg.addEventListener('click', async e => {
    if (e.target === dlg || e.target.closest('[data-close]')) { shut(); return; }
    if (e.target.closest('#bu-alert')) { const s = $('bu-alert'); s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true')); return; }
    if (e.target.closest('#bu-save')) { const c = cents(); if (c <= 0) return; await S.setBudget({ cents: c, alert: $('bu-alert').getAttribute('aria-checked') === 'true' }); shut(); if (window.CTDash) window.CTDash.toast('Monthly budget set to ' + round$(c)); return; }
    if (e.target.closest('#bu-off')) { await S.setBudget(null); await S.setBudgetFlag('dismissed', true); shut(); if (window.CTDash) window.CTDash.toast('Budget turned off. You can set one again from your profile menu.'); }
  });
  dlg.addEventListener('close', () => { document.documentElement.classList.remove('bu-lock'); if (window.CTNav) window.CTNav.done('budget'); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); shut(); });
  if (window.visualViewport) { visualViewport.addEventListener('resize', () => { if (dlg.open) fit(); }); visualViewport.addEventListener('scroll', () => { if (dlg.open) fit(); }); }

  document.addEventListener('click', e => {
    const c = e.target.closest('#ct-budget'); if (!c) return;
    if (e.target.closest('.bu-x')) { S.setBudgetFlag('dismissed', true).then(paint); return; }
    if (e.target.closest('.bu-open')) open(c);
  });
  window.CTBudget = { open, paint, shut };
  // the profile menu shows the current budget
  function paintMenu() { const v = $('am-budget-v'); if (v) { const b = S.budget(); v.textContent = b ? round$(b.cents) : 'Set'; } }
  S.on(() => { paint(); paintMenu(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
  paint(); paintMenu();
})();
