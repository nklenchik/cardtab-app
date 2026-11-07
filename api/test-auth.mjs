// Offline tests for sign-in, against a real SQLite database standing in for D1. Run: node test-auth.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [];
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'nklenchik@gmail.com, second@x.com', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec',
  EMAIL: { async send(m) { mails.push(m); } }, ART: { async get() { return null; } } };
const O = 'https://app.cardtab.app';
const call = (path, { method = 'GET', body, cookie, ip = '1.1.1.1' } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: O, 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }), env, {});
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];

// not signed in
let r = await call('/auth/me'); assert.equal(r.status, 401); assert.equal(r.headers.get('access-control-allow-credentials'), 'true'); assert.equal(r.headers.get('access-control-allow-origin'), O);
// bad email
assert.equal((await call('/auth/email/start', { method: 'POST', body: { email: 'nope' } })).status, 400);
// email link
r = await call('/auth/email/start', { method: 'POST', body: { email: ' NKlenchik@Gmail.com ', mode: 'in' } }); assert.equal(r.status, 200);
assert.equal(mails.length, 1); const m = mails[0]; assert.equal(m.to, 'nklenchik@gmail.com'); assert.equal(m.from.email, 'login@cardtab.app');
const token = /\?login=([\w-]+)/.exec(m.text)[1], code = /code in the app: (\d{6})/.exec(m.text)[1];
assert.ok(m.html.includes(code.slice(0, 3) + ' ' + code.slice(3)), 'html shows the code');
r = await call('/auth/email/verify', { method: 'POST', body: { token } }); assert.equal(r.status, 200);
let j = await r.json(); assert.equal(j.user.email, 'nklenchik@gmail.com'); assert.equal(j.user.role, 'admin'); assert.equal(j.isNew, true);
const sc = r.headers.get('set-cookie'); assert.match(sc, /ct_s=[\w-]{40,}; Domain=cardtab.app; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000/);
const c1 = cookieOf(r);
// link works once
assert.equal((await call('/auth/email/verify', { method: 'POST', body: { token } })).status, 400);
// me
r = await call('/auth/me', { cookie: c1 }); j = await r.json(); assert.equal(j.user.role, 'admin'); assert.equal(j.user.plan, 'free');
// admin plan switch
r = await call('/auth/plan', { method: 'POST', body: { plan: 'premium' }, cookie: c1 }); assert.equal((await r.json()).user.plan, 'premium');
// code path, for a normal person; wrong code counts
await call('/auth/email/start', { method: 'POST', body: { email: 'fan@x.com', mode: 'up' } });
const m2 = mails.at(-1); assert.match(m2.subject, /sign-up/); const code2 = /code in the app: (\d{6})/.exec(m2.text)[1];
r = await call('/auth/email/verify', { method: 'POST', body: { email: 'fan@x.com', code: code2 === '000000' ? '111111' : '000000' } }); assert.equal(r.status, 400);
r = await call('/auth/email/verify', { method: 'POST', body: { email: 'FAN@x.com', code: code2.slice(0, 3) + ' ' + code2.slice(3) } }); assert.equal(r.status, 200);
j = await r.json(); assert.equal(j.user.role, 'user'); const c2 = cookieOf(r);
assert.equal((await call('/auth/plan', { method: 'POST', body: { plan: 'premium' }, cookie: c2 })).status, 403, 'non-admins cannot switch plans');
// 5 wrong codes end it
await call('/auth/email/start', { method: 'POST', body: { email: 'guess@x.com' } });
const code3 = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1];
for (let i = 0; i < 5; i++) await call('/auth/email/verify', { method: 'POST', body: { email: 'guess@x.com', code: String((+code3 + 1 + i) % 1e6).padStart(6, '0') } });
assert.equal((await call('/auth/email/verify', { method: 'POST', body: { email: 'guess@x.com', code: code3 } })).status, 400, 'right code no longer works after 5 wrong ones');
// rate limit: 3 per address per 15 minutes
for (let i = 0; i < 3; i++) await call('/auth/email/start', { method: 'POST', body: { email: 'spam@x.com' }, ip: '9.9.9.' + i });
assert.equal((await call('/auth/email/start', { method: 'POST', body: { email: 'spam@x.com' }, ip: '9.9.9.9' })).status, 429);
// sign out of all devices ends every session for the account
{ const a = await call('/auth/logout-all', { method: 'POST' }); assert.equal(a.status, 401, 'logout-all needs a session');
  const signIn = async ip => { await call('/auth/email/start', { method: 'POST', body: { email: 'two@x.com' }, ip }); const c = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { email: 'two@x.com', code: c }, ip })); };
  const phone = await signIn('2.2.2.2'), laptop = await signIn('3.3.3.3');
  assert.equal((await call('/auth/me', { cookie: phone })).status, 200); assert.equal((await call('/auth/me', { cookie: laptop })).status, 200);
  const o2 = await call('/auth/logout-all', { method: 'POST', cookie: phone }); assert.equal(o2.status, 200); assert.match(o2.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await call('/auth/me', { cookie: phone })).status, 401, 'this device signed out');
  assert.equal((await call('/auth/me', { cookie: laptop })).status, 401, 'the other device signed out too');
  assert.equal((await call('/auth/me', { cookie: c2 })).status, 200, 'other accounts untouched'); }
