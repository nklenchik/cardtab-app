/* Sync: every device keeps its own copy and sends what changed; the server keeps one copy per account.
   POST /sync {since, entries:[...], meta:{key:{v,t}}}  ->  {seq, more, entries:[...], meta:{...}}
   For each entry (and each synced setting) the most recent edit wins, by its updatedAt time. A delete is an edit
   (deleted:true), so it reaches every device. "seq" numbers the server's changes so a device can ask for what's new. */
const META_KEYS = ['budget', 'budgetFlags', 'customPlatforms', 'notif', 'storiesFree'];
const MAX_IN = 400, MAX_OUT = 800, MAX_ENTRY = 24000;

export async function handleSync(env, req, me, out) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return out({ error: 'bad request' }, 400);
  const since = Math.max(0, parseInt(b.since, 10) || 0);
  const inE = Array.isArray(b.entries) ? b.entries.slice(0, MAX_IN) : [];
  const inM = b.meta && typeof b.meta === 'object' ? b.meta : {};
  const st = await env.DB.prepare('SELECT seq FROM sync_state WHERE user_id=?').bind(me.id).first();
  let seq = st ? st.seq : 0;
  const writes = [], rejected = [];
  // entries: compare with what's stored, keep the newer one
  const valid = inE.filter(e => e && typeof e.id === 'string' && /^[\w-]{4,64}$/.test(e.id) && typeof e.updatedAt === 'string');
  const have = new Map();
  for (let i = 0; i < valid.length; i += 90) {
    const ids = valid.slice(i, i + 90).map(e => e.id);
    const r = await env.DB.prepare(`SELECT id, updated_at FROM entries WHERE user_id=? AND id IN (${ids.map(() => '?').join(',')})`).bind(me.id, ...ids).all();
    r.results.forEach(x => have.set(x.id, x.updated_at));
  }
  for (const e of valid) {
    const data = JSON.stringify(e);
    if (data.length > MAX_ENTRY) { rejected.push(e.id); continue; }
    const cur = have.get(e.id);
    if (cur && cur >= e.updatedAt) continue;
    seq++; have.set(e.id, e.updatedAt);
    writes.push(env.DB.prepare('INSERT INTO entries (user_id,id,data,updated_at,deleted,seq) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted=excluded.deleted, seq=excluded.seq')
      .bind(me.id, e.id, data, e.updatedAt, e.deleted ? 1 : 0, seq));
  }
  // synced settings
  for (const k of META_KEYS) {
    const m = inM[k]; if (!m || typeof m.t !== 'string') continue;
    const v = JSON.stringify(m.v === undefined ? null : m.v); if (v.length > MAX_ENTRY) continue;
    const cur = await env.DB.prepare('SELECT updated_at FROM user_meta WHERE user_id=? AND k=?').bind(me.id, k).first();
    if (cur && cur.updated_at >= m.t) continue;
    seq++;
    writes.push(env.DB.prepare('INSERT INTO user_meta (user_id,k,v,updated_at,seq) VALUES (?,?,?,?,?) ON CONFLICT(user_id,k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at, seq=excluded.seq').bind(me.id, k, v, m.t, seq));
  }
  if (writes.length) {
    writes.push(env.DB.prepare('INSERT INTO sync_state (user_id,seq) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET seq=excluded.seq').bind(me.id, seq));
    await env.DB.batch(writes);
  }
  // what's new since the device last asked (including what it just sent; the device ignores copies it already has)
  const rows = await env.DB.prepare('SELECT data, seq FROM entries WHERE user_id=? AND seq>? ORDER BY seq LIMIT ?').bind(me.id, since, MAX_OUT + 1).all();
  const more = rows.results.length > MAX_OUT, list = rows.results.slice(0, MAX_OUT);
  let upTo = more ? list[list.length - 1].seq : seq;
  const metaRows = await env.DB.prepare('SELECT k, v, updated_at, seq FROM user_meta WHERE user_id=? AND seq>? AND seq<=?').bind(me.id, since, upTo).all();
  const meta = {}; metaRows.results.forEach(r => { try { meta[r.k] = { v: JSON.parse(r.v), t: r.updated_at }; } catch (e) {} });
  return out({ seq: upTo, more, entries: list.map(r => JSON.parse(r.data)), meta, rejected });
}

export async function deleteSynced(env, userId) {
  return [env.DB.prepare('DELETE FROM entries WHERE user_id=?').bind(userId), env.DB.prepare('DELETE FROM user_meta WHERE user_id=?').bind(userId), env.DB.prepare('DELETE FROM sync_state WHERE user_id=?').bind(userId)];
}
