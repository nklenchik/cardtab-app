// Offline tests for Premium billing (v50.63), with a pretend Stripe. Run: node test-billing.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { founderOffer, FOUNDER_JOIN_BEFORE, FOUNDER_UPGRADE_BY, verifyStripe } from './src/billing.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [], WH = 'whsec_test';
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'nklenchik@gmail.com', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: WH, STRIPE_PUBLISHABLE_KEY: 'pk_test_x', STRIPE_TAX: 'off',
  EMAIL: { async send(m) { mails.push(m); } }, ART: { async get() { return null; } } };
const O = 'https://app.cardtab.app';
const call = (path, { method = 'GET', body, cookie, headers = {}, raw } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: O, 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.1', ...(cookie ? { cookie } : {}), ...headers }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
async function signIn(email) {
  await call('/auth/email/start', { method: 'POST', body: { email, mode: 'in' } }); const m = mails[mails.length - 1];
  const token = /\?login=([\w-]+)/.exec(m.text)[1]; const r = await call('/auth/email/verify', { method: 'POST', body: { token } });
  return (r.headers.get('set-cookie') || '').split(';')[0];
}

// ---- a pretend Stripe ----
const S = { prices: [], products: [], customers: [], sessions: {}, subs: {}, scheds: {}, calls: [], n: 0 };
const id = p => p + '_' + (++S.n);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  url = String(url); if (!url.startsWith('https://api.stripe.com/v1')) return realFetch(url, init);
  const u = new URL(url), path = u.pathname.replace('/v1', ''), m = init.method || 'GET', f = new URLSearchParams(init.body || ''), q = u.searchParams;
  S.calls.push(m + ' ' + path); const ok = o => new Response(JSON.stringify(o), { status: 200 });
  if (m === 'GET' && path === '/prices') { const want = q.getAll('lookup_keys[0]').concat([1, 2, 3].flatMap(i => q.getAll('lookup_keys[' + i + ']'))); return ok({ data: S.prices.filter(p => want.includes(p.lookup_key)) }); }
  if (path === '/products/search') return ok({ data: S.products });
  if (m === 'POST' && path === '/products') { const p = { id: id('prod'), metadata: { ct: f.get('metadata[ct]') } }; S.products.push(p); return ok(p); }
  if (m === 'POST' && path === '/prices') { const p = { id: id('price'), lookup_key: f.get('lookup_key'), unit_amount: +f.get('unit_amount'), recurring: { interval: f.get('recurring[interval]') }, metadata: { ct: f.get('metadata[ct]') } }; S.prices.push(p); return ok(p); }
  if (m === 'DELETE' && path.startsWith('/customers/')) { if (S.failDelete) return new Response(JSON.stringify({ error: { message: 'down' } }), { status: 500 }); S.deleted = (S.deleted || []).concat(path.slice(11)); return ok({ deleted: true }); }
  if (m === 'POST' && path === '/customers') { const c = { id: id('cus'), email: f.get('email') }; S.customers.push(c); return ok(c); }
  if (m === 'POST' && path === '/checkout/sessions' && S.gone && f.get('customer') === S.gone) return new Response(JSON.stringify({ error: { code: 'resource_missing', param: 'customer', message: 'No such customer' } }), { status: 400 });
  if (m === 'POST' && path === '/checkout/sessions') { const s = { id: id('cs_test'), client_secret: 'secret_' + S.n, price: f.get('line_items[0][price]'), customer: f.get('customer'), client_reference_id: f.get('client_reference_id'), tax: f.get('automatic_tax[enabled]'), mode: 'subscription' }; S.sessions[s.id] = s; return ok(s); }
  let mm;
  if (m === 'GET' && (mm = path.match(/^\/checkout\/sessions\/(.+)$/))) return ok(S.sessions[mm[1]]);
  if (m === 'GET' && (mm = path.match(/^\/subscriptions\/(.+)$/))) return ok(S.subs[mm[1]]);
  if (m === 'POST' && path === '/subscription_schedules') { const sc = { id: id('sub_sched'), phases: [{ start_date: 1000 }] }; S.scheds[sc.id] = sc; S.subs[f.get('from_subscription')].schedule = sc.id; return ok(sc); }
  if ((mm = path.match(/^\/subscription_schedules\/([^/]+)(\/release)?$/))) { const sc = S.scheds[mm[1]]; if (mm[2]) { Object.values(S.subs).forEach(s => { if (s.schedule === sc.id) s.schedule = null; }); } else if (m === 'POST') sc.next = f.get('phases[1][items][0][price]'); return ok(sc); }
  if (path === '/billing_portal/configurations') return ok(m === 'GET' ? { data: [] } : { id: 'bpc_1' });
  if (path === '/billing_portal/sessions') return ok({ url: 'https://billing.stripe.com/p/session_x', cfg: f.get('configuration') });
  return new Response(JSON.stringify({ error: { message: 'unknown ' + m + ' ' + path } }), { status: 400 });
};
const priceBy = lk => S.prices.find(p => p.lookup_key === lk);
async function hook(type, object, secret = WH) {
  const body = JSON.stringify({ type, data: { object } }), t = Math.floor(Date.now() / 1000);
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(t + '.' + body)))].map(b => b.toString(16).padStart(2, '0')).join('');
  return call('/stripe/webhook', { method: 'POST', raw: body, headers: { 'stripe-signature': 't=' + t + ',v1=' + sig } });
}
const planOf = email => sq.prepare('SELECT plan FROM users WHERE email=?').get(email).plan;

