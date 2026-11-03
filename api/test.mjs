import worker, { norm, lookupKey, pickByNumber, normCard } from './src/index.js';
import assert from 'node:assert';
// fake D1 + R2 + JustTCG
const calls = [];
const db = { rows: { lookups: {}, cards: {} },
  prepare(sql) { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
    async first() { if (/FROM lookups/.test(sql)) return db.rows.lookups[o.args[0]] || null; if (/FROM cards/.test(sql)) return db.rows.cards[o.args[0]] || null; },
    async all() { return { results: o.args.map(i => db.rows.cards[i]).filter(Boolean) }; } }; return o; },
  async batch(st) { st.forEach(s => { if (/INTO cards/.test(s.sql)) { const a = s.args; db.rows.cards[a[0]] = { id: a[0], game: a[1], name: a[2], set_name: a[3], number: a[4], rarity: a[5], tcgplayer_id: a[6] }; } else if (/INTO lookups/.test(s.sql)) db.rows.lookups[s.args[0]] = { ids: s.args[1], fetched_at: s.args[2] }; }); } };
globalThis.fetch = async (url, opt) => { calls.push(String(url));
  if (/\/v1\/games/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'pokemon', name: 'Pokemon' }, { id: 'dragon-ball-super-card-game', name: 'Dragon Ball Super Card Game' }] }));
  if (/q=Raichu/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'r1', game: 'Pokemon', name: 'Raichu', set_name: 'Base Set', number: '014/102', rarity: 'Holo Rare', tcgplayerId: 42354 }, { id: 'r2', game: 'Pokemon', name: 'Raichu', set_name: 'Base Set (Shadowless)', number: '014/102', rarity: 'Holo Rare', tcgplayerId: 107009 }, { id: 'r3', game: 'Pokemon', name: 'Raichu', set_name: 'Jungle', number: '14/64', rarity: 'Rare', tcgplayerId: 1 }] }));
  return new Response('{}', { status: 404 }); };
const env = { DB: db, JUSTTCG_API_KEY: 'test', ALLOWED_ORIGIN: 'https://app.cardtab.app', ART: { async get() { return null; }, async put() {} } };
const get = p => worker.fetch(new Request('https://x' + p), env, {});
let r = await (await get('/api/lookup?name=Raichu&number=014/102&game=Pok%C3%A9mon')).json();
assert.deepEqual(r.cards.map(c => c.id), ['r1', 'r2'], 'number filter keeps both printings');
assert.equal(r.cards[0].art.list, '/art/r1/list');
const n1 = calls.length;
r = await (await get('/api/lookup?name=Raichu&number=014/102&game=Pok%C3%A9mon')).json();
assert.equal(calls.length, n1, 'second identical lookup makes no JustTCG request');
assert.equal(r.cards.length, 2);
assert.equal((await get('/api/lookup')).status, 400);
assert.equal((await get('/art/bad id/list')).status, 404);
assert.equal(norm('Raichu #014/102'), 'raichu 014 102');
assert.deepEqual(pickByNumber([{ number: '014/102' }, { number: '14/64' }], '14/102').length, 1);
console.log('api tests ok; JustTCG requests for 2 identical lookups:', calls.filter(c => /api.justtcg/.test(c)).length);
