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
    if (!x || !EV_OK.test(x.e) || x.e === 'journey' || x.e === 'pc_last') continue;
    const k = x.e + '\u0001' + clean(x.d), cur = sum.get(k) || { e: x.e, d: clean(x.d), n: 0, v: 0 };
    cur.n += Math.max(0, Math.min(500, +x.n || 1)); cur.v += Math.max(0, Math.min(86400, +x.v || 0)); sum.set(k, cur);
  }
  const st = [...sum.values()].map(r => env.DB.prepare('INSERT INTO an_day (day,ev,dim,plan,dev,n,v) VALUES (?,?,?,?,?,?,?) ON CONFLICT(day,ev,dim,plan,dev) DO UPDATE SET n=n+excluded.n, v=v+excluded.v').bind(d, r.e, r.d, plan, dev, r.n, r.v));
  // v50.4: which features this person touched today (one row per feature per day), and their own small record: the day they
  // first showed up, their plan, the last Premium screen they saw, the day they went Premium, and what the website showed them
  const ex = [];
  const feats = new Set(); let lastPrem = '', journey = '';
  for (const x of evs) { if (!x || !EV_OK.test(x.e)) continue; const f = featOf(x.e, clean(x.d)); if (f) feats.add(f); if (x.e === 'prem_open') lastPrem = clean(x.d); if (x.e === 'journey') journey = String(x.d || '').slice(0, 300); }
  feats.forEach(f => ex.push(env.DB.prepare('INSERT OR IGNORE INTO an_feat (day,uid,feat,plan,dev) VALUES (?,?,?,?,?)').bind(d, me.id, f, plan, dev)));
  try {
    const u = await env.DB.prepare('SELECT plan, up_day, src FROM an_user WHERE uid=?').bind(me.id).first();
    const J = parseJourney(journey);
    if (!u) ex.push(env.DB.prepare('INSERT OR IGNORE INTO an_user (uid,first_day,plan0,plan,last_prem,src,sec,demo) VALUES (?,?,?,?,?,?,?,?)').bind(me.id, d, plan, plan, lastPrem || null, J ? J.src : null, J ? J.sec : null, J ? J.demo : null));
    else {
      if (u.plan !== 'premium' && plan === 'premium' && !u.up_day) ex.push(env.DB.prepare('UPDATE an_user SET up_day=?, up_ctx=COALESCE(?, last_prem, ?) WHERE uid=?').bind(d, lastPrem || null, 'not seen', me.id));
      if (lastPrem) ex.push(env.DB.prepare('UPDATE an_user SET last_prem=? WHERE uid=?').bind(lastPrem, me.id));
      if (u.plan !== plan) ex.push(env.DB.prepare('UPDATE an_user SET plan=? WHERE uid=?').bind(plan, me.id));
      if (J && !u.src) ex.push(env.DB.prepare('UPDATE an_user SET src=?, sec=?, demo=? WHERE uid=?').bind(J.src, J.sec, J.demo, me.id));
    }
    if (J && (!u || !u.src)) { ex.push(env.DB.prepare('INSERT INTO an_day (day,ev,dim,plan,dev,n,v) VALUES (?,?,?,?,?,1,0) ON CONFLICT(day,ev,dim,plan,dev) DO UPDATE SET n=n+1').bind(d, 'signup_src', J.src, plan, dev)); }
  } catch (e) { /* the new tables aren't there until schema.sql is run again: counting carries on without them */ }
  // v50.95: the Premium sheet copy this person saw last (so a purchase can be credited to it)
  let pc = ''; for (const x of evs) if (x && x.e === 'pc_last') pc = String(x.d || '').replace(/[^a-z0-9:.]/g, '').slice(0, 48);
  if (/^[ebs][1-9]:[\d.]+$/.test(pc)) { try { await env.DB.prepare('INSERT INTO an_copy (uid,last,last_day) VALUES (?,?,?) ON CONFLICT(uid) DO UPDATE SET last=excluded.last, last_day=excluded.last_day').bind(me.id, pc, d).run(); } catch (e) { /* table not made yet */ } }
  const secs = Math.max(0, Math.min(3600, Math.round(+b.secs || 0)));
  st.push(env.DB.prepare('INSERT INTO an_active (day,uid,plan,dev,secs) VALUES (?,?,?,?,?) ON CONFLICT(day,uid) DO UPDATE SET secs=secs+excluded.secs, plan=excluded.plan, dev=excluded.dev').bind(d, me.id, plan, dev, secs));
  try { await env.DB.batch(st.concat(ex)); } catch (e) { if (!ex.length) throw e; await env.DB.batch(st); }
  return out({ ok: true });
}

