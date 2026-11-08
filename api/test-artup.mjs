// Offline tests for uploaded card photos and shared default art (v50.46). Run: node test-artup.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { picInfo } from './src/artup.js';

const SP = new URL('./test-fixtures/', import.meta.url).pathname;
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const store = new Map();
const ART = { async get(k) { const v = store.get(k); return v ? { body: new Blob([v.b]).stream(), httpMetadata: v.m, async text() { return new TextDecoder().decode(v.b); }, async arrayBuffer() { return v.b.buffer.slice(v.b.byteOffset, v.b.byteOffset + v.b.byteLength); } } : null; },
  async head(k) { return store.has(k) ? {} : null; }, async put(k, b, o) { store.set(k, { b: new Uint8Array(b instanceof ArrayBuffer ? b : b.buffer ? b : await new Response(b).arrayBuffer()), m: (o || {}).httpMetadata }); } };
let aiAnswer = '{"card":true,"name_read":"Charizard ex","number_read":"223/197","same_card":true,"unsafe":false}', aiCalls = 0;
const AI = { async run(model, inp) { aiCalls++; assert.ok(Array.isArray(inp.image) && inp.image.length > 1000); return { response: aiAnswer }; } };
const mails = [];
const env = { DB, ART, AI, ALLOWED_ORIGIN: 'https://app.cardtab.app', APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } } };
const O = 'https://app.cardtab.app';
const call = (path, { method = 'GET', body, form, cookie, ip = '1.1.1.1' } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: Object.assign({ origin: O, 'cf-connecting-ip': ip }, form ? {} : { 'content-type': 'application/json' }, cookie ? { cookie } : {}), body: form || (body ? JSON.stringify(body) : undefined) }), env, { waitUntil() {} });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email, ip) { await call('/auth/email/start', { method: 'POST', body: { email }, ip }); const c = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { email, code: c }, ip })); }
const fan = await signIn('fan@x.com', '2.2.2.2'), boss = await signIn('boss@x.com', '3.3.3.3');
const D = readFileSync(SP + 't-detail.webp'), L = readFileSync(SP + 't-list.webp'), SM = readFileSync(SP + 't-small.jpg'), LAND = readFileSync(SP + 't-land.webp');
assert.deepEqual([picInfo(D).w, picInfo(D).h, picInfo(D).type], [640, 894, 'image/webp']); assert.deepEqual([picInfo(SM).w, picInfo(SM).h, picInfo(SM).type], [400, 559, 'image/jpeg']);
sq.prepare("INSERT INTO cards (id,game,name,set_name,number,rarity,tcgplayer_id,fetched_at) VALUES ('sv3-223','pokemon','Charizard ex','Obsidian Flames','223/197','SIR',NULL,0)").run();
sq.prepare("INSERT INTO cards (id,game,name,set_name,number,rarity,tcgplayer_id,fetched_at) VALUES ('sv3-125','pokemon','Charizard ex','Obsidian Flames','125/197','DR',NULL,0)").run();
const fd = (d, l, extra = {}) => { const f = new FormData(); f.set('detail', new Blob([d]), 'd'); f.set('list', new Blob([l]), 'l'); for (const k in extra) f.set(k, extra[k]); return f; };
// signed out: no
assert.equal((await call('/api/art/upload', { method: 'POST', form: fd(D, L) })).status, 401);
// a private photo: stored, shows on the entry, no check run
let r = await (await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(D, L, { name: 'my card' }) })).json();
assert.ok(r.ok && /^\/up\/.+\/detail$/.test(r.art.detail) && !r.share); assert.equal(aiCalls, 0);
let g = await call(r.art.detail); assert.equal(g.status, 200); assert.equal(g.headers.get('content-type'), 'image/webp');
// junk, sideways and oversize files are refused
assert.equal((await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(Buffer.from('hello world, not a picture at all, nope'), L) })).status, 400);
assert.equal((await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(LAND, L) })).status, 400);
assert.equal((await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(L, D) })).status, 400, 'list too big');
// shared, passes the check: becomes the card's default (the card had no auto-fill art)
assert.equal((await call('/art/sv3-223/detail')).status, 404);
r = await (await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(D, L, { card: 'sv3-223', name: 'Charizard ex 223/197', share: '1' }) })).json();
assert.equal(r.share.status, 'shared'); assert.equal(aiCalls, 1);
g = await call('/art/sv3-223/detail'); assert.equal(g.status, 200); assert.equal(g.headers.get('x-art-why'), 'shared');
// a second share for the same card waits for review
r = await (await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(D, L, { card: 'sv3-223', share: '1' }) })).json(); assert.equal(r.share.status, 'review');
// flagged by the check: waits for review with the reason
aiAnswer = 'Sure! {"card":true,"name_read":"Blastoise","number_read":"","same_card":false,"unsafe":false}';
r = await (await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(D, L, { card: 'sv3-125', share: '1' }) })).json(); assert.equal(r.share.status, 'review');
assert.equal((await call('/art/sv3-125/detail')).status, 404);
// too soft to share, or a typed (unmatched) card: kept private, sharing declined
r = await (await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(SM, L, { card: 'sv3-125', share: '1' }) })).json(); assert.equal(r.share.status, 'no'); assert.ok(r.art.detail);
r = await (await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(D, L, { card: 'made-up-card', share: '1' }) })).json(); assert.equal(r.share.status, 'no');
// the check can't run: review
const keep = env.AI; delete env.AI; r = await (await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(D, L, { card: 'sv3-125', share: '1' }) })).json(); assert.equal(r.share.status, 'review'); env.AI = keep;
// the queue: admins only
assert.equal((await call('/api/admin/art', { cookie: fan })).status, 403);
let q = await (await call('/api/admin/art', { cookie: boss })).json();
assert.equal(q.items.length, 3); assert.ok(q.items.some(x => x.reason === 'Doesn’t look like this card' && x.seen === 'Blastoise'));
const flagged = q.items.find(x => x.card_id === 'sv3-125' && x.seen === 'Blastoise');

