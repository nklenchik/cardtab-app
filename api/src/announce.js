/* What's new announcements (v52.87). Written in the admin dashboard, shown once in everyone's in-app notifications.
   POST /auth/admin/announce          admins: {title, body, go, aud}  send a new one
   GET  /auth/admin/announce          admins: the ones sent, newest first, with how many people have it so far
   POST /auth/admin/announce/stop     admins: {id}  stop handing it out (people who already have it keep it)
   POST /auth/admin/announce/discard  admins: {id}  drop a draft (it never comes back)
   POST /auth/admin/announce/edit     admins: {id, title, body, go, aud}  fix it: new copies get the new text, and copies
                                      already handed over are updated the next time that person's app checks
   Each person's app picks new ones up with its other messages (POST /auth/notes). An announcement only reaches people
   whose account existed when it was sent, so new sign-ups never see old news, and it stops going out after 60 days. */
import { DRAFTS } from './announce-drafts.js';
import { raiseAlert, resolveAlert } from './alerts.js';
const now = () => Math.floor(Date.now() / 1000), DAY = 86400;
export const GOS = ['', 'add', 'board', 'stories', 'budget', 'premium', 'ask'];
const AUDS = ['all', 'free', 'premium'];
let ready = false;
export async function ensureAnnounce(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS announce ( id TEXT PRIMARY KEY, at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT, go TEXT, aud TEXT NOT NULL DEFAULT \'all\', stopped INTEGER NOT NULL DEFAULT 0, edited INTEGER )'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS announce_seen ( uid TEXT NOT NULL, aid TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (uid, aid) )'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS announce_seen_aid ON announce_seen (aid)')
  ]);
  for (const c of ['edited INTEGER', 'draft INTEGER NOT NULL DEFAULT 0', 'dkey TEXT']) { try { await env.DB.prepare('ALTER TABLE announce ADD COLUMN ' + c).run(); } catch (e) { /* already there */ } }
  try { await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS announce_dkey ON announce (dkey)').run(); } catch (e) {}
  ready = true;
}
// the person's app asks: announcements sent since they joined, not stopped, not older than 60 days, not handed over yet
export async function takeNews(env, me) {
  try {
    await ensureAnnounce(env);
    const t = now(), joined = +me.created_at || 0;
    const rows = (await env.DB.prepare('SELECT a.id,a.at,a.title,a.body,a.go,a.aud FROM announce a LEFT JOIN announce_seen s ON s.aid=a.id AND s.uid=? WHERE a.draft=0 AND a.stopped=0 AND a.at>=? AND a.at>? AND s.aid IS NULL ORDER BY a.at LIMIT 5')
      .bind(me.id, joined, t - 60 * DAY).all()).results || [];
    // ones already handed over that were edited since: send the fixed text again (the app replaces its copy)
    const fixed = (await env.DB.prepare('SELECT a.id,a.at,a.title,a.body,a.go,a.aud FROM announce a JOIN announce_seen s ON s.aid=a.id AND s.uid=? WHERE a.draft=0 AND a.edited IS NOT NULL AND a.edited>s.at LIMIT 10').bind(me.id).all()).results || [];
    const all = rows.concat(fixed.map(r => Object.assign(r, { fix: 1 })));
    if (all.length) await env.DB.batch(all.map(r => env.DB.prepare('INSERT INTO announce_seen (uid,aid,at) VALUES (?,?,?) ON CONFLICT(uid,aid) DO UPDATE SET at=excluded.at').bind(me.id, r.id, t)));
    return all;
  } catch (e) { return []; }
}
// drafts written alongside a new feature: each new key becomes a draft once, with a "Waiting on you" alert for the admin
export async function seedDrafts(env, list = DRAFTS) {
  try {
    await ensureAnnounce(env);
    for (const d of list || []) {
      const key = String(d && d.key || '').slice(0, 80), title = clean(d && d.title, 70); if (!key || !title) continue;
      const have = await env.DB.prepare('SELECT id, title, body, edited, draft FROM announce WHERE dkey=?').bind(key).first();
      // v53.07 a draft still waiting for review, and not edited by hand, follows Claude's newer wording
      if (have) { if (have.draft && !have.edited && (have.title !== title || have.body !== clean(d.body, 200))) await env.DB.prepare('UPDATE announce SET title=?, body=? WHERE id=?').bind(title, clean(d.body, 200), have.id).run(); continue; }
      const id = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO announce (id,at,title,body,go,aud,stopped,draft,dkey) VALUES (?,?,?,?,?,?,0,1,?)')
        .bind(id, now(), title, clean(d.body, 200), GOS.includes(d.go) ? d.go : '', AUDS.includes(d.aud) ? d.aud : 'all', key).run();
      await raiseAlert(env, { key: 'ann-draft:' + key, grp: 'you', kind: 'b', icon: 'm', title: 'Announcement ready to review', sub: title, go: 'announce:' + id });
    }
  } catch (e) { /* tried again on the next run */ }
}
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
export async function handleAnnounce(env, req, path, admin, out) {
  if (!admin) return out({ error: 'Admins only.' }, 403);
  await ensureAnnounce(env);
  if (path === '/auth/admin/announce' && req.method === 'GET') {
    await seedDrafts(env);
    const rows = (await env.DB.prepare('SELECT a.*, (SELECT COUNT(*) FROM announce_seen s WHERE s.aid=a.id) got FROM announce a WHERE a.draft=0 ORDER BY a.at DESC LIMIT 30').all()).results || [];
    const drafts = (await env.DB.prepare('SELECT id,at,title,body,go,aud FROM announce WHERE draft=1 ORDER BY at DESC').all()).results || [];
    const people = (await env.DB.prepare('SELECT COUNT(*) n FROM users').first().catch(() => null)) || { n: 0 };
    return out({ items: rows, drafts, people: people.n || 0 });
  }
  if (path === '/auth/admin/announce' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const title = clean(b.title, 70), body = clean(b.body, 200), go = GOS.includes(b.go) ? b.go : '', aud = AUDS.includes(b.aud) ? b.aud : 'all';
    if (!title) return out({ error: 'Add a title.' }, 400);
    const at = now();
    // sending a draft: it becomes a real announcement now (its 60 days start today) and its alert closes
    if (b.draftId) { const d = await env.DB.prepare('SELECT id,dkey FROM announce WHERE id=? AND draft=1').bind(String(b.draftId)).first();
      if (!d) return out({ error: 'That draft was already sent or discarded.' }, 409);
      await env.DB.prepare('UPDATE announce SET title=?,body=?,go=?,aud=?,at=?,draft=0,stopped=0,edited=NULL WHERE id=?').bind(title, body, go, aud, at, d.id).run();
      await resolveAlert(env, 'ann-draft:' + d.dkey); return out({ ok: true, id: d.id, at }); }
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO announce (id,at,title,body,go,aud,stopped,draft) VALUES (?,?,?,?,?,?,0,0)').bind(id, at, title, body, go, aud).run();
    return out({ ok: true, id, at });
  }
  if (path === '/auth/admin/announce/edit' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const title = clean(b.title, 70), body = clean(b.body, 200), go = GOS.includes(b.go) ? b.go : '', aud = AUDS.includes(b.aud) ? b.aud : 'all';
    if (!title) return out({ error: 'Add a title.' }, 400);
    const r = await env.DB.prepare('UPDATE announce SET title=?,body=?,go=?,aud=?,edited=? WHERE id=?').bind(title, body, go, aud, now(), String(b.id || '')).run();
    return out({ ok: true });
  }
  if (path === '/auth/admin/announce/discard' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const d = await env.DB.prepare('SELECT id,dkey FROM announce WHERE id=? AND draft=1').bind(String(b.id || '')).first();
    if (d) { await env.DB.prepare('UPDATE announce SET draft=2 WHERE id=?').bind(d.id).run(); await resolveAlert(env, 'ann-draft:' + d.dkey); }
    return out({ ok: true });
  }
  if (path === '/auth/admin/announce/stop' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    await env.DB.prepare('UPDATE announce SET stopped=1 WHERE id=?').bind(String(b.id || '')).run();
    return out({ ok: true });
  }
  return out({ error: 'Not found.' }, 404);
}
