/* Card Tab Premium billing (v50.63), on Stripe.
   Prices (made once, found again by their lookup keys): regular $6/month and $60/year; founders $4/month and $40/year.
   Founders: anyone whose account was made before Jan 1, 2027 (Eastern) who upgrades by Jan 31, 2027 gets the founders price,
   and keeps it for as long as that subscription lasts (switching monthly <-> yearly stays on founders prices). Cancel and come
   back later, and it's the regular price.
   Checkout runs inside the app (Stripe's embedded checkout). The webhook keeps each account's plan in step with Stripe.
   A failed payment keeps Premium for 7 days (the daily job turns it off after that unless the card is fixed).
   Gifts: an admin can give someone Premium without a card (beta testers).

   Routes (signed in):
     GET  /auth/billing               plan, founders offer, subscription, card
     POST /auth/billing/checkout      { plan: 'monthly'|'yearly' } -> { clientSecret, publishableKey }
     POST /auth/billing/portal        -> { url } (Stripe's billing page: card, receipts, cancel)
     POST /auth/billing/switch        { to: 'monthly'|'yearly' } at the next renewal (again to undo)
     GET  /auth/admin/people?q=       admins: find accounts by email (empty q: everyone with a gift)
     POST /auth/admin/people/gift     admins: { id, on }
   Public:
     POST /stripe/webhook             Stripe's events, signature checked */

export const FOUNDER_JOIN_BEFORE = Date.parse('2027-01-01T00:00:00-05:00') / 1000;
export const FOUNDER_UPGRADE_BY = Date.parse('2027-02-01T00:00:00-05:00') / 1000;   // through the end of Jan 31, Eastern
export const GRACE = 7 * 86400;
const PRICES = {
  m6: { amount: 600, interval: 'month', founder: 0, nick: 'Premium monthly' },
  y60: { amount: 6000, interval: 'year', founder: 0, nick: 'Premium yearly' },
  fm4: { amount: 400, interval: 'month', founder: 1, nick: 'Premium monthly, founding member' },
  fy40: { amount: 4000, interval: 'year', founder: 1, nick: 'Premium yearly, founding member' }
};
const LK = k => 'ct_' + k;                       // Stripe lookup key
const keyOfLookup = lk => (String(lk || '').startsWith('ct_') ? lk.slice(3) : '');
const keyFor = (founder, interval) => (founder ? (interval === 'year' ? 'fy40' : 'fm4') : (interval === 'year' ? 'y60' : 'm6'));
const now = () => Math.floor(Date.now() / 1000);
const appUrl = env => env.APP_URL || 'https://app.cardtab.app';