// v50.4 features: what each count says someone used (the admin page's Features and Upgrades tabs)
function featOf(e, d) {
  switch (e) {
    case 'page_view': return d === 'board' ? 'board' : d === 'stories' ? 'stories' : d === 'add a card' ? 'add' : d === 'import' ? 'import' : /^settings/.test(d) ? 'settings' : null;
    case 'entry_add': return 'add';
    case 'widget_add': case 'widget_remove': case 'widget_size': return 'board_edit';
    case 'layout_save': case 'layout_update': return 'layouts';
    case 'ask': return 'ask';
    case 'story_play': case 'story_view': return 'stories_watch';
    case 'story_save': case 'story_share': return 'stories_save';
    case 'theme': case 'background': return 'stories_style';
    case 'limit': return 'entry_limit';
    case 'range': return d === 'all time' || d === 'year' ? 'long_range' : null;
    case 'export': return 'export';
    default: return null;
  }
}
// what the website showed someone before they opened the app: "source~section.section~demo.demo"
function parseJourney(j) {
  if (!j) return null; const [src, sec, demo] = String(j).split('~');
  const list = s => (s || '').split('.').map(x => x.replace(/[^a-z0-9-]/gi, '').slice(0, 24).toLowerCase()).filter(Boolean).slice(0, 16).join('.');
  const S = String(src || 'direct').replace(/[^a-z0-9 .-]/gi, '').slice(0, 32).toLowerCase() || 'direct';
  return { src: S, sec: list(sec) || null, demo: list(demo) || null };
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
    q('SELECT month, tin, tout, n FROM ask_spend ORDER BY month DESC LIMIT 1', []).catch(() => [])
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
  // v50.4: feature reach (who used what, of everyone active), what upgraders had used before going Premium, and where people came from
  const pf = (plan ? ' AND f.plan=?' : '') + (dev ? ' AND f.dev=?' : ''), pp = [...(plan ? [plan] : []), ...(dev ? [dev] : [])];
  const safe = p => p.catch(() => []);
  const [reach, reachPrev, upg, upgFeat, baseN, baseFeat, upCtx, srcRows, joinSec] = await Promise.all([
    safe(q('SELECT feat, COUNT(DISTINCT uid) n FROM an_feat f WHERE day BETWEEN ? AND ?' + pf + ' GROUP BY feat', [from, to, ...pp])),
    safe(q('SELECT feat, COUNT(DISTINCT uid) n FROM an_feat f WHERE day BETWEEN ? AND ?' + pf + ' GROUP BY feat', [pFrom, pTo, ...pp])),
    safe(q('SELECT COUNT(*) n, AVG(julianday(up_day) - julianday(first_day)) days FROM an_user WHERE up_day BETWEEN ? AND ?', [from, to])),
    safe(q('SELECT f.feat, COUNT(DISTINCT f.uid) n FROM an_feat f JOIN an_user u ON u.uid = f.uid WHERE u.up_day BETWEEN ? AND ? AND f.day <= u.up_day AND f.plan = \'free\' GROUP BY f.feat', [from, to])),
    safe(q('SELECT COUNT(DISTINCT a.uid) n FROM an_active a LEFT JOIN an_user u ON u.uid = a.uid WHERE a.day BETWEEN ? AND ? AND a.plan = \'free\' AND (u.up_day IS NULL OR u.up_day > ?)', [from, to, to])),
    safe(q('SELECT f.feat, COUNT(DISTINCT f.uid) n FROM an_feat f LEFT JOIN an_user u ON u.uid = f.uid WHERE f.day BETWEEN ? AND ? AND f.plan = \'free\' AND (u.up_day IS NULL OR u.up_day > ?) GROUP BY f.feat', [from, to, to])),
    safe(q('SELECT up_ctx dim, COUNT(*) n FROM an_user WHERE up_day BETWEEN ? AND ? GROUP BY up_ctx', [from, to])),
    safe(q('SELECT COALESCE(src, \'not known\') src, plan0, plan, sec, demo, up_day FROM an_user WHERE first_day BETWEEN ? AND ?', [from, to])),
    safe(q("SELECT ev, dim, SUM(n) n FROM an_site WHERE day BETWEEN ? AND ? AND ev IN ('join_src','join_sec','join_demo','join_scroll') GROUP BY ev, dim", [from, to]))
  ]);
  // v50.95 Premium copy test: purchases credited to the copy that was showing, and sheet views per headline per day
  const [copyBuys, copyDays] = await Promise.all([
    safe(q('SELECT buy_day day, buy, buy_iv iv FROM an_copy WHERE buy_day BETWEEN ? AND ? AND buy IS NOT NULL', [from, to])),
    safe(q("SELECT day, dim, SUM(n) n FROM an_day" + w1 + " AND ev = 'pc_view' GROUP BY day, dim", p1))
  ]);
  const tally = (rows, key) => { const m = {}; rows.forEach(r => String(r[key] || '').split('.').filter(Boolean).forEach(k => { m[k] = (m[k] || 0) + 1; })); return Object.entries(m).map(([dim, n]) => ({ dim, n })).sort((a, b) => b.n - a.n); };
  const bySrc = {}; srcRows.forEach(r => { const o = bySrc[r.src] = bySrc[r.src] || { dim: r.src, n: 0, free: 0, premium: 0, upgraded: 0 }; o.n++; o[r.plan0 === 'premium' ? 'premium' : 'free']++; if (r.up_day) o.upgraded++; });
  const v504 = { reach, reachPrev, upgraders: (upg[0] || {}).n || 0, upDays: (upg[0] || {}).days || 0, upFeat: upgFeat, freeBase: (baseN[0] || {}).n || 0, freeFeat: baseFeat, upCtx,
    signupSrc: Object.values(bySrc).sort((a, b) => b.n - a.n), signupSec: tally(srcRows, 'sec'), signupDemo: tally(srcRows, 'demo'), signupKnown: srcRows.filter(r => r.src !== 'not known').length, signupAll: srcRows.length, join: joinSec, copyBuys, copyDays };
  return out({
    from, to, pFrom, pTo, days: n, plan: plan || 'all', dev: dev || 'all',
    active: cur.active, activePrev: prev.active, secs: cur.secs, secsPrev: prev.secs, people, peoplePrev,
    events: ev, eventsPrev: evPrev, eventsByDay: evDay,
    members: Object.fromEntries(members.map(r => [r.plan || 'free', r.n])),
    signups: signups, signupsPrev: (signPrev[0] || {}).n || 0,
    cohorts, askSpend: spend[0] || null, eventsToday: (evToday[0] || {}).n || 0,
    askCap: +(env.ASK_MONTH_USD || 25), ...v504
  });
}

