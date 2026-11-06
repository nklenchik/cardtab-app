/* Card Tab sign-in: Google, or an emailed link + 6-digit code. No passwords.
   A session is a random token in an HttpOnly cookie on .cardtab.app (good for 30 days); only its SHA-256 is stored.
   Link tokens and codes are single use, last 15 minutes, and are stored only as hashes. Admins are the emails in
   ADMIN_EMAILS (a Cloudflare setting), checked here on the server, never in the app.

   POST /auth/email/start   {email, mode}       send the link + code (always answers ok, so it can't be used to test emails)
   POST /auth/email/verify  {token} | {email, code}
   GET  /auth/google/start  -> Google -> GET /auth/google/callback
   GET  /auth/me            the signed-in person, or 401
   POST /auth/logout        end this session
   POST /auth/delete        delete the account and every session
   POST /auth/plan {plan}   admins only: switch your own plan for testing
   POST /auth/sync          send and receive entries and settings (see sync.js) */
import { signInEmail, sendMail } from './email.js';
import { handleSync, deleteSynced } from './sync.js';

const DAY = 86400, SESSION_DAYS = 30, LINK_MIN = 15;
const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const code6 = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
export const normEmail = e => String(e || '').trim().toLowerCase();
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

const appUrl = env => env.APP_URL || 'https://app.cardtab.app';
const apiUrl = env => env.API_URL || 'https://api.cardtab.app';
export const isAdmin = (env, email) => String(env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean).includes(normEmail(email));

