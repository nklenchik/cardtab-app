// Offline tests for Add from photo (scan.js), against a real SQLite database standing in for D1 and a stand-in for Anthropic. Run: node test-scan.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { tidy } from './src/scan.js';

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


// tidy: only what's usable comes through, grades only on slabs, numbers never invented
let t = tidy({ items: [
  { photo: 1, kind: 'card', game: 'Pokémon', name: ' Charizard ex ', number: '199/165', set: '151', sure: 0.92 },
  { photo: 3, kind: 'graded', name: 'Umbreon VMAX', number: '215/203', grader: 'psa', grade: '10', cert: '1234-5678<x>' },
  { photo: 1, kind: 'graded', name: 'No label', grader: 'XYZ', grade: '11' },
  { photo: 2, kind: 'sealed', name: 'Prismatic Evolutions Elite Trainer Box' },
  { photo: 1, kind: 'card', name: '' }, null, 'junk' ] }, 2);
assert.equal(t.length, 4);
assert.deepEqual([t[0].name, t[0].number, t[0].sure], ['Charizard ex', '199/165', 0.92]);
assert.deepEqual([t[1].photo, t[1].kind, t[1].grader, t[1].grade, t[1].cert], [2, 'graded', 'PSA', '10', '1234-5678x']);
assert.equal(t[2].kind, 'card'); assert.equal(t[2].grade, '');
assert.equal(t[3].kind, 'sealed');
assert.deepEqual(tidy(null, 1), []);
// at most 4 a photo
assert.equal(tidy({ items: Array.from({ length: 6 }, (v, i) => ({ photo: 1, name: 'Card ' + i })) }, 1).length, 4);

const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake jpeg bytes').toString('base64');
const sent = []; let mode = 'ok';
globalThis.fetch = async (url, init) => {
  assert.equal(url, 'https://api.anthropic.com/v1/messages'); assert.equal(init.headers.authorization, 'Bearer test-key');
  const body = JSON.parse(init.body); sent.push(body);
  if (mode === 'down') return new Response('{}', { status: 529 });
  if (mode === 'unread') return Response.json({ stop_reason: 'tool_use', usage: { input_tokens: 1000, output_tokens: 40 }, content: [{ type: 'tool_use', id: 'tu2', name: 'cards', input: { items: [], photos: [{ photo: 1, readable: false, problem: 'glare' }] } }] });
  if (mode === 'partial') return Response.json({ stop_reason: 'tool_use', usage: { input_tokens: 1000, output_tokens: 40 }, content: [{ type: 'tool_use', id: 'tu3', name: 'cards', input: { items: [{ photo: 2, kind: 'card', name: 'Pikachu', number: '58/102' }], photos: [{ photo: 1, readable: false, problem: 'blurry' }, { photo: 2, readable: true, problem: 'far' }] } }] });
  assert.equal(body.model, 'claude-haiku-5-5'); assert.deepEqual(body.tool_choice, { type: 'tool', name: 'cards' });
  const imgs = body.messages[0].content.filter(c => c.type === 'image');
  assert.ok(imgs.length >= 1); assert.equal(imgs[0].source.media_type, 'image/jpeg');
  return Response.json({ stop_reason: 'tool_use', usage: { input_tokens: 1600, output_tokens: 120 }, content: [{ type: 'tool_use', id: 'tu1', name: 'cards', input: { items: [
    { photo: 1, kind: 'card', game: 'Pokémon', name: 'Charizard ex', number: '199/165', set: 'Scarlet & Violet 151', sure: 0.9 },
    { photo: imgs.length, kind: 'graded', game: 'Pokémon', name: 'Umbreon VMAX', number: '215/203', grader: 'PSA', grade: '10' } ] } }] });
};

const fan = await signIn('fan@x.com', '2.2.2.2');
assert.equal((await call('/auth/scan', { method: 'POST', body: { images: [IMG] } })).status, 401);   // signed out
let r = await call('/auth/scan', { method: 'POST', cookie: fan, body: { check: true } }), j = await r.json();
assert.equal(j.limit, 5); assert.equal(j.left, 5); assert.equal(j.plan, 'free');
// one photo: two items back, one photo counted
r = await call('/auth/scan', { method: 'POST', cookie: fan, body: { images: [IMG] } }); j = await r.json();
assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.items.length, 2); assert.equal(j.items[1].grade, '10'); assert.equal(j.left, 4);
r = await call('/auth/scan', { method: 'POST', cookie: fan, body: { images: [IMG, IMG] } }); assert.equal((await r.json()).left, 2);
// bad input: not an image, too many photos, nothing sent
r = await call('/auth/scan', { method: 'POST', cookie: fan, body: { images: ['data:text/html;base64,PGI+'] } }); assert.equal(r.status, 400);
r = await call('/auth/scan', { method: 'POST', cookie: fan, body: { images: [IMG, IMG, IMG, IMG, IMG] } }); assert.equal(r.status, 400);
r = await call('/auth/scan', { method: 'POST', cookie: fan, body: {} }); assert.equal(r.status, 400);
// two photos at once count as two; then the free limit stops the next one before anything is sent
r = await call('/auth/scan', { method: 'POST', cookie: fan, body: { images: [IMG, IMG] } }); j = await r.json();
assert.equal(r.status, 200); assert.equal(j.left, 0); assert.equal(j.items[1].photo, 2);
const before = sent.length;
r = await call('/auth/scan', { method: 'POST', cookie: fan, body: { images: [IMG] } }); j = await r.json();
assert.equal(r.status, 429); assert.equal(j.error, 'limit'); assert.equal(sent.length, before);
// shares Ask's spend record
assert.ok(sq.prepare('SELECT tin FROM ask_spend').get().tin === 4800);
// Anthropic busy: a clear word back, nothing counted
const boss = await signIn('boss@x.com', '3.3.3.3'); mode = 'down';
r = await call('/auth/scan', { method: 'POST', cookie: boss, body: { images: [IMG] } }); j = await r.json();
assert.equal(r.status, 502); assert.equal(j.error, 'busy');
assert.equal((sq.prepare("SELECT n FROM scan_usage WHERE user_id=(SELECT id FROM users WHERE email='boss@x.com')").get() || { n: 0 }).n, 0);
// admins aren't limited
mode = 'ok'; for (let i = 0; i < 5; i++) { r = await call('/auth/scan', { method: 'POST', cookie: boss, body: { images: [IMG] } }); assert.equal(r.status, 200); }
// v52.98: a photo that couldn't be read (nothing found on it) doesn't count; problems come back so the app can say retake
const pro = await signIn('pro@x.com', '4.4.4.4'); const used = id => (sq.prepare("SELECT n FROM scan_usage WHERE user_id=(SELECT id FROM users WHERE email=?)").get(id) || { n: 0 }).n;
mode = 'unread'; r = await call('/auth/scan', { method: 'POST', cookie: pro, body: { images: [IMG] } }); j = await r.json();
assert.equal(r.status, 200); assert.equal(j.items.length, 0); assert.equal(j.uncounted, 1); assert.deepEqual(j.issues.map(x => x.problem), ['glare']); assert.equal(used('pro@x.com'), 0); assert.equal(j.left, 5);
mode = 'partial'; r = await call('/auth/scan', { method: 'POST', cookie: pro, body: { images: [IMG, IMG] } }); j = await r.json();
assert.equal(j.uncounted, 1); assert.deepEqual(j.issues.map(x => x.photo + x.problem), ['1blurry', '2far']); assert.equal(used('pro@x.com'), 1);
console.log('scan tests ok');