// ---------- Stripe API (form-encoded, nested keys like line_items[0][price]) ----------
function form(obj, pre, out) {
  out = out || [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = pre ? pre + '[' + k + ']' : k;
    if (typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
export async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw Object.assign(new Error('Payments aren’t set up yet.'), { status: 503 });
  const q = params ? form(params).join('&') : '';
  const url = 'https://api.stripe.com/v1' + path + (method === 'GET' && q ? (path.includes('?') ? '&' : '?') + q : '');
  const r = await fetch(url, { method, headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': '2025-03-31.basil' }, body: method === 'GET' ? undefined : q });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j.error && j.error.message) || 'Stripe error'), { status: r.status >= 500 ? 502 : 400, stripe: j.error || null });
  return j;
}

// ---------- the billing table (made on first use) ----------
let tableReady = false;
async function ensureTable(env) {
  if (tableReady) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS billing ( user_id TEXT PRIMARY KEY, customer TEXT, sub TEXT, status TEXT, price_key TEXT, interval TEXT, amount INTEGER, founder INTEGER DEFAULT 0, period_end INTEGER, cancel_at_end INTEGER DEFAULT 0, grace_until INTEGER, card_brand TEXT, card_last4 TEXT, pending_key TEXT, schedule TEXT, gift INTEGER DEFAULT 0, updated INTEGER )'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS billing_customer ON billing (customer)')
  ]);
  tableReady = true;
}
const rowOf = async (env, uid) => (await env.DB.prepare('SELECT * FROM billing WHERE user_id=?').bind(uid).first()) || null;
async function saveRow(env, uid, patch) {
  const cur = (await rowOf(env, uid)) || { user_id: uid };
  const r = Object.assign({ gift: 0, founder: 0, cancel_at_end: 0 }, cur, patch, { updated: now() });
  const cols = ['user_id', 'customer', 'sub', 'status', 'price_key', 'interval', 'amount', 'founder', 'period_end', 'cancel_at_end', 'grace_until', 'card_brand', 'card_last4', 'pending_key', 'schedule', 'gift', 'updated'];
  await env.DB.prepare('INSERT OR REPLACE INTO billing (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')').bind(...cols.map(c => (r[c] === undefined ? null : r[c]))).run();
  return r;
}
const ACTIVE = s => s === 'active' || s === 'trialing' || s === 'past_due';
// the plan an account should have: a gift, or a subscription that's paid up (or within its 7 days after a failed payment)
const planOf = r => (r && (r.gift || (ACTIVE(r.status) && !(r.status === 'past_due' && r.grace_until && r.grace_until < now()))) ? 'premium' : 'free');
async function applyPlan(env, uid, r) {
  const u = await env.DB.prepare('SELECT plan FROM users WHERE id=?').bind(uid).first(); if (!u) return;
  const want = planOf(r);
  // an admin's own test switch (/auth/plan) is left alone unless Stripe or a gift says Premium
  if (want === 'premium' && u.plan !== 'premium') await env.DB.prepare("UPDATE users SET plan='premium' WHERE id=?").bind(uid).run();
  if (want === 'free' && u.plan === 'premium' && (r.customer || r.gift === 0)) await env.DB.prepare("UPDATE users SET plan='free' WHERE id=?").bind(uid).run();
}

// ---------- prices and the billing page settings, made once and found again ----------
let priceCache = null;
export async function ensurePrices(env) {
  if (priceCache) return priceCache;
  const keys = Object.keys(PRICES), found = {};
  const l = await stripe(env, 'GET', '/prices', { active: true, limit: 10, lookup_keys: keys.map(LK) });
  for (const p of l.data || []) { const k = keyOfLookup(p.lookup_key); if (k) found[k] = p.id; }
  const missing = keys.filter(k => !found[k]);
  if (missing.length) {
    let product = null;
    try { const s = await stripe(env, 'GET', '/products/search', { query: "metadata['ct']:'premium' AND active:'true'" }); product = s.data && s.data[0] && s.data[0].id; } catch (e) {}
    if (!product) product = (await stripe(env, 'POST', '/products', { name: 'Card Tab Premium', description: 'Everything in Card Tab, with no monthly entry limit.', metadata: { ct: 'premium' }, tax_code: 'txcd_10103001' })).id;
    for (const k of missing) {
      const d = PRICES[k];
      const p = await stripe(env, 'POST', '/prices', { product, currency: 'usd', unit_amount: d.amount, recurring: { interval: d.interval }, lookup_key: LK(k), nickname: d.nick, tax_behavior: 'exclusive', metadata: { ct: k, founder: d.founder } });
      found[k] = p.id;
    }
  }
  priceCache = found; return found;
}
let portalCfg = null;
async function ensurePortal(env) {
  if (portalCfg) return portalCfg;
  const l = await stripe(env, 'GET', '/billing_portal/configurations', { active: true, limit: 20 });
  const mine = (l.data || []).find(c => c.metadata && c.metadata.ct === 'billing');
  if (mine) return (portalCfg = mine.id);
  const c = await stripe(env, 'POST', '/billing_portal/configurations', {
    business_profile: { headline: 'Card Tab Premium' },
    features: { payment_method_update: { enabled: true }, invoice_history: { enabled: true }, customer_update: { enabled: true, allowed_updates: { 0: 'address' } }, subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: { 0: 'too_expensive', 1: 'unused', 2: 'missing_features', 3: 'other' } } } },
    metadata: { ct: 'billing' }
  });
  return (portalCfg = c.id);
}

// ---------- founders ----------
export function founderOffer(user, r, t = now()) {
  const joinedEarly = (user.created_at || 0) < FOUNDER_JOIN_BEFORE;
  return { eligible: joinedEarly && t < FOUNDER_UPGRADE_BY, joinedEarly, until: FOUNDER_UPGRADE_BY, joinBefore: FOUNDER_JOIN_BEFORE, keeps: !!(r && r.founder && ACTIVE(r.status)) };
}

