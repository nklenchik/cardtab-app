/* Where members are (v52.42): each account's approximate country and state/region (and, v52.49, time zone, so emails arrive in their morning), worked out by Cloudflare from the
   connection (request.cf). Saved when someone signs in or opens the app (at most once an hour, with last seen), and
   updated if it changes. The network address itself is never stored, and nothing finer than state is kept.
   Shown to admins in a person's details and as "Where members are" in the dashboard. Removed with the account. */
const now = () => Math.floor(Date.now() / 1000);
const clip = (s, n) => String(s == null ? '' : s).replace(/[^\p{L}\p{N} .'\-]/gu, '').trim().slice(0, n);
let made = false;
export async function ensureGeo(env) {
  if (made) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS geo (user_id TEXT PRIMARY KEY, cc TEXT, region TEXT, at INTEGER)').run();
  try { await env.DB.prepare('ALTER TABLE geo ADD COLUMN tz TEXT').run(); } catch (e) { /* already there */ }   // v52.49 time zone, for 10am emails
  made = true;
}
export function geoOf(req) {
  const cf = req.cf || {}, cc = clip(cf.country || req.headers.get('cf-ipcountry') || '', 2).toUpperCase();
  const tz = String(cf.timezone || ''), okTz = /^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+){1,2}$/.test(tz) && tz.length <= 40;
  return { cc: /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? cc : '', region: clip(cf.region || '', 60), tz: okTz ? tz : '' };
}
// never throws: a location is nice to have, never worth breaking a sign-in over
export async function noteGeo(env, req, uid) {
  try {
    const g = geoOf(req); if (!g.cc || !uid) return;
    await ensureGeo(env);
    await env.DB.prepare('INSERT INTO geo (user_id,cc,region,at,tz) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET cc=excluded.cc, region=excluded.region, at=excluded.at, tz=COALESCE(excluded.tz, geo.tz)').bind(uid, g.cc, g.region, now(), g.tz || null).run();
  } catch (e) {}
}
export async function geoFor(env, uid) {
  try { await ensureGeo(env); const r = await env.DB.prepare('SELECT cc,region,at FROM geo WHERE user_id=?').bind(uid).first(); return r ? { cc: r.cc, region: r.region || '', at: r.at } : null; } catch (e) { return null; }
}
