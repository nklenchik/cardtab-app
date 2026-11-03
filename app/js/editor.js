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

  const AMOUNT_LABEL = { purchase: 'Paid', sale: 'Sold for', refund: 'Refunded' };

  function setType(t) {
    type = t;
    const btns = [...form.querySelectorAll('.ed-seg button')];
    btns.forEach((b, i) => { const on = b.dataset.type === t; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; if (on) form.querySelector('.ed-pill').style.transform = 'translateX(' + (i * 100) + '%)'; });
    document.getElementById('ed-amount-l').textContent = AMOUNT_LABEL[t];
    document.getElementById('ed-net-f').hidden = t !== 'sale';
    clearErrors();
  }
  form.querySelector('.ed-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setType(b.dataset.type); });
  form.querySelector('.ed-seg').addEventListener('keydown', e => {
    const order = ['purchase', 'sale', 'refund'], i = order.indexOf(type);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setType(n); form.querySelector('[data-type="' + n + '"]').focus(); }
  });

  function clearErrors() { form.querySelectorAll('.ed-err').forEach(x => { x.textContent = ''; }); form.querySelectorAll('.ed-f.bad').forEach(x => x.classList.remove('bad')); }
  function showErrors(errs) {
    clearErrors(); let first = null;
    Object.keys(errs).forEach(k => { const el = form.querySelector('[data-err="' + k + '"]'); if (el) { el.textContent = errs[k]; el.closest('.ed-f').classList.add('bad'); first = first || f(k); } });
    if (first) first.focus();
  }
  const cents = c => (c == null ? '' : S.fromCents(c));

  function open(entry, done) {
    editing = entry || null; onDone = done || null;
    form.reset(); clearErrors();
    document.getElementById('ed-h').textContent = editing ? 'Edit entry' : 'Add an entry';
    document.getElementById('ed-save').textContent = editing ? 'Save changes' : 'Save';
    document.getElementById('ed-del').hidden = !editing;
    const last = (() => { try { return JSON.parse(localStorage.getItem('ct.lastEntry') || '{}'); } catch (e) { return {}; } })();
    const e = editing || { type: last.type || 'purchase', platform: last.platform || '', date: S.today(), qty: 1 };
    setType(e.type);
    f('name').value = e.name || ''; f('amount').value = cents(e.amount); f('net').value = cents(e.net);
    f('qty').value = e.qty || 1; f('date').value = e.date || S.today(); f('platform').value = e.platform || '';
    f('condition').value = e.condition || ''; f('note').value = e.note || '';
    document.getElementById('ed-platforms').innerHTML = [...new Set(S.platforms().concat(['eBay', 'TCGplayer', 'Mercari', 'Whatnot', 'Card Show', 'Facebook Marketplace', 'Local game store']))].map(p => '<option value="' + p.replace(/"/g, '&quot;') + '">').join('');
    const u = S.usage(), left = document.getElementById('ed-left');
    left.hidden = !!editing || !(u.warn);
    left.textContent = u.left === 1 ? '1 free entry left this month.' : u.left + ' free entries left this month.';
    dlg.showModal();
    requestAnimationFrame(() => { (editing ? f('amount') : f('name')).focus({ preventScroll: true }); });
  }
  function close() { if (dlg.open) dlg.close(); editing = null; }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const data = { type, name: f('name').value, amount: f('amount').value, net: f('net').value, qty: f('qty').value, date: f('date').value, platform: f('platform').value, condition: f('condition').value, note: f('note').value };
    const v = S.validate(data, editing || undefined);
    if (!v.ok) { showErrors(v.errors); return; }
    try {
      const saved = editing ? await S.update(editing.id, data) : await S.add(data);
      if (!editing) { try { localStorage.setItem('ct.lastEntry', JSON.stringify({ type: saved.type, platform: saved.platform })); } catch (e) {} } // remember type and platform from adds only
      const wasEdit = !!editing; close();
      if (onDone) onDone(wasEdit ? 'edited' : 'added', saved);
    } catch (err) {
      if (err.code === 'invalid') showErrors(err.errors);
      else if (err.code === 'limit') { close(); if (onDone) onDone('limit'); }
      else { console.error(err); }
    }
  });
  document.getElementById('ed-del').addEventListener('click', async () => {
    if (!editing) return; const id = editing.id; close(); await S.remove(id); if (onDone) onDone('deleted');
  });
  form.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); }); // tap outside the sheet
  // Tidy money as you leave the field: "12.5" becomes "12.50"
  ['amount', 'net'].forEach(n => f(n).addEventListener('blur', () => { const c = S.toCents(f(n).value); if (c != null && c >= 0) f(n).value = S.fromCents(c); }));

  window.CTEditor = { open, close, get isOpen() { return dlg.open; } };
})();