// ---------- keep an account in step with its Stripe subscription ----------
async function uidForCustomer(env, customer) {
  const r = await env.DB.prepare('SELECT user_id FROM billing WHERE customer=?').bind(customer).first(); return r ? r.user_id : '';
}
export async function syncSubscription(env, sub, uidHint) {
  await ensureTable(env);
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id;
  const uid = (sub.metadata && sub.metadata.uid) || uidHint || (await uidForCustomer(env, customer)); if (!uid) return null;
  const item = sub.items && sub.items.data && sub.items.data[0], price = item && item.price;
  const key = keyOfLookup(price && price.lookup_key) || (price && price.metadata && price.metadata.ct) || '';
  const pm = sub.default_payment_method && typeof sub.default_payment_method === 'object' ? sub.default_payment_method : null;
  const cur = await rowOf(env, uid);
  const patch = { customer, sub: sub.id, status: sub.status, price_key: key, interval: price && price.recurring ? price.recurring.interval : null, amount: price ? price.unit_amount : null,
    founder: PRICES[key] ? PRICES[key].founder : 0, period_end: (item && item.current_period_end) || sub.current_period_end || null, cancel_at_end: sub.cancel_at_period_end ? 1 : 0,
    schedule: typeof sub.schedule === 'string' ? sub.schedule : (sub.schedule && sub.schedule.id) || null };
  if (!patch.schedule) patch.pending_key = null;
  if (pm && pm.card) { patch.card_brand = pm.card.brand; patch.card_last4 = pm.card.last4; }
  if (sub.status !== 'past_due') patch.grace_until = null;
  else if (!(cur && cur.grace_until)) patch.grace_until = now() + GRACE;
  if (sub.status === 'canceled' || sub.status === 'incomplete_expired') Object.assign(patch, { sub: null, price_key: null, interval: null, amount: null, founder: 0, period_end: null, cancel_at_end: 0, pending_key: null, schedule: null });
  const r = await saveRow(env, uid, patch);
  await applyPlan(env, uid, r);
  return r;
}
const getSub = (env, id) => stripe(env, 'GET', '/subscriptions/' + id, { expand: { 0: 'default_payment_method' } });

// ---------- the webhook ----------
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyStripe(secret, header, body, t0 = now()) {
  const parts = Object.fromEntries(String(header || '').split(',').map(x => x.split('=')).filter(x => x.length === 2).map(([a, b]) => [a.trim(), b.trim()]));
  const sigs = String(header || '').split(',').filter(x => x.trim().startsWith('v1=')).map(x => x.trim().slice(3));
  if (!parts.t || !sigs.length || Math.abs(t0 - Number(parts.t)) > 300) return false;
  const want = await hmacHex(secret, parts.t + '.' + body);
  return sigs.some(s => s.length === want.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ want.charCodeAt(i)), 0) === 0);
}
export async function handleWebhook(env, req) {
  const body = await req.text();
  if (!env.STRIPE_WEBHOOK_SECRET || !(await verifyStripe(env.STRIPE_WEBHOOK_SECRET, req.headers.get('stripe-signature'), body))) return new Response('bad signature', { status: 400 });
  const ev = JSON.parse(body), o = ev.data && ev.data.object; await ensureTable(env);
  try {
    if (ev.type === 'checkout.session.completed' && o.mode === 'subscription' && o.subscription) {
      const uid = o.client_reference_id || (o.metadata && o.metadata.uid) || '';
      if (uid && o.customer) await saveRow(env, uid, { customer: o.customer });
      await syncSubscription(env, await getSub(env, o.subscription), uid);
    } else if (/^customer\.subscription\.(created|updated|deleted|paused|resumed)$/.test(ev.type)) {
      await syncSubscription(env, ev.type.endsWith('deleted') ? o : await getSub(env, o.id));
    } else if ((ev.type === 'invoice.payment_failed' || ev.type === 'invoice.paid') && (o.subscription || (o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription))) {
      await syncSubscription(env, await getSub(env, o.subscription || o.parent.subscription_details.subscription));
    } else if (ev.type === 'payment_method.attached' || ev.type === 'customer.updated') {
      const cus = o.customer || o.id, uid = cus && (await uidForCustomer(env, cus)), r = uid && (await rowOf(env, uid));
      if (r && r.sub) await syncSubscription(env, await getSub(env, r.sub), uid);
    }
  } catch (e) { return new Response('retry', { status: 500 }); }   // Stripe tries again later
  return new Response('ok');
}

