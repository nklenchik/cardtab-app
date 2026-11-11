/* People (v52.8): the admin dashboard's account tools. Admins only (checked by the caller).
   GET  /auth/admin/people/one?id=     one account: plan and its history, this month's use, devices, shared board, flags
   POST /auth/admin/people/act         { id, act, ... } one action:
        gift { on, days }       Premium as a gift, forever or for N days (switches back to Free on its own)
        entries { n }           extra Free entries this month (a set number, 0 takes them away)
        askmore { n }           extra Ask questions this month, on top of the plan's (a set number)
        ask                     this month's Ask questions back
        signout                 ends every session
        email { email }         changes the sign-in email
        share                   turns their shared board link off
        uploads { on }          allows or blocks card photo uploads
        suspend { on }          pauses the account: signed out, can't sign in; nothing is deleted
        export                  everything kept for this account, as JSON (a "send me my data" request)
        delete                  removes the account and its data (not while a paid subscription is running)
   Only counts and dates are shown; never their cards or prices (export is the one exception, for that person's own request).
   Every action is logged in acct_log, which also feeds the plan history. */
import { rowOf, saveRow, planOf, ACTIVE, ensureTable, cancelForDelete } from './billing.js';
import { deleteUserPhotos } from './artup.js';
import { deleteSynced } from './sync.js';
import { askLimits } from './ask.js';

const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const ym = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);
const normEmail = e => String(e || '').trim().toLowerCase();
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
export const BONUS_STEP = 20;