assert.ok((await (await call('/api/admin/art', { method: 'POST', cookie: boss, body: { id: flagged.id, action: 'approve' } })).json()).ok);
assert.equal((await call('/art/sv3-125/detail')).status, 200, 'approved: now the default');
const other = q.items.find(x => x.id !== flagged.id); await call('/api/admin/art', { method: 'POST', cookie: boss, body: { id: other.id, action: 'reject' } });
q = await (await call('/api/admin/art', { cookie: boss })).json(); assert.equal(q.items.length, 1);
// daily cap
for (let i = 0; i < 40; i++) sq.prepare("INSERT INTO art_uploads (id,user_id,status,created) VALUES (?,?,?,?)").run('x' + i, sq.prepare("SELECT id FROM users WHERE email='fan@x.com'").get().id, 'private', Math.floor(Date.now() / 1000));
assert.equal((await call('/api/art/upload', { method: 'POST', cookie: fan, form: fd(D, L) })).status, 429);
// the check's decision rules, directly
import('./src/artup.js').then(async ({ aiCheck, numSame }) => {
  assert.equal(numSame('223/197', '223/197'), true); assert.equal(numSame('0223 / 197', '223/197'), true); assert.equal(numSame('223', '223/197'), true);
  assert.equal(numSame('224/197', '223/197'), false); assert.equal(numSame('BT29-086', 'bt29-86'), true); assert.equal(numSame('', '223/197'), null);
  const e2 = (ans) => ({ AI: { async run() { return { response: ans }; } } }), px = new Uint8Array(2000);
  const W = { name: 'Charizard ex', number: '223/197', set: 'Obsidian Flames', game: 'pokemon' };
  // a Japanese printing: the name is in Japanese, the model says it's the same card -> passes
  assert.equal((await aiCheck(e2('{"card":true,"name_read":"リザードンex","name_english":"Charizard ex","number_read":"","same_card":true,"unsafe":false}'), px, W)).ok, true);
  // number matches even though the name couldn't be judged -> passes
  let c = await aiCheck(e2('{"card":true,"name_read":"","number_read":"223/197","same_card":false,"unsafe":false}'), px, W); assert.equal(c.ok, true); assert.equal(c.by, 'number');
  // a different card of the same character (number differs) -> held, even if the model says same
  c = await aiCheck(e2('{"card":true,"name_read":"Charizard ex","number_read":"125/197","same_card":true,"unsafe":false}'), px, W); assert.equal(c.ok, false); assert.equal(c.reason, 'Card number doesn’t match');
  // nothing confirmed -> held
  c = await aiCheck(e2('{"card":true,"name_read":"","number_read":"","unsafe":false}'), px, W); assert.equal(c.ok, false); assert.equal(c.reason, 'Couldn’t confirm it’s this card');
  // unsafe wins over everything
  c = await aiCheck(e2('{"card":true,"name_read":"Charizard ex","number_read":"223/197","same_card":true,"unsafe":true}'), px, W); assert.equal(c.ok, false); assert.equal(c.reason, 'Might be inappropriate');
  console.log('art upload tests ok');
});
// v50.51: the backup download and the daily check's backup line
{
  const st = { day: '2026-11-08', at: Math.floor(Date.now() / 1000) - 3600, ok: true, users: '12', entries: '340', artBytes: 2e9, backupBytes: 2.1e9 };
  await ART.put('_backup/status.json', new TextEncoder().encode(JSON.stringify(st)), {}); await ART.put('_backup/latest.sql.gz', new Uint8Array([31, 139, 8, 0]), {});
  assert.equal((await call('/api/admin/backup', { cookie: fan })).status, 403);
  const r = await call('/api/admin/backup', { cookie: boss }); assert.equal(r.status, 200); assert.ok(/card-tab-database-2026-11-08/.test(r.headers.get('content-disposition')));
  assert.equal((await call('/art/_backup/latest.sql.gz')).status, 404, 'backups are never public');
  const { runHealth } = await import('./src/health.js');
  const h = await runHealth(Object.assign({}, env, { ADMIN_EMAILS: '' }), { send: false }); const b = h.checks.find(c => c.key === 'backup');
  assert.ok(b.ok && /12 accounts, 340 entries/.test(b.note) && /4\.10 of 10 GB/.test(b.note), b.note);
  st.at -= 40 * 3600; await ART.put('_backup/status.json', new TextEncoder().encode(JSON.stringify(st)), {});
  const h2 = await runHealth(Object.assign({}, env, { ADMIN_EMAILS: '' }), { send: false }); assert.equal(h2.checks.find(c => c.key === 'backup').ok, false);
  console.log('backup checks ok');
}
