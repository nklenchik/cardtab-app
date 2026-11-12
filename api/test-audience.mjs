// Audience (v52.43): campaign + ad from the site's tag, spend typed by an admin, and best users (Premium vs Free) with
// gifted accounts, admins and people who switched off "Share anonymous usage" left out. Run: node test-audience.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { const r = sq.prepare(sql).run(...o.args); return { meta: { changes: r.changes } }; } }; return o; };
const mails = [];
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; } }, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } } };
const call = (path, { method = 'GET', body, cookie, ua } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: 'https://app.cardtab.app', 'content-type': 'application/json', 'user-agent': ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email, ua) { mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email } });
  const tok = /\?login=([\w-]+)/.exec(mails.find(m => m.to === email).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { token: tok }, ua })); }
const uid = e => sq.prepare('SELECT id FROM users WHERE email=?').get(e).id;
const ent = (u, i, type, platform, game, recent = true) => sq.prepare('INSERT INTO entries (user_id,id,data,updated_at,deleted,seq) VALUES (?,?,?,?,0,?)').run(u, 'e' + i, JSON.stringify({ type, platform, game, createdAt: recent ? new Date().toISOString() : '2025-01-01T00:00:00Z' }), new Date().toISOString(), i);

const a = await signIn('a@x.com'), b = await signIn('b@x.com', 'Mozilla/5.0 (Linux; Android 15) Chrome/131 Mobile'), c = await signIn('c@x.com'), g = await signIn('gift@x.com'), o = await signIn('off@x.com');
const boss = await signIn('boss@x.com');
// first events carry the site's tag: source~sections~demos~campaign~ad
await call('/auth/ev', { method: 'POST', cookie: a, body: { ev: [{ e: 'journey', d: 'facebook~hero~add~Fall Promo~Video 1' }] } });
await call('/auth/ev', { method: 'POST', cookie: b, body: { ev: [{ e: 'journey', d: 'facebook~hero~~fall promo~carousel' }] } });
await call('/auth/ev', { method: 'POST', cookie: c, body: { ev: [{ e: 'journey', d: 'google~~~' }] } });
sq.prepare("UPDATE users SET plan='premium' WHERE email IN ('a@x.com','gift@x.com')").run();
sq.prepare("UPDATE an_user SET up_day=? WHERE uid=?").run(new Date().toISOString().slice(0, 10), uid('a@x.com'));
try { sq.prepare('INSERT INTO billing (user_id, gift) VALUES (?,1)').run(uid('gift@x.com')); } catch (e) { sq.exec('CREATE TABLE IF NOT EXISTS billing (user_id TEXT PRIMARY KEY, gift INTEGER)'); sq.prepare('INSERT INTO billing (user_id, gift) VALUES (?,1)').run(uid('gift@x.com')); }
sq.prepare("INSERT INTO user_meta (user_id,k,v,updated_at,seq) VALUES (?, 'shareUsage', 'false', '', 1)").run(uid('off@x.com'));
sq.prepare("INSERT INTO user_meta (user_id,k,v,updated_at,seq) VALUES (?, 'games', ?, '', 1)").run(uid('a@x.com'), JSON.stringify(['Pokémon', 'One Piece']));
let i = 0; for (let k = 0; k < 8; k++) ent(uid('a@x.com'), i++, 'sale', 'eBay', 'pokemon'); for (let k = 0; k < 2; k++) ent(uid('a@x.com'), i++, 'purchase', 'Card Show', 'pokemon');
for (let k = 0; k < 6; k++) ent(uid('b@x.com'), i++, 'purchase', 'TCGplayer', 'Magic: The Gathering', false);
ent(uid('off@x.com'), i++, 'sale', 'Whatnot', 'pokemon');

// spend: admins only
assert.equal((await call('/auth/admin/adspend', { method: 'POST', cookie: a, body: { camp: 'fall promo', usd: 50 } })).status, 403);
assert.equal((await call('/auth/admin/adspend', { method: 'POST', cookie: boss, body: { camp: 'Fall Promo', usd: 49.999 } })).status, 200);
const st = await (await call('/auth/admin/stats', { cookie: boss })).json();
const C = st.campaigns; assert.equal(C.spend['fall promo'], 50);
assert.deepEqual(C.rows.map(r => [r.camp, r.ad, r.n, r.up]).sort(), [['fall promo', 'carousel', 1, 0], ['fall promo', 'video 1', 1, 1]]);
const B = st.best; assert.equal(B.premium.n, 1, 'gifted left out'); assert.equal(B.free.n, 2, 'b and c (off@ left out, admin left out)');
assert.deepEqual(B.premium.dims.game, { 'Pokémon': 1, 'One Piece': 1 }); assert.deepEqual(B.premium.dims.sells, { eBay: 1 }); assert.deepEqual(B.premium.dims.kind, { 'Mostly sells': 1 });
assert.deepEqual(B.premium.dims.activity, { '6–20 a month': 1 });
assert.deepEqual(B.free.dims.kind, { 'Mostly buys': 1, 'Just getting started': 1 }); assert.deepEqual(B.free.dims.buys, { TCGplayer: 1 }); assert.equal(B.free.dims.game.Magic, 1);
assert.equal(B.free.dims.device.Android, 1); assert.ok(!B.free.dims.sells.Whatnot, 'off@ entries not counted');
// removing spend
await call('/auth/admin/adspend', { method: 'POST', cookie: boss, body: { camp: 'fall promo', usd: 0 } });
assert.equal((await (await call('/auth/admin/stats', { cookie: boss })).json()).campaigns.spend['fall promo'], undefined);
console.log('audience tests passed');