// ---------- the daily job: 7 days after a failed payment, Premium turns off ----------
export async function graceSweep(env) {
  try { await ensureTable(env); } catch (e) { return; }
  const rows = (await env.DB.prepare("SELECT * FROM billing WHERE status='past_due' AND grace_until IS NOT NULL AND grace_until<? AND COALESCE(gift,0)=0").bind(now()).all()).results || [];
  for (const r of rows) await applyPlan(env, r.user_id, r);
}

// ---------- signed-in routes ----------
const statusOut = (env, user, r) => ({
  plan: user.plan || 'free', gift: !!(r && r.gift), publishableKey: env.STRIPE_PUBLISHABLE_KEY || '', ready: !!env.STRIPE_SECRET_KEY,
  founders: founderOffer(user, r),
  sub: r && r.sub ? { status: r.status, interval: r.interval, amount: r.amount, founder: !!r.founder, periodEnd: r.period_end, cancelAtEnd: !!r.cancel_at_end, graceUntil: r.status === 'past_due' ? r.grace_until : null,
    card: r.card_last4 ? { brand: r.card_brand, last4: r.card_last4 } : null, pending: r.pending_key ? { interval: PRICES[r.pending_key] && PRICES[r.pending_key].interval, amount: PRICES[r.pending_key] && PRICES[r.pending_key].amount } : null } : null
});
export async function handleBilling(env, req, me, path, out, admin) {
  await ensureTable(env);
  if (path === '/auth/billing' && req.method === 'GET') return out(statusOut(env, me, await rowOf(env, me.id)));
  if (path === '/auth/billing/checkout' && req.method === 'POST') {
    const b = await req.json().catch(() => ({})), interval = b.plan === 'yearly' ? 'year' : 'month';
    let r = await rowOf(env, me.id);
    if (r && r.sub && ACTIVE(r.status)) return out({ error: 'You already have Premium.', have: true }, 409);
    const offer = founderOffer(me, r), key = keyFor(offer.eligible, interval), prices = await ensurePrices(env);
    let customer = r && r.customer;
    if (!customer) { customer = (await stripe(env, 'POST', '/customers', { email: me.email, name: me.name || undefined, metadata: { uid: me.id } })).id; r = await saveRow(env, me.id, { customer }); }
    const mk = cus => stripe(env, 'POST', '/checkout/sessions', {
      mode: 'subscription', ui_mode: 'embedded', customer: cus, client_reference_id: me.id, line_items: { 0: { price: prices[key], quantity: 1 } },
      subscription_data: { metadata: { uid: me.id, founder: PRICES[key].founder } }, metadata: { uid: me.id, plan: key },
      return_url: appUrl(env) + '/?checkout={CHECKOUT_SESSION_ID}', redirect_on_completion: 'if_required',
      automatic_tax: env.STRIPE_TAX === 'on' ? { enabled: true } : undefined, customer_update: env.STRIPE_TAX === 'on' ? { address: 'auto', name: 'auto' } : undefined,
      billing_address_collection: env.STRIPE_TAX === 'on' ? 'auto' : undefined
    });
    let s;
    try { s = await mk(customer); }
    catch (e) {   // the customer was deleted in Stripe (e.g. clearing a test card): start a fresh one
      if (!(e.stripe && e.stripe.code === 'resource_missing' && e.stripe.param === 'customer')) throw e;
      customer = (await stripe(env, 'POST', '/customers', { email: me.email, name: me.name || undefined, metadata: { uid: me.id } })).id;
      await saveRow(env, me.id, { customer, card_brand: null, card_last4: null }); s = await mk(customer);
    }
    return out({ clientSecret: s.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY || '', plan: key, amount: PRICES[key].amount, interval });
  }
  if (path === '/auth/billing/confirm' && req.method === 'POST') {
    // right after checkout: ask Stripe directly instead of waiting for the webhook, so Premium turns on at once
    const b = await req.json().catch(() => ({}));
    const s = /^cs_[\w]+$/.test(b.session || '') ? await stripe(env, 'GET', '/checkout/sessions/' + b.session) : null;
    if (s && s.client_reference_id === me.id && s.subscription) await syncSubscription(env, await getSub(env, s.subscription), me.id);
    const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(me.id).first();
    return out(statusOut(env, u || me, await rowOf(env, me.id)));
  }
  if (path === '/auth/billing/portal' && req.method === 'POST') {
    const r = await rowOf(env, me.id); if (!r || !r.customer) return out({ error: 'No billing account yet.' }, 404);
    const s = await stripe(env, 'POST', '/billing_portal/sessions', { customer: r.customer, configuration: await ensurePortal(env), return_url: appUrl(env) + '/?billing=back' });
    return out({ url: s.url });
  }
  if (path === '/auth/billing/switch' && req.method === 'POST') {
    const b = await req.json().catch(() => ({})), to = b.to === 'yearly' ? 'year' : 'month';
    const r = await rowOf(env, me.id); if (!r || !r.sub || !ACTIVE(r.status)) return out({ error: 'No active subscription.' }, 404);
    const sub = await getSub(env, r.sub), item = sub.items.data[0], prices = await ensurePrices(env), want = keyFor(!!r.founder, to);
    const schedId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule && sub.schedule.id;
    if (want === r.price_key) {   // back to what they have: drop any change waiting for the renewal
      if (schedId) await stripe(env, 'POST', '/subscription_schedules/' + schedId + '/release');
      return out(statusOut(env, me, await syncSubscription(env, await getSub(env, r.sub), me.id)));
    }
    const sched = schedId ? await stripe(env, 'GET', '/subscription_schedules/' + schedId) : await stripe(env, 'POST', '/subscription_schedules', { from_subscription: r.sub });
    const ph = sched.phases[0];
    await stripe(env, 'POST', '/subscription_schedules/' + sched.id, { end_behavior: 'release', proration_behavior: 'none',
      phases: { 0: { items: { 0: { price: item.price.id, quantity: 1 } }, start_date: ph.start_date, end_date: (item.current_period_end || sub.current_period_end), proration_behavior: 'none' },
                1: { items: { 0: { price: prices[want], quantity: 1 } }, duration: { interval: to, interval_count: 1 }, proration_behavior: 'none' } } });
    await saveRow(env, me.id, { pending_key: want, schedule: sched.id });
    return out(statusOut(env, me, await rowOf(env, me.id)));
  }
  // ---- admins: find people, give Premium ----
  if (path === '/auth/admin/people' && req.method === 'GET') {
    if (!admin) return out({ error: 'Admins only.' }, 403);
    const q = String(new URL(req.url).searchParams.get('q') || '').trim().toLowerCase().slice(0, 80);
    const sel = 'SELECT u.id,u.email,u.name,u.plan,u.created_at,b.gift,b.status,b.founder,b.interval FROM users u LEFT JOIN billing b ON b.user_id=u.id ';
    const rows = q.length >= 2 ? (await env.DB.prepare(sel + 'WHERE u.email LIKE ? ORDER BY u.created_at DESC LIMIT 20').bind('%' + q.replace(/[%_]/g, '') + '%').all()).results
      : (await env.DB.prepare(sel + 'WHERE b.gift=1 ORDER BY u.email LIMIT 100').all()).results;
    return out({ people: (rows || []).map(x => ({ id: x.id, email: x.email, name: x.name || '', plan: x.plan || 'free', joined: x.created_at, gift: !!x.gift, paying: !!(x.status && ACTIVE(x.status) && !x.gift), founderPrice: !!x.founder, founderEligible: (x.created_at || 0) < FOUNDER_JOIN_BEFORE, interval: x.interval || null })) });
  }
  if (path === '/auth/admin/people/gift' && req.method === 'POST') {
    if (!admin) return out({ error: 'Admins only.' }, 403);
    const b = await req.json().catch(() => ({})); if (!b.id) return out({ error: 'Missing id.' }, 400);
    const u = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(b.id).first(); if (!u) return out({ error: 'No such account.' }, 404);
    const r = await saveRow(env, b.id, { gift: b.on ? 1 : 0 });
    await env.DB.prepare('UPDATE users SET plan=? WHERE id=?').bind(planOf(r), b.id).run();
    return out({ ok: true, gift: !!r.gift, plan: planOf(r) });
  }
  return null;
}
