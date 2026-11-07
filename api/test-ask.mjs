// Offline tests for Ask, against a real SQLite database standing in for D1 and a stand-in for Anthropic. Run: node test-ask.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { runTool } from './src/ask.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [];
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', ANTHROPIC_API_KEY: 'test-key',
  EMAIL: { async send(m) { mails.push(m); } }, ART: { async get() { return null; } } };
const O = 'https://app.cardtab.app';
const call = (path, { method = 'GET', body, cookie, ip = '1.1.1.1' } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: O, 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, {});
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email, ip) { await call('/auth/email/start', { method: 'POST', body: { email }, ip }); const c = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { email, code: c }, ip })); }

// the numbers: same rules as the app (cents in, dollars out, refunds come out of what you kept)
const E = [
  { id: 'ent-a', date: '2026-03-02', type: 'purchase', platform: 'eBay', name: 'Charizard ex - 199/165', qty: 1, amount: 10000 },
  { id: 'ent-b', date: '2026-03-20', type: 'sale', platform: 'TCGplayer', name: 'Charizard ex - 199/165', qty: 1, amount: 25000, fees: 3150, ship: 120, net: 21730 },
  { id: 'ent-c', date: '2026-04-05', type: 'sale', platform: 'eBay', name: 'Gengar ex - 154/128', qty: 2, amount: 8590, fees: 1057, ship: 111, net: 7422 },
  { id: 'ent-d', date: '2026-04-09', type: 'refund', platform: 'eBay', name: 'Gengar ex - 154/128', qty: 1, amount: 1840 },
  { id: 'ent-e', date: '2026-04-11', type: 'purchase', platform: 'Whatnot', name: 'Pikachu ex', qty: 1, amount: 3239 }
];
let t = runTool(E, 'totals', {});
assert.deepEqual([t.sales, t.fees_and_shipping, t.kept_after_fees, t.spent, t.refunds_paid, t.profit], [335.9, 44.38, 273.12, 132.39, 18.4, 140.73]);
t = runTool(E, 'totals', { platform: 'ebay', from: '2026-04-01' }); assert.equal(t.kept_after_fees, 55.82); assert.equal(t.sales_count, 1);
t = runTool(E, 'totals', { card: 'charizard' }); assert.equal(t.profit, 117.3);
let br = runTool(E, 'breakdown', { by: 'month' }); assert.deepEqual(br.rows.map(r => r.group), ['2026-03', '2026-04']); assert.equal(br.rows[0].profit, 117.3);
br = runTool(E, 'breakdown', { by: 'platform', sort: 'fees_and_shipping' }); assert.equal(br.rows[0].group, 'TCGplayer');
assert.equal(runTool(E, 'entries', { type: 'sale', sort: 'biggest', limit: 1 }).entries[0].kept, 217.3);

// the stand-in for Anthropic: the first reply asks for totals, the second answers with what the tool said
const sent = []; let mode = 'ok';
globalThis.fetch = async (url, init) => {
  assert.equal(url, 'https://api.anthropic.com/v1/messages'); assert.equal(init.headers['x-api-key'], 'test-key');
  const body = JSON.parse(init.body); sent.push(body);
  if (mode === 'down') return new Response('{}', { status: 529 });
  assert.equal(body.model, 'claude-haiku-5-5'); assert.ok(body.tools.some(x => x.name === 'totals'));
  const last = body.messages.at(-1);
  if (typeof last.content === 'string') return Response.json({ stop_reason: 'tool_use', usage: { input_tokens: 1500, output_tokens: 40 }, content: [{ type: 'text', text: 'Let me check.' }, { type: 'tool_use', id: 'tu1', name: 'totals', input: {} }] });
  const res = JSON.parse(last.content[0].content);
  return Response.json({ stop_reason: 'end_turn', usage: { input_tokens: 1700, output_tokens: 60 }, content: [{ type: 'text', text: 'Your profit is **$' + res.profit.toFixed(2) + '**.' }] });
};

