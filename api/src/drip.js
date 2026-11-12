/* First-two-weeks emails for Free members (v52.49). Three short emails, each sent once, around 10am in the person's own
   time zone (from Cloudflare when they sign in or open the app; Eastern when not known):
   - d1  "Add your first card": two days after sign-up (v52.50; the welcome email covers day 0), only if they still have no entries
   - d7  one tip picked from what they've done (log a sale, set a budget, Home Screen, Card Board, Stories, Ask)
   - d13 their first two weeks in numbers, plus what Premium adds (skipped with no entries)
   Never to Premium members, gifted or paused accounts, admins, or anyone who switched emails off (Notifications → Email,
   or the "Stop these emails" link). At most one a day. A step that's more than a few days late is skipped, not sent late.
   Each email has its own random id (email_log.id) used in its links: /e/c/<id>?to=<where> counts a click and opens the
   app there, /e/o/<id>.gif counts an open (a 1x1 image; Apple Mail opens most mail by itself, so opens run high),
   /e/u/<id> stops these emails (one click, plus the List-Unsubscribe header mail apps use).
   Admin dashboard: Growth → Emails (emailStats) and each person's email history (emailsFor). Removed with the account.
   Set DRIP = "off" in the Worker's variables to pause sending. */
import { dripEmail, sendMail, TIPS } from './email.js';
import { ensureGeo } from './geo.js';

const now = () => Math.floor(Date.now() / 1000);
const DEF_TZ = 'America/New_York', SEND_HOUR = 10, MAX_RUN = 40;
export const STEPS = [
  { id: 'd1', day: 2, last: 4, name: 'Day 2 · First card', when: 'If no entries yet' },
  { id: 'd7', day: 7, last: 10, name: 'Day 7 · One tip', when: 'Picked from what they’ve done' },
  { id: 'd13', day: 13, last: 17, name: 'Day 13 · Two weeks', when: 'Summary and Premium' }
];
const GO = { add: 'add', budget: 'budget', board: 'board', stories: 'stories', ask: 'ask', home: 'home', premium: 'premium', emails: 'emails', app: '' };
const admins = env => String(env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
const parse = v => { try { return JSON.parse(v); } catch (e) { return null; } };
const rid = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

let made = false;
export async function ensureDrip(env) {
  if (made) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS email_log (id TEXT PRIMARY KEY, uid TEXT NOT NULL, flow TEXT NOT NULL, step TEXT NOT NULL, variant TEXT, sent_at INTEGER NOT NULL, opened_at INTEGER, opens INTEGER NOT NULL DEFAULT 0, clicked_at INTEGER, clicks INTEGER NOT NULL DEFAULT 0, unsub_at INTEGER)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS email_log_uid ON email_log (uid, sent_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS email_log_sent ON email_log (sent_at)').run();
  made = true;
}

// the person's local date (YYYY-MM-DD) and hour
export function localOf(t, tz) {
  let f; try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || DEF_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }); } catch (e) { f = new Intl.DateTimeFormat('en-CA', { timeZone: DEF_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }); }
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, hour: +p.hour % 24 };
}
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

// which step is due for this person right now (or null)
export function dueStep(created, t, tz, sent) {
  const L = localOf(t, tz); if (L.hour < SEND_HOUR || L.hour > SEND_HOUR + 3) return null;
  const age = daysBetween(localOf(created * 1000, tz).date, L.date);
  for (const s of STEPS) if (age >= s.day && age <= s.last && !sent.has(s.id)) return s.id;
  return null;
}

// switched off: Notifications → Email in the app, or a "Stop these emails" link newer than that setting
export function emailsOff(notif, lastUnsub) {
  const v = notif && notif.v, p = v && v.prefs || {};
  if (p.emailOff === true) return true;
  return !!(lastUnsub && (!notif || !notif.t || lastUnsub * 1000 > Date.parse(notif.t)));
}

// the day-7 tip: the first that fits what they've done
export function pickTip({ n, sales, buys, budget, feats, phone }) {
  if (!n) return 'start';
  if (buys > 0 && !sales) return 'sale';
  if (!budget) return 'budget';
  if (phone && !feats.has('home_screen')) return 'home';
  if (!feats.has('board')) return 'board';
  if (!feats.has('stories_watch')) return 'stories';
  if (!feats.has('ask')) return 'ask';
  return 'board';
}

