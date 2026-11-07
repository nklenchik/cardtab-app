// Offline tests for shared boards (v50.5), against a real SQLite database standing in for D1. Run: node test-analytics.mjs
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
const a = await signIn('fan@x.com', '2.2.2.2'), b = await signIn('pal@x.com', '3.3.3.3');
sq.prepare("UPDATE users SET plan='premium', name='Nick K' WHERE email='fan@x.com'").run();
const pub = id => worker.fetch(new Request('https://api.cardtab.app/s/b/' + id), env, {});
const evil = '<div class="w" onclick="steal()">ok<script>alert(1)</script><img src="javascript:alert(2)"><a href=\'javascript:x\'>x</a><iframe src="https://evil"></iframe><style>body{}</style></div>';
assert.equal((await call('/auth/share', { method: 'POST', cookie: b, body: { id: 'abcdefgh1', html: '<div>x</div>' } })).status, 403, 'Free can’t share');
let r = await (await call('/auth/share', { method: 'POST', cookie: a, body: { id: 'abcdefgh1', html: evil, meta: { title: 'Nick’s Card Board', label: 'All time', cbStyle: '--rowh:180px;background:url(javascript:x)' }, live: true, exp: 'never' } })).json();
assert.ok(r.ok); assert.equal(r.url, 'https://app.cardtab.app/b/abcdefgh1');
let g = await (await pub('abcdefgh1')).json();
assert.ok(!/script|onclick|javascript|iframe|<style/i.test(g.html), 'cleaned: ' + g.html); assert.ok(/ok/.test(g.html)); assert.equal(g.meta.title, 'Nick’s Card Board'); assert.ok(!/url\(/.test(g.meta.cbStyle));
assert.equal((await call('/auth/share', { method: 'POST', cookie: b, body: { id: 'abcdefgh1', html: 'x' } })).status, 403);
// a new link: the old one stops working
await call('/auth/share', { method: 'POST', cookie: a, body: { id: 'zzzzzzzz2', html: '<b>v2</b>', exp: '7' } });
assert.equal((await pub('abcdefgh1')).status, 404); g = await (await pub('zzzzzzzz2')).json(); assert.equal(g.html, '<b>v2</b>');
// expired links say so
sq.prepare("UPDATE shares SET exp=1 WHERE id='zzzzzzzz2'").run(); assert.equal((await pub('zzzzzzzz2')).status, 410);
await call('/auth/share', { method: 'POST', cookie: a, body: { id: 'zzzzzzzz2', html: '<b>v3</b>', exp: 'never' } }); assert.equal((await pub('zzzzzzzz2')).status, 200);
// invites by email
mails.length = 0; r = await (await call('/auth/share/invite', { method: 'POST', cookie: a, body: { emails: ['one@x.com', 'bad', 'two@x.com'] } })).json();
assert.equal(r.sent, 2); assert.ok(/Nick shared their Card Board/.test(mails[0].subject)); assert.ok(mails[0].text.includes('https://app.cardtab.app/b/zzzzzzzz2'));
// turning it off
await call('/auth/share', { method: 'POST', cookie: a, body: { off: true } }); assert.equal((await pub('zzzzzzzz2')).status, 404);
assert.equal((await pub('../etc')).status, 404);
console.log('share tests ok');