// nightly: keep two years of daily rows
export async function cleanupAnalytics(env) {
  const cut = addDays(day(), -731);
  // the website's daily visitor codes can never be remade once yesterday's random value is gone
  await env.DB.batch([env.DB.prepare('DELETE FROM an_day WHERE day < ?').bind(cut), env.DB.prepare('DELETE FROM an_active WHERE day < ?').bind(cut), env.DB.prepare('DELETE FROM an_site WHERE day < ?').bind(cut), env.DB.prepare('DELETE FROM an_site_vis WHERE day < ?').bind(cut), env.DB.prepare('DELETE FROM an_salt WHERE day < ?').bind(day())]);
  await env.DB.prepare('DELETE FROM an_feat WHERE day < ?').bind(cut).run().catch(() => {});
}

// ================= website (cardtab.app) visits — v50.1 =================
// No cookies and nothing stored in the browser: a visitor is counted once a day with a code made from a random value that
// changes every day (and is thrown away), plus their network address and browser. It can't be turned back into anyone, and
// tomorrow the same person gets a different code. Country comes from Cloudflare; the page sends only what it is
// (path, which sections came into view, demo taps, button taps, how far down it was scrolled).
const SITE_ORIGINS = /^https:\/\/(www\.)?cardtab\.app$|^https:\/\/[a-z0-9-]+\.cardtab-site\.pages\.dev$/;
const SITE_EV = new Set(['pv', 'sec', 'demo', 'cta', 'scroll', 'join', 'out', 'join_src', 'join_sec', 'join_demo', 'join_scroll']);
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
function srcOf(ref, utm) {
  if (utm) return clean(utm).toLowerCase();
  let h = ''; try { h = new URL(ref).hostname.replace(/^www\./, ''); } catch (e) { return 'direct'; }
  if (!h || /(^|\.)cardtab\.app$/.test(h)) return 'direct';
  if (/google\./.test(h)) return 'google'; if (/bing\.com$/.test(h)) return 'bing'; if (/duckduckgo/.test(h)) return 'duckduckgo';
  if (/(^|\.)(facebook|fb)\.com$|^l\.facebook/.test(h)) return 'facebook'; if (/instagram\.com$/.test(h)) return 'instagram';
  if (/reddit\.com$/.test(h)) return 'reddit'; if (/(^|\.)(t\.co|twitter\.com|x\.com)$/.test(h)) return 'x'; if (/tiktok\.com$/.test(h)) return 'tiktok';
  if (/youtube\.com$|youtu\.be$/.test(h)) return 'youtube'; if (/discord/.test(h)) return 'discord'; if (/chatgpt|openai|claude\.ai|perplexity/.test(h)) return 'ai assistants';
  return clean(h).toLowerCase();
}
export async function handleSiteEvent(env, req) {
  const origin = req.headers.get('origin') || '';
  const hdr = { 'access-control-allow-origin': SITE_ORIGINS.test(origin) ? origin : 'https://cardtab.app', vary: 'origin' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: { ...hdr, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
  if (!SITE_ORIGINS.test(origin)) return new Response(null, { status: 204, headers: hdr });
  let b = {}; try { b = JSON.parse(await req.text()); } catch (e) {}
  const ua = req.headers.get('user-agent') || '';
  if (/bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i.test(ua)) return new Response(null, { status: 204, headers: hdr });
  const d = day(), dev = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'phone' : 'desk';
  let salt = await env.DB.prepare('SELECT salt FROM an_salt WHERE day=?').bind(d).first();
  if (!salt) { const s = hex(crypto.getRandomValues(new Uint8Array(16))); await env.DB.prepare('INSERT OR IGNORE INTO an_salt (day, salt) VALUES (?,?)').bind(d, s).run(); salt = await env.DB.prepare('SELECT salt FROM an_salt WHERE day=?').bind(d).first(); }
  const ip = req.headers.get('cf-connecting-ip') || '';
  const vh = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt.salt + '|' + ip + '|' + ua))).slice(0, 24);
  const src = srcOf(b.ref || '', b.utm || ''), cc = clean((req.cf && req.cf.country) || req.headers.get('cf-ipcountry') || '').slice(0, 2) || '—';
  const sum = new Map();
  for (const x of (Array.isArray(b.ev) ? b.ev.slice(0, 60) : [])) { if (!x || !SITE_EV.has(x.e)) continue; const dd = x.e === 'join_src' ? src : clean(x.d); const k = x.e + '\u0001' + dd; const c = sum.get(k) || { e: x.e, d: dd, n: 0 }; c.n += 1; sum.set(k, c); }
  const st = [...sum.values()].map(r => env.DB.prepare('INSERT INTO an_site (day,ev,dim,dev,n) VALUES (?,?,?,?,?) ON CONFLICT(day,ev,dim,dev) DO UPDATE SET n=n+excluded.n').bind(d, r.e, r.d, dev, r.n));
  st.push(env.DB.prepare('INSERT INTO an_site_vis (day,vh,dev,src,cc) VALUES (?,?,?,?,?) ON CONFLICT(day,vh) DO NOTHING').bind(d, vh, dev, src, cc));
  await env.DB.batch(st);
  return new Response(null, { status: 204, headers: hdr });
}

