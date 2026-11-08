/* Add / edit entry sheet (Drop 1).
   A plain form so entries can be added, edited and deleted for real now. Drop 2 replaces "Add" with the
   free-text add-card sheet (parser, card art, "Which one is your card?"); Edit keeps using this form.
   Money is typed with the device's own keyboard (inputmode=decimal), no in-app number pad. */
(function () {
  'use strict';
  const S = window.CTStore;
  const dlg = document.getElementById('ed'), form = document.getElementById('ed-form');
  const f = n => form.elements[n];
  let editing = null, type = 'purchase', onDone = null;
  const PHONE = matchMedia('(max-width:760px)');
  // v37.6: on phones the form reads like the profile sheet: a grab handle, the title pinned at the top, the fields in
  // rounded groups, and Save pinned at the bottom. Group the fields once (desktop shows them exactly as before).
  (function group() {
    const kids = [...form.children], at = sel => form.querySelector(sel);
    const wrap = (els, cls) => { els = els.filter(Boolean); if (!els.length) return; const g = document.createElement('div'); g.className = 'ed-g' + (cls ? ' ' + cls : ''); els[0].before(g); els.forEach(e => g.appendChild(e)); };
    const rows = kids.filter(k => k.classList.contains('ed-row'));
    const nameF = f('name').closest('.ed-f'), condF = f('condition').closest('.ed-f'), noteF = f('note').closest('.ed-f');
    wrap([nameF], 'ed-g-name');
    wrap([rows[0], at('#ed-net-f')], 'ed-g-money');
    wrap([rows[1], condF, at('#ed-grade')], 'ed-g-when');
    wrap([noteF], 'ed-g-note');
    const grab = document.createElement('i'); grab.className = 'ed-grab'; grab.setAttribute('aria-hidden', 'true'); at('.ed-head').prepend(grab);
  })();

  // v50.29: "Graded" opens the grade fields (company, grade, cert number); the card then shows as a slab
  const G = window.CTGrade, gRow = document.getElementById('ed-grade');
  const gShow = () => { gRow.hidden = f('condition').value !== 'Graded'; };
  f('condition').addEventListener('change', () => { gShow(); if (!gRow.hidden && !f('gg').value) f('gg').focus(); });
  const LEGACY = /^graded\s+(psa|bgs|beckett|cgc|sgc|tag)\s*\d[^\n]*\n?/i;

  const AMOUNT_LABEL = { purchase: 'Total paid', sale: 'Sold for', refund: 'Refunded to buyer' };

  function setType(t) {
    type = t;
    const btns = [...form.querySelectorAll('.ed-seg button')];
    btns.forEach((b, i) => { const on = b.dataset.type === t; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; if (on) form.querySelector('.ed-pill').style.transform = 'translateX(' + (i * 100) + '%)'; });
    document.getElementById('ed-amount-l').textContent = AMOUNT_LABEL[t];
    document.getElementById('ed-net-f').hidden = t !== 'sale';
    keep();
    clearErrors();
  }
  form.querySelector('.ed-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setType(b.dataset.type); });
  form.querySelector('.ed-seg').addEventListener('keydown', e => {
    const order = ['purchase', 'sale', 'refund'], i = order.indexOf(type);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setType(n); form.querySelector('[data-type="' + n + '"]').focus(); }
  });

  // Live "You keep" line for sales: sale price minus fees minus your shipping, to the cent
  function keep() {
    const el = document.getElementById('ed-keep'); if (!el) return;
    const a = S.toCents(f('amount').value), fe = S.toCents(f('fees').value) || 0, sh = S.toCents(f('ship').value) || 0;
    if (type !== 'sale' || a == null) { el.innerHTML = 'Sold for includes any shipping the buyer paid.'; return; }
    const k = a - fe - sh;
    el.innerHTML = 'You keep <b' + (k < 0 ? ' class="neg"' : '') + '>' + (k < 0 ? '−' : '') + '$' + S.fromCents(Math.abs(k)) + '</b> · Sold for includes any shipping the buyer paid.';
  }
  ['amount', 'fees', 'ship'].forEach(n => f(n).addEventListener('input', keep));
  function clearErrors() { form.querySelectorAll('.ed-err').forEach(x => { x.textContent = ''; }); form.querySelectorAll('.ed-f.bad').forEach(x => x.classList.remove('bad')); }
  function showErrors(errs) {
    clearErrors(); let first = null;
    Object.keys(errs).forEach(k => { const el = form.querySelector('[data-err="' + k + '"]'); if (el) { el.textContent = errs[k]; el.closest('.ed-f').classList.add('bad'); first = first || f(k); } });
    if (first) first.focus();
  }
  const cents = c => (c == null ? '' : S.fromCents(c));
  const last0 = () => { try { return JSON.parse(localStorage.getItem('ct.lastEntry') || '{}'); } catch (e) { return {}; } };

  function open(entry, done) {
    editing = entry || null; onDone = done || null;
    form.reset(); clearErrors();
    document.getElementById('ed-h').textContent = editing ? 'Edit entry' : 'Add an entry';
    document.getElementById('ed-save').textContent = editing ? 'Save changes' : 'Save';
    document.getElementById('ed-del').hidden = !editing;
    const last = (() => { try { return JSON.parse(localStorage.getItem('ct.lastEntry') || '{}'); } catch (e) { return {}; } })();
    const e = editing || { type: last.type || 'purchase', platform: last.platform || '', date: S.today(), qty: 1 };
    setType(e.type);
    f('name').value = e.name || ''; f('amount').value = cents(e.amount);
    if (editing && e.type === 'sale') { f('fees').value = cents(e.fees != null ? e.fees : e.amount - e.net); f('ship').value = cents(e.ship != null ? e.ship : 0); }
    else { f('fees').value = ''; f('ship').value = last.ship != null ? S.fromCents(last.ship) : ''; }
    f('qty').value = e.qty || 1; f('date').value = e.date || S.today(); f('platform').value = e.platform || '';
    f('condition').value = e.condition || ''; f('note').value = e.note || ''; keep();
    const gr = G && G.of(e);
    if (gr) { f('condition').value = 'Graded'; f('gco').value = G.CO.includes(gr.co) ? gr.co : 'PSA'; f('gg').value = gr.g; f('gcert').value = gr.cert || ''; f('note').value = (e.note || '').replace(LEGACY, '').trim(); }
    else { f('gco').value = 'PSA'; f('gg').value = ''; f('gcert').value = ''; }
    gShow();
    fillPlat(f('platform').value);
    const u = S.usage(), left = document.getElementById('ed-left');
    left.hidden = !!editing || !(u.warn);
    left.textContent = u.left === 1 ? '1 free entry left this month.' : u.left + ' free entries left this month.';
    dlg.showModal();
    // phones: no keyboard jumping up while the sheet slides in; tap a field when you're ready
    if (!PHONE.matches) requestAnimationFrame(() => { (editing ? f('amount') : f('name')).focus({ preventScroll: true }); });
    else { form.scrollTop = 0; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); requestAnimationFrame(() => { form.scrollTop = 0; }); }
  }
  function close() { if (dlg.open) dlg.close(); editing = null; }
  // Platform: your platforms in a list, with "Other…" at the end to type a new one (it's saved, so it's in the list next time)
  const psel = document.getElementById('ed-plat-sel');
  function fillPlat(cur) {
    const ps = S.pickerPlatforms(), esc2 = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    psel.innerHTML = '<option value="">Pick one</option>' + ps.map(p => '<option>' + esc2(p) + '</option>').join('') + '<option value="__other">Other…</option>';
    const hit = cur && ps.find(p => p.toLowerCase() === cur.toLowerCase());
    if (hit) { psel.value = hit; f('platform').value = hit; f('platform').hidden = true; }
    else if (cur) { psel.value = '__other'; f('platform').hidden = false; }
    else { psel.value = ''; f('platform').hidden = true; }
  }
  psel.addEventListener('change', () => {
    if (psel.value === '__other') { f('platform').value = ''; f('platform').hidden = false; f('platform').focus(); }
    else { f('platform').value = psel.value; f('platform').hidden = true; }
  });

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const data = { type, name: f('name').value, amount: f('amount').value, fees: f('fees').value, ship: f('ship').value, qty: f('qty').value, date: f('date').value, platform: f('platform').value, condition: f('condition').value, note: f('note').value };
    if (G) {
      const was = editing && G.of(editing);
      if (data.condition === 'Graded' && f('gg').value) { const g = { co: f('gco').value, g: f('gg').value, cert: f('gcert').value }; if (was && was.w && was.co === g.co && was.g === g.g) g.w = was.w; data.grade = g; }
      else if (was) data.grade = false;
    }
    const v = S.validate(data, editing || undefined);
    if (!v.ok) { showErrors(v.errors); return; }
    try {
      const saved = editing ? await S.update(editing.id, data) : await S.add(data);
      if (saved.platform && !S.pickerPlatforms().some(p => p.toLowerCase() === saved.platform.toLowerCase())) await S.addPlatform(saved.platform); // a new platform typed here is kept for this account
      if (!editing) { try { localStorage.setItem('ct.lastEntry', JSON.stringify({ type: saved.type, platform: saved.platform, ship: saved.type === 'sale' ? saved.ship : (last0().ship) })); } catch (e) {} } // remember type and platform from adds only
      const wasEdit = !!editing; close();
      if (onDone) onDone(wasEdit ? 'edited' : 'added', saved);
    } catch (err) {
      if (err.code === 'invalid') showErrors(err.errors);
      else if (err.code === 'limit') { close(); if (onDone) onDone('limit'); }
      else { console.error(err); }
    }
  });
  document.getElementById('ed-del').addEventListener('click', async () => {
    if (!editing) return; const id = editing.id; close(); if (onDone) onDone('delete', id); else await S.remove(id);
  });
  form.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  // phones: drag the sheet down by its top to close it
  form.querySelector('.ed-head').addEventListener('pointerdown', e => {
    if (!PHONE.matches || e.target.closest('button')) return;
    const y0 = e.clientY; let dy = 0; form.style.transition = 'none';
    const mv = ev => { dy = Math.max(0, ev.clientY - y0); form.style.transform = 'translate3d(0,' + dy + 'px,0)'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      form.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
      if (dy > 90) { form.style.transform = 'translate3d(0,100%,0)'; setTimeout(() => { close(); form.style.transform = ''; form.style.transition = ''; }, 200); }
      else { form.style.transform = ''; setTimeout(() => { form.style.transition = ''; }, 230); } };
    addEventListener('pointermove', mv, { passive: true }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); }); // tap outside the sheet
  // Tidy money as you leave the field: "12.5" becomes "12.50"
  ['amount', 'fees', 'ship'].forEach(n => f(n).addEventListener('blur', () => { const c = S.toCents(f(n).value); if (c != null && c >= 0) f(n).value = S.fromCents(c); }));

  // v42.5 phones: the sheet sits on top of the keyboard instead of behind it, and the field you're typing in scrolls to the
  // middle of what you can see, so you always see what you type
  const vv = window.visualViewport, PH = matchMedia('(max-width:760px)');
  function kfit() {
    if (!vv || !dlg.open || !PH.matches || dlg.classList.contains('closing')) return;
    const kb = vv.height < innerHeight * .85;
    if (!kb) { form.style.removeProperty('bottom'); form.style.removeProperty('max-height'); return; }
    form.style.setProperty('bottom', Math.max(0, innerHeight - (vv.offsetTop + vv.height)) + 'px', 'important');
    form.style.setProperty('max-height', Math.max(200, vv.height - 10) + 'px', 'important');
    reveal();
  }
  function reveal() { const a = document.activeElement; if (!a || !form.contains(a) || !a.matches('input,textarea,select')) return;
    requestAnimationFrame(() => { const box = a.closest('label') || a, f0 = form.getBoundingClientRect(), r = box.getBoundingClientRect();
      // the sticky Save bar and header cover part of the sheet; aim for the middle of what's left
      const foot = document.getElementById('ed-save').parentElement, head = form.querySelector('.ed-head');
      const top = f0.top + (head && getComputedStyle(head).position === 'sticky' ? head.offsetHeight : 0) + 12;
      const bot = (foot && /sticky|fixed/.test(getComputedStyle(foot).position) ? foot.getBoundingClientRect().top : f0.bottom) - 12;
      if (r.top < top || r.bottom > bot) form.scrollBy({ top: r.top - top - Math.max(0, (bot - top - r.height) / 2), behavior: 'smooth' }); }); }
  if (vv) { vv.addEventListener('resize', kfit); vv.addEventListener('scroll', kfit); }
  form.addEventListener('focusin', () => setTimeout(() => { kfit(); reveal(); }, 60));
  dlg.addEventListener('close', () => { form.style.removeProperty('bottom'); form.style.removeProperty('max-height'); });
  window.CTEditor = { open, close, get isOpen() { return dlg.open; } };
})();
