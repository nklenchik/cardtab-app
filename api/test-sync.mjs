// Offline tests for sync (SQLite stands in for D1). Run: node test-sync.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = sql => { const o = { args: [], bind(...a) { o.args = a; return o; }, async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const mails = [];
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); } }, ADMIN_EMAILS: '', EMAIL: { async send(m) { mails.push(m); } }, ART: { async get() { return null; } } };
const call = (path, body, cookie) => worker.fetch(new Request('https://api.cardtab.app' + path, { method: 'POST', headers: { origin: 'https://app.cardtab.app', 'content-type': 'application/json', 'cf-connecting-ip': '2.2.2.' + Math.random(), ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body || {}) }), env, {});
async function signIn(email) { await call('/auth/email/start', { email }); const code = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; const r = await call('/auth/email/verify', { email, code }); return (r.headers.get('set-cookie') || '').split(';')[0]; }
const A = await signIn('a@x.com'), B = await signIn('b@x.com');
const sync = async (c, b) => { const r = await call('/auth/sync', b, c); assert.equal(r.status, 200, 'sync ok'); return r.json(); };
assert.equal((await call('/auth/sync', { since: 0 })).status, 401, 'needs sign-in');
// phone sends two entries
const e1 = { id: 'e1aaaa', name: 'Raichu', amount: 1000, updatedAt: '2026-11-06T10:00:00.000Z', deleted: false };
const e2 = { id: 'e2bbbb', name: 'Gengar', amount: 2000, updatedAt: '2026-11-06T10:00:01.000Z', deleted: false };
let r = await sync(A, { since: 0, entries: [e1, e2], meta: { budget: { v: { cents: 15000 }, t: '2026-11-06T10:00:00.000Z' }, plan: { v: 'premium', t: 'z' } } });
assert.equal(r.entries.length, 2); const phoneSeq = r.seq;
assert.deepEqual(r.meta.budget.v, { cents: 15000 }); assert.equal(r.meta.plan, undefined, 'plan is never synced from a device');
// mac starts fresh and gets both
r = await sync(A, { since: 0 }); assert.deepEqual(r.entries.map(e => e.id).sort(), ['e1aaaa', 'e2bbbb']); const macSeq = r.seq;
// mac edits e1 (newer), phone edits e1 offline with an older time: newer wins
await sync(A, { since: macSeq, entries: [{ ...e1, amount: 1500, updatedAt: '2026-11-06T11:00:00.000Z' }] });
r = await sync(A, { since: phoneSeq, entries: [{ ...e1, amount: 999, updatedAt: '2026-11-06T10:30:00.000Z' }] });
const got = r.entries.find(e => e.id === 'e1aaaa'); assert.equal(got.amount, 1500, 'most recent edit wins');
// delete travels
await sync(A, { since: 0, entries: [{ ...e2, deleted: true, updatedAt: '2026-11-06T12:00:00.000Z' }] });
r = await sync(A, { since: r.seq }); assert.equal(r.entries.find(e => e.id === 'e2bbbb').deleted, true);
// accounts are separate
r = await sync(B, { since: 0 }); assert.equal(r.entries.length, 0, 'other accounts see nothing');
// paging: 900 entries come back in two pages
const many = Array.from({ length: 400 }, (_, i) => ({ id: 'm' + String(i).padStart(5, '0'), updatedAt: '2026-11-06T13:00:00.000Z' }));
await sync(B, { since: 0, entries: many }); await sync(B, { since: 0, entries: many.map(e => ({ ...e, id: 'n' + e.id.slice(1) })) }); await sync(B, { since: 0, entries: many.map(e => ({ ...e, id: 'p' + e.id.slice(1) })) });
let p1 = await sync(B, { since: 0 }); assert.equal(p1.more, true); assert.equal(p1.entries.length, 800);
let p2 = await sync(B, { since: p1.seq }); assert.equal(p2.more, false); assert.equal(p2.entries.length, 400);
// too-big entries are refused, not stored
r = await sync(B, { since: p2.seq, entries: [{ id: 'bigone', updatedAt: 'x', note: 'x'.repeat(30000) }] }); assert.deepEqual(r.rejected, ['bigone']);
// delete account removes synced data
await call('/auth/delete', {}, A);
assert.equal(sq.prepare("SELECT COUNT(*) n FROM entries e JOIN users u ON 1=0").get().n, 0);
assert.equal(sq.prepare('SELECT COUNT(*) n FROM entries WHERE user_id NOT IN (SELECT id FROM users)').get().n, 0, 'no leftover entries after delete');
console.log('sync tests ok');
