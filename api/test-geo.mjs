// Where members are (v52.42): country + state saved at sign-in and on opening the app (hourly), shown in a person's details and
// the dashboard (admins left out), the network address never stored, removed with the account. Run: node test-geo.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { const r = sq.prepare(sql).run(...o.args); return { meta: { changes: r.changes } }; } }; return o; };
const mails = [];
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; } }, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } } };
const call = (path, { method = 'GET', body, cookie, cf } = {}) => { const r = new Request('https://api.cardtab.app' + path, { method, headers: { origin: 'https://app.cardtab.app', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (cf) Object.defineProperty(r, 'cf', { value: cf }); return worker.fetch(r, env, { waitUntil() {} }); };
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email, cf) { mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email } });
  const tok = /\?login=([\w-]+)/.exec(mails.find(m => m.to === email).text)[1]; return cookieOf(await call('/auth/email/verify', { method: 'POST', body: { token: tok }, cf })); }
const ny = await signIn('ny@x.com', { country: 'US', region: 'New York' });
await signIn('tx@x.com', { country: 'US', region: 'Texas' });
await signIn('ca@x.com', { country: 'CA', region: 'Ontario' });
await signIn('anon@x.com', { country: 'XX' });   // unknown: nothing saved
const boss = await signIn('boss@x.com', { country: 'US', region: 'Ohio' });
const uid = e => sq.prepare('SELECT id FROM users WHERE email=?').get(e).id;
const one = async e => (await (await call('/auth/admin/people/one?id=' + uid(e), { cookie: boss })).json()).person;
assert.deepEqual({ cc: (await one('ny@x.com')).place.cc, region: (await one('ny@x.com')).place.region }, { cc: 'US', region: 'New York' });
assert.equal((await one('anon@x.com')).place, null);
// the network address is never kept with the place
assert.ok(!JSON.stringify(sq.prepare('SELECT * FROM geo').all()).includes('203.0.113.7'));
// dashboard: by country and US state, admins left out
const st = await (await call('/auth/admin/stats', { cookie: boss })).json();
assert.deepEqual(st.geo.countries.map(r => [r.cc, r.n]), [['US', 2], ['CA', 1]], JSON.stringify(st.geo));
assert.deepEqual(st.geo.us.map(r => r.region).sort(), ['New York', 'Texas']);
// opening the app after an hour updates it (moved)
sq.prepare('UPDATE users SET last_seen_at=0 WHERE email=?').run('ny@x.com');
await call('/auth/me', { cookie: ny, cf: { country: 'US', region: 'Florida' } });
assert.equal((await one('ny@x.com')).place.region, 'Florida');
// deleting the account removes it
await call('/auth/delete', { method: 'POST', body: {}, cookie: ny });
assert.equal(sq.prepare('SELECT COUNT(*) n FROM geo WHERE user_id NOT IN (SELECT id FROM users)').get().n, 0);
console.log('geo tests passed');
