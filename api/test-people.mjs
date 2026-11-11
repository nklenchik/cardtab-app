// Admin account tools (v52.8): details, gift with an end date, extra entries, Ask reset, sign out, email change, share off,
// uploads off, pause (blocks sign-in), export, delete. Real SQLite standing in for D1. Run: node test-people.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { giftSweep, device } from './src/people.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [];
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } },
  ART: { async get() { return null; }, async list() { return { objects: [], truncated: false }; }, async delete() {} } };
const O = 'https://app.cardtab.app';
const call = (path, { method = 'GET', body, cookie } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: O, 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.' + Math.floor(Math.random() * 200), 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email) {
  mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email } });
  const tok = /\?login=([\w-]+)/.exec(mails.find(m => m.to === email).text)[1];
  const r = await call('/auth/email/verify', { method: 'POST', body: { token: tok } }); return { r, c: cookieOf(r), j: await r.json() };
}
const boss = await signIn('boss@x.com'), fan = await signIn('fan@x.com'), fid = fan.j.user.id;
const act = (body) => call('/auth/admin/people/act', { method: 'POST', body, cookie: boss.c });
const one = async () => (await (await call('/auth/admin/people/one?id=' + fid, { cookie: boss.c })).json()).person;

// admins only
assert.equal((await call('/auth/admin/people/one?id=' + fid, { cookie: fan.c })).status, 403);
assert.equal((await call('/auth/admin/people/act', { method: 'POST', body: { id: fid, act: 'signout' }, cookie: fan.c })).status, 403);

// details: counts and dates, a device
const m = new Date().toISOString().slice(0, 7);
sq.prepare("INSERT INTO entries (user_id,id,data,updated_at,deleted,seq) VALUES (?,?,?,?,0,1),(?,?,?,?,0,2),(?,?,?,?,1,3)").run(fid, 'a', JSON.stringify({ createdAt: m + '-02T10:00:00Z', name: 'X' }), 'x', fid, 'b', JSON.stringify({ createdAt: '2025-01-01T00:00:00Z' }), 'x', fid, 'c', JSON.stringify({ createdAt: m + '-03' }), 'x');
sq.prepare("INSERT INTO ask_usage (user_id,month,n) VALUES (?,?,4)").run(fid, m);
let p = await one();
assert.equal(p.email, 'fan@x.com'); assert.equal(p.plan, 'free'); assert.equal(p.via, 'Email');
assert.deepEqual([p.month.entries, p.month.limit, p.month.ask, p.month.askLimit, p.totals.entries], [1, 20, 4, 5, 2]);
assert.equal(p.devices.length, 1); assert.equal(p.devices[0].name, 'iPhone · Safari'); assert.ok(!JSON.stringify(p).includes('"X"'), 'no card names in details');

// gift for 30 days, then it ends on its own
let r = await act({ id: fid, act: 'gift', on: true, days: 30 }); p = (await r.json()).person;
assert.equal(p.plan, 'premium'); assert.ok(p.gift && p.giftUntil > Date.now() / 1000 + 29 * 86400);
assert.equal(sq.prepare('SELECT plan FROM users WHERE id=?').get(fid).plan, 'premium');
sq.prepare('UPDATE acct SET gift_until=? WHERE user_id=?').run(Math.floor(Date.now() / 1000) - 5, fid);
assert.equal(await giftSweep(env), 1); p = await one(); assert.equal(p.plan, 'free'); assert.equal(p.gift, false);
assert.ok(p.history.some(h => /Gift ended/.test(h.what)) && p.history.some(h => /for 30 days/.test(h.what)), 'history');
// a gift with no end date stays
await act({ id: fid, act: 'gift', on: true }); await giftSweep(env); assert.equal((await one()).plan, 'premium'); await act({ id: fid, act: 'gift', on: false });