// the two small tables, made on first use (the nightly schema check makes them too)
let ready = false;
export async function ensureAcct(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS acct ( user_id TEXT PRIMARY KEY, gift_until INTEGER, bonus_month TEXT, bonus_entries INTEGER NOT NULL DEFAULT 0, suspended INTEGER NOT NULL DEFAULT 0, no_upload INTEGER NOT NULL DEFAULT 0, updated INTEGER, ask_month TEXT, ask_bonus INTEGER NOT NULL DEFAULT 0 )'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS acct_log ( at INTEGER NOT NULL, uid TEXT NOT NULL, act TEXT NOT NULL, note TEXT )'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS acct_log_uid ON acct_log (uid, at)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS acct_note ( id TEXT PRIMARY KEY, uid TEXT NOT NULL, at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT, seen INTEGER NOT NULL DEFAULT 0 )'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS acct_note_uid ON acct_note (uid, seen)')
  ]);
  // v52.9: extra Ask questions (tables made before that get the columns)
  for (const c of ['ask_month TEXT', 'ask_bonus INTEGER NOT NULL DEFAULT 0']) { try { await env.DB.prepare('ALTER TABLE acct ADD COLUMN ' + c).run(); } catch (e) { /* already there */ } }
  ready = true;
}
// an account's flags ({} when there are none, or the table can't be read)
export async function acctOf(env, uid) {
  try { await ensureAcct(env); return (await env.DB.prepare('SELECT * FROM acct WHERE user_id=?').bind(uid).first()) || {}; } catch (e) { return {}; }
}
async function setAcct(env, uid, patch) {
  const cur = await acctOf(env, uid);
  const r = Object.assign({ gift_until: null, bonus_month: null, bonus_entries: 0, suspended: 0, no_upload: 0, ask_month: null, ask_bonus: 0 }, cur, patch, { user_id: uid, updated: now() });
  await env.DB.prepare('INSERT OR REPLACE INTO acct (user_id,gift_until,bonus_month,bonus_entries,suspended,no_upload,updated,ask_month,ask_bonus) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(uid, r.gift_until, r.bonus_month, r.bonus_entries, r.suspended, r.no_upload, r.updated, r.ask_month, r.ask_bonus || 0).run();
  return r;
}
// v52.10: a message for the person, picked up by their app (POST /auth/notes) and shown in their notifications
const note = (env, uid, title, body) => env.DB.prepare('INSERT INTO acct_note (id,uid,at,title,body,seen) VALUES (?,?,?,?,?,0)').bind(crypto.randomUUID(), uid, now(), title, body || '').run().catch(() => {});
const day = t => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
// the person's app asks for new messages; each one is handed over once
export async function takeNotes(env, uid) {
  try {
    await ensureAcct(env);
    const rows = (await env.DB.prepare('SELECT id,at,title,body FROM acct_note WHERE uid=? AND seen=0 ORDER BY at LIMIT 20').bind(uid).all()).results || [];
    if (rows.length) await env.DB.batch(rows.map(r => env.DB.prepare('UPDATE acct_note SET seen=1 WHERE id=?').bind(r.id)));
    await env.DB.prepare('DELETE FROM acct_note WHERE uid=? AND seen=1 AND at<?').bind(uid, now() - 90 * DAY).run().catch(() => {});
    return rows;
  } catch (e) { return []; }
}
const log = (env, uid, act, note = '') => env.DB.prepare('INSERT INTO acct_log (at,uid,act,note) VALUES (?,?,?,?)').bind(now(), uid, act, note).run().catch(() => {});

// extra Free entries for the app (only this month's count)
// extra Ask questions this month (0 when none)
export const askBonus = a => (a && a.ask_month === ym() && a.ask_bonus > 0 ? a.ask_bonus : 0);
export const bonusOut = a => (a && a.bonus_month === ym() && a.bonus_entries > 0 ? { m: a.bonus_month, n: a.bonus_entries } : null);

// a gift with an end date switches back on its own (called by the daily job)
export async function giftSweep(env) {
  try {
    await ensureAcct(env); await ensureTable(env);
    const rows = (await env.DB.prepare('SELECT user_id FROM acct WHERE gift_until IS NOT NULL AND gift_until<?').bind(now()).all()).results || [];
    for (const x of rows) {
      const r = await saveRow(env, x.user_id, { gift: 0 });
      await env.DB.prepare('UPDATE users SET plan=? WHERE id=?').bind(planOf(r), x.user_id).run();
      await setAcct(env, x.user_id, { gift_until: null });
      await log(env, x.user_id, 'gift_end', 'Gift ended on its date');
      await note(env, x.user_id, 'Your Premium gift has ended', 'You’re back on Free. Everything you added is still here.');
    }
    return rows.length;
  } catch (e) { return 0; }
}

// "iPhone · Safari" from a browser's user-agent text
export function device(ua) {
  ua = String(ua || '');
  const d = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const b = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return b ? d + ' · ' + b : d;
}

// everything the delete removes (the person's own Settings → Delete account uses this too)
export async function wipeAccount(env, uid, email) {
  await deleteUserPhotos(env, uid);
  const st = [...(await deleteSynced(env, uid))];
  for (const [t, c] of [['sessions', 'user_id'], ['an_active', 'uid'], ['an_feat', 'uid'], ['shares', 'uid'], ['an_user', 'uid'], ['ask_usage', 'user_id'], ['usage_user', 'user_id']]) st.push(env.DB.prepare(`DELETE FROM ${t} WHERE ${c}=?`).bind(uid));
  st.push(env.DB.prepare('DELETE FROM login_tokens WHERE email=?').bind(email), env.DB.prepare('DELETE FROM users WHERE id=?').bind(uid));
  await env.DB.batch(st);
  for (const sql of ['DELETE FROM an_copy WHERE uid=?', 'DELETE FROM acct WHERE user_id=?', 'DELETE FROM acct_log WHERE uid=?', 'DELETE FROM acct_note WHERE uid=?'])
    try { await env.DB.prepare(sql).bind(uid).run(); } catch (e) { /* a table not made yet */ }
}

const q1 = async (env, sql, ...a) => { try { return (await env.DB.prepare(sql).bind(...a).first()) || {}; } catch (e) { return {}; } };
const qa = async (env, sql, ...a) => { try { return (await env.DB.prepare(sql).bind(...a).all()).results || []; } catch (e) { return []; } };
const stripeUrl = (env, cus) => cus ? 'https://dashboard.stripe.com/' + (/^sk_test_/.test(env.STRIPE_SECRET_KEY || '') ? 'test/' : '') + 'customers/' + encodeURIComponent(cus) : '';

async function details(env, uid) {
  const u = await q1(env, 'SELECT * FROM users WHERE id=?', uid); if (!u.id) return null;
  await ensureTable(env);
  const b = (await rowOf(env, uid)) || {}, a = await acctOf(env, uid), m = ym(), L = askLimits(env);
  const paying = !!(b.status && ACTIVE(b.status) && !b.gift);
  const ent = await q1(env, "SELECT COUNT(*) n, COALESCE(SUM(substr(json_extract(data,'$.createdAt'),1,7)=?),0) mo FROM entries WHERE user_id=? AND deleted=0", m, uid);
  const ask = await q1(env, 'SELECT n FROM ask_usage WHERE user_id=? AND month=?', uid, m);
  const share = await q1(env, 'SELECT live,exp,views,created FROM shares WHERE uid=?', uid);
  const ups = await q1(env, 'SELECT COUNT(*) n FROM art_uploads WHERE user_id=?', uid);
  const sess = await qa(env, 'SELECT created_at,expires_at,ua FROM sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 12', uid, now());
  const hist = (await qa(env, 'SELECT at,kind FROM plan_ev WHERE uid=?', uid)).map(x => ({ at: x.at, what: x.kind === 'up' ? 'Upgraded to Premium' : 'Moved back to Free' }))
    .concat((await qa(env, 'SELECT at,act,note FROM acct_log WHERE uid=? ORDER BY at DESC LIMIT 40', uid)).map(x => ({ at: x.at, what: x.note || x.act })))
    .sort((x, y) => y.at - x.at).slice(0, 30);
  const plan = planOf(b) === 'premium' || u.plan === 'premium' ? 'premium' : 'free';
  return {
    id: u.id, email: u.email, name: u.name || '', joined: u.created_at, lastSeen: u.last_seen_at || null, via: u.google_sub ? 'Google' : 'Email',
    plan, gift: !!b.gift, giftUntil: b.gift ? (a.gift_until || null) : null, paying, interval: b.interval || null, founderPrice: !!b.founder,
    status: b.status || null, renews: b.period_end || null, cancelAtEnd: !!b.cancel_at_end, stripe: stripeUrl(env, b.customer),
    month: { entries: ent.mo || 0, limit: plan === 'premium' ? null : 20 + ((bonusOut(a) || {}).n || 0), bonus: (bonusOut(a) || {}).n || 0, ask: ask.n || 0, askLimit: (plan === 'premium' ? L.premium : L.free) + askBonus(a), askBonus: askBonus(a) },
    totals: { entries: ent.n || 0, uploads: ups.n || 0 },
    share: share.created ? { live: !!share.live && !(share.exp && share.exp < now()), views: share.views || 0, since: share.created } : null,
    devices: sess.map(s => ({ name: device(s.ua), since: s.created_at })),
    suspended: !!a.suspended, uploadsOff: !!a.no_upload, history: hist
  };
}

export async function handlePeople(env, req, path, out) {
  await ensureAcct(env);
  if (path === '/auth/admin/people/one' && req.method === 'GET') {
    const d = await details(env, String(new URL(req.url).searchParams.get('id') || ''));
    return d ? out({ person: d }) : out({ error: 'No such account.' }, 404);
  }
  if (path !== '/auth/admin/people/act' || req.method !== 'POST') return null;
  const b = await req.json().catch(() => ({}));
  const u = b.id ? await q1(env, 'SELECT * FROM users WHERE id=?', String(b.id)) : {};
  if (!u.id) return out({ error: 'No such account.' }, 404);
  // tell(title, body): the person gets a notification for this change
  let told = false;
  const tell = (title, body) => { told = true; return note(env, uid, title, body); };
  const uid = u.id, done = async what => { if (what) await log(env, uid, b.act, what); return out({ ok: true, told, person: await details(env, uid) }); };
  switch (b.act) {
    case 'gift': {
      await ensureTable(env);
      const cur = (await rowOf(env, uid)) || {};
      if (b.on && cur.status && ACTIVE(cur.status) && !cur.gift) return out({ error: 'They already pay for Premium.' }, 400);
      const days = Math.max(0, Math.min(3650, parseInt(b.days, 10) || 0));
      const r = await saveRow(env, uid, { gift: b.on ? 1 : 0 });
      await setAcct(env, uid, { gift_until: b.on && days ? now() + days * DAY : null });
      await env.DB.prepare('UPDATE users SET plan=? WHERE id=?').bind(planOf(r), uid).run();
      if (b.on) await tell('You’ve been given Premium', 'A gift from Card Tab: Premium ' + (days ? 'for ' + days + ' days, until ' + day(now() + days * DAY) : 'with no end date') + '. Nothing to pay, and it won’t renew.');
      else if (cur.gift) await tell('Your Premium gift has ended', 'You’re back on Free. Everything you added is still here.');
      return done(b.on ? 'Gift of Premium' + (days ? ' for ' + days + ' days' : ', no end date') : 'Gift turned off');
    }
    case 'entries': {
      const a = await acctOf(env, uid), m = ym(), had = a.bonus_month === m ? a.bonus_entries || 0 : 0;
      const n = b.n == null ? had + BONUS_STEP : Math.max(0, Math.min(10000, parseInt(b.n, 10) || 0));
      await setAcct(env, uid, { bonus_month: m, bonus_entries: n });
      if (n > had) await tell('You have ' + n + ' extra entries this month', 'A gift from Card Tab: you can add up to ' + (20 + n) + ' entries this month. Extras end on the 1st.');
      return done(n ? n + ' extra entries this month (' + (20 + n) + ' in all)' : 'Extra entries taken away');
    }
    case 'askmore': {
      const n = Math.max(0, Math.min(10000, parseInt(b.n, 10) || 0));
      const hadA = askBonus(await acctOf(env, uid));
      await setAcct(env, uid, { ask_month: ym(), ask_bonus: n });
      if (n > hadA) await tell('You have ' + n + ' extra Ask questions this month', 'A gift from Card Tab, on top of your plan’s questions. Extras end on the 1st.');
      return done(n ? n + ' extra Ask questions this month' : 'Extra Ask questions taken away');
    }
    case 'ask':
      await env.DB.prepare('DELETE FROM ask_usage WHERE user_id=? AND month=?').bind(uid, ym()).run();
      await tell('Your Ask questions are back', 'Your questions for this month have been reset. Ask away.');
      return done('Ask questions reset for this month');
    case 'signout':
      await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(uid).run();
      return done('Signed out everywhere');
    case 'email': {
      const e = normEmail(b.email);
      if (!validEmail(e)) return out({ error: 'Enter a valid email address.' }, 400);
      if (e === u.email) return out({ error: 'That’s already their email.' }, 400);
      const taken = await q1(env, 'SELECT id FROM users WHERE email=?', e);
      if (taken.id) return out({ error: 'Another account already uses that email.' }, 400);
      await env.DB.batch([env.DB.prepare('UPDATE users SET email=? WHERE id=?').bind(e, uid), env.DB.prepare('DELETE FROM login_tokens WHERE email=?').bind(u.email)]);
      await tell('Your sign-in email changed', 'You now sign in with ' + e + '. If you didn’t ask for this, email hello@cardtab.app.');
      return done('Email changed from ' + u.email + ' to ' + e);
    }
    case 'share':
      await env.DB.prepare('UPDATE shares SET live=0 WHERE uid=?').bind(uid).run().catch(() => {});
      return done('Shared board link turned off');
    case 'uploads':
      await setAcct(env, uid, { no_upload: b.on ? 0 : 1 });
      return done(b.on ? 'Photo uploads allowed' : 'Photo uploads blocked');
    case 'suspend':
      await setAcct(env, uid, { suspended: b.on ? 1 : 0 });
      if (b.on) await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(uid).run();
      return done(b.on ? 'Account paused' : 'Account unpaused');
    case 'export': {
      const entries = (await qa(env, 'SELECT data FROM entries WHERE user_id=? AND deleted=0', uid)).map(x => { try { return JSON.parse(x.data); } catch (e) { return null; } }).filter(Boolean);
      const settings = Object.fromEntries((await qa(env, 'SELECT k,v FROM user_meta WHERE user_id=?', uid)).map(x => { let v = x.v; try { v = JSON.parse(x.v); } catch (e) {} return [x.k, v]; }));
      const d = await details(env, uid);
      await log(env, uid, 'export', 'Data exported');
      return out({ ok: true, data: { exported: new Date().toISOString(), account: { email: u.email, name: u.name || '', joined: new Date((u.created_at || 0) * 1000).toISOString(), signIn: d.via, plan: d.plan },
        entries, settings, sharedBoard: d.share, photosUploaded: d.totals.uploads } });
    }
    case 'delete': {
      await ensureTable(env);
      const r = (await rowOf(env, uid)) || {};
      if (r.status && ACTIVE(r.status) && !r.gift && !r.cancel_at_end) return out({ error: 'They have a paid subscription running. Cancel it in Stripe first, then delete.' }, 400);
      try { await cancelForDelete(env, uid); } catch (e) { return out({ error: e.message || 'Couldn’t reach Stripe. Nothing was deleted.' }, 502); }
      await wipeAccount(env, uid, u.email);
      return out({ ok: true, deleted: true });
    }
  }
  return out({ error: 'Unknown action.' }, 400);
}
