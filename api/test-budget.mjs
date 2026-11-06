// Card data budget: counting, catalog-first, fill pacing, free accounts last. Real SQLite standing in for D1.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { cycle, report } from './src/budget.js';
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = sql => { const o = { sql, args: [], bind(...a) { o.args = a; return o; }, async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; } };
let up = 0;
globalThis.fetch = async url => { up++; url = String(url);
  if (/\/v1\/games/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'pokemon', name: 'Pokemon' }] }));
  if (/q=Raichu/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'r1', game: 'pokemon', name: 'Raichu', set_name: 'Base Set', number: '014/102', rarity: 'Holo Rare', tcgplayerId: 42354 }, { id: 'r3', game: 'pokemon', name: 'Raichu', set_name: 'Jungle', number: '14/64', rarity: 'Rare', tcgplayerId: 1 }] }));
  return new Response(JSON.stringify({ data: [] })); };
const env = { DB, JUSTTCG_API_KEY: 't', ALLOWED_ORIGIN: 'https://app.cardtab.app', MONTH_LIMIT: '3000', RESET_DAY: '6', ART: { async get() { return null; } } };
const now = Math.floor(Date.now() / 1000);
sq.prepare("INSERT INTO users (id,email,plan,created_at) VALUES ('uf','f@x.com','free',?),('up','p@x.com','premium',?)").run(now, now);
sq.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?),(?,?,?,?)").run(await sha('tf'), 'uf', now, now + 9e5, await sha('tp'), 'up', now, now + 9e5);
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
const get = (q, cookie) => worker.fetch(new Request('https://api.cardtab.app/api/lookup?' + q, { headers: { origin: 'https://app.cardtab.app', ...(cookie ? { cookie: 'ct_s=' + cookie } : {}) } }), env, {});

// typing: counted, cached, and credentials allowed for the app
let r = await get('name=Raichu&game=Pok%C3%A9mon'); assert.equal(r.status, 200); assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
assert.equal((await r.json()).cards.length, 2); const a = up;
await get('name=Raichu&game=Pok%C3%A9mon'); assert.equal(up, a, 'cached');
// short names never ask
await get('name=Ra'); assert.equal(up, a, 'two letters: no lookup');
// catalog first: a name + number we already know is answered without asking, even written differently
r = await (await get('name=Raichu&number=14/102&src=fill', 'tp')).json(); assert.equal(up, a, 'answered from our own catalog'); assert.deepEqual(r.cards.map(c => c.id), ['r1']);
let u = sq.prepare("SELECT src,plan,SUM(calls) c,SUM(reqs) q FROM usage GROUP BY src,plan ORDER BY src,plan").all();
assert.ok(u.find(x => x.src === 'type' && x.c === a), 'typing calls counted ' + JSON.stringify(u));
// fill pacing: month 300, days left d -> share = 300/d; fill gets 60%, free 30% of that
const share = Math.floor(3000 / cycle(env).daysLeft), fillCap = share * 0.6, freeCap = fillCap * 0.3;
let freeOk = 0, freeHeld = 0;
for (let i = 0; i < 40; i++) { const x = await get('name=Nothing' + i + '&number=1/1&src=fill', 'tf'); if (x.status === 200) freeOk++; else { assert.equal(x.status, 429); assert.ok((await x.json()).later); freeHeld++; } }
const freeCalls = sq.prepare("SELECT COALESCE(SUM(calls),0) c FROM usage WHERE src='fill' AND plan='free'").get().c;
assert.ok(freeHeld > 0 && freeCalls <= Math.max(freeCap, 0) + 4, `free fill stops at its share (${freeCalls} calls, cap ${freeCap.toFixed(1)}, held ${freeHeld})`);
let premOk = 0; for (let i = 0; i < 60; i++) { const x = await get('name=Other' + i + '&number=2/2&src=fill', 'tp'); if (x.status === 200) premOk++; }
const fillCalls = sq.prepare("SELECT COALESCE(SUM(calls),0) c FROM usage WHERE src='fill'").get().c;
assert.ok(premOk > freeOk || freeOk === 0, 'Premium fill keeps going after free stops'); assert.ok(fillCalls <= fillCap + 4, `all fill stops at the day's fill share (${fillCalls} of ${fillCap})`);
// typing keeps working while fill waits
const b = up; r = await get('name=Pikachu'); assert.equal(r.status, 200); assert.ok(up > b, 'typing still asks');
// over the month limit: typing gets what we've saved, no new requests
sq.prepare("INSERT INTO usage (day,src,plan,calls,reqs) VALUES ('" + new Date().toISOString().slice(0, 10) + "','type','none',4000,1) ON CONFLICT(day,src,plan) DO UPDATE SET calls=calls+4000").run();
const c0 = up; r = await (await get('name=Raichu jungle')).json(); assert.equal(up, c0, 'no requests over the limit'); assert.ok(Array.isArray(r.cards));
r = await (await get('name=Raichu&number=999')).json(); assert.equal(up, c0);
const rep = await report(env); assert.equal(rep.limit, 3000); assert.ok(rep.month > 3000 && rep.days.length >= 1 && rep.resets);
console.log('budget tests ok:', { share, freeCalls, fillCalls, freeHeld, premOk }, 'report:', { month: rep.month, savedPct: rep.savedPct, resets: rep.resets });