// founders rule, by date
assert.ok(founderOffer({ created_at: FOUNDER_JOIN_BEFORE - 1 }, null, FOUNDER_UPGRADE_BY - 1).eligible, 'joined Dec 31, upgrades Jan 31');
assert.ok(!founderOffer({ created_at: FOUNDER_JOIN_BEFORE + 1 }, null, FOUNDER_JOIN_BEFORE + 10).eligible, 'joined Jan 1');
assert.ok(!founderOffer({ created_at: FOUNDER_JOIN_BEFORE - 1 }, null, FOUNDER_UPGRADE_BY + 1).eligible, 'joined early, upgrades Feb 1');
assert.equal(new Date(FOUNDER_UPGRADE_BY * 1000).toISOString(), '2027-02-01T05:00:00.000Z');

const cf = await signIn('friend@x.com'), ca = await signIn('nklenchik@gmail.com');
// status before paying
let j = await (await call('/auth/billing', { cookie: cf })).json();
assert.equal(j.plan, 'free'); assert.equal(j.founders.eligible, true); assert.equal(j.sub, null); assert.equal(j.publishableKey, 'pk_test_x');
// checkout (founders, monthly): prices are made once
// before launch (BILLING_OPEN off): people see when Premium opens and can't check out; admins still can
env.BILLING_OPEN = 'off'; env.BILLING_OPENS = 'Dec 1';
j = await (await call('/auth/billing', { cookie: cf })).json(); assert.equal(j.open, false); assert.equal(j.opens, 'Dec 1');
let r = await call('/auth/billing/checkout', { method: 'POST', cookie: cf, body: { plan: 'monthly' } }); assert.equal(r.status, 403); assert.equal((await r.json()).closed, true);
j = await (await call('/auth/billing', { cookie: ca })).json(); assert.equal(j.open, true, 'admins can still test');
env.BILLING_OPEN = 'on';
r = await call('/auth/billing/checkout', { method: 'POST', cookie: cf, body: { plan: 'monthly' } }); j = await r.json();
assert.equal(r.status, 200, JSON.stringify(j)); assert.ok(j.clientSecret); assert.equal(j.plan, 'fm5'); assert.equal(j.amount, 500);
assert.equal(S.prices.length, 4); assert.equal(S.products.length, 1); assert.equal(S.customers.length, 1);
const sess = Object.values(S.sessions)[0]; assert.equal(sess.price, priceBy('ct_fm5').id); assert.equal(sess.tax, null, 'no tax until it is switched on');
r = await call('/auth/billing/checkout', { method: 'POST', cookie: cf, body: { plan: 'yearly' } }); j = await r.json();
assert.equal(j.plan, 'fy50'); assert.equal(S.prices.length, 4, 'prices reused'); assert.equal(S.customers.length, 1, 'same customer');
// Stripe finishes the checkout: the webhook turns Premium on
const uid = sq.prepare("SELECT id FROM users WHERE email='friend@x.com'").get().id, P = Math.floor(Date.now() / 1000) + 30 * 86400;
S.subs.sub_A = { id: 'sub_A', customer: sess.customer, status: 'active', cancel_at_period_end: false, metadata: { uid }, items: { data: [{ current_period_end: P, price: priceBy('ct_fm5') }] }, default_payment_method: { card: { brand: 'visa', last4: '4242' } } };
assert.equal((await hook('checkout.session.completed', { mode: 'subscription', subscription: 'sub_A', customer: sess.customer, client_reference_id: uid }, 'wrong')).status, 400, 'bad signature refused');
assert.equal(planOf('friend@x.com'), 'free');
// v50.95 copy test: the Premium sheet copy they saw last gets the credit for the purchase
sq.prepare('INSERT INTO an_copy (uid,last,last_day) VALUES (?,?,?)').run(uid, 'b2:1.4.6.7.9.16', '2026-11-10');
assert.equal((await hook('checkout.session.completed', { mode: 'subscription', subscription: 'sub_A', customer: sess.customer, client_reference_id: uid })).status, 200);
assert.equal(planOf('friend@x.com'), 'premium');
{ const c = sq.prepare('SELECT buy, buy_iv, buy_day FROM an_copy WHERE uid=?').get(uid); assert.equal(c.buy, 'b2:1.4.6.7.9.16'); assert.equal(c.buy_iv, 'month'); assert.ok(c.buy_day); }
j = await (await call('/auth/billing', { cookie: cf })).json();
assert.equal(j.sub.founder, true); assert.equal(j.sub.amount, 500); assert.equal(j.sub.interval, 'month'); assert.deepEqual(j.sub.card, { brand: 'visa', last4: '4242' }); assert.equal(j.sub.periodEnd, P);
assert.equal((await call('/auth/billing/checkout', { method: 'POST', cookie: cf, body: { plan: 'monthly' } })).status, 409, 'no second subscription');
// confirm right after checkout (no waiting on the webhook)
sess.subscription = 'sub_A'; j = await (await call('/auth/billing/confirm', { method: 'POST', cookie: cf, body: { session: sess.id } })).json(); assert.equal(j.plan, 'premium');
// switch to yearly at renewal: stays on the founders price
j = await (await call('/auth/billing/switch', { method: 'POST', cookie: cf, body: { to: 'yearly' } })).json();
assert.equal(j.sub.pending.interval, 'year'); assert.equal(j.sub.pending.amount, 5000);
assert.equal(Object.values(S.scheds)[0].next, priceBy('ct_fy50').id);
j = await (await call('/auth/billing/switch', { method: 'POST', cookie: cf, body: { to: 'monthly' } })).json(); assert.equal(j.sub.pending, null, 'switching back drops the change');
// billing page link
j = await (await call('/auth/billing/portal', { method: 'POST', cookie: cf })).json(); assert.match(j.url, /^https:\/\/billing\.stripe\.com\//);
// a failed payment: 7 days of Premium, then off
S.subs.sub_A.status = 'past_due';
await hook('invoice.payment_failed', { subscription: 'sub_A' });
j = await (await call('/auth/billing', { cookie: cf })).json();
assert.equal(j.plan, 'premium', 'still Premium during the grace period'); assert.ok(j.sub.graceUntil > Date.now() / 1000 + 6 * 86400);
// the payment emails: one when it fails, one reminder near the end, never repeated
const pay = () => mails.filter(x => /payment didn't go through|Premium ends/.test(x.subject));
assert.equal(pay().length, 1); assert.equal(pay()[0].to, 'friend@x.com'); assert.match(pay()[0].text, /\?billing=fix/); assert.equal(pay()[0].replyTo, 'hello@cardtab.app');
await hook('invoice.payment_failed', { subscription: 'sub_A' }); assert.equal(pay().length, 1, 'a retry failing again sends nothing new');
await worker.scheduled({ cron: '17 8 * * *' }, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 50)); assert.equal(pay().length, 1, 'no reminder with 7 days left');
sq.prepare('UPDATE billing SET grace_until=? WHERE user_id=?').run(Math.floor(Date.now() / 1000) + 86400, uid);
await worker.scheduled({ cron: '17 8 * * *' }, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 50));
assert.equal(pay().length, 2); assert.match(pay()[1].subject, /Premium ends/);
await worker.scheduled({ cron: '17 8 * * *' }, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 50)); assert.equal(pay().length, 2, 'one reminder only');
sq.prepare('UPDATE billing SET grace_until=? WHERE user_id=?').run(Math.floor(Date.now() / 1000) - 10, uid);
await worker.scheduled({ cron: '17 8 * * *' }, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 50));
assert.equal(planOf('friend@x.com'), 'free', 'off after 7 days');
// card fixed: back on
S.subs.sub_A.status = 'active'; await hook('invoice.paid', { subscription: 'sub_A' });
assert.equal(planOf('friend@x.com'), 'premium');
j = await (await call('/auth/billing', { cookie: cf })).json(); assert.equal(j.sub.graceUntil, null);
// cancelled for good: free, and the founders price is gone with it
S.subs.sub_A.status = 'canceled'; await hook('customer.subscription.deleted', S.subs.sub_A);
assert.equal(planOf('friend@x.com'), 'free'); j = await (await call('/auth/billing', { cookie: cf })).json(); assert.equal(j.sub, null);
// joined after New Year: regular price
sq.prepare('UPDATE users SET created_at=? WHERE id=?').run(FOUNDER_JOIN_BEFORE + 100, uid);
j = await (await call('/auth/billing/checkout', { method: 'POST', cookie: cf, body: { plan: 'monthly' } })).json(); assert.equal(j.plan, 'm8'); assert.equal(j.amount, 800);
// a customer deleted in Stripe (clearing a test card): checkout starts a fresh one
S.gone = sq.prepare('SELECT customer FROM billing WHERE user_id=?').get(uid).customer; const nC = S.customers.length;
r = await call('/auth/billing/checkout', { method: 'POST', cookie: cf, body: { plan: 'monthly' } }); assert.equal(r.status, 200); assert.equal(S.customers.length, nC + 1); assert.notEqual(sq.prepare('SELECT customer FROM billing WHERE user_id=?').get(uid).customer, S.gone);
// admins: find people and give Premium
assert.equal((await call('/auth/admin/people?q=friend', { cookie: cf })).status, 403, 'admins only');
j = await (await call('/auth/admin/people?q=frie', { cookie: ca })).json(); assert.equal(j.people.length, 1); assert.equal(j.people[0].email, 'friend@x.com'); assert.equal(j.people[0].plan, 'free');
j = await (await call('/auth/admin/people/gift', { method: 'POST', cookie: ca, body: { id: uid, on: true } })).json(); assert.equal(j.plan, 'premium');
assert.equal(planOf('friend@x.com'), 'premium');
j = await (await call('/auth/billing', { cookie: cf })).json(); assert.equal(j.gift, true);
j = await (await call('/auth/admin/people', { cookie: ca })).json(); assert.equal(j.people.length, 1, 'empty search lists gifts'); assert.equal(j.people[0].gift, true);
j = await (await call('/auth/admin/people/gift', { method: 'POST', cookie: ca, body: { id: uid, on: false } })).json(); assert.equal(j.plan, 'free');
// deleting the account cancels Premium (the Stripe customer goes, so no more charges); if Stripe is down, nothing is deleted
const cus = sq.prepare('SELECT customer FROM billing WHERE user_id=?').get(uid).customer; assert.ok(cus);
S.failDelete = true; r = await call('/auth/delete', { method: 'POST', cookie: cf }); assert.equal(r.status, 502, 'Stripe down: account kept');
assert.ok(sq.prepare('SELECT 1 FROM users WHERE id=?').get(uid), 'user still there'); S.failDelete = false;
r = await call('/auth/delete', { method: 'POST', cookie: cf }); assert.equal(r.status, 200);
assert.deepEqual(S.deleted, [cus], 'Stripe customer deleted'); assert.equal(sq.prepare('SELECT COUNT(*) n FROM billing WHERE user_id=?').get(uid).n, 0, 'billing row gone');
// signature check alone
assert.equal(await verifyStripe('s', 't=1,v1=00', 'x', 1), false);
console.log('billing tests ok:', S.calls.length, 'Stripe calls');

