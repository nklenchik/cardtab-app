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
assert.equal(sq.prepare("SELECT COUNT(DISTINCT uid) n FROM an_feat").get().n, 1, 'their feature days go too'); assert.equal(sq.prepare("SELECT COUNT(*) n FROM an_user").get().n, 1);
// ---- the website ----
const site = (body, { origin = 'https://cardtab.app', ip = '9.9.9.9', ua = 'Mozilla/5.0 (iPhone) Mobile' } = {}) => worker.fetch(new Request('https://api.cardtab.app/s/ev', { method: 'POST', headers: { origin, 'content-type': 'text/plain', 'cf-connecting-ip': ip, 'cf-ipcountry': 'US', 'user-agent': ua }, body: JSON.stringify(body) }), env, {});
assert.equal((await site({ ref: 'https://www.google.com/', ev: [{ e: 'pv', d: '/' }, { e: 'sec', d: 'pricing' }, { e: 'nope', d: 'x' }] })).status, 204);
await site({ ref: 'https://www.google.com/', ev: [{ e: 'pv', d: '/' }, { e: 'cta', d: 'join focus' }, { e: 'join', d: 'hero' }] });   // same visitor, same day
await site({ ref: 'https://reddit.com/r/pkmntcg', ev: [{ e: 'pv', d: '/' }] }, { ip: '8.8.8.8', ua: 'Mozilla/5.0 (Macintosh)' });
await site({ ev: [{ e: 'pv', d: '/' }] }, { origin: 'https://evil.example' });   // not our site: ignored
await site({ ev: [{ e: 'pv', d: '/' }] }, { ua: 'Googlebot/2.1' });              // robots: ignored
assert.equal(sq.prepare('SELECT COUNT(*) n FROM an_site_vis').get().n, 2, 'two visitors');
assert.deepEqual(sq.prepare('SELECT src FROM an_site_vis ORDER BY src').all().map(r => r.src), ['google', 'reddit']);
assert.equal(sq.prepare("SELECT SUM(n) n FROM an_site WHERE ev='pv'").get().n, 3);
let w = await (await call('/auth/admin/site', { cookie: boss })).json();
assert.equal(w.visitors.at(-1), 2); assert.equal(w.events.find(x => x.ev === 'join').n, 1); assert.equal(w.countries[0].dim, 'US');
// v52.46 browser and operating system per visitor
assert.equal(w.browsers.length >= 1 && w.systems.length >= 1, true, JSON.stringify([w.browsers, w.systems]));
assert.equal(w.systems.reduce((t, r) => t + r.n, 0), w.visitors.at(-1), 'every visitor has an operating system');
w = await (await call('/auth/admin/site?dev=desk', { cookie: boss })).json(); assert.equal(w.visitors.at(-1), 1);
assert.equal((await call('/auth/admin/site', { cookie: a })).status, 403);
// ---- v50.4: features, upgrades, where people came from ----
await call('/auth/ev', { method: 'POST', cookie: a, body: { dev: 'phone', secs: 10, ev: [{ e: 'journey', d: 'google~hero.pricing.stories~stories' }, { e: 'page_view', d: 'board' }, { e: 'theme', d: 'Neon' }, { e: 'limit', d: 'entries' }, { e: 'prem_open', d: 'layouts' }] } });
assert.ok(!sq.prepare("SELECT 1 FROM an_day WHERE ev='journey'").get(), 'the journey itself is not a count');
let U = sq.prepare('SELECT * FROM an_user u JOIN users x ON x.id=u.uid WHERE x.email=?').get('fan@x.com');
assert.equal(U.src, 'google'); assert.equal(U.sec, 'hero.pricing.stories'); assert.equal(U.last_prem, 'layouts'); assert.equal(U.up_day, null);
sq.prepare("UPDATE users SET plan='premium' WHERE email='fan@x.com'").run();
await call('/auth/ev', { method: 'POST', cookie: a, body: { dev: 'phone', secs: 10, ev: [{ e: 'layout_save', d: '1' }] } });
U = sq.prepare('SELECT * FROM an_user u JOIN users x ON x.id=u.uid WHERE x.email=?').get('fan@x.com');
assert.equal(U.up_day, t); assert.equal(U.up_ctx, 'layouts'); assert.equal(U.plan, 'premium');
await call('/auth/ev', { method: 'POST', cookie: a, body: { ev: [{ e: 'journey', d: 'reddit~faq~' }] } });
assert.equal(sq.prepare('SELECT src FROM an_user u JOIN users x ON x.id=u.uid WHERE x.email=?').get('fan@x.com').src, 'google', 'first journey sticks');
s = await (await call('/auth/admin/stats', { cookie: boss })).json();
const R = Object.fromEntries(s.reach.map(r => [r.feat, r.n]));
assert.equal(R.board, 1); assert.equal(R.stories_style, 1); assert.equal(R.entry_limit, 1); assert.equal(R.layouts, 1);
assert.equal(s.upgraders, 1); assert.deepEqual(s.upCtx, [{ dim: 'layouts', n: 1 }]);
const UF = Object.fromEntries(s.upFeat.map(r => [r.feat, r.n])); assert.equal(UF.entry_limit, 1); assert.ok(!UF.layouts, 'saving layouts came after the upgrade');
assert.equal(s.freeBase, 0, 'no one left on Free'); assert.equal(s.signupSrc.find(x => x.dim === 'google').upgraded, 1);
assert.equal(s.signupSec.find(x => x.dim === 'pricing').n, 1);
await site({ ref: 'https://www.instagram.com/', ev: [{ e: 'join', d: 'waitlist' }, { e: 'join_src', d: '' }, { e: 'join_sec', d: 'pricing' }, { e: 'join_demo', d: 'stories' }, { e: 'join_scroll', d: '75' }] }, { ip: '7.7.7.7' });
s = await (await call('/auth/admin/stats', { cookie: boss })).json();
assert.deepEqual(s.join.find(x => x.ev === 'join_src'), { ev: 'join_src', dim: 'instagram', n: 1 });
// v50.95 Premium copy test: views and taps per headline and bullet are counted; the last-shown copy is kept per person
await call('/auth/ev', { method: 'POST', cookie: a, body: { dev: 'phone', ev: [{ e: 'pc_view', d: 's2' }, { e: 'pc_bul', d: 's:11' }, { e: 'pc_last', d: 's2:11.3.12.1.6.15' }, { e: 'pc_tap', d: 's2' }] } });
assert.equal(sq.prepare("SELECT c.last FROM an_copy c JOIN users u ON u.id=c.uid WHERE u.email=?").get('fan@x.com').last, 's2:11.3.12.1.6.15');
await call('/auth/ev', { method: 'POST', cookie: a, body: { ev: [{ e: 'pc_last', d: 'DROP TABLE' }] } });
assert.equal(sq.prepare("SELECT c.last FROM an_copy c JOIN users u ON u.id=c.uid WHERE u.email=?").get('fan@x.com').last, 's2:11.3.12.1.6.15', 'junk ignored');
sq.prepare("UPDATE an_copy SET buy=last, buy_day=?, buy_iv='year'").run(new Date().toISOString().slice(0, 10));
s = await (await call('/auth/admin/stats', { cookie: boss })).json();
assert.equal(s.copyBuys.length, 1); assert.equal(s.copyBuys[0].buy, 's2:11.3.12.1.6.15'); assert.ok(s.copyDays.some(r => r.dim === 's2' && r.n === 1));
assert.ok(s.events.some(r => r.ev === 'pc_bul' && r.dim === 's:11'));
console.log('analytics tests ok');