// their numbers so far (cents), the way the app adds them up
export function summary(entries) {
  let after = 0, spent = 0, n = 0, best = null; const plat = {};
  for (const e of entries) {
    n++;
    if (e.type === 'sale') { after += +e.net || 0; if (!best || (+e.net || 0) > best.net) best = { name: String(e.name || 'A card').slice(0, 40), net: +e.net || 0 }; }
    else if (e.type === 'purchase') spent += +e.amount || 0;
    else if (e.type === 'refund') after -= +e.amount || 0;
    const p = String(e.platform || '').trim(); if (p) plat[p] = (plat[p] || 0) + 1;
  }
  const top = Object.entries(plat).sort((a, b) => b[1] - a[1])[0];
  return { n, profit: after - spent, best: best && best.net > 0 ? best : null, plat: top ? top[0].slice(0, 30) : '' };
}

export async function dripRun(env, t = Date.now(), opt = {}) {
  if (env.DRIP === 'off') return { off: true };
  const q = async (sql, ...a) => { try { return (await env.DB.prepare(sql).bind(...a).all()).results || []; } catch (e) { return []; } };
  try {
    await ensureDrip(env); await ensureGeo(env);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta ( k TEXT PRIMARY KEY, v TEXT )').run();
    const hr = new Date(t).toISOString().slice(0, 13);
    if (!opt.force) {   // at most once an hour (the schedule runs every 5 minutes)
      const row = await env.DB.prepare("SELECT v FROM meta WHERE k='drip_hr'").first();
      if (row && row.v === hr) return { skipped: true };
      await env.DB.prepare("INSERT INTO meta (k,v) VALUES ('drip_hr',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(hr).run();
    }
    const T = Math.floor(t / 1000), adm = admins(env);
    const users = (await q("SELECT u.id, u.email, u.name, u.created_at, g.tz FROM users u LEFT JOIN geo g ON g.user_id = u.id WHERE COALESCE(u.plan,'free') <> 'premium' AND u.created_at > ?", T - 19 * 86400))
      .filter(u => !adm.includes(String(u.email).toLowerCase()) && !/\.local$/.test(u.email));
    let sent = 0; const out = [];
    for (const u of users) {
      if (sent >= MAX_RUN) break;
      const log = await q('SELECT id, step, sent_at, unsub_at FROM email_log WHERE uid=?', u.id);
      if (log.some(r => !r.id.startsWith('x') && r.step !== 'w0' && r.sent_at > T - 20 * 3600)) continue;   // at most one a day
      const step = dueStep(u.created_at, t, u.tz, new Set(log.filter(r => r.step).map(r => r.step))); if (!step) continue;
      const [acct] = await q('SELECT suspended FROM acct WHERE user_id=?', u.id); if (acct && acct.suspended) continue;
      const [gift] = await q('SELECT gift FROM billing WHERE user_id=? AND gift=1', u.id); if (gift) continue;
      const [nm] = await q("SELECT v, updated_at FROM user_meta WHERE user_id=? AND k='notif'", u.id);
      const lastUnsub = Math.max(0, ...log.map(r => r.unsub_at || 0));
      if (emailsOff(nm ? { v: parse(nm.v), t: nm.updated_at } : null, lastUnsub)) continue;
      const ents = (await q('SELECT data FROM entries WHERE user_id=? AND deleted=0', u.id)).map(r => parse(r.data)).filter(Boolean);
      let variant = '', sum = null, n = ents.length;
      if (step === 'd1' && n) { await mark(env, u.id, step, 'skipped', T); continue; }    // already started: nothing to nudge
      if (step === 'd13' && !n) { await mark(env, u.id, step, 'skipped', T); continue; }
      if (step === 'd7') {
        const [b] = await q("SELECT v FROM user_meta WHERE user_id=? AND k='budget'", u.id), bv = b && parse(b.v);
        const feats = new Set((await q('SELECT DISTINCT feat FROM an_feat WHERE uid=?', u.id)).map(r => r.feat));
        const [dv] = await q("SELECT dev, COUNT(*) n FROM an_active WHERE uid=? GROUP BY dev ORDER BY n DESC LIMIT 1", u.id);
        variant = pickTip({ n, sales: ents.filter(e => e.type === 'sale').length, buys: ents.filter(e => e.type === 'purchase').length, budget: !!(bv && bv.cents > 0), feats, phone: !!(dv && dv.dev === 'phone') });
      }
      if (step === 'd13') sum = summary(ents);
      const id = rid(), api = env.API_URL || 'https://api.cardtab.app';
      const links = { go: k => api + '/e/c/' + id + '?to=' + k, unsub: api + '/e/u/' + id, pixel: api + '/e/o/' + id + '.gif' };
      const msg = dripEmail({ step, tip: variant, name: u.name, n, sum, links, open: env.BILLING_OPEN === 'on', opens: env.BILLING_OPENS || '', joinedAt: u.created_at, t });
      try {
        await sendMail(env, { to: u.email, from: 'hello@cardtab.app', replyTo: 'hello@cardtab.app', ...msg,
          headers: { 'List-Unsubscribe': '<' + links.unsub + '>, <mailto:hello@cardtab.app?subject=Stop%20emails>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
      } catch (e) { out.push({ uid: u.id, step, error: String(e.message || e).slice(0, 80) }); continue; }
      await env.DB.prepare('INSERT INTO email_log (id,uid,flow,step,variant,sent_at) VALUES (?,?,?,?,?,?)').bind(id, u.id, 'free14', step, variant || null, T).run();
      sent++; out.push({ uid: u.id, step, variant });
      if (opt.pace !== false) await new Promise(r => setTimeout(r, 600));   // the email service allows a couple a second
    }
    return { sent, out };
  } catch (e) { return { error: String(e && e.message || e) }; }
}
// a step we decided not to send (so it isn't looked at again); no id is ever emailed for it
async function mark(env, uid, step, variant, T) {
  try { await env.DB.prepare('INSERT INTO email_log (id,uid,flow,step,variant,sent_at) VALUES (?,?,?,?,?,?)').bind('x' + rid().slice(1), uid, 'free14', step, variant, T).run(); } catch (e) {}
}

// the welcome email (sent at sign-up by auth.js): a tracked button and open image, logged as step w0
export function welcomeLinks(env) {
  const id = rid(), api = env.API_URL || 'https://api.cardtab.app';
  return { links: { go: k => api + '/e/c/' + id + '?to=' + k, pixel: api + '/e/o/' + id + '.gif' },
    async log(uid) { try { await ensureDrip(env); await env.DB.prepare('INSERT INTO email_log (id,uid,flow,step,variant,sent_at) VALUES (?,?,?,?,?,?)').bind(id, uid, 'free14', 'w0', null, now()).run(); } catch (e) {} } };
}

// ---------- the links in the emails: /e/o/<id>.gif, /e/c/<id>?to=, /e/u/<id> ----------
const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
const page = (title, body) => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;background:#f6f5f0;font:500 15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1918;padding:48px 16px}main{max-width:420px;margin:0 auto;background:#fff;border:1px solid #e9e6de;border-radius:20px;padding:28px}h1{font-size:22px;margin:0 0 8px;letter-spacing:-.02em}p{color:#55524c;margin:0 0 14px}a{color:#a50e37;font-weight:700}button{font:inherit;font-weight:800;background:#a50e37;color:#fff;border:0;border-radius:999px;padding:12px 20px;cursor:pointer}</style></head><body><main>${body}</main></body></html>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' } });

export async function handleEmailLink(env, req, path) {
  const m = path.match(/^\/e\/([ocu])\/([0-9a-f]{32})(\.gif)?$/); if (!m) return null;
  const [, kind, id] = m, T = now();
  try { await ensureDrip(env); } catch (e) {}
  const row = await env.DB.prepare('SELECT id, uid FROM email_log WHERE id=?').bind(id).first().catch(() => null);
  if (kind === 'o') {
    if (row) await env.DB.prepare('UPDATE email_log SET opens=opens+1, opened_at=COALESCE(opened_at,?) WHERE id=?').bind(T, id).run().catch(() => {});
    return new Response(GIF, { headers: { 'content-type': 'image/gif', 'cache-control': 'no-store, max-age=0' } });
  }
  if (kind === 'c') {
    const k = new URL(req.url).searchParams.get('to') || 'app', go = Object.prototype.hasOwnProperty.call(GO, k) ? GO[k] : '';
    if (row) await env.DB.prepare('UPDATE email_log SET clicks=clicks+1, clicked_at=COALESCE(clicked_at,?), opened_at=COALESCE(opened_at,?) WHERE id=?').bind(T, T, id).run().catch(() => {});
    return new Response(null, { status: 302, headers: { location: (env.APP_URL || 'https://app.cardtab.app') + '/' + (go ? '?go=' + go : ''), 'cache-control': 'no-store' } });
  }
  // stop these emails: mail apps send a POST (one click); a person tapping the link gets a page that does the same
  if (req.method === 'POST') { if (row) await unsubscribe(env, row.uid, id, T); return new Response(row ? 'ok' : 'gone', { status: row ? 200 : 404 }); }
  if (!row) return page('Card Tab', '<h1>This link has expired</h1><p>You can switch emails off any time in Card Tab: tap your picture, then Notifications.</p><p><a href="https://app.cardtab.app/">Open Card Tab</a></p>');
  await unsubscribe(env, row.uid, id, T);
  return page('Emails stopped · Card Tab', '<h1>You won’t get these emails anymore</h1><p>No more tips or summaries from Card Tab. Sign-in links and anything about payments still come through.</p><p>Changed your mind? Turn emails back on in Card Tab under your picture → Notifications.</p><p><a href="https://app.cardtab.app/">Open Card Tab</a></p>');
}

// marks the email and switches emails off in their synced Notifications settings, so the app's switch shows it too
export async function unsubscribe(env, uid, id, T = now()) {
  await env.DB.prepare('UPDATE email_log SET unsub_at=COALESCE(unsub_at,?) WHERE id=?').bind(T, id).run();
  try {
    const cur = await env.DB.prepare("SELECT v FROM user_meta WHERE user_id=? AND k='notif'").bind(uid).first();
    const v = (cur && parse(cur.v)) || {}; v.prefs = Object.assign({}, v.prefs, { emailOff: true });
    const st = await env.DB.prepare('SELECT seq FROM sync_state WHERE user_id=?').bind(uid).first(), seq = ((st && st.seq) || 0) + 1, at = new Date(T * 1000 + 1).toISOString();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO user_meta (user_id,k,v,updated_at,seq) VALUES (?,?,?,?,?) ON CONFLICT(user_id,k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at, seq=excluded.seq').bind(uid, 'notif', JSON.stringify(v), at, seq),
      env.DB.prepare('INSERT INTO sync_state (user_id,seq) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET seq=excluded.seq').bind(uid, seq)
    ]);
  } catch (e) { /* the email_log mark alone still keeps them off the list */ }
}

// ---------- admin dashboard ----------
// emails sent in these dates: totals, each step, each day-7 tip, and what people did after
export async function emailStats(env, from, to) {
  const q = async (sql, ...a) => { try { return (await env.DB.prepare(sql).bind(...a).all()).results || []; } catch (e) { return []; } };
  try { await ensureDrip(env); } catch (e) { return null; }
  const a = Math.floor(Date.parse(from + 'T00:00:00Z') / 1000), b = Math.floor(Date.parse(to + 'T23:59:59Z') / 1000);
  const rows = await q('SELECT l.id, l.uid, l.step, l.variant, l.sent_at, l.opened_at, l.clicked_at, l.unsub_at, u.plan, u.created_at FROM email_log l LEFT JOIN users u ON u.id = l.uid WHERE l.sent_at BETWEEN ? AND ? AND l.flow = ?', a, b, 'free14');
  const uids = [...new Set(rows.map(r => r.uid))];
  // what they did after: entries added, budget set, features used, upgraded
  const after = {};
  for (const uid of uids) {
    const ents = (await q('SELECT json_extract(data,\'$.type\') t, json_extract(data,\'$.createdAt\') c FROM entries WHERE user_id=? AND deleted=0', uid));
    const [bud] = await q("SELECT v, updated_at FROM user_meta WHERE user_id=? AND k='budget'", uid);
    const feats = await q('SELECT feat, MIN(day) d FROM an_feat WHERE uid=? GROUP BY feat', uid);
    const [up] = await q("SELECT MIN(at) at FROM plan_ev WHERE uid=? AND kind = 'up'", uid);
    const [au] = await q('SELECT up_day FROM an_user WHERE uid=?', uid);
    after[uid] = { ents, bud: bud && (parse(bud.v) || {}).cents > 0 ? Date.parse(bud.updated_at) / 1000 : 0, feats: Object.fromEntries(feats.map(f => [f.feat, f.d])), up: (up && up.at) || (au && au.up_day ? Date.parse(au.up_day + 'T12:00:00Z') / 1000 : 0) };
  }
  const dayOf = s => new Date(s * 1000).toISOString().slice(0, 10);
  const did = r => {
    const A = after[r.uid]; if (!A) return false; const t0 = r.sent_at, d0 = dayOf(t0), ent = type => A.ents.some(e => (!type || e.t === type) && e.c && Date.parse(e.c) / 1000 > t0), feat = f => !!(A.feats[f] && A.feats[f] >= d0);
    if (r.step === 'd1') return ent();
    if (r.step === 'w0') return ent();
    if (r.step === 'd13') return !!(A.up && A.up >= t0 && A.up <= t0 + 14 * 86400);
    return { start: () => ent(), sale: () => ent('sale'), budget: () => A.bud > t0, home: () => feat('home_screen'), board: () => feat('board'), stories: () => feat('stories_watch'), ask: () => feat('ask') }[r.variant || 'board']();
  };
  const sent = rows.filter(r => !r.id.startsWith('x'));
  const agg = list => ({ sent: list.length, opened: list.filter(r => r.opened_at).length, clicked: list.filter(r => r.clicked_at).length, unsub: list.filter(r => r.unsub_at).length, did: list.filter(did).length });
  const w = sent.filter(r => r.step === 'w0'), welcome = { id: 'w0', name: 'Welcome', when: 'Right after sign-up', ...agg(w) };
  const steps = STEPS.map(s => ({ id: s.id, name: s.name, when: s.when, skipped: rows.filter(r => r.step === s.id && r.id.startsWith('x')).length, ...agg(sent.filter(r => r.step === s.id)) }));
  const TL = { start: 'Add a first card', sale: 'Log a sale', budget: 'Set a budget', home: 'Add to Home Screen', board: 'Try the Card Board', stories: 'Play a Card Story', ask: 'Ask a question' };
  const tips = Object.keys(TIPS).map(k => ({ tip: k, title: TL[k] || TIPS[k].title, ...agg(sent.filter(r => r.step === 'd7' && r.variant === k)) })).filter(x => x.sent);
  const byDay = {}; sent.forEach(r => { const d = dayOf(r.sent_at); byDay[d] = (byDay[d] || 0) + 1; });
  const adm = admins(env), joined = (await q('SELECT email FROM users WHERE created_at BETWEEN ? AND ?', a, b)).filter(u => !adm.includes(String(u.email).toLowerCase())).length;
  const offNow = (await q("SELECT COUNT(*) n FROM user_meta WHERE k='notif' AND json_extract(v,'$.prefs.emailOff') = 1"))[0];
  return { total: agg(sent), welcome, steps, tips, byDay, joined, offNow: (offNow && offNow.n) || 0, hour: SEND_HOUR, paused: env.DRIP === 'off' };
}

// one person's emails, newest first (People → a person)
export async function emailsFor(env, uid) {
  try { await ensureDrip(env); return ((await env.DB.prepare("SELECT step, variant, sent_at, opened_at, clicked_at, unsub_at FROM email_log WHERE uid=? AND id NOT LIKE 'x%' ORDER BY sent_at DESC LIMIT 20").bind(uid).all()).results || []); } catch (e) { return []; }
}
