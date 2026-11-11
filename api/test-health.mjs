// Offline tests for the daily check (v50.12), against a real SQLite database standing in for D1. Run: node test-analytics.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [];
const env = { DB, GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gs', JUSTTCG_API_KEY: 'jt', RESEND_API_KEY: 're', STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'wh', ANTHROPIC_API_KEY: 'ak', APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } }, ART: { async get(k) { return k === '_backup/status.json' ? { async text() { return JSON.stringify({ day: 'x', at: Math.floor(Date.now() / 1000) - 3600, ok: true, users: '3', entries: '9', artBytes: 1e8, backupBytes: 1e8 }); } } : null; }, async list() { return { objects: [{ key: 'x' }] }; } }, RESEND_API_KEY: 'r', GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's', JUSTTCG_API_KEY: 'j', ANTHROPIC_API_KEY: 'k' };
const O = 'https://app.cardtab.app';
const call = (path, { method = 'GET', body, cookie, ip = '1.1.1.1' } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: O, 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, {});
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email, ip) { await call('/auth/email/start', { method: 'POST', body: { email }, ip }); const c = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { email, code: c }, ip })); }
const realFetch = globalThis.fetch; let down = '';
globalThis.fetch = async (u, init) => { u = String(u.url || u);
  if (u.startsWith('https://api.justtcg.com')) return down === 'jt' ? new Response('{"error":"API key is required"}', { status: 401 }) : Response.json({ data: [{ id: 'pokemon' }, { id: 'magic' }] });
  if (u.startsWith('https://oauth2.googleapis.com')) return Response.json({ error: down === 'google' ? 'invalid_client' : 'invalid_grant' }, { status: 400 });
  if (u.startsWith('https://api.resend.com')) return Response.json({ data: [{ name: 'cardtab.app', status: 'verified' }] });
  if (u.startsWith('https://api.stripe.com/v1/balance')) return Response.json({ livemode: false });
  if (u.startsWith('https://api.stripe.com/v1/webhook_endpoints')) return Response.json({ data: [{ url: 'https://api.cardtab.app/stripe/webhook', status: 'enabled' }] });
  if (u.startsWith('https://api.anthropic.com')) return down === 'ask' ? Response.json({ error: { message: 'invalid x-api-key' } }, { status: 401 }) : Response.json({ content: [] });
  if (u.includes('app.cardtab.app/share')) return new Response('<script src="/js/share-view.js"></script>');
  if (u.includes('app.cardtab.app/board')) return new Response('', { status: down === 'board' ? 404 : 200 });
  if (u.includes('app.cardtab.app') || u.includes('cardtab.app/')) return new Response('<title>Card Tab</title>');
  return realFetch(u, init); };
const boss = await signIn('boss@x.com', '4.4.4.4');
mails.length = 0;
await worker.scheduled({ cron: '7 12 * * *' }, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 30));
assert.ok(/all \d+ passed/.test(mails[0].subject), mails[0] && mails[0].subject); assert.equal(mails[0].to, 'boss@x.com');
down = 'ask'; mails.length = 0;
let r = await (await call('/auth/admin/health', { method: 'POST', cookie: boss })).json();
assert.equal(r.ok, false); assert.equal(r.checks.find(c => c.key === 'ask').ok, false); assert.ok(/platform\.claude\.com/.test(r.checks.find(c => c.key === 'ask').fix)); assert.equal(mails.length, 0, 'run from the dashboard sends no email');
down = ''; env.HEALTH_EMAIL = 'problems'; mails.length = 0;
await worker.scheduled({ cron: '7 12 * * *' }, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 30));
assert.equal(mails.length, 0, 'problems-only mode stays quiet when all is well');
down = 'board'; await worker.scheduled({ cron: '7 12 * * *' }, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 30));
assert.ok(/1 problem found/.test(mails[0].subject)); assert.ok(mails[0].html.includes('Suggested fix'));
r = await (await call('/auth/admin/health', { cookie: boss })).json(); assert.equal(r.latest.ok, 0); assert.ok(r.history.length >= 1);
// v52.2 real key checks: each one fails when its service refuses the key, and Stripe warns about a test key once Premium is open
down = 'google'; r = await (await call('/auth/admin/health', { method: 'POST', cookie: boss })).json(); assert.equal(r.checks.find(c => c.key === 'google').ok, false, 'wrong Google secret caught');
down = 'jt'; r = await (await call('/auth/admin/health', { method: 'POST', cookie: boss })).json(); assert.equal(r.checks.find(c => c.key === 'lookup').ok, false, 'JustTCG refusal caught');
down = ''; env.BILLING_OPEN = 'on'; r = await (await call('/auth/admin/health', { method: 'POST', cookie: boss })).json(); const sc = r.checks.find(c => c.key === 'stripe');
assert.ok(sc.ok && sc.warn && /test key while Premium is open/.test(sc.note), JSON.stringify(sc)); delete env.BILLING_OPEN;
r = await (await call('/auth/admin/health', { method: 'POST', cookie: boss })).json();
for (const k of ['email', 'google', 'lookup', 'stripe', 'webhook']) { const c = r.checks.find(x => x.key === k); assert.ok(c && c.ok && !c.warn, k + ' ' + JSON.stringify(c)); }
console.log('   key checks:', r.checks.filter(c => ['email', 'google', 'lookup', 'stripe', 'webhook'].includes(c.key)).map(c => c.key + ': ' + c.note).join(' | '));
const fan = await signIn('fan@x.com', '2.2.2.2'); assert.equal((await call('/auth/admin/health', { cookie: fan })).status, 403);
// v51.5 sign-ups and totals: admins and gifts left out, Google vs email, paid upgrades counted
const nowS = Math.floor(Date.now() / 1000);
sq.prepare("INSERT INTO users (id,email,google_sub,plan,created_at) VALUES ('g1','g1@x.com','sub1','free',?),('g2','g2@x.com','sub2','premium',?),('old','old@x.com',NULL,'free',?),('gift','gift@x.com',NULL,'premium',?)").run(nowS - 100, nowS - 200, nowS - 5 * 86400, nowS - 50);
sq.prepare("INSERT INTO billing (user_id,gift) VALUES ('gift',1)").run();
sq.prepare("INSERT INTO plan_ev (at,uid,kind) VALUES (?,?,?),(?,?,?)").run(nowS - 60, 'g2', 'up', nowS - 3 * 86400, 'old', 'down');
down = ''; env.HEALTH_EMAIL = 'daily'; mails.length = 0;
await worker.scheduled({ cron: '7 12 * * *' }, env, { waitUntil: p => p }); await new Promise(r => setTimeout(r, 30));
const m = mails[0]; assert.ok(m.text.includes('Last 24 hours: 3 new sign-ups (2 Free, 1 Premium) · 2 via Google, 1 via email link'), m.text.split('\n').slice(0, 4).join(' | '));
assert.ok(m.text.includes('Totals: 4 accounts · 3 Free, 1 Premium (+1 gifted) · 1 upgrade, 0 back to Free'), m.text);
assert.ok(/· 3 new sign-ups$/.test(m.subject), m.subject); assert.ok(m.html.includes('Last 24 hours'));
console.log('health tests ok');