// logout ends the session
assert.equal((await call('/auth/logout', { method: 'POST', cookie: c2 })).status, 200);
assert.equal((await call('/auth/me', { cookie: c2 })).status, 401);
// google start sets state and goes to Google with PKCE
r = await call('/auth/google/start?mode=up'); assert.equal(r.status, 302); const loc = r.headers.get('location');
assert.match(loc, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/); assert.match(loc, /code_challenge_method=S256/); assert.match(loc, /redirect_uri=https%3A%2F%2Fapi.cardtab.app%2Fauth%2Fgoogle%2Fcallback/);
const gck = cookieOf(r), state = new URL(loc).searchParams.get('state');
// google callback: wrong state is refused
r = await call('/auth/google/callback?code=x&state=bad', { cookie: gck }); assert.match(r.headers.get('location'), /signin_error=google/);
// google callback: right state, token exchange answered by a stand-in Google
const realFetch = globalThis.fetch; const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
globalThis.fetch = async (url, opt) => { assert.equal(String(url), 'https://oauth2.googleapis.com/token'); assert.match(String(opt.body), /code_verifier=/);
  return new Response(JSON.stringify({ id_token: 'h.' + b64({ aud: 'gid', iss: 'https://accounts.google.com', email: 'Nklenchik@gmail.com', email_verified: true, given_name: 'Nick', sub: 'g1', exp: Math.floor(Date.now() / 1000) + 600 }) + '.s' })); };
r = await call('/auth/google/callback?code=abc&state=' + state, { cookie: gck }); globalThis.fetch = realFetch;
assert.equal(r.status, 302); assert.match(r.headers.get('location'), /^https:\/\/app\.cardtab\.app\/\?signedin=google/);
const gc = (r.headers.get('set-cookie') || '').match(/ct_s=[\w-]+/)[0];
j = await (await call('/auth/me', { cookie: gc })).json(); assert.equal(j.user.email, 'nklenchik@gmail.com'); assert.equal(j.user.name, 'Nick'); assert.equal(j.user.plan, 'premium', 'same account as the email sign-in');
// card data readout: admins only
r = await call('/auth/usage', { cookie: gc }); assert.equal(r.status, 200); j = await r.json(); assert.equal(j.limit, 10000); assert.ok(j.resets);
// delete account
assert.equal((await call('/auth/delete', { method: 'POST', cookie: gc })).status, 200);
assert.equal((await call('/auth/me', { cookie: c1 })).status, 401, 'every session ends');
assert.equal(sq.prepare('SELECT COUNT(*) n FROM users WHERE email=?').get('nklenchik@gmail.com').n, 0);
// card lookups still work alongside
assert.equal((await call('/api/lookup')).status, 400);
console.log('auth tests ok:', mails.length, 'emails sent');
