// Offline tests for Add from photo (scan.js), against a real SQLite database standing in for D1 and a stand-in for Anthropic. Run: node test-scan.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { tidy, itemsFrom, learnKey } from './src/scan.js';

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
  if (body.stream) {   // Anthropic's streaming format, the tool input arriving in small pieces
    const json = JSON.stringify({ photos: [{ photo: 1, readable: true, problem: '' }], items: [{ photo: 1, kind: 'card', name: 'Charizard ex', number: '199/165', set: '151', sure: 0.9 }, { photo: 1, kind: 'card', name: 'Pikachu "Promo" {x}', number: '', sure: 0.4 }] });
    const ev = [{ type: 'message_start', message: { usage: { input_tokens: 2100, output_tokens: 1 } } }, { type: 'content_block_start', content_block: { type: 'tool_use', name: 'cards' } }];
    for (let i = 0; i < json.length; i += 7) ev.push({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: json.slice(i, i + 7) } });
    ev.push({ type: 'message_delta', usage: { output_tokens: 140 } }, { type: 'message_stop' });
    return new Response(ev.map(e => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join(''), { headers: { 'content-type': 'text/event-stream' } });
  }
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
// itemsFrom: complete objects only, braces inside strings don't confuse it
let g = itemsFrom('{"photos":[],"items":[{"name":"A {b}","n":1},{"name":"C', 0);
assert.deepEqual(g.found.map(x => x.name), ['A {b}']); g = itemsFrom('{"photos":[],"items":[{"name":"A {b}","n":1},{"name":"C"}]}', g.next); assert.deepEqual(g.found.map(x => x.name), ['C']); assert.ok(g.end);
// streamed: one line per card as it's read, then done with the scan id
mode = 'ok';
r = await call('/auth/scan', { method: 'POST', cookie: pro, body: { images: [IMG], stream: true } });
assert.equal(r.headers.get('content-type'), 'application/x-ndjson');
const lines = (await r.text()).trim().split('\n').map(l => JSON.parse(l));
assert.deepEqual(lines.filter(l => l.item).map(l => l.item.name), ['Charizard ex', 'Pikachu "Promo" {x}']);
const done = lines.find(l => l.done).done; assert.equal(done.items.length, 2); assert.ok(done.scan > 0);
const lg = sq.prepare('SELECT * FROM scan_log WHERE id=?').get(done.scan); assert.equal(lg.tin, 2100); assert.equal(lg.tout, 140); assert.equal(lg.items, 2);
assert.equal(sq.prepare('SELECT COUNT(*) n FROM scan_item WHERE scan_id=?').get(done.scan).n, 2);
// scans add tokens to the shared cap but don't count as Ask questions
assert.equal(sq.prepare('SELECT n FROM ask_spend').get().n, 0);
// feedback: what happened to each row; fixes that were added teach the next scan once two scans agree
const fb = (sid, who) => call('/auth/scan', { method: 'POST', cookie: who, body: { feedback: { scan: sid, added: 2, rows: [{ i: 0, outcome: 'kept', auto: true, final: 'Charizard ex - 199/165 - 151' }, { i: 1, outcome: 'changed', auto: false, final: 'Pikachu - 4/53 - Promo' }] } } });
assert.equal((await fb(done.scan, fan)).status, 404);   // someone else's scan
assert.equal((await fb(done.scan, pro)).status, 200);
assert.equal((await (await fb(done.scan, pro)).json()).again, true);   // only once
assert.equal(sq.prepare('SELECT outcome FROM scan_item WHERE scan_id=? AND idx=1').get(done.scan).outcome, 'changed');
const k = learnKey({ name: 'Pikachu "Promo" {x}', number: '', set: '' });
assert.equal(sq.prepare('SELECT n FROM scan_learn WHERE k=?').get(k).n, 1);
r = await call('/auth/scan', { method: 'POST', cookie: pro, body: { images: [IMG], stream: true } });
let d2 = (await r.text()).trim().split('\n').map(l => JSON.parse(l)).find(l => l.done).done;
assert.equal(d2.items[1].learned, undefined);   // one scan isn't enough
await fb(d2.scan, pro);
r = await call('/auth/scan', { method: 'POST', cookie: pro, body: { images: [IMG], stream: true } });
d2 = (await r.text()).trim().split('\n').map(l => JSON.parse(l)).find(l => l.done).done;
assert.equal(d2.items[1].learned, 'Pikachu - 4/53 - Promo'); assert.equal(d2.items[0].learned, undefined);
// stats for the dashboard
const { scanStats } = await import('./src/scan.js');
const today = new Date().toISOString().slice(0, 10), stt = await scanStats(env, today, today);
assert.ok(stt.scans >= 3 && stt.tin > 0); assert.ok(stt.fixes.some(f => f.f === 'Pikachu - 4/53 - Promo')); assert.equal(stt.learned, 1);
// v53.03 Use your phone: a code for the same account only, then the phone's cards show on the computer
const P = (cookie, pair) => call('/auth/scan', { method: 'POST', cookie, body: { pair } });
r = await P(fan, { op: 'new' }); const pc = (await r.json()).code; assert.ok(/^[A-Za-z0-9_-]{20,}$/.test(pc));
assert.equal((await (await P(fan, { op: 'poll', code: pc })).json()).joined, false);
r = await P(pro, { op: 'join', code: pc }); assert.equal(r.status, 403); assert.equal((await r.json()).error, 'other');   // another account
assert.equal((await P(fan, { op: 'join', code: 'nope-nope-nope-nope-nope' })).status, 410);
assert.equal((await P(fan, { op: 'join', code: pc })).status, 200);
await P(fan, { op: 'added', code: pc, items: [{ id: 'e1', name: 'Pikachu', meta: 'Base Set · No. 58/102 · Purchase', amt: '$3.00', art: 'javascript:alert(1)' }, { id: 'e2', name: 'Raichu', meta: '', amt: '$9.00', art: 'https://art.cardtab.app/x.webp' }] });
j = await (await P(fan, { op: 'poll', code: pc })).json(); assert.equal(j.joined, true); assert.equal(j.items.length, 2); assert.equal(j.items[0].art, ''); assert.equal(j.items[1].art, 'https://art.cardtab.app/x.webp');
await P(fan, { op: 'removed', code: pc, ids: ['e1'] }); j = await (await P(fan, { op: 'poll', code: pc })).json(); assert.deepEqual(j.items.map(x => x.id), ['e2']);
assert.equal((await P(pro, { op: 'poll', code: pc })).status, 403);
await P(fan, { op: 'end', code: pc }); assert.equal((await P(fan, { op: 'poll', code: pc })).status, 410);
console.log('scan tests ok');
