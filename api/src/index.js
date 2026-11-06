/* Card Tab API (Cloudflare Worker)
   GET /api/lookup?name=&number=&set=&game=   -> candidate printings (cached in D1)
   GET /art/:id/:size                          -> our own copy of the card art as WebP (size: list | detail)
   Nothing here is exposed to the app except our own ids and our own image URLs. */
const JT = 'https://api.justtcg.com';
const CDN = 'https://tcgplayer-cdn.tcgplayer.com/product/';
const DAY = 86400;
const SIZES = { list: { width: 240, quality: 78 }, detail: { width: 640, quality: 82 } };

export function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
export function numKey(s) { return norm(s).split(' ').map(x => x.replace(/^0+(?=\d)/, '')).join(' '); }
// the ways a card number gets written: as typed, without leading zeros, and padded to the set size (14/102 -> 014/102)
export function numVariants(n) { const out = [String(n || '').trim()], m = /^0*(\d+)\s*\/\s*(\d+)$/.exec(out[0]);
  if (m) { out.push(m[1] + '/' + m[2], m[1].padStart(m[2].length, '0') + '/' + m[2]); }
  return [...new Set(out.filter(Boolean))]; }
export function lookupKey(q) { return ['v2', norm(q.game), norm(q.name), numKey(q.number), norm(q.set)].join('|'); }
export function normCard(c) {
  return { id: c.id, g: c.game, n: c.name, s: c.set_name, num: c.number, r: c.rarity, tcg: c.tcgplayerId ? String(c.tcgplayerId) : '' };
}
export function pickByNumber(cards, number) {
  const want = norm(number); if (!want) return cards;
  const hit = cards.filter(c => numKey(c.number) === numKey(number));
  return hit.length ? hit : [];
}
const cors = (env) => ({ 'access-control-allow-origin': env.ALLOWED_ORIGIN || '*', 'vary': 'origin' });
const json = (env, body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(env), ...extra } });

async function jt(env, path) {
  const r = await fetch(JT + path, { headers: { 'x-api-key': env.JUSTTCG_API_KEY, accept: 'application/json' } });
  // keep JustTCG's own words when it says no (rate limit, bad key, plan limits), so we can tell which it is
  if (!r.ok) { let why = ''; try { why = (await r.text()).slice(0, 200); } catch (e) {}
    throw Object.assign(new Error('justtcg ' + r.status), { status: r.status === 429 ? 429 : 502, upstream: r.status, why }); }
  return r.json();
}
let GAMES = null;
async function gameId(env, game) {
  if (!game) return '';
  if (!GAMES) GAMES = (await jt(env, '/v1/games')).data || [];
  const want = { 'Pokémon': /pok/i, 'Dragon Ball Super': /dragon ball.*super.*card|dragon-ball-super-card/i, 'Fusion World': /fusion/i }[game];
  const g = GAMES.find(x => want && (want.test(x.id) || want.test(x.name)));
  return g ? g.id : '';
}