// 20 more entries: shows up for the app in /auth/me
await act({ id: fid, act: 'entries' }); await act({ id: fid, act: 'entries' });
p = await one(); assert.equal(p.month.limit, 60); assert.equal(p.month.bonus, 40);
let me = await (await call('/auth/me', { cookie: fan.c })).json(); assert.deepEqual(me.user.bonus, { m, n: 40 });
// exact numbers: 50 extra entries, then 0 takes them away; extra Ask questions raise the limit Ask itself uses
await act({ id: fid, act: 'entries', n: 50 }); assert.equal((await one()).month.limit, 70);
await act({ id: fid, act: 'entries', n: 0 }); assert.equal((await one()).month.limit, 20);
me = await (await call('/auth/me', { cookie: fan.c })).json(); assert.equal(me.user.bonus, null);
await act({ id: fid, act: 'askmore', n: 10 }); p = await one(); assert.equal(p.month.askLimit, 15); assert.equal(p.month.askBonus, 10);
env.ANTHROPIC_API_KEY = 'k'; let ai = await (await call('/auth/ask', { method: 'POST', body: { check: true }, cookie: fan.c })).json(); assert.equal(ai.limit, 15); assert.equal(ai.left, 11);
await act({ id: fid, act: 'askmore', n: 0 }); ai = await (await call('/auth/ask', { method: 'POST', body: { check: true }, cookie: fan.c })).json(); assert.equal(ai.limit, 5);
// Ask reset
await act({ id: fid, act: 'ask' }); assert.equal((await one()).month.ask, 0);

// email change: checked, unique, then sign-in works with the new one
assert.equal((await act({ id: fid, act: 'email', email: 'nope' })).status, 400);
assert.equal((await act({ id: fid, act: 'email', email: 'boss@x.com' })).status, 400);
r = await act({ id: fid, act: 'email', email: ' New@X.com ' }); assert.equal(r.status, 200); assert.equal((await r.json()).person.email, 'new@x.com');
const again = await signIn('new@x.com'); assert.equal(again.j.user.id, fid, 'same account, new email');

// shared board off
sq.prepare("INSERT INTO shares (id,uid,html,live,created,updated) VALUES ('s1',?, '<p>', 1, 1, 1)").run(fid);
assert.equal((await one()).share.live, true); await act({ id: fid, act: 'share' }); assert.equal((await one()).share.live, false);

// uploads off: the upload is refused
await act({ id: fid, act: 'uploads', on: false }); assert.equal((await one()).uploadsOff, true);
r = await worker.fetch(new Request('https://api.cardtab.app/api/art/upload', { method: 'POST', headers: { origin: O, cookie: again.c }, body: new FormData() }), env, { waitUntil() {} });
assert.equal(r.status, 403); await act({ id: fid, act: 'uploads', on: true });

// sign out everywhere
r = await act({ id: fid, act: 'signout' }); assert.equal((await r.json()).person.devices.length, 0);
assert.equal((await call('/auth/me', { cookie: again.c })).status, 401);

// pause: can't sign in (email or Google), unpause and it works
await act({ id: fid, act: 'suspend', on: true });
mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email: 'new@x.com' } });
const tk = /\?login=([\w-]+)/.exec(mails[0].text)[1]; r = await call('/auth/email/verify', { method: 'POST', body: { token: tk } });
assert.equal(r.status, 403); assert.match((await r.json()).error, /paused/); assert.ok(!r.headers.get('set-cookie'));
await act({ id: fid, act: 'suspend', on: false }); assert.equal((await signIn('new@x.com')).r.status, 200);

// export: their entries and settings
r = await act({ id: fid, act: 'export' }); const ex = (await r.json()).data;
assert.equal(ex.account.email, 'new@x.com'); assert.equal(ex.entries.length, 2);

// delete: refused while paying, then removes everything
sq.prepare("INSERT OR REPLACE INTO billing (user_id,customer,status,gift) VALUES (?,?,?,0)").run(fid, 'cus_1', 'active');
r = await act({ id: fid, act: 'delete' }); assert.equal(r.status, 400); assert.match((await r.json()).error, /Cancel it in Stripe/);
sq.prepare("UPDATE billing SET status='canceled' WHERE user_id=?").run(fid);
r = await act({ id: fid, act: 'delete' }); assert.equal((await r.json()).deleted, true);
for (const [t, c] of [['users', 'id'], ['entries', 'user_id'], ['sessions', 'user_id'], ['shares', 'uid'], ['acct', 'user_id'], ['ask_usage', 'user_id']]) assert.equal(sq.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${c}=?`).get(fid).n, 0, t);
assert.equal((await call('/auth/admin/people/one?id=' + fid, { cookie: boss.c })).status, 404);

assert.equal(device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36'), 'Mac · Chrome');
assert.equal(device('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36'), 'Android · Chrome');
console.log('people tests ok');