export async function handleSiteStats(env, req, out) {
  const u = new URL(req.url), today = day();
  let to = /^\d{4}-\d\d-\d\d$/.test(u.searchParams.get('to') || '') ? u.searchParams.get('to') : today;
  let from = /^\d{4}-\d\d-\d\d$/.test(u.searchParams.get('from') || '') ? u.searchParams.get('from') : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  const n = Math.min(800, span(from, to)), pTo = addDays(from, -1), pFrom = addDays(pTo, -(n - 1));
  const dev = ['phone', 'desk'].includes(u.searchParams.get('dev')) ? u.searchParams.get('dev') : '';
  const w = (a, b) => [' WHERE day BETWEEN ? AND ?' + (dev ? ' AND dev=?' : ''), dev ? [a, b, dev] : [a, b]];
  const q = async (sql, p) => (await env.DB.prepare(sql).bind(...p).all()).results || [];
  const [w1, p1] = w(from, to), [w0, p0] = w(pFrom, pTo), adm = admins(env), notAdmin = adm.length ? ' AND lower(email) NOT IN (' + adm.map(() => '?').join(',') + ')' : '';
  const [vis, visPrev, src, srcPrev, cc, ev, evPrev, evDay, signups, signPrev] = await Promise.all([
    q('SELECT day, COUNT(*) n FROM an_site_vis' + w1 + ' GROUP BY day', p1),
    q('SELECT day, COUNT(*) n FROM an_site_vis' + w0 + ' GROUP BY day', p0),
    q('SELECT src dim, COUNT(*) n FROM an_site_vis' + w1 + ' GROUP BY src', p1),
    q('SELECT src dim, COUNT(*) n FROM an_site_vis' + w0 + ' GROUP BY src', p0),
    q('SELECT cc dim, COUNT(*) n FROM an_site_vis' + w1 + ' GROUP BY cc', p1),
    q('SELECT ev, dim, SUM(n) n FROM an_site' + w1 + ' GROUP BY ev, dim', p1),
    q('SELECT ev, dim, SUM(n) n FROM an_site' + w0 + ' GROUP BY ev, dim', p0),
    q("SELECT day, ev, SUM(n) n FROM an_site" + w1 + " AND ev IN ('pv','join') GROUP BY day, ev", p1),
    q("SELECT COUNT(*) n FROM users WHERE date(created_at,'unixepoch') BETWEEN ? AND ?" + notAdmin, [from, to, ...adm]),
    q("SELECT COUNT(*) n FROM users WHERE date(created_at,'unixepoch') BETWEEN ? AND ?" + notAdmin, [pFrom, pTo, ...adm])
  ]);
  const fill = (rows, a) => { const m = Object.fromEntries(rows.map(r => [r.day, r.n])); return Array.from({ length: n }, (_, i) => m[addDays(a, i)] || 0); };
  return out({ from, to, pFrom, pTo, days: n, dev: dev || 'all', visitors: fill(vis, from), visitorsPrev: fill(visPrev, pFrom), sources: src, sourcesPrev: srcPrev, countries: cc,
    events: ev, eventsPrev: evPrev, eventsByDay: evDay, appSignups: (signups[0] || {}).n || 0, appSignupsPrev: (signPrev[0] || {}).n || 0 });
}
