// In-house analytics (v50). The app sends small batches of counts ("widget_add: featured", "page_time: board, 42s");
// the server adds them into one row per day per count, and keeps a list of who was active each day (for active people,
// time in the app and coming-back numbers). No card names, prices, emails or typed text ever arrive here.
// Admin accounts (ADMIN_EMAILS) are never counted, on any device. Rows older than two years are removed nightly.

const EV_OK = /^[a-z_]{2,24}$/;
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const clean = s => String(s == null ? '' : s).replace(/[^\w .:+\-×&'/·]/g, '').slice(0, 48);
const admins = env => (env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

export async function handleEvents(env, req, me, out) {
  if (admins(env).includes(String(me.email).toLowerCase())) return out({ ok: true, skipped: 'admin' });
  const b = await req.json().catch(() => ({}));
  const evs = Array.isArray(b.ev) ? b.ev.slice(0, 120) : [];
  const dev = b.dev === 'desk' ? 'desk' : 'phone', plan = me.plan === 'premium' ? 'premium' : 'free', d = day();
  const sum = new Map();
  for (const x of evs) {
    if (!x || !EV_OK.test(x.e)) continue;
    const k = x.e + '\u0001' + clean(x.d), cur = sum.get(k) || { e: x.e, d: clean(x.d), n: 0, v: 0 };
    cur.n += Math.max(0, Math.min(500, +x.n || 1)); cur.v += Math.max(0, Math.min(86400, +x.v || 0)); sum.set(k, cur);
  }
  const st = [...sum.values()].map(r => env.DB.prepare('INSERT INTO an_day (day,ev,dim,plan,dev,n,v) VALUES (?,?,?,?,?,?,?) ON CONFLICT(day,ev,dim,plan,dev) DO UPDATE SET n=n+excluded.n, v=v+excluded.v').bind(d, r.e, r.d, plan, dev, r.n, r.v));
  const secs = Math.max(0, Math.min(3600, Math.round(+b.secs || 0)));
  st.push(env.DB.prepare('INSERT INTO an_active (day,uid,plan,dev,secs) VALUES (?,?,?,?,?) ON CONFLICT(day,uid) DO UPDATE SET secs=secs+excluded.secs, plan=excluded.plan, dev=excluded.dev').bind(d, me.id, plan, dev, secs));
  await env.DB.batch(st);
  return out({ ok: true });
}

// ---------- the admin dashboard's numbers ----------
const addDays = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const span = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5) + 1;
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export async function handleStats(env, req, out) {
  const u = new URL(req.url), today = day();
  let to = /^\d{4}-\d\d-\d\d$/.test(u.searchParams.get('to') || '') ? u.searchParams.get('to') : today;
  let from = /^\d{4}-\d\d-\d\d$/.test(u.searchParams.get('from') || '') ? u.searchParams.get('from') : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  const n = Math.min(800, span(from, to)), pTo = addDays(from, -1), pFrom = addDays(pTo, -(n - 1));
  const plan = ['free', 'premium'].includes(u.searchParams.get('plan')) ? u.searchParams.get('plan') : '';
  const dev = ['phone', 'desk'].includes(u.searchParams.get('dev')) ? u.searchParams.get('dev') : '';
  const f = (a, b) => { let w = ' WHERE day BETWEEN ? AND ?', p = [a, b]; if (plan) { w += ' AND plan=?'; p.push(plan); } if (dev) { w += ' AND dev=?'; p.push(dev); } return [w, p]; };
  const q = async (sql, p) => (await env.DB.prepare(sql).bind(...p).all()).results || [];
  const [w1, p1] = f(from, to), [w0, p0] = f(pFrom, pTo);
  const adm = admins(env), notAdmin = adm.length ? ' AND lower(email) NOT IN (' + adm.map(() => '?').join(',') + ')' : '';
  const [act, actPrev, ev, evPrev, evDay, members, signups, signPrev, spend] = await Promise.all([
    q('SELECT day, uid, secs FROM an_active' + w1, p1),
    q('SELECT day, uid, secs FROM an_active' + w0, p0),
    q('SELECT ev, dim, SUM(n) n, SUM(v) v FROM an_day' + w1 + ' GROUP BY ev, dim', p1),
    q('SELECT ev, dim, SUM(n) n, SUM(v) v FROM an_day' + w0 + ' GROUP BY ev, dim', p0),
    q("SELECT day, ev, SUM(n) n FROM an_day" + w1 + " AND ev IN ('story_play','ask','page_view','widget_add','prem_open','upgrade','error') GROUP BY day, ev", p1),
    q('SELECT plan, COUNT(*) n FROM users WHERE 1=1' + notAdmin + ' GROUP BY plan', adm),
    q("SELECT date(created_at,'unixepoch') day, COUNT(*) n FROM users WHERE date(created_at,'unixepoch') BETWEEN ? AND ?" + notAdmin + (plan ? ' AND plan=?' : '') + ' GROUP BY day', [from, to, ...adm, ...(plan ? [plan] : [])]),
    q("SELECT COUNT(*) n FROM users WHERE date(created_at,'unixepoch') BETWEEN ? AND ?" + notAdmin + (plan ? ' AND plan=?' : ''), [pFrom, pTo, ...adm, ...(plan ? [plan] : [])]),
    q('SELECT month, tin, tout FROM ask_spend ORDER BY month DESC LIMIT 1', []).catch(() => [])
  ]);
  const byDay = rows => { const m = {}; rows.forEach(r => { (m[r.day] = m[r.day] || []).push(r); }); return m; };
  const series = (rows, a, len) => { const m = byDay(rows), outA = [], secs = []; for (let i = 0; i < len; i++) { const d = addDays(a, i), r = m[d] || []; outA.push(r.length); secs.push(median(r.map(x => x.secs))); } return { active: outA, secs }; };
  const cur = series(act, from, n), prev = series(actPrev, pFrom, n);
  const people = new Set(act.map(r => r.uid)).size, peoplePrev = new Set(actPrev.map(r => r.uid)).size;
  // coming back: of the people who joined in each of the last three months, how many were active again in weeks 1, 4 and 8
  const cohorts = await q(`SELECT strftime('%Y-%m', u.created_at, 'unixepoch') m, COUNT(DISTINCT u.id) n,
      COUNT(DISTINCT CASE WHEN julianday(a.day) - julianday(date(u.created_at,'unixepoch')) BETWEEN 1 AND 7 THEN u.id END) w1,
      COUNT(DISTINCT CASE WHEN julianday(a.day) - julianday(date(u.created_at,'unixepoch')) BETWEEN 22 AND 28 THEN u.id END) w4,
      COUNT(DISTINCT CASE WHEN julianday(a.day) - julianday(date(u.created_at,'unixepoch')) BETWEEN 50 AND 56 THEN u.id END) w8
    FROM users u LEFT JOIN an_active a ON a.uid = u.id
    WHERE u.created_at >= strftime('%s', date('now','start of month','-2 months'))` + notAdmin.replace(/lower\(email\)/, 'lower(u.email)') + ' GROUP BY m ORDER BY m', adm);
  const evToday = await q('SELECT SUM(n) n FROM an_day WHERE day=?', [today]);
  return out({
    from, to, pFrom, pTo, days: n, plan: plan || 'all', dev: dev || 'all',
    active: cur.active, activePrev: prev.active, secs: cur.secs, secsPrev: prev.secs, people, peoplePrev,
    events: ev, eventsPrev: evPrev, eventsByDay: evDay,
    members: Object.fromEntries(members.map(r => [r.plan || 'free', r.n])),
    signups: signups, signupsPrev: (signPrev[0] || {}).n || 0,
    cohorts, askSpend: spend[0] || null, eventsToday: (evToday[0] || {}).n || 0,
    askCap: +(env.ASK_MONTH_USD || 25)
  });
}

// nightly: keep two years of daily rows
export async function cleanupAnalytics(env) {
  const cut = addDays(day(), -731);
  await env.DB.batch([env.DB.prepare('DELETE FROM an_day WHERE day < ?').bind(cut), env.DB.prepare('DELETE FROM an_active WHERE day < ?').bind(cut)]);
}
