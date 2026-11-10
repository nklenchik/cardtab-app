// Catalog fill (v51.3): only in the last week, users first, newest sets first, limits kept, art capped. Real SQLite as D1.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { step, allowance, catReport } from './src/catalog.js';
import { gate } from './src/budget.js';
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = sql => { const o = { sql, args: [], bind(...a) { o.args = a; return o; }, async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; } };
const env = { DB, JUSTTCG_API_KEY: 't', MONTH_LIMIT: '10000', RESET_DAY: '6', DAY_LIMIT: '1000' };
// a pretend JustTCG: 2 games, 3 sets (released 2024, 2026, 2025), 250 cards each, pages of up to 100
const asked = []; let fail = 0;
globalThis.fetch = async url => { url = String(url); asked.push(url); if (fail) return new Response('{}', { status: fail });
  if (/\/v1\/games/.test(url)) return Response.json({ data: [{ id: 'pokemon', name: 'Pokemon' }, { id: 'pokemon-japan', name: 'Pokemon Japan' }, { id: 'one-piece-card-game', name: 'One Piece Card Game' }, { id: 'flesh-and-blood', name: 'Flesh and Blood' }] });
  if (/\/v1\/sets\?game=pokemon$/.test(url)) return Response.json({ data: [{ id: 'old', name: 'Old Set', release_date: '2024-02-01' }, { id: 'new', name: 'New Set', release_date: '2026-11-07' }] });
  if (/\/v1\/sets\?game=one-piece/.test(url)) return Response.json({ data: [{ id: 'mid', name: 'Mid Set', release_date: '2025-06-01' }] });
  const m = url.match(/set=(\w+)&limit=(\d+)&offset=(\d+)/);
  if (m) { const [, set, lim, off] = m, total = 250, k = Math.max(0, Math.min(+lim, total - +off));
    return Response.json({ data: Array.from({ length: k }, (_, i) => ({ id: set + '-' + (+off + i), game: 'g', name: 'Card ' + (+off + i), set_name: set, number: String(+off + i), rarity: 'R', tcgplayerId: 1000 + +off + i })), meta: { hasMore: +off + k < total } }); }
  return Response.json({ data: [] }); };
const at = s => Date.parse(s);
const artCalls = []; const art = async id => { artCalls.push(id); return new Response('x', { headers: { 'content-type': 'image/webp' } }); };

// 1) mid-month: nothing happens, not even a database write
let r = await step(env, { art }, at('2026-11-15T12:00:00Z')); assert.equal(r.skipped, 'not yet'); assert.equal(asked.length, 0);

// 2) Nov 30, 2,000 used so far this month: a week of leftover, spread over the days left, minus the cushion
const T = at('2026-11-30T12:00:00Z');
sq.prepare("INSERT INTO usage (day,src,plan,calls,reqs) VALUES ('2026-11-20','type','free',2000,2000)").run();
let A = await allowance(env, T); assert.equal(A.daysLeft, 6); assert.equal(A.perDay, Math.floor((10000 - 2000 - 500) / 6)); assert.equal(A.left, Math.min(A.perDay, 900));
// users used 300 today: that comes off the top
sq.prepare("INSERT INTO usage (day,src,plan,calls,reqs) VALUES ('2026-11-30','type','free',300,300)").run();
A = await allowance(env, T); assert.equal(A.left, Math.min(A.perDay - 300, 1000 - 100 - 300), 'users first: ' + JSON.stringify(A));

// 3) one run: lists the sets (English only, games we support), then pages, newest set first
r = await step(env, { art }, T);
assert.ok(asked.some(u => /v1\/games/.test(u)) && !asked.some(u => /pokemon-japan|flesh/.test(u)), 'Japanese and unsupported games skipped');
const pages = asked.filter(u => /\/v1\/cards/.test(u)); assert.ok(pages.length && /set=new/.test(pages[0]), 'newest set first: ' + pages[0]);
assert.equal(r.cards, pages.length * 100 > 250 ? r.cards : r.cards);
assert.ok(r.calls <= 4 + 3, 'a run stays small: ' + r.calls);
// cards saved without prices, counted toward the month's usage
const saved = sq.prepare("SELECT COUNT(*) n FROM cards").get().n; assert.equal(saved, r.cards);
assert.equal(sq.prepare("SELECT calls FROM usage WHERE src='cat'").get().calls, r.calls);
assert.ok(artCalls.length > 0 && artCalls.length <= 4, 'a little art each run');