async function search(env, q) {
  const key = lookupKey(q), now = Math.floor(Date.now() / 1000);
  const hit = await env.DB.prepare('SELECT ids, fetched_at FROM lookups WHERE key=?').bind(key).first();
  // found cards are kept 30 days; "nothing found" only 6 hours, so a miss can be retried soon
  if (hit && now - hit.fetched_at < (hit.ids === '[]' ? DAY / 4 : 30 * DAY)) {
    const ids = JSON.parse(hit.ids); if (!ids.length) return [];
    const rows = await env.DB.prepare(`SELECT * FROM cards WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const by = Object.fromEntries(rows.results.map(r => [r.id, r]));
    return ids.map(i => by[i]).filter(Boolean).map(r => normCard({ id: r.id, game: r.game, name: r.name, set_name: r.set_name, number: r.number, rarity: r.rarity, tcgplayerId: r.tcgplayer_id }));
  }
  const game = await gameId(env, q.game), g = game ? `&game=${encodeURIComponent(game)}` : '';
  const base = `/v1/cards?limit=20&include_price_history=false${g}`;
  let cards = [];
  if (q.name) {
    cards = (await jt(env, `${base}&q=${encodeURIComponent(q.name)}`)).data || [];
    if (q.number) { const f = pickByNumber(cards, q.number); cards = f; }
  }
  if (!cards.length && q.number) {
    const vs = numVariants(q.number);
    // name + number as one search, then the number on its own, in each way it might be written
    for (const v of vs) { if (cards.length) break; cards = pickByNumber((await jt(env, `${base}&q=${encodeURIComponent((q.name ? q.name + ' ' : '') + v)}`)).data || [], q.number); }
    for (const v of vs) { if (cards.length) break; cards = pickByNumber((await jt(env, `${base}&number=${encodeURIComponent(v)}`)).data || [], q.number); }
    if (q.name && cards.length) { const nm = norm(q.name); const named = cards.filter(c => norm(c.name).includes(nm)); if (named.length) cards = named; }
  }
  cards = cards.slice(0, 12);
  const stmts = cards.map(c => env.DB.prepare('INSERT OR REPLACE INTO cards (id,game,name,set_name,number,rarity,tcgplayer_id,fetched_at) VALUES (?,?,?,?,?,?,?,?)').bind(c.id, c.game, c.name, c.set_name || c.set, c.number, c.rarity, c.tcgplayerId ? String(c.tcgplayerId) : '', now));
  stmts.push(env.DB.prepare('INSERT OR REPLACE INTO lookups (key,ids,fetched_at) VALUES (?,?,?)').bind(key, JSON.stringify(cards.map(c => c.id)), now));
  await env.DB.batch(stmts);
  return cards.map(c => normCard({ ...c, set_name: c.set_name || c.set }));
}

async function art(env, ctx, id, size) {
  const sz = SIZES[size]; if (!sz || !/^[\w-]{3,80}$/.test(id)) return new Response('not found', { status: 404 });
  const k = `art/v2/${id}/${size}.webp`;   // v2: copies made before resizing was switched on are ignored
  let obj = await env.ART.get(k);
  if (!obj) {
    const row = await env.DB.prepare('SELECT tcgplayer_id FROM cards WHERE id=?').bind(id).first();
    if (!row || !row.tcgplayer_id) return new Response('no art', { status: 404 });
    // Fetch the source once, resized and converted to WebP by Cloudflare. Only our copy is kept.
    const r = await fetch(`${CDN}${row.tcgplayer_id}_in_1000x1000.jpg`, { cf: { image: { width: sz.width, format: 'webp', quality: sz.quality, metadata: 'none' } } });
    if (!r.ok) return new Response('no art', { status: 404 });
    const buf = await r.arrayBuffer(), type = r.headers.get('content-type') || 'image/jpeg';
    // only keep a copy when Cloudflare actually resized it (it can't on the workers.dev address); otherwise show it, keep nothing, try again next time
    if (!/webp/i.test(type)) return new Response(buf, { headers: { 'content-type': type, 'cache-control': 'public, max-age=3600', ...cors(env) } });
    await env.ART.put(k, buf, { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
    return new Response(buf, { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable', ...cors(env) } });
  }
  return new Response(obj.body, { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable', ...cors(env) } });
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors(env), 'access-control-allow-methods': 'GET,POST', 'access-control-allow-headers': 'content-type' } });
    try {
      if (u.pathname === '/api/lookup') {
        const q = { name: u.searchParams.get('name') || '', number: u.searchParams.get('number') || '', set: u.searchParams.get('set') || '', game: u.searchParams.get('game') || '' };
        if (!q.name && !q.number) return json(env, { error: 'name or number required' }, 400);
        const cards = await search(env, q);
        return json(env, { cards: cards.map(c => ({ ...c, art: { list: `/art/${c.id}/list`, detail: `/art/${c.id}/detail` } })) });
      }
      const m = u.pathname.match(/^\/art\/([^/]+)\/(list|detail)$/);
      if (m) return art(env, ctx, decodeURIComponent(m[1]), m[2]);
      return new Response('not found', { status: 404 });
    } catch (e) {
      return json(env, { error: e.status === 429 ? 'busy, try again in a moment' : 'lookup failed', upstream: e.upstream || null, detail: e.why || String(e.message || '') }, e.status || 500, e.status === 429 ? { 'retry-after': '20' } : {});
    }
  }
};
