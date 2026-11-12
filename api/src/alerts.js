/* Admin alerts (v52.31): things that need the admin, kept until they're marked done.
   One list on the server, shown in the admin dashboard (the bell) and in the admin's own Card Tab notifications.
   Marking one done anywhere clears it everywhere. The same problem never stacks up: while an alert is open, raising it
   again only updates it; once it's done, the next time it happens it comes back as a new alert.
     grp 'now' = needs attention now (health check failures, limits, error spikes, failed payments)
     grp 'you' = waiting on you (new feedback, card photos to review)
   GET  /auth/admin/alerts              admins: the open alerts, needs-attention first
   POST /auth/admin/alerts/done {id}    admins: mark one done
   Urgent alerts raised outside the daily check also send one email (the daily check already emails its own results). */
import { sendMail } from './email.js';
import { limits, cycle } from './budget.js';

const now = () => Math.floor(Date.now() / 1000);
const admins = env => (env.ADMIN_EMAILS || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAIL_PER_DAY = 8;

let made = false;
export async function ensureAlerts(env) {
  if (made) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, k TEXT NOT NULL, grp TEXT NOT NULL, kind TEXT, icon TEXT,
    title TEXT, sub TEXT, go TEXT, at INTEGER, upd INTEGER, n INTEGER DEFAULT 1, done_at INTEGER)`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS alerts_open ON alerts (done_at, k)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta ( k TEXT PRIMARY KEY, v TEXT )').run();
  made = true;
}

/* raise an alert. a = {key, grp:'now'|'you', kind:'r'|'w'|'b', icon:'x'|'g'|'m'|'p'|'c', title, sub, go, mail}
   go: where the dashboard opens it: health | errors | art | data | ask | billing | feedback:<id>
   Returns {id, fresh}. Never throws: an alert must never break what raised it. */
export async function raiseAlert(env, a) {
  try {
    await ensureAlerts(env);
    const k = clip(a.key, 120), t = now(); if (!k) return null;
    const open = await env.DB.prepare('SELECT id FROM alerts WHERE k=? AND done_at IS NULL').bind(k).first();
    if (open) { await env.DB.prepare('UPDATE alerts SET title=?, sub=?, kind=?, upd=?, n=n+1 WHERE id=?').bind(clip(a.title, 140), clip(a.sub, 200), a.kind || 'w', t, open.id).run(); return { id: open.id, fresh: false }; }
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO alerts (id,k,grp,kind,icon,title,sub,go,at,upd,n) VALUES (?,?,?,?,?,?,?,?,?,?,1)')
      .bind(id, k, a.grp === 'you' ? 'you' : 'now', a.kind || 'w', a.icon || 'x', clip(a.title, 140), clip(a.sub, 200), clip(a.go, 80) || 'health', t, t).run();
    if (a.mail && a.grp !== 'you') await mailAlert(env, a).catch(() => {});
    return { id, fresh: true };
  } catch (e) { return null; }
}
// close an alert by its key (when the thing behind it was dealt with somewhere else, like replying to feedback)
export async function resolveAlert(env, key) {
  try { await ensureAlerts(env); await env.DB.prepare('UPDATE alerts SET done_at=? WHERE k=? AND done_at IS NULL').bind(now(), clip(key, 120)).run(); } catch (e) {}
}
export async function openAlerts(env) {
  await ensureAlerts(env);
  const rows = (await env.DB.prepare("SELECT id,k,grp,kind,icon,title,sub,go,at,upd,n FROM alerts WHERE done_at IS NULL ORDER BY CASE grp WHEN 'now' THEN 0 ELSE 1 END, at DESC LIMIT 100").all()).results || [];
  return rows.map(r => ({ id: r.id, key: r.k, grp: r.grp, kind: r.kind, icon: r.icon, title: r.title, sub: r.sub, go: r.go, at: r.at, upd: r.upd, n: r.n }));
}

async function mailAlert(env, a) {
  const to = admins(env); if (!to.length) return;
  const d = new Date().toISOString().slice(0, 10), mk = 'alert_mail_' + d;
  const c = await env.DB.prepare('SELECT v FROM meta WHERE k=?').bind(mk).first().catch(() => null);
  if (c && +c.v >= MAIL_PER_DAY) return;   // a bad day can't flood the inbox
  await env.DB.prepare("INSERT INTO meta (k,v) VALUES (?, '1') ON CONFLICT(k) DO UPDATE SET v=CAST(v AS INTEGER)+1").bind(mk).run().catch(() => {});
  const app = env.APP_URL || 'https://app.cardtab.app', link = app + '/admin.html#alerts';
  const subject = 'Card Tab needs attention: ' + clip(a.title, 90);
  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1918;max-width:520px"><div style="font-weight:800;font-size:15px">Card Tab · needs attention</div>' +
    '<h1 style="font-size:20px;margin:10px 0 6px;color:#c0392b">' + esc(a.title) + '</h1>' + (a.sub ? '<p style="margin:0 0 16px;color:#77736d;font-size:14px">' + esc(a.sub) + '</p>' : '') +
    '<p style="margin:0"><a href="' + link + '" style="background:#a50e37;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;font-size:14px">Open alerts</a></p>' +
    '<p style="margin:16px 0 0;font-size:12.5px;color:#77736d">It stays in your alerts (admin dashboard and Card Tab notifications) until you mark it done.</p></div>';
  const text = subject + (a.sub ? '\n\n' + a.sub : '') + '\n\nOpen alerts: ' + link;
  for (const t of to) { try { await sendMail(env, { to: t, subject, html, text }); } catch (e) {} }
}

// ---------- the regular checks (from the 5-minute schedule, at most once an hour) ----------
// JustTCG requests and Ask spending close to their monthly limits, and app errors well above normal today.
// The catalog fill in the last week before the reset uses leftover requests on purpose, so it isn't counted here.
export async function alertChecks(env, t = Date.now()) {
  await ensureAlerts(env);
  const hr = new Date(t).toISOString().slice(0, 13), last = await env.DB.prepare("SELECT v FROM meta WHERE k='alert_checks'").first().catch(() => null);
  if (last && last.v === hr) return { skipped: true };
  await env.DB.prepare("INSERT INTO meta (k,v) VALUES ('alert_checks',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(hr).run();
  const out = {};
  try {   // JustTCG
    const L = limits(env), c = cycle(env, t);
    const r = await env.DB.prepare("SELECT COALESCE(SUM(calls),0) n FROM usage WHERE day>=? AND day<? AND src<>'cat'").bind(c.start, c.end).first();
    const pct = Math.round((r ? r.n : 0) / L.month * 100); out.jt = pct;
    const sub = (r ? r.n : 0).toLocaleString('en-US') + ' of ' + L.month.toLocaleString('en-US') + ' · resets ' + new Date(c.end + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (pct >= 95) { await resolveAlert(env, 'jt80:' + c.start); await raiseAlert(env, { key: 'jt95:' + c.start, grp: 'now', kind: 'r', icon: 'g', title: 'JustTCG at ' + pct + '% of this month’s requests', sub, go: 'data', mail: true }); }
    else if (pct >= 80) await raiseAlert(env, { key: 'jt80:' + c.start, grp: 'now', kind: 'w', icon: 'g', title: 'JustTCG at ' + pct + '% of this month’s requests', sub, go: 'data', mail: true });
  } catch (e) {}
  try {   // Ask spending
    const m = new Date(t).toISOString().slice(0, 7), r = await env.DB.prepare('SELECT tin, tout FROM ask_spend WHERE month=?').bind(m).first();
    const cost = r ? (r.tin * 0.10 + r.tout * 0.50) / 1e6 : 0, cap = +(env.ASK_MONTH_USD || 25), pct = cap ? Math.round(cost / cap * 100) : 0; out.ask = pct;
    const sub = '$' + cost.toFixed(2) + ' of $' + cap + ' this month';
    if (pct >= 100) { await resolveAlert(env, 'ask80:' + m); await raiseAlert(env, { key: 'ask100:' + m, grp: 'now', kind: 'r', icon: 'g', title: 'Ask reached its monthly cap', sub: sub + ' · questions are paused until next month', go: 'ask', mail: true }); }
    else if (pct >= 80) await raiseAlert(env, { key: 'ask80:' + m, grp: 'now', kind: 'w', icon: 'g', title: 'Ask at ' + pct + '% of its monthly cap', sub, go: 'ask', mail: true });
  } catch (e) {}
  try {   // errors today, against the last 7 days
    const d = new Date(t).toISOString().slice(0, 10), w = new Date(t - 7 * 864e5).toISOString().slice(0, 10);
    const a = await env.DB.prepare("SELECT COALESCE(SUM(n),0) n FROM an_day WHERE day=? AND ev='error'").bind(d).first();
    const b = await env.DB.prepare("SELECT COALESCE(SUM(n),0) n FROM an_day WHERE day>=? AND day<? AND ev='error'").bind(w, d).first();
    const today = a ? a.n : 0, avg = (b ? b.n : 0) / 7; out.err = today;
    if (today >= Math.max(25, avg * 3)) {
      const top = (await env.DB.prepare("SELECT dim, SUM(n) n FROM an_day WHERE day=? AND ev='error' GROUP BY dim ORDER BY n DESC LIMIT 2").bind(d).all()).results || [];
      await raiseAlert(env, { key: 'err:' + d, grp: 'now', kind: 'r', icon: 'x', title: 'App errors are up: ' + today + ' today', sub: 'Usually about ' + Math.round(avg) + ' a day' + (top.length ? ' · mostly ' + top.map(x => x.dim).join(', ') : ''), go: 'errors', mail: true });
    }
  } catch (e) {}
  return out;
}

// the daily check's results: every failure, and every check that needs a look, becomes an alert (no extra email)
export async function alertsFromHealth(env, checks) {
  for (const c of checks || []) {
    if (c.ok && !c.warn) continue;
    await raiseAlert(env, { key: 'health:' + c.key, grp: 'now', kind: c.ok ? 'w' : 'r', icon: 'x', title: c.ok ? c.name + ' needs a look' : c.name + ' failed', sub: c.note || 'Daily health check', go: 'health' });
  }
}

export async function handleAlerts(env, req, path, admin, out) {
  if (!admin) return out({ error: 'Admins only.' }, 403);
  if (path === '/auth/admin/alerts' && req.method === 'GET') { const items = await openAlerts(env); return out({ items, now: items.filter(x => x.grp === 'now').length, you: items.filter(x => x.grp === 'you').length }); }
  if (path === '/auth/admin/alerts/done' && req.method === 'POST') {
    await ensureAlerts(env); const b = await req.json().catch(() => ({}));
    const r = await env.DB.prepare('UPDATE alerts SET done_at=? WHERE id=? AND done_at IS NULL').bind(now(), clip(b.id, 60)).run();
    return out({ ok: true, changed: (r.meta && r.meta.changes) || 0 });
  }
  return out({ error: 'not found' }, 404);
}

// nightly: forget alerts that were marked done more than 90 days ago
export async function cleanupAlerts(env) { try { await ensureAlerts(env); await env.DB.prepare('DELETE FROM alerts WHERE done_at IS NOT NULL AND done_at < ?').bind(now() - 90 * 86400).run(); } catch (e) {} }
