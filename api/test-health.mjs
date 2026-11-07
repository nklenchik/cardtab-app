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
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } }, ART: { async get() { return null; }, async list() { return { objects: [{ key: 'x' }] }; } }, RESEND_API_KEY: 'r', GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's', JUSTTCG_API_KEY: 'j', ANTHROPIC_API_KEY: 'k' };
const O = 'https://app.cardtab.app';
const call = (path, { method = 'GET', body, cookie, ip = '1.1.1.1' } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin: O, 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, {});
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email, ip) { await call('/auth/email/start', { method: 'POST', body: { email }, ip }); const c = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { email, code: c }, ip })); }
const realFetch = globalThis.fetch; let down = '';
globalThis.fetch = async (u, init) => { u = String(u.url || u);
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
const fan = await signIn('fan@x.com', '2.2.2.2'); assert.equal((await call('/auth/admin/health', { cookie: fan })).status, 403);
console.log('health tests ok');