// v51.5: paid upgrades and moves back to Free are logged for the daily check (gifts are not)
{ const ev = sq.prepare("SELECT kind, COUNT(*) n FROM plan_ev GROUP BY kind").all(); console.log("plan changes logged:", JSON.stringify(ev)); assert.ok(ev.some(e => e.kind === "up"), "a paid upgrade is logged"); }

// v52.64 the publishable key follows the secret key's mode
{ const { pubKey, isLive } = await import('./src/billing.js');
  const assert = (await import('node:assert')).default;
  assert.equal(pubKey({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_a', STRIPE_PUBLISHABLE_KEY_LIVE: 'pk_live_b' }), 'pk_test_a');
  assert.equal(pubKey({ STRIPE_SECRET_KEY: 'rk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_a', STRIPE_PUBLISHABLE_KEY_LIVE: 'pk_live_b' }), 'pk_live_b');
  assert.equal(pubKey({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_a' }), '');   // live secret, no live key yet: not ready
  assert.ok(isLive({ STRIPE_SECRET_KEY: 'sk_live_1' }) && !isLive({ STRIPE_SECRET_KEY: 'sk_test_1' }));
  console.log('publishable key checks ok'); }

// v52.65 after the switch to live keys, test-mode billing rows are ignored (gifts kept)
{ const { rowOf, saveRow, modeOf } = await import('./src/billing.js');
  const assert = (await import('node:assert')).default;
  const testEnv = Object.assign({}, env, { STRIPE_SECRET_KEY: 'sk_test_x' }), liveEnv = Object.assign({}, env, { STRIPE_SECRET_KEY: 'sk_live_x' });
  await saveRow(testEnv, 'modeu', { customer: 'cus_T', sub: 'sub_T', status: 'active', gift: 0 });
  assert.equal((await rowOf(testEnv, 'modeu')).sub, 'sub_T');
  const L = await rowOf(liveEnv, 'modeu'); assert.equal(L.sub, null); assert.equal(L.customer, null);
  await saveRow(testEnv, 'modeg', { customer: 'cus_G', gift: 1 }); assert.equal((await rowOf(liveEnv, 'modeg')).gift, 1);
  await saveRow(liveEnv, 'modeu', { customer: 'cus_L' }); assert.equal((await rowOf(liveEnv, 'modeu')).customer, 'cus_L'); assert.equal(modeOf(liveEnv), 'live');
  console.log('test/live mode checks ok'); }

// v52.67 Premium opens by itself at midnight Eastern on Dec 1, only with the live key
{ const { isOpen } = await import('./src/billing.js'); const assert = (await import('node:assert')).default;
  const at = '2026-12-01T00:00:00-05:00', t0 = Date.parse(at);
  assert.equal(isOpen({ BILLING_OPEN: 'off', BILLING_OPEN_AT: at, STRIPE_SECRET_KEY: 'rk_live_x' }, t0 - 1000), false, 'not yet');
  assert.equal(isOpen({ BILLING_OPEN: 'off', BILLING_OPEN_AT: at, STRIPE_SECRET_KEY: 'rk_live_x' }, t0), true, 'midnight');
  assert.equal(isOpen({ BILLING_OPEN: 'off', BILLING_OPEN_AT: at, STRIPE_SECRET_KEY: 'sk_test_x' }, t0 + 1000), false, 'not with a test key');
  assert.equal(isOpen({ BILLING_OPEN: 'on', STRIPE_SECRET_KEY: 'sk_test_x' }), true, 'on means on');
  console.log('opening time checks ok'); }
