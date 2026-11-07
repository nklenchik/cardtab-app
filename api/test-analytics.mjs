// Offline tests for analytics (v50), against a real SQLite database standing in for D1. Run: node test-analytics.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [];
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } }, ART: { async get() { return null; } } };
const O = 'https://app.cardtab.app';
const call = (path, { method = 'GET', body, cookie, ip = '1.1.1.1' } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: O, 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, {});
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email, ip) { await call('/auth/email/start', { method: 'POST', body: { email }, ip }); const c = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { email, code: c }, ip })); }

const a = await signIn('fan@x.com', '2.2.2.2'), b = await signIn('pal@x.com', '3.3.3.3'), boss = await signIn('boss@x.com', '4.4.4.4');
assert.equal((await call('/auth/ev', { method: 'POST', body: { ev: [] } })).status, 401, 'needs sign-in');
// counts add up into one row per day per count; junk names and text are dropped or cleaned
let r = await call('/auth/ev', { method: 'POST', cookie: a, body: { dev: 'phone', secs: 120, ev: [{ e: 'widget_add', d: 'featured' }, { e: 'widget_add', d: 'featured' }, { e: 'page_time', d: 'board', v: 42 }, { e: 'BAD NAME', d: 'x' }, { e: 'theme', d: '<script>Neon' }] } });
assert.equal(r.status, 200);
await call('/auth/ev', { method: 'POST', cookie: b, body: { dev: 'desk', secs: 60, ev: [{ e: 'widget_add', d: 'featured' }, { e: 'story_play', d: 'top win' }] } });
await call('/auth/ev', { method: 'POST', cookie: a, body: { dev: 'phone', secs: 30, ev: [{ e: 'page_time', d: 'board', v: 8 }] } });
const rows = sq.prepare("SELECT ev, dim, SUM(n) n, SUM(v) v FROM an_day GROUP BY ev, dim").all();
const get = (e, d) => rows.find(x => x.ev === e && x.dim === d);
assert.equal(get('widget_add', 'featured').n, 3); assert.equal(get('page_time', 'board').v, 50); assert.ok(!rows.some(x => x.ev === 'BAD NAME')); assert.equal(get('theme', 'scriptNeon').n, 1);
assert.equal(sq.prepare('SELECT secs FROM an_active a JOIN users u ON u.id=a.uid WHERE u.email=?').get('fan@x.com').secs, 150);
// the admin is never counted
r = await (await call('/auth/ev', { method: 'POST', cookie: boss, body: { secs: 999, ev: [{ e: 'widget_add', d: 'featured' }] } })).json();
assert.equal(r.skipped, 'admin'); assert.equal(sq.prepare("SELECT COUNT(*) n FROM an_active").get().n, 2);
// the dashboard: admins only, with filters
assert.equal((await call('/auth/admin/stats', { cookie: a })).status, 403);
let s = await (await call('/auth/admin/stats', { cookie: boss })).json();
assert.equal(s.days, 30); assert.equal(s.active.at(-1), 2); assert.equal(s.people, 2); assert.equal(s.members.free, 2, 'admin left out of members');
assert.equal(s.signups.reduce((t, x) => t + x.n, 0), 2); assert.ok(s.events.find(x => x.ev === 'widget_add').n === 3);
s = await (await call('/auth/admin/stats?dev=desk', { cookie: boss })).json(); assert.equal(s.active.at(-1), 1); assert.equal(s.events.find(x => x.ev === 'widget_add').n, 1);
s = await (await call('/auth/admin/stats?plan=premium', { cookie: boss })).json(); assert.equal(s.active.at(-1), 0);
const t = new Date().toISOString().slice(0, 10);
s = await (await call('/auth/admin/stats?from=' + t + '&to=' + t, { cookie: boss })).json(); assert.equal(s.days, 1); assert.equal(s.eventsToday, 7);
// deleting an account removes its activity rows; the nightly tidy-up keeps two years
sq.prepare("INSERT INTO an_day (day,ev,dim,plan,dev,n,v) VALUES ('2020-01-01','x','', 'free','phone',1,0)").run();
await worker.scheduled({}, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 10));
assert.equal(sq.prepare("SELECT COUNT(*) n FROM an_day WHERE day='2020-01-01'").get().n, 0);
await call('/auth/delete', { method: 'POST', cookie: b });
assert.equal(sq.prepare("SELECT COUNT(*) n FROM an_active").get().n, 1);
console.log('analytics tests ok');
