// First-two-weeks emails (v52.49): day 1 / 7 / 13 at 10am local, skips, one-click stop, open + click counts, admin numbers,
// removed with the account. Run: node test-drip.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { dripRun, pickTip, localOf, summary } from './src/drip.js';
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { const r = sq.prepare(sql).run(...o.args); return { meta: { changes: r.changes } }; } }; return o; };
const mails = [];
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; } }, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } } };
const call = (path, { method = 'GET', body, cookie, cf } = {}) => { const r = new Request('https://api.cardtab.app' + path, { method, headers: { origin: 'https://app.cardtab.app', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  if (cf) Object.defineProperty(r, 'cf', { value: cf }); return worker.fetch(r, env, { waitUntil() {} }); };
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email, cf = { country: 'US', region: 'New York', timezone: 'America/New_York' }) { mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email } });
  const tok = /\?login=([\w-]+)/.exec(mails.find(m => m.to === email).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { token: tok }, cf })); }
const uid = e => sq.prepare('SELECT id FROM users WHERE email=?').get(e).id;
const NOW = Date.parse('2026-11-20T15:30:00Z');   // 10:30am in New York
const T = Math.floor(NOW / 1000);
const ago = (e, days) => sq.prepare('UPDATE users SET created_at=? WHERE email=?').run(T - days * 86400, e);
let n = 0; const entry = (e, type, extra = {}) => { const d = { id: 'e' + (++n), type, name: 'Card ' + n, amount: 1000, net: type === 'sale' ? 850 : null, platform: 'eBay', createdAt: new Date(NOW - 86400e3).toISOString(), ...extra };
  sq.prepare('INSERT INTO entries (user_id,id,data,updated_at,deleted,seq) VALUES (?,?,?,?,0,?)').run(uid(e), d.id, JSON.stringify(d), d.createdAt, n); };

const a = await signIn('day1@x.com'); ago('day1@x.com', 2);
await signIn('started@x.com'); ago('started@x.com', 2); entry('started@x.com', 'purchase');
await signIn('prem@x.com'); ago('prem@x.com', 2); sq.prepare("UPDATE users SET plan='premium' WHERE email='prem@x.com'").run();
const boss = await signIn('boss@x.com'); ago('boss@x.com', 2);
await signIn('la@x.com', { country: 'US', region: 'California', timezone: 'America/Los_Angeles' }); ago('la@x.com', 2);
await signIn('wk@x.com'); ago('wk@x.com', 7); entry('wk@x.com', 'purchase'); entry('wk@x.com', 'purchase');
await signIn('two@x.com'); ago('two@x.com', 13); entry('two@x.com', 'purchase', { amount: 2000 }); entry('two@x.com', 'sale', { name: 'Pikachu ex', net: 6000 }); entry('two@x.com', 'sale', { net: 900, platform: 'TCGplayer' });
await signIn('old@x.com'); ago('old@x.com', 30);
await signIn('off@x.com'); ago('off@x.com', 2);
sq.prepare("INSERT INTO user_meta (user_id,k,v,updated_at,seq) VALUES (?,?,?,?,1)").run(uid('off@x.com'), 'notif', JSON.stringify({ prefs: { emailOff: true } }), new Date(NOW).toISOString());

// pure helpers
assert.deepEqual(localOf(NOW, 'America/Los_Angeles'), { date: '2026-11-20', hour: 7 });
assert.equal(localOf(NOW, 'Not/AZone').hour, 10);   // unknown zone: Eastern
assert.equal(pickTip({ n: 0, feats: new Set() }), 'start');
assert.equal(pickTip({ n: 3, sales: 0, buys: 3, feats: new Set() }), 'sale');
assert.equal(pickTip({ n: 3, sales: 1, buys: 2, budget: false, feats: new Set() }), 'budget');
assert.equal(pickTip({ n: 3, sales: 1, buys: 2, budget: true, phone: true, feats: new Set() }), 'home');
assert.equal(pickTip({ n: 3, sales: 1, buys: 2, budget: true, phone: true, feats: new Set(['home_screen', 'board']) }), 'stories');
assert.deepEqual(summary([{ type: 'purchase', amount: 2000 }, { type: 'sale', net: 6000, name: 'P', platform: 'eBay' }]), { n: 2, profit: 4000, best: { name: 'P', net: 6000 }, plat: 'eBay' });

