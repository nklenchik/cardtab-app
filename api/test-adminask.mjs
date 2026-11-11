// Admin Ask (v52.20): admins only, tools read the dashboard numbers and accounts, spending shares the Ask cap, SHOW links.
// The AI is replaced by a script of replies. Run: node test-adminask.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [];
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', ANTHROPIC_API_KEY: 'test', EMAIL: { async send(m) { mails.push(m); } },
  ART: { async get() { return null; }, async list() { return { objects: [], truncated: false }; }, async delete() {} } };
const O = 'https://app.cardtab.app';
const realFetch = globalThis.fetch;
let script = [], sent = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com')) { const body = JSON.parse(init.body); sent.push(body); const r = script.shift();
    return new Response(JSON.stringify(Object.assign({ usage: { input_tokens: 1000, output_tokens: 100 } }, r)), { status: 200, headers: { 'content-type': 'application/json' } }); }
  return realFetch(url, init);
};
const call = (path, { method = 'GET', body, cookie } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: O, 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.' + Math.floor(Math.random() * 200), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email) { mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email } });
  const tok = /\?login=([\w-]+)/.exec(mails.find(m => m.to === email).text)[1]; const r = await call('/auth/email/verify', { method: 'POST', body: { token: tok } }); return { c: cookieOf(r), j: await r.json() }; }
const boss = await signIn('boss@x.com'), fan = await signIn('fan@x.com'), pro = await signIn('pro@x.com');
sq.prepare("UPDATE users SET plan='premium' WHERE email='pro@x.com'").run();
const ask = (body, c = boss.c) => call('/auth/admin/ask', { method: 'POST', body, cookie: c });
const tool = (name, input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't' + Math.random(), name, input }] });
const say = t => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] });
const lastResult = () => JSON.parse(sent[sent.length - 1].messages.at(-1).content[0].content);

// admins only
assert.equal((await ask({ q: 'hi' }, fan.c)).status, 403);

// app numbers: accounts by plan, with admins left out
script = [tool('app_stats', { from: '2026-10-01', to: '2026-10-31' }), say('You have 1 Premium and 1 Free account.\nSHOW: Members; Not a card')];
let r = await (await ask({ q: 'how many members?', spots: ['Members', 'Ask cost this month'], view: { label: 'Last 30 days' } })).json();
let res = lastResult();
assert.deepEqual(res.accountsNow, { free: 1, premium: 1 }, 'admins not counted');
assert.equal(r.text, 'You have 1 Premium and 1 Free account.'); assert.deepEqual(r.show, ['Members'], 'only names from the list');
assert.ok(sent[0].system.includes('Members | Ask cost this month') && sent[0].system.includes('Last 30 days'));

// one person, by email; and finding people
sq.prepare("INSERT INTO ask_usage (user_id,month,n) VALUES (?,?,3)").run(fan.j.user.id, new Date().toISOString().slice(0, 7));
sent = []; script = [tool('person', { email: 'FAN@x.com' }), say('fan@x.com is on Free and asked 3 questions this month.')];
r = await (await ask({ q: 'tell me about fan@x.com' })).json();
res = lastResult(); assert.equal(res.email, 'fan@x.com'); assert.equal(res.month.ask, 3); assert.match(res.joined, /^\d{4}-\d\d-\d\d$/);
sent = []; script = [tool('find_people', { plan: 'premium' }), say('One Premium member: pro@x.com.')];
await ask({ q: 'who is premium?' }); res = lastResult(); assert.deepEqual(res.people.map(p => p.email), ['pro@x.com']);
sent = []; script = [tool('find_people', { q: 'x.com', limit: 5 }), say('ok')];
await ask({ q: 'find x.com' }); res = lastResult(); assert.equal(res.found, 3, 'a search can find admins too');
sent = []; script = [tool('person', { email: 'nobody@x.com' }), say('No such account.')];
await ask({ q: 'nobody?' }); assert.ok(lastResult().error);

// website numbers and health
sent = []; script = [tool('site_stats', { from: '2026-11-01', to: '2026-11-10' }), say('ok')]; await ask({ q: 'site?' }); assert.equal(lastResult().visitors, 0);
sent = []; script = [tool('health', {}), say('No check yet.')]; await ask({ q: 'health?' }); assert.ok(lastResult().error);

// spending goes into the shared Ask total; nobody's question count changes
const sp = sq.prepare('SELECT tin, tout, n FROM ask_spend').get();
assert.ok(sp.tin >= 12000 && sp.n === 7, 'tokens added to the shared total');
assert.equal(sq.prepare('SELECT n FROM ask_usage WHERE user_id=?').get(boss.j.user.id), undefined, 'admin questions not counted as questions used');

// the shared cap stops it
sq.prepare('UPDATE ask_spend SET tin=?').run(300e6);
r = await ask({ q: 'more?' }); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'cap');
console.log('admin ask: all tests pass');