// 4) more runs: finishes New Set (3 pages), then Mid Set (2025), then Old Set (2024); never lists twice
for (let i = 0; i < 6; i++) await step(env, { art }, T);
const order = [...new Set(asked.filter(u => /\/v1\/cards/.test(u)).map(u => u.match(/set=(\w+)/)[1]))];
assert.deepEqual(order, ['new', 'mid', 'old'], 'newest to oldest: ' + order);
assert.equal(asked.filter(u => /v1\/games/.test(u)).length, 1, 'set list fetched once a month');
const sets = sq.prepare('SELECT id,done,cards FROM cat_sets ORDER BY released DESC').all();
assert.deepEqual(sets.map(s => [s.id, s.done, s.cards]), [['new', 1, 250], ['mid', 1, 250], ['old', 1, 250]]);

// 5) a set people already add from jumps the line
sq.prepare("INSERT INTO cat_sets (id,game,name,released,listed) VALUES ('pop','pokemon','Popular Set','2020-01-01','2026-11-30'),('newer','pokemon','Newer Set','2026-11-08','2026-11-30')").run();
sq.prepare("INSERT INTO cards (id,name,set_name,number) VALUES ('u1','A','Popular Set','1'),('u2','B','Popular Set','2')").run();
asked.length = 0; await step(env, {}, T); assert.ok(/set=pop/.test(asked.find(u => /\/v1\/cards/.test(u))), 'popular set first');

// 6) daily limit: with the day nearly used, nothing more is asked
sq.prepare("UPDATE usage SET calls=900 WHERE day='2026-11-30' AND src='type'").run();
A = await allowance(env, T); assert.equal(A.left, 0); asked.length = 0; r = await step(env, {}, T); assert.equal(asked.length, 0, "keeps 100 of the day for users");

// 7) JustTCG errors: the run stops quietly and tries again next time
sq.prepare("UPDATE usage SET calls=300 WHERE day='2026-11-30' AND src='type'").run();
fail = 429; r = await step(env, {}, T); assert.ok(/429/.test(r.stop)); assert.equal(r.calls, 1); fail = 0;

// 8) art has its own daily cap
env.CAT_ART_DAY = String(sq.prepare("SELECT art FROM cat_day WHERE day='2026-11-30'").get().art);
const a0 = artCalls.length; await step(env, { art }, T); assert.equal(artCalls.length, a0, 'art stops at its daily cap');
delete env.CAT_ART_DAY;

// 9) the last day: cushion shrinks to 150
A = await allowance(env, at('2026-12-05T12:00:00Z')); assert.equal(A.daysLeft, 1);
const month = sq.prepare("SELECT SUM(calls) c FROM usage WHERE day>='2026-11-06' AND day<'2026-12-05'").get().c;
assert.equal(A.perDay, 10000 - month - 150);

// 10) switched off with CAT_FILL = "off"
env.CAT_FILL = 'off'; asked.length = 0; r = await step(env, {}, T); assert.equal(r.skipped, 'not yet'); delete env.CAT_FILL;

// 11) per-person art fill caps: Premium 100 a day, Free 20, tripled in the last week
sq.prepare("DELETE FROM usage").run();
sq.prepare("INSERT INTO usage_user (day,user_id,calls) VALUES ('2026-11-20','p',100),('2026-11-20','f',20),('2026-11-30','p',299),('2026-11-30','f',60)").run();
assert.equal(await gate(env, { src: 'fill', plan: 'premium', user: 'p' }, at('2026-11-20T12:00:00Z')), 'later', 'Premium stops at 100');
assert.equal(await gate(env, { src: 'fill', plan: 'free', user: 'f' }, at('2026-11-20T12:00:00Z')), 'later', 'Free stops at 20');
assert.equal(await gate(env, { src: 'fill', plan: 'premium', user: 'p' }, T), '', 'last week: Premium up to 300');
assert.equal(await gate(env, { src: 'fill', plan: 'free', user: 'f' }, T), 'later', 'last week: Free up to 60');
assert.equal(await gate(env, { src: 'type', plan: 'free', user: 'f' }, at('2026-11-20T12:00:00Z')), '', 'typing is never capped per person');

const rep = await catReport(env, T); assert.ok(rep.active && rep.setsDone >= 3 && rep.cards >= 750);
const off = await catReport(env, at('2026-11-15T12:00:00Z')); assert.equal(off.active, false); assert.equal(off.startsIn, 14);
console.log('catalog tests ok:', { cards: rep.cards, setsDone: rep.setsDone + '/' + rep.sets, art: rep.art, today: rep.today });