const fan = await signIn('fan@x.com', '2.2.2.2');
// not signed in
assert.equal((await call('/auth/ask', { method: 'POST', body: { q: 'hi' } })).status, 401);
// put entries on the server the way the app does
let r = await call('/auth/sync', { method: 'POST', cookie: fan, body: { since: 0, entries: E.map(e => Object.assign({ updatedAt: '2026-04-12T00:00:00Z', deleted: false }, e)), meta: {} } });
assert.equal(r.status, 200);
// how many are left, without asking
r = await call('/auth/ask', { method: 'POST', cookie: fan, body: { check: true } }); let j = await r.json();
assert.equal(j.limit, 5); assert.equal(j.left, 5); assert.equal(j.plan, 'free'); assert.match(j.resets, /^\d{4}-\d\d-01$/);
// a question: the tool runs on the server, the answer quotes its number, one question is counted
r = await call('/auth/ask', { method: 'POST', cookie: fan, body: { q: 'What is my profit?', view: { label: 'All time', platform: 'all' } } }); j = await r.json();
assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.text, 'Your profit is **$140.73**.'); assert.equal(j.left, 4);
assert.match(sent[0].system, /Never add, subtract or estimate/); assert.match(sent[0].system, /They are looking at: All time/);
assert.equal(sent.length, 2, 'one tool round, then the answer');
// follow-up turns go along (and a stray assistant first turn is dropped)
await call('/auth/ask', { method: 'POST', cookie: fan, body: { q: 'And in April?', turns: [{ role: 'assistant', content: 'x' }, { role: 'user', content: 'What is my profit?' }, { role: 'assistant', content: 'Your profit is $140.73.' }] } });
assert.equal(sent.at(-2).messages[0].content, 'What is my profit?'); assert.equal(sent.at(-2).messages.length, 3);
// the Free limit
for (let i = 0; i < 3; i++) assert.equal((await call('/auth/ask', { method: 'POST', cookie: fan, body: { q: 'again ' + i } })).status, 200);
r = await call('/auth/ask', { method: 'POST', cookie: fan, body: { q: 'one too many' } }); j = await r.json();
assert.equal(r.status, 429); assert.equal(j.error, 'limit'); assert.equal(j.left, 0);
// Premium gets 50
sq.prepare("UPDATE users SET plan='premium' WHERE email='fan@x.com'").run();
j = await (await call('/auth/ask', { method: 'POST', cookie: fan, body: { check: true } })).json(); assert.equal(j.limit, 50); assert.equal(j.left, 45);
// a failed answer doesn't use up a question
mode = 'down'; r = await call('/auth/ask', { method: 'POST', cookie: fan, body: { q: 'x' } }); j = await r.json(); assert.equal(r.status, 502); assert.equal(j.error, 'busy'); assert.equal(j.left, 45); assert.equal(j.detail, undefined, 'only admins see the details'); mode = 'ok';
// the month's spending cap stops everyone (it reads the tokens used so far)
const spent = sq.prepare('SELECT tin, tout FROM ask_spend').get(); assert.ok(spent.tin > 0 && spent.tout > 0);
env.ASK_MONTH_USD = '0.0001'; r = await call('/auth/ask', { method: 'POST', cookie: fan, body: { q: 'x' } }); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'busy'); delete env.ASK_MONTH_USD;
// admins aren't held to the limit
const boss = await signIn('boss@x.com', '3.3.3.3'); sq.prepare("INSERT INTO ask_usage (user_id,month,n) SELECT id, ?, 99 FROM users WHERE email='boss@x.com'").run(new Date().toISOString().slice(0, 7));
assert.equal((await call('/auth/ask', { method: 'POST', cookie: boss, body: { q: 'hi' } })).status, 200);
// no key: says it isn't set up
mode = 'nokey'; const realFetch = globalThis.fetch; globalThis.fetch = async () => Response.json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, { status: 401 });
r = await call('/auth/ask', { method: 'POST', cookie: boss, body: { q: 'hi' } }); j = await r.json(); assert.equal(j.error, 'key'); assert.match(j.detail, /401: invalid x-api-key/);
globalThis.fetch = async () => Response.json({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, { status: 400 });
j = await (await call('/auth/ask', { method: 'POST', cookie: boss, body: { q: 'hi' } })).json(); assert.equal(j.error, 'billing'); globalThis.fetch = realFetch;
delete env.ANTHROPIC_API_KEY; r = await call('/auth/ask', { method: 'POST', cookie: fan, body: { q: 'x' } }); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'setup');
console.log('ask tests ok');
