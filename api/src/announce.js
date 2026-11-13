/* What's new announcements (v52.87). Written in the admin dashboard, shown once in everyone's in-app notifications.
   POST /auth/admin/announce          admins: {title, body, go, aud}  send a new one
   GET  /auth/admin/announce          admins: the ones sent, newest first, with how many people have it so far
   POST /auth/admin/announce/stop     admins: {id}  stop handing it out (people who already have it keep it)
   Each person's app picks new ones up with its other messages (POST /auth/notes). An announcement only reaches people
   whose account existed when it was sent, so new sign-ups never see old news, and it stops going out after 60 days. */
const now = () => Math.floor(Date.now() / 1000), DAY = 86400;
export const GOS = ['', 'add', 'board', 'stories', 'budget', 'premium', 'ask'];
const AUDS = ['all', 'free', 'premium'];
let ready = false;
export async function ensureAnnounce(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS announce ( id TEXT PRIMARY KEY, at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT, go TEXT, aud TEXT NOT NULL DEFAULT \'all\', stopped INTEGER NOT NULL DEFAULT 0 )'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS announce_seen ( uid TEXT NOT NULL, aid TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (uid, aid) )'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS announce_seen_aid ON announce_seen (aid)')
  ]);
  ready = true;
}
// the person's app asks: announcements sent since they joined, not stopped, not older than 60 days, not handed over yet
export async function takeNews(env, me) {
  try {
    await ensureAnnounce(env);
    const t = now(), joined = +me.created_at || 0;
    const rows = (await env.DB.prepare('SELECT a.id,a.at,a.title,a.body,a.go,a.aud FROM announce a LEFT JOIN announce_seen s ON s.aid=a.id AND s.uid=? WHERE a.stopped=0 AND a.at>=? AND a.at>? AND s.aid IS NULL ORDER BY a.at LIMIT 5')
      .bind(me.id, joined, t - 60 * DAY).all()).results || [];
    if (rows.length) await env.DB.batch(rows.map(r => env.DB.prepare('INSERT OR IGNORE INTO announce_seen (uid,aid,at) VALUES (?,?,?)').bind(me.id, r.id, t)));
    return rows;
  } catch (e) { return []; }
}
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
export async function handleAnnounce(env, req, path, admin, out) {
  if (!admin) return out({ error: 'Admins only.' }, 403);
  await ensureAnnounce(env);
  if (path === '/auth/admin/announce' && req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT a.*, (SELECT COUNT(*) FROM announce_seen s WHERE s.aid=a.id) got FROM announce a ORDER BY a.at DESC LIMIT 30').all()).results || [];
    const people = (await env.DB.prepare('SELECT COUNT(*) n FROM users').first().catch(() => null)) || { n: 0 };
    return out({ items: rows, people: people.n || 0 });
  }
  if (path === '/auth/admin/announce' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const title = clean(b.title, 70), body = clean(b.body, 200), go = GOS.includes(b.go) ? b.go : '', aud = AUDS.includes(b.aud) ? b.aud : 'all';
    if (!title) return out({ error: 'Add a title.' }, 400);
    const id = crypto.randomUUID(), at = now();
    await env.DB.prepare('INSERT INTO announce (id,at,title,body,go,aud,stopped) VALUES (?,?,?,?,?,?,0)').bind(id, at, title, body, go, aud).run();
    return out({ ok: true, id, at });
  }
  if (path === '/auth/admin/announce/stop' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    await env.DB.prepare('UPDATE announce SET stopped=1 WHERE id=?').bind(String(b.id || '')).run();
    return out({ ok: true });
  }
  return out({ error: 'Not found.' }, 404);
}
