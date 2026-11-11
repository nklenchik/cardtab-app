// Daily check (v50.12): a short, light look at the things people use most, once a day, with an email to the admins.
// About a dozen small requests in all (the app and site pages, the database, picture storage, one tiny AI question) and
// a few database reads. Nothing is changed or fixed automatically: problems come with a suggested fix to approve.
import { sendMail } from './email.js';

const now = () => Math.floor(Date.now() / 1000);
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const admins = env => (env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);

async function timed(fn) { const t = Date.now(); try { const r = await fn(); return Object.assign({ ms: Date.now() - t }, r); } catch (e) { return { ok: false, ms: Date.now() - t, note: String(e && e.message || e).slice(0, 160) }; } }
async function page(url, must) {
  const r = await fetch(url, { headers: { 'user-agent': 'CardTab-DailyCheck/1' }, cf: { cacheTtl: 0 } });
  if (!r.ok) return { ok: false, note: 'answered ' + r.status };
  if (must) { const t = await r.text(); if (!t.includes(must)) return { ok: false, note: 'loaded, but looks wrong (no "' + must + '")' }; }
  return { ok: true };
}

// v51.5: who signed up in the last 24 hours and where the totals stand. Admins' own accounts and gifted Premium (beta
// testers) are left out, so the numbers are real users; gifts are shown separately.
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
export async function people(env, t = now()) {
  const adm = admins(env).map(s => s.toLowerCase()), notAdm = adm.length ? `lower(u.email) NOT IN (${adm.map(() => '?').join(',')})` : '1=1';
  const q = async (where, extra = []) => { const sql = `SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN u.google_sub IS NOT NULL AND u.google_sub<>'' THEN 1 ELSE 0 END),0) g, COALESCE(SUM(CASE WHEN u.plan='premium' THEN 1 ELSE 0 END),0) p FROM users u WHERE ${notAdm} AND ${where}`;
    try { return await env.DB.prepare(sql + " AND u.id NOT IN (SELECT user_id FROM billing WHERE gift=1)").bind(...adm, ...extra).first(); }
    catch (e) { return await env.DB.prepare(sql).bind(...adm, ...extra).first(); } };          // before the billing table exists
  const since = t - 86400, nw = await q('u.created_at >= ?', [since]), all = await q('1=1');
  let gifts = 0, up = 0, down = 0;
  try { gifts = ((await env.DB.prepare('SELECT COUNT(*) n FROM billing WHERE gift=1').first()) || {}).n || 0; } catch (e) {}
  try { const rows = (await env.DB.prepare(`SELECT e.kind, COUNT(*) n FROM plan_ev e JOIN users u ON u.id=e.uid WHERE e.at >= ? AND ${notAdm} GROUP BY e.kind`).bind(since, ...adm).all()).results || [];
    rows.forEach(r => { if (r.kind === 'up') up = r.n; if (r.kind === 'down') down = r.n; }); } catch (e) {}
  const r = { new: nw.n, newFree: nw.n - nw.p, newPremium: nw.p, google: nw.g, email: nw.n - nw.g, total: all.n, free: all.n - all.p, premium: all.p, gifts, up, down };
  r.line1 = 'Last 24 hours: ' + plural(r.new, 'new sign-up') + (r.new ? ' (' + r.newFree + ' Free, ' + r.newPremium + ' Premium) · ' + r.google + ' via Google, ' + r.email + ' via email link' : '');
  r.line2 = 'Totals: ' + plural(r.total, 'account') + ' · ' + r.free + ' Free, ' + r.premium + ' Premium' + (r.gifts ? ' (+' + r.gifts + ' gifted)' : '') + ' · ' + plural(r.up, 'upgrade') + ', ' + r.down + ' back to Free';
  return r;
}