mails.length = 0;
const r1 = await dripRun(env, NOW, { force: true, pace: false });
const to = new Set(mails.map(m => m.to));
assert.deepEqual([...to].sort(), ['day1@x.com', 'two@x.com', 'wk@x.com'], JSON.stringify(r1));
const m1 = mails.find(m => m.to === 'day1@x.com');
assert.equal(m1.subject, 'Add your first card in 30 seconds'); assert.equal(m1.from.email, 'hello@cardtab.app');
assert.match(m1.headers['List-Unsubscribe'], /^<https:\/\/api\.cardtab\.app\/e\/u\/[0-9a-f]{32}>/); assert.equal(m1.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
assert.match(m1.html, /e\/o\/[0-9a-f]{32}\.gif/); assert.match(m1.html, /Stop these emails/); assert.match(m1.text, /Stop these emails: https/);
assert.equal(mails.find(m => m.to === 'wk@x.com').subject, 'See what you really kept');   // only buys so far: the "log a sale" tip
const m13 = mails.find(m => m.to === 'two@x.com'); assert.match(m13.html, /Pikachu ex/); assert.match(m13.html, /\+\$49\.00/); assert.match(m13.html, /See Premium/);
assert.equal(sq.prepare("SELECT variant FROM email_log WHERE uid=? AND step='d1'").get(uid('started@x.com')).variant, 'skipped');   // already started
// LA: 7:30am there now, sent at 10:30 its time
mails.length = 0; await dripRun(env, NOW + 3 * 3600e3, { force: true, pace: false });
assert.deepEqual(mails.map(m => m.to), ['la@x.com']);
// never twice: run again, nothing
mails.length = 0; await dripRun(env, NOW + 3.5 * 3600e3, { force: true, pace: false }); assert.equal(mails.length, 0);
// the hourly guard without force
await dripRun(env, NOW + 5 * 3600e3, { pace: false }); assert.equal((await dripRun(env, NOW + 5 * 3600e3 + 60e3, { pace: false })).skipped, true);

// links
const id = /e\/o\/([0-9a-f]{32})\.gif/.exec(m1.html)[1];
let r = await call('/e/o/' + id + '.gif'); assert.equal(r.headers.get('content-type'), 'image/gif');
r = await call('/e/c/' + id + '?to=add'); assert.equal(r.status, 302); assert.equal(r.headers.get('location'), 'https://app.cardtab.app/?go=add');
r = await call('/e/c/' + id + '?to=https://evil.com'); assert.equal(r.headers.get('location'), 'https://app.cardtab.app/');
let row = sq.prepare('SELECT * FROM email_log WHERE id=?').get(id); assert.equal(row.opens, 1); assert.equal(row.clicks, 2); assert.ok(row.clicked_at);
r = await call('/e/u/' + id); assert.match(await r.text(), /won’t get these emails/);
const nm = JSON.parse(sq.prepare("SELECT v FROM user_meta WHERE user_id=? AND k='notif'").get(uid('day1@x.com')).v); assert.equal(nm.prefs.emailOff, true);
assert.ok(sq.prepare('SELECT seq FROM sync_state WHERE user_id=?').get(uid('day1@x.com')).seq >= 1);
// the app sees it on its next sync
const sy = await (await call('/auth/sync', { method: 'POST', body: { since: 0, entries: [], meta: {} }, cookie: a })).json();
assert.equal(sy.meta.notif.v.prefs.emailOff, true);
// switched off: no day 7 for them
ago('day1@x.com', 7); mails.length = 0; await dripRun(env, NOW + 86400e3 * 6, { force: true, pace: false }); assert.ok(!mails.some(m => m.to === 'day1@x.com'));
// one-click POST from a mail app
const id2 = /e\/u\/([0-9a-f]{32})/.exec(mails.length ? mails[0].html : m13.html)[1];
r = await call('/e/u/' + id2, { method: 'POST' }); assert.equal(r.status, 200);
r = await call('/e/u/' + 'f'.repeat(32)); assert.match(await r.text(), /expired/);

// admin: the flow numbers and one person's emails
const st = await (await call('/auth/admin/stats?from=2026-11-01&to=2026-11-30', { cookie: boss })).json();
assert.ok(st.emails.total.sent >= 4, JSON.stringify(st.emails.total));
const d1 = st.emails.steps.find(s => s.id === 'd1'); assert.equal(d1.skipped, 1); assert.equal(d1.clicked, 1); assert.equal(d1.unsub, 1);
assert.ok(st.emails.tips.some(t => t.tip === 'sale'));
const one = (await (await call('/auth/admin/people/one?id=' + uid('two@x.com'), { cookie: boss })).json()).person;
assert.equal(one.emails[0].step, 'd13');
// pause switch
assert.equal((await dripRun({ ...env, DRIP: 'off' }, NOW, { force: true })).off, true);
// deleting the account removes its emails
const two = await signIn('two@x.com'); await call('/auth/delete', { method: 'POST', body: {}, cookie: two });
assert.equal(sq.prepare('SELECT COUNT(*) n FROM email_log WHERE uid NOT IN (SELECT id FROM users)').get().n, 0);
console.log('drip tests passed');
