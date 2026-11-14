// What's new announcements (v52.87). Run: node test-announce.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';

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
const notes = c => call('/auth/notes', { method: 'POST', body: {}, cookie: c }).then(r => r.json());
// admins only
assert.equal((await call('/auth/admin/announce', { method: 'POST', body: { title: 'x' }, cookie: fan.c })).status, 403);
assert.equal((await call('/auth/admin/announce', { method: 'POST', body: { title: ' ' }, cookie: boss.c })).status, 400);
// send one; existing people get it once
let r = await call('/auth/admin/announce', { method: 'POST', body: { title: 'Card Tab now tracks sealed products', body: 'Log packs, boxes and ETBs.', go: 'add', aud: 'all' }, cookie: boss.c });
assert.equal(r.status, 200); const { id } = await r.json();
// the fan joined before it was sent (same second counts)
let n = await notes(fan.c); assert.equal(n.news.length, 1); assert.equal(n.news[0].go, 'add'); assert.equal(n.news[0].title, 'Card Tab now tracks sealed products');
n = await notes(fan.c); assert.equal(n.news.length, 0, 'handed over once');
// someone who joins later never gets it
sq.prepare("UPDATE announce SET at=at-100").run();
const late = await signIn('late@x.com'); n = await notes(late.c); assert.equal(n.news.length, 0, 'new sign-ups skip old news');
// edit: someone who already has it gets the fixed text on their next check, once
await new Promise(r => setTimeout(r, 1100));
r = await call('/auth/admin/announce/edit', { method: 'POST', body: { id, title: 'Card Tab now tracks sealed products!', body: 'Fixed text.', go: 'add', aud: 'all' }, cookie: boss.c }); assert.equal(r.status, 200);
n = await notes(fan.c); assert.equal(n.news.length, 1); assert.equal(n.news[0].fix, 1); assert.equal(n.news[0].body, 'Fixed text.');
n = await notes(fan.c); assert.equal(n.news.length, 0, 'fix sent once');
// the list shows how many have it; bad go/aud are cleaned
r = await call('/auth/admin/announce', { cookie: boss.c }); let j = await r.json(); assert.equal(j.items[0].got, 1); assert.ok(j.people >= 3);
r = await call('/auth/admin/announce', { method: 'POST', body: { title: 'Two', go: 'evil', aud: 'nope' }, cookie: boss.c }); const id2 = (await r.json()).id;
j = await (await call('/auth/admin/announce', { cookie: boss.c })).json(); const two = j.items.find(x => x.id === id2); assert.equal(two.go, ''); assert.equal(two.aud, 'all');
// stopped: no longer handed out
await call('/auth/admin/announce/stop', { method: 'POST', body: { id: id2 }, cookie: boss.c });
n = await notes(late.c); assert.equal(n.news.length, 0);
// older than 60 days: no longer handed out
sq.prepare("UPDATE users SET created_at=0").run(); sq.prepare("UPDATE announce SET stopped=0, at=? WHERE id=?").run(Math.floor(Date.now()/1000) - 61*86400, id2);
n = await notes(late.c); assert.equal(n.news.filter(x => x.id === id2).length, 0);
// deleting an account removes what it had seen
{ const { wipeAccount } = await import('./src/people.js'); const u = sq.prepare("SELECT id FROM users WHERE email='fan@x.com'").get();
  await wipeAccount(env, u.id, 'fan@x.com'); assert.equal(sq.prepare("SELECT COUNT(*) n FROM announce_seen WHERE uid=?").get(u.id).n, 0); }
// drafts written with a feature: a draft and a Waiting on you alert, never sent by themselves
{ const { seedDrafts } = await import('./src/announce.js'); const { openAlerts } = await import('./src/alerts.js');
  const L = [{ key: 'test-draft-1', title: 'Big new thing', body: 'Try it.', go: 'board', aud: 'all' }, { key: 'test-draft-2', title: 'Other thing' }];
  await seedDrafts(env, L); await seedDrafts(env, L);
  await seedDrafts(env, [{ key: 'test-draft-2', title: 'Other thing', body: 'Newer words.' }]); assert.equal(sq.prepare("SELECT body FROM announce WHERE dkey='test-draft-2'").get().body, 'Newer words.', 'an untouched draft follows newer wording');
  let j = await (await call('/auth/admin/announce', { cookie: boss.c })).json();
  const { DRAFTS } = await import('./src/announce-drafts.js');   // the admin page also seeds the real drafts waiting in the code
  assert.equal(j.drafts.length, 2 + DRAFTS.length, 'seeded once'); assert.ok(!j.items.some(x => x.title === 'Big new thing'), 'drafts are not in Sent');
  let al = await openAlerts(env); assert.equal(al.filter(a => /^ann-draft:/.test(a.key)).length, 2 + DRAFTS.length); assert.equal(al.find(a => a.key === 'ann-draft:test-draft-1').grp, 'you');
  const late2 = await signIn('late2@x.com'); sq.prepare("UPDATE users SET created_at=0").run();
  let nn = await notes(late2.c); assert.ok(!nn.news.some(x => x.title === 'Big new thing'), 'a draft never reaches people');
  // send the first (edited), discard the second
  const d1 = j.drafts.find(x => x.title === 'Big new thing'), d2 = j.drafts.find(x => x.title === 'Other thing');
  let r2 = await call('/auth/admin/announce', { method: 'POST', body: { draftId: d1.id, title: 'Big new thing, fixed', body: 'Try it.', go: 'board', aud: 'all' }, cookie: boss.c }); assert.equal(r2.status, 200);
  assert.equal((await call('/auth/admin/announce', { method: 'POST', body: { draftId: d1.id, title: 'again' }, cookie: boss.c })).status, 409, 'a draft sends once');
  await call('/auth/admin/announce/discard', { method: 'POST', body: { id: d2.id }, cookie: boss.c });
  nn = await notes(late2.c); assert.ok(nn.news.some(x => x.title === 'Big new thing, fixed'), 'sent draft reaches people');
  al = await openAlerts(env); assert.equal(al.filter(a => /^ann-draft:test-/.test(a.key)).length, 0, 'alerts closed');
  await seedDrafts(env, L); j = await (await call('/auth/admin/announce', { cookie: boss.c })).json(); assert.equal(j.drafts.filter(x => /thing/.test(x.title)).length, 0, 'sent and discarded drafts never come back'); }
console.log('announce: all good');
