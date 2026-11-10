/* Card data budget (v42.6).
   JustTCG allows MONTH_LIMIT requests per billing month (it resets on RESET_DAY) and DAY_LIMIT per day.
   - Every request we make to JustTCG is counted, by day, by why (typing in Add New, or filling in art in the background)
     and by plan. Cache hits are counted too, so the admin readout shows how much the cache saves.
   - Typing always comes first. Background art fill only uses its share of what's left: the month's remaining requests
     spread over the days left, and fill gets FILL_SHARE of each day's share. Free accounts' fill comes last: they only
     use the first FREE_SHARE of the day's share, and at most FREE_PER_USER requests a day each. Premium fill gets the rest, at most PREMIUM_PER_USER a day each (v51.3).
   - Nobody is told any of this. When fill has to wait, the app quietly tries again later. */
const n = (v, d) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };
export function limits(env) {
  return { month: n(env.MONTH_LIMIT, 10000), resetDay: n(env.RESET_DAY, 6), day: n(env.DAY_LIMIT, 1000),
    fillShare: n(env.FILL_SHARE, 0.6), freeShare: n(env.FREE_SHARE, 0.3), freePerUser: n(env.FREE_PER_USER, 20), premPerUser: n(env.PREMIUM_PER_USER, 100),
    boost: n(env.LAST_WEEK_BOOST, 3) };
}
export const today = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
// the billing month we're in: from the last reset day (UTC) to the next one
export function cycle(env, t = Date.now()) {
  const L = limits(env), d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth();
  let start = new Date(Date.UTC(y, m, L.resetDay)); if (start.getTime() > t) start = new Date(Date.UTC(y, m - 1, L.resetDay));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, L.resetDay));
  return { start: today(start.getTime()), end: today(end.getTime()), daysLeft: Math.max(1, Math.ceil((end.getTime() - t) / 864e5)) };
}

export async function totals(env, t = Date.now()) {
  const c = cycle(env, t), d = today(t);
  const r = await env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN day>=? AND day<? THEN calls END),0) month,
      COALESCE(SUM(CASE WHEN day=? THEN calls END),0) day,
      COALESCE(SUM(CASE WHEN day=? AND src='fill' THEN calls END),0) fill,
      COALESCE(SUM(CASE WHEN day=? AND src='fill' AND plan='free' THEN calls END),0) freefill,
      COALESCE(SUM(CASE WHEN day>=? AND day<? AND day<? THEN calls END),0) before
    FROM usage WHERE day>=?`).bind(c.start, c.end, d, d, d, c.start, c.end, d, c.start).first();
  return { ...r, cycle: c };
}

// May this lookup ask JustTCG? Returns '' when yes, or why not.
export async function gate(env, who, t = Date.now()) {
  const L = limits(env), T = await totals(env, t);
  if (T.month >= L.month - 20 || T.day >= L.day - 10) return 'limit';            // nothing left: everyone uses what we've already saved
  if (who.src !== 'fill' || who.admin) return '';                 // admins can fill their own art now, past the daily share
  // the day's fair share of what's left this month, decided at the start of the day so it doesn't shrink as the day goes on
  const share = Math.min(L.day, Math.floor((L.month - T.before) / T.cycle.daysLeft));
  if (T.fill >= share * L.fillShare) return 'later';
  if (who.plan !== 'premium' && T.freefill >= share * L.fillShare * L.freeShare) return 'later';
  // v51.3: one person can only take so much art fill a day (Free 20, Premium 100), so a big import can't crowd out
  // everyone else. In the last week before the reset, when there's quota to spare, the caps triple.
  if (who.user) { const u = await env.DB.prepare('SELECT calls FROM usage_user WHERE day=? AND user_id=?').bind(today(t), who.user).first();
    const cap = (who.plan === 'premium' ? L.premPerUser : L.freePerUser) * (T.cycle.daysLeft <= 7 ? L.boost : 1);
    if (u && u.calls >= cap) return 'later'; }
  return '';
}

// count what one lookup did: calls = requests made to JustTCG (0 when the cache or our own catalog answered)
export async function count(env, who, calls, t = Date.now()) {
  const d = today(t), src = who.src === 'fill' ? 'fill' : 'type', plan = who.plan === 'premium' ? 'premium' : who.user ? 'free' : 'none';
  const s = [env.DB.prepare('INSERT INTO usage (day,src,plan,calls,reqs) VALUES (?,?,?,?,1) ON CONFLICT(day,src,plan) DO UPDATE SET calls=calls+excluded.calls, reqs=reqs+1').bind(d, src, plan, calls)];
  if (calls && who.user) s.push(env.DB.prepare('INSERT INTO usage_user (day,user_id,calls) VALUES (?,?,?) ON CONFLICT(day,user_id) DO UPDATE SET calls=calls+excluded.calls').bind(d, who.user, calls));
  await env.DB.batch(s);
}

// the admin readout
export async function report(env, t = Date.now()) {
  const L = limits(env), T = await totals(env, t), c = T.cycle;
  const rows = (await env.DB.prepare('SELECT day,src,plan,calls,reqs FROM usage WHERE day>=? ORDER BY day DESC').bind(c.start).all()).results;
  const days = {}; for (const r of rows) { const x = days[r.day] || (days[r.day] = { day: r.day, calls: 0, reqs: 0, type: 0, fill: 0, cat: 0, free: 0, premium: 0 });
    x.calls += r.calls; x.reqs += r.reqs; x[r.src] = (x[r.src] || 0) + r.calls; if (r.plan === 'free' || r.plan === 'premium') x[r.plan] += r.calls; }
  const reqs = rows.reduce((a, r) => a + r.reqs, 0);
  const share = Math.min(L.day, Math.floor((L.month - T.before) / c.daysLeft));
  return { month: T.month, limit: L.month, resets: c.end, daysLeft: c.daysLeft, today: T.day, todayShare: share,
    savedPct: reqs ? Math.max(0, Math.min(100, Math.round((1 - T.month / Math.max(reqs, 1)) * 100))) : 0, days: Object.values(days).slice(0, 14) };
}
