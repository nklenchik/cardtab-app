// Admin alerts (v52.31): raise/dedupe/done, admins only, feedback and photo review raise and resolve, hourly checks for
// JustTCG, Ask and error spikes (with one email each, capped), health results. Run: node test-alerts.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { raiseAlert, resolveAlert, openAlerts, alertChecks, alertsFromHealth } from './src/alerts.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { const r = sq.prepare(sql).run(...o.args); return { meta: { changes: r.changes } }; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [];
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } } };
const call = (path, { method = 'GET', body, cookie } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: 'https://app.cardtab.app', 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.' + Math.floor(Math.random() * 200), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email) { mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email } });
  const tok = /\?login=([\w-]+)/.exec(mails.find(m => m.to === email).text)[1]; const r = await call('/auth/email/verify', { method: 'POST', body: { token: tok } }); return cookieOf(r); }
const boss = await signIn('boss@x.com'), fan = await signIn('fan@x.com');
const list = async () => (await (await call('/auth/admin/alerts', { cookie: boss })).json());

// admins only
assert.equal((await call('/auth/admin/alerts', { cookie: fan })).status, 403);
assert.equal((await list()).items.length, 0);

// feedback raises a "waiting on you" alert; marking it handled closes it
await call('/auth/feedback', { method: 'POST', body: { kind: 'bug', msg: 'Board froze when I added a card', page: 'Board' }, cookie: fan });
let L = await list(); assert.equal(L.you, 1); assert.equal(L.now, 0);
const fb = L.items[0]; assert.match(fb.title, /New bug report: “Board froze/); assert.match(fb.go, /^feedback:/);
const fid = fb.go.split(':')[1];
await call('/auth/admin/feedback/act', { method: 'POST', body: { id: fid, act: 'handled' }, cookie: boss });
assert.equal((await list()).items.length, 0, 'handled feedback closes its alert');

// dedupe: raising the same key while open updates it; done clears it; raising again brings a new one
mails.length = 0;
const a1 = await raiseAlert(env, { key: 'x:1', grp: 'now', kind: 'r', title: 'Thing broke', sub: 'first', go: 'health', mail: true });
const a2 = await raiseAlert(env, { key: 'x:1', grp: 'now', kind: 'r', title: 'Thing broke', sub: 'second', go: 'health', mail: true });
assert.equal(a1.fresh, true); assert.equal(a2.fresh, false); assert.equal(a1.id, a2.id);
assert.equal(mails.length, 1, 'one email for a new urgent alert, none for updates');
L = await list(); assert.equal(L.items.length, 1); assert.equal(L.items[0].sub, 'second'); assert.equal(L.items[0].n, 2);
assert.equal((await call('/auth/admin/alerts/done', { method: 'POST', body: { id: a1.id }, cookie: fan })).status, 403);
const d = await (await call('/auth/admin/alerts/done', { method: 'POST', body: { id: a1.id }, cookie: boss })).json(); assert.equal(d.changed, 1);
assert.equal((await list()).items.length, 0);
const a3 = await raiseAlert(env, { key: 'x:1', grp: 'now', kind: 'r', title: 'Thing broke', go: 'health' }); assert.equal(a3.fresh, true); assert.notEqual(a3.id, a1.id);
await resolveAlert(env, 'x:1'); assert.equal((await openAlerts(env)).length, 0);

// "waiting on you" never emails
mails.length = 0; await raiseAlert(env, { key: 'y:1', grp: 'you', title: 'Review', mail: true }); assert.equal(mails.length, 0); await resolveAlert(env, 'y:1');

// hourly checks: JustTCG (catalog fill not counted), Ask, errors
const T = Date.UTC(2026, 10, 20, 15, 30), day = new Date(T).toISOString().slice(0, 10);
sq.prepare("INSERT INTO usage (day,src,plan,calls,reqs) VALUES (?,?,?,?,?)").run(day, 'type', 'free', 8200, 8200);
sq.prepare("INSERT INTO usage (day,src,plan,calls,reqs) VALUES (?,?,?,?,?)").run(day, 'cat', 'none', 1500, 1500);
sq.prepare("INSERT INTO ask_spend (month,tin,tout,n) VALUES (?,?,?,?)").run('2026-11', 50e6, 32e6, 400);   // $5 + $16 = $21 of $25 = 84%
for (let i = 1; i <= 7; i++) sq.prepare("INSERT INTO an_day (day,ev,dim,plan,dev,n) VALUES (?,?,?,?,?,?)").run(new Date(T - i * 864e5).toISOString().slice(0, 10), 'error', 'TypeError main.js', 'free', 'phone', 4);
sq.prepare("INSERT INTO an_day (day,ev,dim,plan,dev,n) VALUES (?,?,?,?,?,?)").run(day, 'error', 'TypeError board.js', 'free', 'phone', 40);
mails.length = 0;
let c = await alertChecks(env, T); assert.equal(c.jt, 82); assert.equal(c.ask, 84); assert.equal(c.err, 40);
L = await list(); const keys = L.items.map(x => x.key).sort();
assert.deepEqual(keys, ['ask80:2026-11', 'err:' + day, 'jt80:2026-11-06']);
assert.equal(mails.length, 3, 'one email each');
assert.ok(L.items.every(x => x.grp === 'now'));
assert.deepEqual(await alertChecks(env, T + 60e3), { skipped: true }, 'once an hour');
sq.prepare("UPDATE usage SET calls=9600 WHERE src='type'").run();
await alertChecks(env, T + 3600e3);
L = await list(); assert.ok(L.items.some(x => x.key === 'jt95:2026-11-06' && x.kind === 'r')); assert.ok(!L.items.some(x => x.key === 'jt80:2026-11-06'), '95% replaces the 80% alert');

// health results: failures and look-ats become alerts, passes don't, no extra email
mails.length = 0;
await alertsFromHealth(env, [{ key: 'stripe', name: 'Payments (Stripe) key works', ok: false, note: 'Stripe refused the key (401)' }, { key: 'db', name: 'Database', ok: true }, { key: 'email', name: 'Sign-in emails can send', ok: true, warn: true, note: 'domain pending' }]);
L = await list(); assert.ok(L.items.some(x => x.key === 'health:stripe' && x.title === 'Payments (Stripe) key works failed' && x.kind === 'r'));
assert.ok(L.items.some(x => x.key === 'health:email' && x.kind === 'w')); assert.ok(!L.items.some(x => x.key === 'health:db')); assert.equal(mails.length, 0);

// email cap: at most 8 alert emails a day
mails.length = 0; for (let i = 0; i < 12; i++) await raiseAlert(env, { key: 'cap:' + i, grp: 'now', title: 'n' + i, mail: true });
assert.ok(mails.length <= 8, 'capped at 8, got ' + mails.length);
console.log('alerts: all passed');
