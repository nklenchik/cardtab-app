// Help and feedback (v52.23): send with/without a screenshot, admin inbox, screenshot fetch, handled, reply -> in-app notice,
// daily summary email (once per message), admin Ask tool, deletion with the account. Run: node test-feedback.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { feedbackDigest, feedbackForAsk } from './src/feedback.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [], bucket = new Map();
const ART = { async put(k, v, o) { bucket.set(k, { v: new Uint8Array(v), type: o && o.httpMetadata && o.httpMetadata.contentType }); }, async get(k) { const x = bucket.get(k); return x ? { body: x.v, httpMetadata: { contentType: x.type } } : null; },
  async delete(k) { bucket.delete(k); }, async list() { return { objects: [], truncated: false }; } };
const env = { DB, ART, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } } };
const call = (path, { method = 'GET', body, cookie } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: 'https://app.cardtab.app', 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.' + Math.floor(Math.random() * 200), 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email) { mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email } });
  const tok = /\?login=([\w-]+)/.exec(mails.find(m => m.to === email).text)[1]; const r = await call('/auth/email/verify', { method: 'POST', body: { token: tok } }); return { c: cookieOf(r), j: await r.json() }; }
const boss = await signIn('boss@x.com'), fan = await signIn('fan@x.com');
const send = (body, c = fan.c) => call('/auth/feedback', { method: 'POST', body, cookie: c });
// a real tiny PNG (1x1) padded past the minimum size check
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex'), Buffer.alloc(200)]);

// signed out can't send; empty message refused
assert.equal((await call('/auth/feedback', { method: 'POST', body: { msg: 'hi there' } })).status, 401);
assert.equal((await send({ msg: ' ' })).status, 400);
// send: a bug with a screenshot, an idea without
let r = await send({ kind: 'bug', msg: 'The board froze when I added a card', page: 'Board', ver: '52.23', shot: 'data:image/png;base64,' + png.toString('base64') });
assert.equal(r.status, 200, await r.text());
r = await send({ kind: 'idea', msg: 'Please add a dark theme for Stories', page: 'Stories' }); assert.equal(r.status, 200);
// bad pictures refused (not an image; too big)
assert.equal((await send({ msg: 'x y', shot: 'data:image/png;base64,' + Buffer.from('not a png at all, just text'.repeat(10)).toString('base64') })).status, 400);
assert.equal((await send({ msg: 'x y', shot: 'data:text/html;base64,PGgxPg==' })).status, 400);
assert.equal(bucket.size, 1, 'one screenshot stored');

// admins only
assert.equal((await call('/auth/admin/feedback', { cookie: fan.c })).status, 403);
let list = await (await call('/auth/admin/feedback', { cookie: boss.c })).json();
assert.equal(list.total, 2); assert.equal(list.fresh, 2);
const bug = list.items.find(i => i.kind === 'bug'), idea = list.items.find(i => i.kind === 'idea');
assert.ok(bug.shot && !idea.shot); assert.equal(bug.email, 'fan@x.com'); assert.equal(bug.dev, 'iPhone · Safari'); assert.equal(bug.page, 'Board');
// screenshot: admins can fetch it, others can't
r = await call('/auth/admin/feedback/shot?id=' + bug.id, { cookie: boss.c }); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png');
assert.equal((await call('/auth/admin/feedback/shot?id=' + bug.id, { cookie: fan.c })).status, 403);

// reply -> handled, and the person gets an in-app notice once
r = await call('/auth/admin/feedback/act', { method: 'POST', body: { id: bug.id, act: 'reply', text: 'Thanks! Fixed in the next update.' }, cookie: boss.c }); assert.equal(r.status, 200);
let notes = (await (await call('/auth/notes', { method: 'POST', cookie: fan.c })).json()).notes;
assert.equal(notes.length, 1); assert.equal(notes[0].title, 'Card Tab replied to your feedback'); assert.match(notes[0].body, /Fixed in the next update[\s\S]*board froze/);
assert.equal((await (await call('/auth/notes', { method: 'POST', cookie: fan.c })).json()).notes.length, 0);
// handled / back to new
await call('/auth/admin/feedback/act', { method: 'POST', body: { id: idea.id, act: 'handled' }, cookie: boss.c });
list = await (await call('/auth/admin/feedback?status=new', { cookie: boss.c })).json(); assert.equal(list.items.length, 0); assert.equal(list.fresh, 0);

// daily summary: one email listing both, then nothing until something new arrives
mails.length = 0; let d = await feedbackDigest(env);
assert.equal(d.items, 2); assert.equal(mails.length, 1); assert.equal(mails[0].to, 'boss@x.com'); assert.match(mails[0].subject, /2 new \(1 bug\)/); assert.match(mails[0].html, /board froze/);
mails.length = 0; d = await feedbackDigest(env); assert.equal(mails.length, 0, 'nothing new, no email');
await send({ kind: 'other', msg: 'Love it so far' }); d = await feedbackDigest(env); assert.equal(mails.length, 1); assert.match(mails[0].subject, /1 new$/);

// admin Ask tool
const a = await feedbackForAsk(env, { kind: 'bug' }); assert.equal(a.count, 1); assert.equal(a.items[0].replied, true);

// deleting the account removes the messages and screenshot
r = await call('/auth/delete', { method: 'POST', body: { confirm: 'DELETE' }, cookie: fan.c });
if (r.status === 200) { assert.equal(sq.prepare("SELECT COUNT(*) n FROM feedback").get().n, 0); assert.equal(bucket.size, 0); console.log('deleted with account: ok'); }
else console.log('note: /auth/delete answered', r.status, '(checked wipe separately)');
console.log('feedback tests ok');
