/* Premium billing in the app (v50.63).
   - The Premium sheet gets a plan picker: yearly (picked first, two months free) or monthly. Anyone who joined before 2027
     sees the founders prices ($40 a year, $4 a month) until Jan 31, 2027, locked in while they stay subscribed.
   - Checkout opens in a sheet inside the app (Stripe's own secure form: Apple Pay, Google Pay, cards). Card Tab never sees the card.
   - Right after paying: Premium turns on without a reload, and a welcome screen shows once.
   - Settings → Plan and billing: the plan at a glance, switch monthly/yearly at the next renewal, and Stripe's billing page for
     the card, receipts and cancelling.
   - A failed payment: a banner on Entries and a notification; Premium keeps working for 7 days while Stripe retries.
   Off cardtab.app (local previews and tests) everything runs as a demo: no Stripe, nothing charged. */
(function () {
  'use strict';
  const S = window.CTStore, Sess = window.CTSession; if (!S) return;
  const REAL = /(^|\.)cardtab\.app$/i.test(location.hostname);
  const $ = id => document.getElementById(id);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const toast = t => window.CTDash && window.CTDash.toast && window.CTDash.toast(t);
  const api = (p, b) => Sess.api(p, b);
  const dollars = c => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
  const dateOf = s => new Date(s * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const FOUNDER_UNTIL = Date.parse('2027-02-01T00:00:00-05:00') / 1000, JOIN_BEFORE = Date.parse('2027-01-01T00:00:00-05:00') / 1000;

  // ---------- status ----------
  let status = null, loading = null;
  function demoStatus() {
    const prem = S.plan() === 'premium', t = Date.now() / 1000;
    return { plan: prem ? 'premium' : 'free', gift: false, ready: true, demo: true, founders: { eligible: t < FOUNDER_UNTIL, until: FOUNDER_UNTIL, joinBefore: JOIN_BEFORE },
      sub: prem ? { status: 'active', interval: 'year', amount: 4000, founder: true, periodEnd: Math.floor(t + 365 * 86400), cancelAtEnd: false, graceUntil: null, card: { brand: 'visa', last4: '4242' }, pending: null } : null };
  }
  function load(force) {
    if (!REAL) { status = demoStatus(); after(); return Promise.resolve(status); }
    if (loading && !force) return loading;
    loading = api('/auth/billing').then(j => { status = j; after(); return j; }).catch(() => status).finally(() => { setTimeout(() => { loading = null; }, 2000); });
    return loading;
  }
  function after() { paintRow(); banner(); notifyPayfail(); }
  const offer = () => (status && status.founders && status.founders.eligible) || false;
  const priceOf = interval => (offer() ? (interval === 'year' ? 4000 : 400) : (interval === 'year' ? 6000 : 600));
  const regular = interval => (interval === 'year' ? 6000 : 600);
  const card = c => c ? (c.brand ? c.brand[0].toUpperCase() + c.brand.slice(1) : 'Card') + ' •••• ' + c.last4 : '';

  // ---------- the plan picker on the Premium sheet ----------
  let pick = 'year';
  function planPicker() {
    const pms = $('pms'); if (!pms) return; const pill = pms.querySelector('.pmpill, .pmplans'); if (!pill) return;
    const f = offer(), y = priceOf('year'), m = priceOf('month');
    const row = (iv, title, sub, amt, unit, tag) => '<button type="button" class="pmplan' + (pick === iv ? ' on' : '') + '" data-iv="' + iv + '" role="radio" aria-checked="' + (pick === iv) + '">' + (tag ? '<span class="pmtag2">' + tag + '</span>' : '') +
      '<i class="pmrad" aria-hidden="true"></i><span class="pmpl"><b>' + title + '</b><small>' + sub + '</small></span><span class="pmpr">' + (f ? '<s>' + dollars(regular(iv)) + '</s>' : '') + '<b>' + dollars(amt) + '</b><em>' + unit + '</em></span></button>';
    const box = document.createElement('div'); box.className = 'pmplans'; box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', 'Plan');
    box.innerHTML = row('year', 'Yearly', '', y, ' /yr', '2 months free') + row('month', 'Monthly', 'Billed every month', m, ' /mo', '') +
      (f ? '<p class="pmfnd"><span aria-hidden="true">★</span> Founding member price, locked in while you stay subscribed. Ends Jan 31.</p>' : '');
    box.querySelector('[data-iv="year"] small').textContent = '$' + (y / 1200).toFixed(2) + ' a month, billed yearly';
    pill.replaceWith(box);
    // the small print goes under the button
    const go = $('pm-go'); if (go && !pms.querySelector('.pmfine')) go.insertAdjacentHTML('afterend', '<p class="pmfine"></p>');
    box.addEventListener('click', e => { const b = e.target.closest('[data-iv]'); if (!b) return; pick = b.dataset.iv; box.querySelectorAll('[data-iv]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); box.classList.add('pmtouched'); cta(true); });
    cta();
  }
  // v50.72: before launch the button says when Premium opens and can't be pressed (admins can still check out)
  const closed = () => !!(status && status.open === false);
  // v52.19: the button's words sit in a clipped line, so a new price can slide up in place of the old one
  function label(g, t, slide) { const w = g.querySelector('.pmlbw'), cur = w && w.querySelector('.pmlb:not(.out)'); if (cur && cur.textContent === t) return;
    if (!cur || !slide || matchMedia('(prefers-reduced-motion: reduce)').matches) { g.innerHTML = '<span class="pmlbw"><span class="pmlb"></span></span>'; g.querySelector('.pmlb').textContent = t; return; }
    const n = document.createElement('span'); n.className = 'pmlb in'; n.textContent = t; w.appendChild(n); void n.offsetWidth; n.classList.remove('in'); cur.classList.add('out'); setTimeout(() => cur.remove(), 420); }
  function cta(slide) { const g = $('pm-go'), pms = $('pms'), fine = pms && pms.querySelector('.pmfine'); if (!g) return;
    g.disabled = closed(); g.classList.toggle('pm-soon', closed());
    label(g, closed() ? 'Premium opens ' + (status.opens || 'soon') : 'Continue · ' + dollars(priceOf(pick)) + (pick === 'year' ? '/year' : '/month'), slide);
    if (fine) fine.textContent = closed() ? (offer() ? 'You’re in early, so the founders price is yours. Upgrade by Jan 31.' : 'Premium isn’t open yet.') : 'Renews automatically. Cancel anytime in Settings.'; }
  // the sheet lives in the Card Board files, which load later: paint the picker whenever it opens
  new MutationObserver(() => { const pms = $('pms'); if (pms && pms.open && !pms._ctPlans) { pms._ctPlans = true; pick = 'year'; planPicker(); if (!status) load().then(planPicker); }
    if (pms && !pms.open) pms._ctPlans = false; }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });
  // "Continue" on the sheet (the board closes the sheet, then calls this)
  window.CTBoardUpgrade = () => checkout(pick);

  // ---------- checkout, in a sheet ----------
  let ck = null, embedded = null;
  function ckDialog() {
    if (ck) return ck;
    ck = document.createElement('dialog'); ck.className = 'ckd'; ck.setAttribute('aria-label', 'Checkout');
    ck.innerHTML = '<div class="ck-p" tabindex="-1"><div class="ck-h"><span class="ck-logo" aria-hidden="true">C</span><span class="ck-t"><b>Card Tab Premium</b><small id="ck-sub"></small></span><button type="button" class="ck-x" aria-label="Close">✕</button></div>' +
      '<div class="ck-body"><div id="ck-mount"></div><p class="ck-wait" id="ck-wait">Opening secure checkout…</p></div><p class="ck-foot">Secure checkout by Stripe. Card Tab never sees or stores your card.</p></div>';
    document.body.appendChild(ck);
    ck.querySelector('.ck-x').addEventListener('click', () => closeCk());
    ck.addEventListener('cancel', e => { e.preventDefault(); closeCk(); });
    ck.addEventListener('click', e => { if (e.target === ck) closeCk(); });
    if (window.CTSheetDrag) window.CTSheetDrag.attach({ zone: ck, sheet: ck.querySelector('.ck-p'), on: () => matchMedia('(max-width:760px)').matches, ownClose: () => closeCk() });
    return ck;
  }
  function closeCk() { if (!ck) return; try { embedded && embedded.destroy(); } catch (e) {} embedded = null; $('ck-mount').innerHTML = ''; if (ck.open) ck.close(); }
  let stripeJs = null;
  const loadStripe = () => stripeJs || (stripeJs = new Promise((res, rej) => { if (window.Stripe) return res(window.Stripe); const s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.onload = () => res(window.Stripe); s.onerror = () => { stripeJs = null; rej(new Error('Couldn’t reach Stripe. Check your connection.')); }; document.head.appendChild(s); }));
  async function checkout(iv) {
    if (closed()) { cta(); return; }
    iv = iv === 'month' ? 'month' : 'year';
    const d = ckDialog(); $('ck-sub').textContent = (iv === 'year' ? 'Yearly' : 'Monthly') + ' · ' + dollars(priceOf(iv)) + (iv === 'year' ? '/year' : '/month') + (offer() ? ' · founding member' : '');
    const w = $('ck-wait'); w.hidden = false; w.textContent = 'Opening secure checkout…'; w.classList.remove('err');
    d.showModal(); try { d.querySelector('.ck-p').focus({ preventScroll: true }); } catch (e) {}
    if (!REAL) { demoCheckout(iv); return; }
    try {
      if (!status) await load();
      if (!status || !status.publishableKey || !status.ready) throw new Error('Payments aren’t switched on yet. Try again soon.');
      const Stripe = await loadStripe(), stripe = Stripe(status.publishableKey);
      let secret = '';
      embedded = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => { const j = await api('/auth/billing/checkout', { plan: iv === 'year' ? 'yearly' : 'monthly' }); secret = j.clientSecret; return secret; }, onComplete: () => done(secret.split('_secret_')[0]) });
      w.hidden = true; embedded.mount('#ck-mount');
    } catch (e) { w.hidden = false; w.classList.add('err'); w.textContent = (e && e.body && e.body.have) ? 'You already have Premium.' : (e && e.message) || 'Checkout didn’t open. Try again.'; }
  }
  function demoCheckout(iv) {
    $('ck-wait').hidden = true;
    $('ck-mount').innerHTML = '<div class="ck-demo"><p><b>Preview checkout</b><br>On cardtab.app this is Stripe’s secure form with Apple Pay, Google Pay and cards. Nothing is charged here.</p><div class="ck-dl"><span>Premium, ' + (iv === 'year' ? 'yearly' : 'monthly') + '</span><span>' + dollars(priceOf(iv)) + '</span></div><button type="button" class="ck-pay" id="ck-demo-pay">Subscribe</button></div>';
    $('ck-demo-pay').addEventListener('click', async () => { await S.setPlan('premium'); status = demoStatus(); status.sub.interval = iv; status.sub.amount = priceOf(iv); closeCk(); welcome(); after(); });
  }
  // after paying: ask the server (it checks with Stripe), then turn Premium on here
  async function done(session) {
    let j = null;
    for (let i = 0; i < 10; i++) { try { j = await api('/auth/billing/confirm', { session }); } catch (e) {} if (j && j.plan === 'premium') break; await new Promise(r => setTimeout(r, 1500)); }
    closeCk();
    if (j) { status = j; after(); }
    if (j && j.plan === 'premium') { await turnOn(); welcome(); } else toast('Payment received. Premium turns on in a moment.');
  }
  async function turnOn() {
    if (S.plan() !== 'premium') await S.setPlan('premium');
    try { const c = Sess.current && Sess.current(); if (c && Sess.fromUser) Sess.fromUser(Object.assign({}, c, { plan: 'premium' }), c.via); } catch (e) {}
  }

  // ---------- welcome ----------
  function welcome() {
    let w = $('wlc');
    if (!w) { w = document.createElement('dialog'); w.id = 'wlc'; w.className = 'wlc'; document.body.appendChild(w);
      w.addEventListener('click', e => { if (e.target.closest('[data-wgo]') || e.target === w) w.close(); }); }
    const s = status && status.sub, f = s && s.founder;
    w.innerHTML = '<div class="wl-p"><div class="wl-badge" aria-hidden="true"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>' +
      '<h2>You’re Premium.</h2><p>' + (f ? 'Thanks for being a founding member. Your ' + dollars(s.amount) + (s.interval === 'year' ? ' a year' : ' a month') + ' price is locked in.' : 'Thanks for supporting Card Tab.') + '</p>' +
      '<div class="wl-ul"><div><span>✓</span>No monthly entry limit</div><div><span>✓</span>Every Card Board widget and saved layouts</div><div><span>✓</span>All Stories themes and video</div><div><span>✓</span>Import and all your history</div></div>' +
      '<button type="button" class="wl-go" data-wgo>Start exploring</button><p class="wl-fine">A receipt is on its way to your email.</p></div>';
    w.showModal(); const pnl = w.querySelector('.wl-p'); pnl.tabIndex = -1; pnl.style.outline = 'none'; try { pnl.focus({ preventScroll: true }); } catch (e) {}
  }

  // ---------- Settings → Plan and billing ----------
  function paintRow() { const v = document.querySelector('[data-sv="plan"]'); if (!v || !status) return;
    const s = status.sub; v.textContent = status.gift ? 'Premium (gift)' : s ? 'Premium · ' + (s.interval === 'year' ? 'yearly' : 'monthly') + (s.status === 'past_due' ? ' · payment problem' : s.cancelAtEnd ? ' · ends ' + dateOf(s.periodEnd).replace(/, \d{4}$/, '') : '') : (status.plan === 'premium' ? 'Premium' : 'Free'); }
  const R = (id, title, sub, right, cls) => '<button type="button" class="amr bl-r' + (cls ? ' ' + cls : '') + '" data-bl="' + id + '"><span class="amgt">' + title + (sub ? '<small class="am-sv">' + sub + '</small>' : '') + '</span>' + (right || '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>') + '</button>';
  function paint(el) {
    el = el || $('am-bill'); if (!el) return;
    if (!status) { el.innerHTML = '<p class="amp-n">Loading…</p>'; load().then(() => paint(el)); return; }
    const s = status.sub;
    let h = '';
    if (status.gift) h = '<div class="amg bl-hero"><span class="bl-k">Gift</span><b>Premium</b><small>Given by Card Tab. There’s nothing to pay.</small></div>';
    else if (s) {
      const per = s.interval === 'year' ? ' a year' : ' a month', other = s.interval === 'year' ? 'month' : 'year';
      const line = s.status === 'past_due' ? 'Payment didn’t go through' : s.cancelAtEnd ? dollars(s.amount) + (s.interval === 'year' ? '/year' : '/month') : dollars(s.amount) + per + ' · renews ' + dateOf(s.periodEnd);
      h = '<div class="amg bl-hero">' + (s.founder ? '<span class="bl-k">Founding member</span>' : '') + '<b>Premium · ' + (s.interval === 'year' ? 'Yearly' : 'Monthly') + '</b><small>' + line + '</small>' +
        (s.pending ? '<small class="bl-pend">Switches to ' + (s.pending.interval === 'year' ? 'yearly' : 'monthly') + ' (' + dollars(s.pending.amount) + (s.pending.interval === 'year' ? ' a year' : ' a month') + ') on ' + dateOf(s.periodEnd) + '</small>' : '') + '</div>';
      // v52.66 cancelled (Premium runs to the end of what's paid): say plainly when it ends and what happens after
      if (s.cancelAtEnd && s.status !== 'past_due') h += '<div class="amg bl-warn"><b>Your Premium ends ' + dateOf(s.periodEnd) + '</b><small>You keep everything until then. After that you’re on Free: 20 new entries a month, and every entry stays in your list.' + (s.founder ? ' Renew before then to keep your founding member price.' : '') + '</small><button type="button" class="bl-btn" data-bl="portal">Renew Premium</button></div>';
      if (s.status === 'past_due') h += '<div class="amg bl-warn"><b>Your payment didn’t go through</b><small>Update your card to keep Premium. It stays on until ' + dateOf(s.graceUntil || s.periodEnd) + ' while we try again.</small><button type="button" class="bl-btn" data-bl="portal">Update card</button></div>';
      const sw = s.pending ? R('switch:' + s.interval, 'Keep ' + (s.interval === 'year' ? 'yearly' : 'monthly'), 'Cancel the switch to ' + (s.pending.interval === 'year' ? 'yearly' : 'monthly'))
        : s.cancelAtEnd ? '' : R('switch:' + other, 'Switch to ' + (other === 'year' ? 'yearly' : 'monthly'), dollars(priceFor(s.founder, other)) + (other === 'year' ? ' a year' : ' a month') + ', starting ' + dateOf(s.periodEnd));
      h += '<div class="amg">' + sw + R('portal', 'Payment method', card(s.card) || 'Add a card', '<em class="am-val">Update</em>') + R('portal', 'Receipts', 'Every payment, ready to download') + '</div>';
      if (!s.cancelAtEnd) h += '<div class="amg">' + R('portal', '<span class="bl-red">Cancel Premium</span>', 'You keep Premium until ' + dateOf(s.periodEnd)) + '</div>';   // cancelled: the box above has Renew
    } else if (status.plan === 'premium') h = '<div class="amg bl-hero"><b>Premium</b><small>Turned on for this account.</small></div>';
    else {
      h = '<div class="amg bl-hero"><b>Free</b><small>Up to 20 new entries a month, totals and the starting Card Board for your last 3 months. Every entry stays in your list.</small></div>' +
        (offer() ? '<div class="amg bl-fnd"><b>Founding member price</b><small>$4 a month or $40 a year, locked in while you stay subscribed. Ends Jan 31, 2027.</small></div>' : '') +
        '<button type="button" class="bl-go" data-bl="upgrade">Get Premium</button>';
    }
    h += '<p class="amp-n">' + (status.demo ? 'Preview: on cardtab.app this shows your real plan. ' : '') + 'Payments are handled securely by Stripe. Card Tab never sees or stores your card number.</p>';
    el.innerHTML = h;
  }
  const priceFor = (founder, iv) => (founder ? (iv === 'year' ? 4000 : 400) : (iv === 'year' ? 6000 : 600));
  async function portal() {
    if (!REAL) { toast('Preview: on cardtab.app this opens Stripe’s billing page.'); return; }
    try { const j = await api('/auth/billing/portal', {}); location.href = j.url; } catch (e) { toast(e.message || 'Couldn’t open billing. Try again.'); }
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-bl]'); if (!b || !b.closest('#am-bill, .ct-paybar')) return;
    e.stopPropagation(); const a = b.dataset.bl;
    if (a === 'portal') return portal();
    if (a === 'upgrade') { if (window.CTMenu) window.CTMenu.close(); const go = () => window.CTPremiumOpen && window.CTPremiumOpen(); if (window.CTPremiumOpen) setTimeout(go, 200); else if (window.CTBoardLoader) window.CTBoardLoader.load().then(() => setTimeout(go, 200)); return; }
    if (a.startsWith('switch:')) {
      const to = a.split(':')[1];
      if (!REAL) { const s = status.sub; s.pending = s.interval === to ? null : { interval: to, amount: priceFor(s.founder, to) }; paint(); return; }
      b.disabled = true;
      try { status = await api('/auth/billing/switch', { to: to === 'year' ? 'yearly' : 'monthly' }); after(); paint(); toast(status.sub && status.sub.pending ? 'Switches at your next renewal' : 'Staying on your plan'); }
      catch (er) { b.disabled = false; toast(er.message || 'Couldn’t switch. Try again.'); }
    }
  }, true);

  // ---------- a failed payment: banner on Entries + a notification ----------
  function banner() {
    const s = status && status.sub, bad = s && s.status === 'past_due';
    let el = document.querySelector('.ct-paybar');
    if (!bad) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'ct-paybar'; el.setAttribute('role', 'alert');
      const at = document.querySelector('#view-app .ct-demo-left') || document.querySelector('#view-app'); if (!at) return; at.prepend(el); }
    el.innerHTML = '<span class="pb-ic" aria-hidden="true">!</span><div><b>Your payment didn’t go through</b><p>Update your card to keep Premium. It stays on until ' + dateOf(s.graceUntil || s.periodEnd) + ' while we try again.</p><button type="button" data-bl="portal">Update card</button></div>';
  }
  async function notifyPayfail() {
    const s = status && status.sub, bad = s && s.status === 'past_due', n = S.meta('notif') || {}, items = n.items || [], has = items.some(x => x.kind === 'payfail');
    if (bad && !has) await S.setMeta('notif', Object.assign({}, n, { items: items.concat([{ id: 'payfail:' + (s.graceUntil || Date.now()), kind: 'payfail', cat: 'billing', ts: Date.now() }]) }));
    else if (!bad && has) await S.setMeta('notif', Object.assign({}, n, { items: items.filter(x => x.kind !== 'payfail') }));
    if ((bad && !has) || (!bad && has)) window.CTNotify && window.CTNotify.paintDot && window.CTNotify.paintDot();
  }

  // ---------- coming back from Stripe (a wallet that left the page, or the billing page) ----------
  (async () => {
    const q = new URLSearchParams(location.search), cs = q.get('checkout'), back = q.get('billing');
    if (cs || back) { q.delete('checkout'); q.delete('billing'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
    if (cs && REAL) { setTimeout(() => done(cs), 800); return; }
    // v50.72: "Update my card" in a payment email goes straight to Stripe's page for changing the card
    if (back === 'fix' && REAL) { setTimeout(async () => { try { await load(true); if (status && status.sub) portal(); } catch (e) {} }, 600); return; }
    setTimeout(() => load(true), back ? 300 : 2500);
  })();
  S.on && S.on(r => { if (r === 'plan' && !REAL) { status = demoStatus(); after(); } });
  window.CTBilling = { load, paint, checkout, portal, welcome, render: after, status: () => status };
})();