export async function runHealth(env, { send = true } = {}) {
  const app = env.APP_URL || 'https://app.cardtab.app', yest = day(Date.now() - 864e5);
  const C = [];
  const add = (key, name, res, fix) => C.push({ key, name, ok: res.ok !== false, warn: !!res.warn, note: res.note || '', ms: res.ms || 0, fix: res.ok === false || res.warn ? fix : '' });

  // what people open
  add('app', 'App opens', await timed(() => page(app + '/', 'Card Tab')), 'Check the latest Cloudflare Pages deploy of cardtab-app (Workers & Pages → cardtab-app → Deployments) and roll back if the newest one is broken.');
  add('board', 'Card Board files load', await timed(async () => { const r = await fetch(app + '/board/board.js', { method: 'HEAD' }); return r.ok ? { ok: true } : { ok: false, note: 'answered ' + r.status }; }), 'The board script is missing from the last app deploy. Redeploy the app from the latest commit.');
  add('share', 'Shared board page', await timed(() => page(app + '/share', 'share-view.js')), 'The /b/ share page didn’t load. Check app/_redirects and that share.html is in the deploy.');
  add('site', 'cardtab.app website', await timed(() => page('https://cardtab.app/', 'Card Tab')), 'Check the cardtab-site Pages project’s latest deploy.');

  // what the app relies on
  add('db', 'Database', await timed(async () => { const r = await env.DB.prepare('SELECT COUNT(*) n FROM users').first(); return { ok: true, note: (r && r.n) + ' accounts' }; }), 'The database didn’t answer. Look at D1 → card-tab in the Cloudflare dashboard for an outage notice.');
  add('art', 'Card pictures', await timed(async () => { const l = await env.ART.list({ limit: 1 }); return l ? { ok: true, note: l.objects.length ? 'storage answering' : 'storage empty' } : { ok: false }; }), 'Card picture storage (R2 card-tab-art) didn’t answer. Check R2 in the Cloudflare dashboard.');
  // v52.2: real (read-only) checks that each key works, not just that it's set. None of them sends anything or changes anything.
  add('email', 'Sign-in emails can send', await timed(async () => {
    if (!env.RESEND_API_KEY) return (env.EMAIL && env.EMAIL.send) ? { ok: true, note: 'Cloudflare email sender' } : { ok: false, note: 'no email sender set up' };
    const r = await fetch('https://api.resend.com/domains', { headers: { authorization: 'Bearer ' + String(env.RESEND_API_KEY).trim() } });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && /restricted/i.test(j.name || j.message || '')) return { ok: true, note: 'key accepted (sending-only key)' };   // a send-only key can't list domains, but it was recognised
    if (!r.ok) return { ok: false, note: 'Resend refused the key (' + r.status + ')' };
    const d = (j.data || []).find(x => /(^|\.)cardtab\.app$/.test(x.name || ''));
    return d ? { ok: true, warn: d.status !== 'verified', note: 'key works · ' + d.name + ' ' + d.status } : { ok: true, warn: true, note: 'key works, but cardtab.app isn’t in Resend' };
  }), 'Make a new key at resend.com → API Keys and add it in Cloudflare → card-tab-api → Settings → Runtime variables and secrets as RESEND_API_KEY (type Secret). If the domain isn’t verified, open resend.com → Domains and fix the DNS records it lists.');
  add('google', 'Google sign-in set up', await timed(async () => {
    if (!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) return { ok: false, note: 'client id or secret missing' };
    // a made-up code: Google says "invalid_grant" when the id and secret are right, "invalid_client" when they aren't
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: 'card-tab-daily-check', client_id: env.GOOGLE_CLIENT_ID, client_secret: String(env.GOOGLE_CLIENT_SECRET).trim(), redirect_uri: (env.API_URL || 'https://api.cardtab.app') + '/auth/google/callback', grant_type: 'authorization_code' }) });
    const j = await r.json().catch(() => ({}));
    return j.error === 'invalid_grant' ? { ok: true, note: 'secret accepted' } : { ok: false, note: 'Google said ' + (j.error || r.status) + (j.error_description ? ': ' + String(j.error_description).slice(0, 80) : '') };
  }), 'Copy the client secret from Google Cloud Console → APIs & Services → Credentials → the OAuth client, and add it in Cloudflare → card-tab-api → Settings → Runtime variables and secrets as GOOGLE_CLIENT_SECRET (type Secret).');
  add('lookup', 'Card search works', await timed(async () => {
    if (!env.JUSTTCG_API_KEY) return { ok: false, note: 'JUSTTCG_API_KEY missing' };
    const r = await fetch('https://api.justtcg.com/v1/games', { headers: { 'x-api-key': String(env.JUSTTCG_API_KEY).trim(), accept: 'application/json' } });   // one request a day
    if (!r.ok) { const t = await r.text().catch(() => ''); return { ok: false, note: 'JustTCG answered ' + r.status + (t ? ': ' + t.slice(0, 80) : '') }; }
    const j = await r.json().catch(() => ({})); return { ok: true, note: ((j.data || []).length || '?') + ' games' };
  }), 'Copy the key from your JustTCG dashboard and add it in Cloudflare → card-tab-api → Settings → Runtime variables and secrets as JUSTTCG_API_KEY (type Secret). If JustTCG itself is down, nothing to do: saved cards still work.');
  add('stripe', 'Payments (Stripe) key works', await timed(async () => {
    if (!env.STRIPE_SECRET_KEY) return { ok: false, note: 'STRIPE_SECRET_KEY missing' };
    const r = await fetch('https://api.stripe.com/v1/balance', { headers: { authorization: 'Bearer ' + String(env.STRIPE_SECRET_KEY).trim() } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, note: 'Stripe refused the key (' + r.status + ')' };
    const live = !!j.livemode, open = env.BILLING_OPEN === 'on';
    return { ok: true, warn: open && !live, note: (live ? 'live key' : 'test key') + (open && !live ? ' while Premium is open: customers can’t pay' : open ? '' : ' · Premium not open yet') };
  }), 'Add the Stripe secret key (live mode once Premium is open) in Cloudflare → card-tab-api → Settings → Runtime variables and secrets as STRIPE_SECRET_KEY (type Secret).');
  add('webhook', 'Stripe payment notices', await timed(async () => {
    if (!env.STRIPE_WEBHOOK_SECRET) return { ok: false, note: 'STRIPE_WEBHOOK_SECRET missing' };
    let note = 'signing secret set', warn = false;
    if (env.STRIPE_SECRET_KEY) {
      const r = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=50', { headers: { authorization: 'Bearer ' + String(env.STRIPE_SECRET_KEY).trim() } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { const mine = (j.data || []).filter(w => /api\.cardtab\.app\/stripe\/webhook/.test(w.url || ''));
        if (!mine.length) { warn = true; note = 'no Stripe endpoint points at api.cardtab.app/stripe/webhook'; }
        else if (!mine.some(w => w.status === 'enabled')) { warn = true; note = 'the Stripe endpoint is disabled'; }
        else note = 'endpoint active'; }
    }
    const last = await env.DB.prepare("SELECT v FROM meta WHERE k='stripe_last'").first().catch(() => null);
    note += ' · last notice: ' + (last ? Math.max(0, Math.round((now() - +last.v) / 86400)) + ' days ago' : 'none yet');
    return { ok: true, warn, note };
  }), 'In Stripe → Developers → Webhooks (event destinations), make sure one endpoint points at https://api.cardtab.app/stripe/webhook and is enabled; its signing secret goes in Cloudflare as STRIPE_WEBHOOK_SECRET (type Secret).');
  add('ask', 'Ask can reach the AI', await timed(async () => {
    const key = String(env.ANTHROPIC_API_KEY || '').trim(); if (!key) return { ok: false, note: 'no ANTHROPIC_API_KEY' };
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, 'anthropic-version': '2023-06-01', ...(env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': String(env.ANTHROPIC_WORKSPACE_ID).trim() } : {}) },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }) });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({})); return { ok: false, note: r.status + ': ' + String((j.error && j.error.message) || '').slice(0, 100) };
  }), 'Ask’s AI key was refused or out of credit. Check Billing and API keys at platform.claude.com, then add the key in Cloudflare → card-tab-api → Settings → Runtime variables and secrets as ANTHROPIC_API_KEY (type Secret).');

  // v50.51: last night's backup (written by the GitHub job .github/workflows/backup.yml) and how much free storage is used
  add('backup', 'Nightly backup', await timed(async () => {
    const o = await env.ART.get('_backup/status.json'); if (!o) return { ok: true, warn: true, note: 'no backup has run yet' };
    const b = JSON.parse(await o.text()), hrs = (now() - (b.at || 0)) / 3600, gb = ((b.artBytes || 0) + (b.backupBytes || 0)) / 1e9, pct = Math.round(gb / 10 * 100);
    const note = (b.ok ? 'last night: ' : 'FAILED: ') + (b.users || '?') + ' accounts, ' + (b.entries || '?') + ' entries · storage ' + gb.toFixed(2) + ' of 10 GB free (' + pct + '%)';
    return { ok: b.ok !== false && hrs < 36, warn: pct >= 80, note: hrs >= 36 ? 'last backup ' + Math.round(hrs) + ' hours ago · ' + note : note };
  }), 'Open GitHub → nklenchik/cardtab-app → Actions → Nightly backup and read the failed step (or press Run workflow). If storage is near 10 GB, extra space costs about $0.015 per GB a month.');

  // how yesterday went (warnings, not failures)
  add('spend', 'Ask spending this month', await timed(async () => {
    const m = new Date().toISOString().slice(0, 7), r = await env.DB.prepare('SELECT tin, tout FROM ask_spend WHERE month=?').bind(m).first().catch(() => null);
    const cost = r ? (r.tin * 0.10 + r.tout * 0.50) / 1e6 : 0, cap = +(env.ASK_MONTH_USD || 25), pct = cap ? cost / cap * 100 : 0;
    return { ok: true, warn: pct >= 80, note: '$' + cost.toFixed(2) + ' of $' + cap + ' (' + Math.round(pct) + '%)' };
  }), 'Ask is close to its monthly cap. Raise it if that’s expected: add ASK_MONTH_USD (a dollar amount) in Cloudflare → card-tab-api → Settings → Runtime variables and secrets.');
  add('errors', 'App errors yesterday', await timed(async () => {
    const rows = (await env.DB.prepare("SELECT dim, SUM(n) n FROM an_day WHERE day=? AND ev='error' GROUP BY dim ORDER BY n DESC LIMIT 3").bind(yest).all().catch(() => ({ results: [] }))).results || [];
    const n = rows.reduce((t, r) => t + r.n, 0);
    return { ok: true, warn: n >= 25, note: n ? n + ' (' + rows.map(r => r.dim + ' ×' + r.n).join(', ') + ')' : 'none' };
  }), 'Errors went up. Send this report to Claude to look into the files named here.');

  let P = null; try { P = await people(env); } catch (e) {}
  const bad = C.filter(c => !c.ok), warn = C.filter(c => c.ok && c.warn), ok = !bad.length;
  try { await env.DB.prepare('INSERT INTO health (day, at, ok, n_bad, n_warn, checks) VALUES (?,?,?,?,?,?) ON CONFLICT(day) DO UPDATE SET at=excluded.at, ok=excluded.ok, n_bad=excluded.n_bad, n_warn=excluded.n_warn, checks=excluded.checks').bind(day(), now(), ok ? 1 : 0, bad.length, warn.length, JSON.stringify(C)).run(); } catch (e) {}

  try { await env.DB.prepare('DELETE FROM health WHERE day < ?').bind(day(Date.now() - 90 * 864e5)).run(); } catch (e) {}
  const mode = env.HEALTH_EMAIL || 'daily';   // 'daily' = every day; 'problems' = only when something fails or needs a look
  if (send && (mode === 'daily' || bad.length || warn.length)) {
    const subject = (ok && !warn.length ? 'Card Tab daily check: all ' + C.length + ' passed ✓' : ok ? 'Card Tab daily check: passed, ' + warn.length + ' to look at' : 'Card Tab daily check: ' + bad.length + ' problem' + (bad.length > 1 ? 's' : '') + ' found') + (P && P.new ? ' · ' + plural(P.new, 'new sign-up') : '');
    const row = c => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${c.ok ? (c.warn ? '🟡' : '✅') : '❌'} ${esc(c.name)}${c.note ? `<div style="color:#77736d;font-size:12.5px">${esc(c.note)}</div>` : ''}${c.fix ? `<div style="margin-top:4px;font-size:12.5px;color:#a50e37"><b>Suggested fix:</b> ${esc(c.fix)}</div>` : ''}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#9a958e;font-size:12px">${c.ms ? c.ms + ' ms' : ''}</td></tr>`;
    const html = `<!doctype html><html><body style="margin:0;background:#f6f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e9e6de;border-radius:18px"><tr><td style="padding:24px">
      <div style="font-weight:800;font-size:16px;color:#1a1918">Card Tab · daily check</div>
      <h1 style="margin:10px 0 4px;font-size:22px;color:${ok ? '#2e8b4f' : '#c0392b'}">${ok ? (warn.length ? 'Everything works · ' + warn.length + ' to look at' : 'Everything passed') : bad.length + ' problem' + (bad.length > 1 ? 's' : '') + ' found'}</h1>
      <p style="margin:0 0 14px;color:#77736d;font-size:13px">${esc(new Date().toUTCString())}. Nothing was changed automatically${bad.length ? ': each problem has a suggested fix for you to approve' : ''}.</p>
      ${P ? `<div style="margin:0 0 14px;padding:12px 14px;background:#f6f5f0;border-radius:10px;font-size:14px;color:#1a1918;line-height:1.5"><div style="font-weight:700">${esc(P.line1)}</div><div style="color:#77736d;font-size:13px">${esc(P.line2)}</div></div>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${C.map(row).join('')}</table>
      <p style="margin:16px 0 0;font-size:12.5px;color:#77736d">History is on the admin dashboard → Health. To get this email only when something’s wrong, add HEALTH_EMAIL with the value problems in Cloudflare → card-tab-api → Settings → Runtime variables and secrets.</p>
    </td></tr></table></td></tr></table></body></html>`;
    const text = subject + '\n\n' + (P ? P.line1 + '\n' + P.line2 + '\n\n' : '') + C.map(c => (c.ok ? (c.warn ? '[look] ' : '[ok] ') : '[FAIL] ') + c.name + (c.note ? ' — ' + c.note : '') + (c.fix ? '\n   Suggested fix: ' + c.fix : '')).join('\n');
    for (const to of admins(env)) { try { await sendMail(env, { to, subject, html, text }); } catch (e) {} }
  }
  return { ok, bad: bad.length, warn: warn.length, checks: C, people: P, at: now() };
}

export async function handleHealth(env, req, out) {
  if (req.method === 'POST') return out(await runHealth(env, { send: false }));
  const rows = (await env.DB.prepare('SELECT day, at, ok, n_bad, n_warn, checks FROM health ORDER BY day DESC LIMIT 30').all().catch(() => ({ results: [] }))).results || [];
  return out({ latest: rows[0] ? Object.assign({}, rows[0], { checks: JSON.parse(rows[0].checks || '[]') }) : null, history: rows.map(r => ({ day: r.day, ok: !!r.ok, bad: r.n_bad, warn: r.n_warn })) });
}
