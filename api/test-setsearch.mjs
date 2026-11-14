// Card data budget: counting, catalog-first, fill pacing, free accounts last. Real SQLite standing in for D1.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
import { cycle, report } from './src/budget.js';
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = sql => { const o = { sql, args: [], bind(...a) { o.args = a; return o; }, async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; } };
// v53.06 set-aware search: a set typed after the name finds the card inside that set
const calls = [];
globalThis.fetch = async url => { url = String(url); calls.push(url);
  if (/\/v1\/games/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'pokemon', name: 'Pokemon' }, { id: 'pokemon-japan', name: 'Pokemon Japan' }] }));
  if (/\/v1\/sets\?game=pokemon$/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'swsh07-evolving-skies', name: 'SWSH07: Evolving Skies' }, { id: 'swsh03-darkness-ablaze', name: 'SWSH03: Darkness Ablaze' }, { id: 'base-set', name: 'Base Set' }] }));
  if (/set=swsh07-evolving-skies&q=umbreon/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'u1', game: 'pokemon', name: 'Umbreon VMAX', set_name: 'SWSH07: Evolving Skies', number: '215/203', rarity: 'Secret Rare', tcgplayerId: 1 }] }));
  if (/q=umbreon%20evolving%20skies/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'b1', game: 'pokemon', name: 'Evolving Skies 3 Pack Blister [Umbreon]', set_name: 'SWSH07: Evolving Skies', number: 'N/A', rarity: '', tcgplayerId: 2 }] }));
  if (/q=Dark%20Charizard/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'd1', game: 'pokemon', name: 'Dark Charizard', set_name: 'Team Rocket', number: '4/82', rarity: 'Holo Rare', tcgplayerId: 3 }] }));
  return new Response(JSON.stringify({ data: [] })); };
const env = { DB, JUSTTCG_API_KEY: 't', ALLOWED_ORIGIN: 'https://app.cardtab.app', MONTH_LIMIT: '3000', RESET_DAY: '6', ART: { async get() { return null; } } };
const get = q => worker.fetch(new Request('https://api.cardtab.app/api/lookup?' + q, { headers: { origin: 'https://app.cardtab.app' } }), env, {});
let j = await (await get('name=umbreon%20evolving%20skies')).json();
assert.equal(j.cards[0].id, 'u1', 'the card inside the set comes first'); assert.ok(j.cards.some(c => c.id === 'b1'));
assert.ok(calls.some(u => /\/v1\/sets\?game=pokemon$/.test(u)) && !calls.some(u => /pokemon-japan/.test(u)), 'sets listed once, English only');
const n0 = calls.length; await get('name=umbreon%20evolving%20skies'); assert.equal(calls.length, n0, 'cached');
// a plain name whose results already match costs nothing more
const n1 = calls.length; j = await (await get('name=Dark%20Charizard')).json(); assert.equal(j.cards[0].id, 'd1'); assert.equal(calls.length - n1, 1);
// sets listed only once
const n2 = calls.length; await get('name=blastoise%20darkness%20ablaze'); assert.ok(!calls.slice(n2).some(u => /\/v1\/sets/.test(u)));
// an answer saved before set search existed gets the set tried once
sq.prepare("INSERT INTO cards (id,game,name,set_name,number,rarity,tcgplayer_id,fetched_at) VALUES ('old1','pokemon','Charizard VMAX','S4a: Shiny Star V','308/190','',5,1)").run();
sq.prepare("INSERT INTO lookups (key,ids,fetched_at) VALUES ('v2||charizard vmax darkness ablaze||','[\"old1\"]',?)").run(Math.floor(Date.now() / 1000));
globalThis.fetch = (f => async url => { url = String(url); if (/set=swsh03-darkness-ablaze&q=charizard%20vmax/.test(url)) { calls.push(url); return new Response(JSON.stringify({ data: [{ id: 'cz', game: 'pokemon', name: 'Charizard VMAX', set_name: 'SWSH03: Darkness Ablaze', number: '020/189', rarity: 'Ultra Rare', tcgplayerId: 9 }] })); } return f(url); })(globalThis.fetch);
j = await (await get('name=charizard%20vmax%20darkness%20ablaze')).json(); assert.deepEqual(j.cards.map(c => c.id), ['cz', 'old1']);
const n3 = calls.length; j = await (await get('name=charizard%20vmax%20darkness%20ablaze')).json(); assert.equal(calls.length, n3, 'now cached with the set card'); assert.equal(j.cards[0].id, 'cz');
console.log('set search ok');