// sign-in replies carry cookies, so CORS names the app exactly and allows credentials
export const authCors = (env, req) => {
  const o = req.headers.get('origin') || '', ok = o === appUrl(env) || (env.EXTRA_ORIGINS || '').split(/[\s,]+/).includes(o);
  return { 'access-control-allow-origin': ok ? o : appUrl(env), 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST', 'access-control-allow-headers': 'content-type', vary: 'origin' };
};
const out = (env, req, body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...authCors(env, req), ...extra } });
const cookieDomain = env => env.COOKIE_DOMAIN === undefined ? 'cardtab.app' : env.COOKIE_DOMAIN;
const setCookie = (env, name, val, maxAge, path = '/') => `${name}=${val}; ${cookieDomain(env) ? 'Domain=' + cookieDomain(env) + '; ' : ''}Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const getCookie = (req, name) => { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return m ? m[1] : ''; };
const userOut = (env, u) => ({ id: u.id, email: u.email, name: u.name || '', plan: u.plan || 'free', role: isAdmin(env, u.email) ? 'admin' : 'user', since: u.created_at });

async function upsertUser(env, email, extra = {}) {
  let u = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if (!u) {
    u = { id: rand(12), email, name: extra.name || '', google_sub: extra.sub || null, plan: 'free', created_at: now() };
    await env.DB.prepare('INSERT INTO users (id,email,name,google_sub,plan,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)').bind(u.id, email, u.name, u.google_sub, u.plan, u.created_at, u.created_at).run();
    u.isNew = true;
  } else if ((extra.name && !u.name) || (extra.sub && !u.google_sub)) {
    await env.DB.prepare('UPDATE users SET name=COALESCE(NULLIF(name,\'\'),?), google_sub=COALESCE(google_sub,?) WHERE id=?').bind(extra.name || '', extra.sub || null, u.id).run();
    u.name = u.name || extra.name || ''; u.google_sub = u.google_sub || extra.sub || null;
  }
  return u;
}
async function newSession(env, req, u) {
  const tok = rand(32), t = now();
  await env.DB.prepare('INSERT INTO sessions (id,user_id,created_at,expires_at,ua) VALUES (?,?,?,?,?)').bind(await sha(tok), u.id, t, t + SESSION_DAYS * DAY, (req.headers.get('user-agent') || '').slice(0, 160)).run();
  return setCookie(env, 'ct_s', tok, SESSION_DAYS * DAY);
}
export async function currentUser(env, req) {
  const tok = getCookie(req, 'ct_s'); if (!tok) return null;
  const s = await env.DB.prepare('SELECT s.id sid, s.expires_at, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=?').bind(await sha(tok)).first();
  if (!s || s.expires_at < now()) return null;
  return s;
}

async function emailStart(env, req) {
  const b = await req.json().catch(() => ({})), email = normEmail(b.email), mode = b.mode === 'up' ? 'up' : 'in';
  if (!validEmail(email)) return out(env, req, { error: 'Enter a valid email address.' }, 400);
  const t = now(), ip = req.headers.get('cf-connecting-ip') || '';
  // at most 3 emails per address per 15 minutes, and 12 per network per hour
  const perEmail = await env.DB.prepare('SELECT COUNT(*) n FROM login_tokens WHERE email=? AND created_at>?').bind(email, t - LINK_MIN * 60).first();
  const perIp = ip ? await env.DB.prepare('SELECT COUNT(*) n FROM login_tokens WHERE ip=? AND created_at>?').bind(ip, t - 3600).first() : { n: 0 };
  if ((perEmail && perEmail.n >= 3) || (perIp && perIp.n >= 12)) return out(env, req, { error: 'Too many tries. Wait a few minutes, then try again.' }, 429);
  const token = rand(32), code = code6();
  await env.DB.prepare('INSERT INTO login_tokens (id,email,code_hash,mode,ip,created_at,expires_at,attempts) VALUES (?,?,?,?,?,?,?,0)')
    .bind(await sha(token), email, await sha(email + ':' + code), mode, ip, t, t + LINK_MIN * 60).run();
  const link = appUrl(env) + '/?login=' + token;
  await sendMail(env, { to: email, ...signInEmail({ link, code, mode }) });
  return out(env, req, { ok: true });
}

async function emailVerify(env, req) {
  const b = await req.json().catch(() => ({})), t = now();
  let row = null;
  if (b.token) row = await env.DB.prepare('SELECT * FROM login_tokens WHERE id=?').bind(await sha(String(b.token))).first();
  else if (b.email && b.code) {
    const email = normEmail(b.email), code = String(b.code).replace(/\D/g, '');
    // the newest unused code for this email; a wrong code counts against it, and 5 wrong codes end it
    row = await env.DB.prepare('SELECT * FROM login_tokens WHERE email=? AND used_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1').bind(email, t).first();
    if (row && row.code_hash !== await sha(email + ':' + code)) {
      await env.DB.prepare('UPDATE login_tokens SET attempts=attempts+1, used_at=CASE WHEN attempts+1>=5 THEN ? ELSE used_at END WHERE id=?').bind(t, row.id).run();
      return out(env, req, { error: row.attempts + 1 >= 5 ? 'Too many wrong codes. Ask for a new email.' : 'That code doesn’t match. Check the email and try again.' }, 400);
    }
  }
  if (!row || row.used_at || row.expires_at < t) return out(env, req, { error: 'This sign-in link has expired or was already used. Ask for a new one.' }, 400);
  await env.DB.prepare('UPDATE login_tokens SET used_at=? WHERE id=?').bind(t, row.id).run();
  const u = await upsertUser(env, row.email);
  const c = await newSession(env, req, u);
  return out(env, req, { user: userOut(env, u), isNew: !!u.isNew }, 200, { 'set-cookie': c });
}

async function googleStart(env, req) {
  if (!env.GOOGLE_CLIENT_ID) return Response.redirect(appUrl(env) + '/?signin_error=google_off', 302);
  const state = rand(16), verifier = rand(48), mode = new URL(req.url).searchParams.get('mode') === 'up' ? 'up' : 'in';
  const challenge = b64u(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: apiUrl(env) + '/auth/google/callback', response_type: 'code', scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
  return new Response(null, { status: 302, headers: { location: 'https://accounts.google.com/o/oauth2/v2/auth?' + q, 'set-cookie': setCookie(env, 'ct_g', `${state}.${verifier}.${mode}`, 600, '/auth/google'), 'cache-control': 'no-store' } });
}
async function googleCallback(env, req) {
  const u = new URL(req.url), back = q => new Response(null, { status: 302, headers: { location: appUrl(env) + '/?' + q, 'set-cookie': setCookie(env, 'ct_g', '', 0, '/auth/google'), 'cache-control': 'no-store' } });
  const [state, verifier, mode] = getCookie(req, 'ct_g').split('.');
  if (!state || u.searchParams.get('state') !== state || !u.searchParams.get('code')) return back('signin_error=google');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: u.searchParams.get('code'), client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET || '', redirect_uri: apiUrl(env) + '/auth/google/callback', grant_type: 'authorization_code', code_verifier: verifier }) });
  if (!r.ok) return back('signin_error=google');
  const tok = await r.json();
  // the ID token came straight from Google over HTTPS, so its contents can be read directly (Google's own guidance)
  let p = {}; try { p = JSON.parse(atob(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) {}
  if (p.aud !== env.GOOGLE_CLIENT_ID || !/accounts\.google\.com$/.test(p.iss || '') || !p.email || p.email_verified === false || p.exp < now()) return back('signin_error=google');
  const user = await upsertUser(env, normEmail(p.email), { name: p.given_name || p.name || '', sub: p.sub });
  const c = await newSession(env, req, user);
  const h = new Headers({ location: appUrl(env) + '/?signedin=google' + (user.isNew || mode === 'up' ? '&new=1' : ''), 'cache-control': 'no-store' });
  h.append('set-cookie', c); h.append('set-cookie', setCookie(env, 'ct_g', '', 0, '/auth/google'));
  return new Response(null, { status: 302, headers: h });
}

export async function handleAuth(env, req, path) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: authCors(env, req) });
  if (path === '/auth/google/start') return googleStart(env, req);
  if (path === '/auth/google/callback') return googleCallback(env, req);
  if (path === '/auth/email/start' && req.method === 'POST') return emailStart(env, req);
  if (path === '/auth/email/verify' && req.method === 'POST') return emailVerify(env, req);
  const me = await currentUser(env, req);
  if (path === '/auth/me') {
    if (!me) return out(env, req, { user: null }, 401);
    if (now() - (me.last_seen_at || 0) > 3600) await env.DB.prepare('UPDATE users SET last_seen_at=? WHERE id=?').bind(now(), me.id).run();
    return out(env, req, { user: userOut(env, me) });
  }
  if (path === '/auth/logout' && req.method === 'POST') {
    if (me) await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(me.sid).run();
    return out(env, req, { ok: true }, 200, { 'set-cookie': setCookie(env, 'ct_s', '', 0) });
  }
  if (!me) return out(env, req, { error: 'Sign in first.' }, 401);
  if (path === '/auth/delete' && req.method === 'POST') {
    await env.DB.batch([...(await deleteSynced(env, me.id)), env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(me.id), env.DB.prepare('DELETE FROM login_tokens WHERE email=?').bind(me.email), env.DB.prepare('DELETE FROM users WHERE id=?').bind(me.id)]);
    return out(env, req, { ok: true }, 200, { 'set-cookie': setCookie(env, 'ct_s', '', 0) });
  }
  if (path === '/auth/sync' && req.method === 'POST') return handleSync(env, req, me, (body, status = 200) => out(env, req, body, status));
  if (path === '/auth/plan' && req.method === 'POST') {
    if (!isAdmin(env, me.email)) return out(env, req, { error: 'Admins only.' }, 403);
    const b = await req.json().catch(() => ({})), plan = b.plan === 'premium' ? 'premium' : 'free';
    await env.DB.prepare('UPDATE users SET plan=? WHERE id=?').bind(plan, me.id).run();
    return out(env, req, { user: userOut(env, { ...me, plan }) });
  }
  return out(env, req, { error: 'not found' }, 404);
}
