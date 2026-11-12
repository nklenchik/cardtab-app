// Face ID / Touch ID sign-in (v52.38): add a passkey while signed in, sign in with it, wrong site / reused challenge /
// bad signature / copied key all fail, list + remove, deleting the account removes passkeys. Run: node test-passkey.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import worker from './src/index.js';

const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { const r = sq.prepare(sql).run(...o.args); return { meta: { changes: r.changes } }; } }; return o; };
const DB = { prepare: stmt, async batch(list) { for (const s of list) await s.run(); return []; } };
const mails = [];
const env = { DB, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: 'boss@x.com', EMAIL: { async send(m) { mails.push(m); } } };
const call = (path, { method = 'GET', body, cookie, origin = 'https://app.cardtab.app' } = {}) => worker.fetch(new Request('https://api.cardtab.app' + path, { method, headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.' + Math.floor(Math.random() * 200), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
async function signIn(email) { mails.length = 0; await call('/auth/email/start', { method: 'POST', body: { email } });
  const tok = /\?login=([\w-]+)/.exec(mails.find(m => m.to === email).text)[1]; const r = await call('/auth/email/verify', { method: 'POST', body: { token: tok } }); return cookieOf(r); }
const b64u = buf => Buffer.from(buf).toString('base64url'), unb = s => new Uint8Array(Buffer.from(s, 'base64url'));
const sha = async u => new Uint8Array(await crypto.subtle.digest('SHA-256', u));
const enc = new TextEncoder();
const rawToDer = raw => { const one = b => { let i = 0; while (i < 31 && b[i] === 0) i++; let v = b.slice(i); if (v[0] & 0x80) v = Uint8Array.from([0, ...v]); return [0x02, v.length, ...v]; };
  const r = one(raw.slice(0, 32)), s = one(raw.slice(32)); return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]); };

// a pretend iPhone: one key pair, signs like Face ID would
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
const credId = crypto.getRandomValues(new Uint8Array(20)), cid = b64u(credId);
async function authData({ rp = 'cardtab.app', flags = 0x05, count = 0, attested = false } = {}) {
  const head = [...await sha(enc.encode(rp)), flags | (attested ? 0x40 : 0), count >>> 24 & 255, count >>> 16 & 255, count >>> 8 & 255, count & 255];
  return Uint8Array.from(attested ? [...head, ...new Uint8Array(16), 0, credId.length, ...credId, 0xa0] : head);
}
const cdj = (type, challenge, origin = 'https://app.cardtab.app') => b64u(enc.encode(JSON.stringify({ type, challenge, origin, crossOrigin: false })));

const fan = await signIn('fan@x.com');
// not signed in: can't add
assert.equal((await call('/auth/passkey/reg/start', { method: 'POST', body: {} })).status, 401);
// add the iPhone
let o = await (await call('/auth/passkey/reg/start', { method: 'POST', body: {}, cookie: fan })).json();
assert.equal(o.rp.id, 'cardtab.app'); assert.ok(o.challenge && o.user.id);
const uid = new TextDecoder().decode(unb(o.user.id));
const reg = c => ({ id: cid, clientDataJSON: cdj('webauthn.create', c), authenticatorData: '', publicKey: b64u(spki), alg: -7, label: 'iPhone', kind: 'Face ID' });
let r = await call('/auth/passkey/reg/finish', { method: 'POST', body: { ...reg(o.challenge), authenticatorData: b64u(await authData({ attested: true, flags: 0x01 })) }, cookie: fan });
assert.equal(r.status, 400, 'no Face ID check (UV) is refused');
o = await (await call('/auth/passkey/reg/start', { method: 'POST', body: {}, cookie: fan })).json();
r = await call('/auth/passkey/reg/finish', { method: 'POST', body: { ...reg(o.challenge), authenticatorData: b64u(await authData({ attested: true })) }, cookie: fan });
assert.equal(r.status, 200, await r.clone().text());
let L = await (await call('/auth/passkeys', { cookie: fan })).json(); assert.equal(L.items.length, 1); assert.equal(L.items[0].label, 'iPhone');

// sign in with it (no cookie)
async function login({ origin, rp, count = 0, tamper = false, reuse } = {}) {
  const s = reuse || (await (await call('/auth/passkey/login/start', { method: 'POST', body: {} })).json()).challenge;
  const cd = cdj('webauthn.get', s, origin), ad = await authData({ rp, count });
  const data = Uint8Array.from([...ad, ...await sha(unb(cd))]);
  let sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, data)); if (tamper) sig[5] ^= 1;
  const res = await call('/auth/passkey/login/finish', { method: 'POST', body: { id: cid, clientDataJSON: cd, authenticatorData: b64u(ad), signature: b64u(rawToDer(sig)), userHandle: b64u(enc.encode(uid)) } });
  return { res, s };
}
let { res, s } = await login(); assert.equal(res.status, 200, await res.clone().text());
const j = await res.json(); assert.equal(j.user.email, 'fan@x.com'); const pkCookie = cookieOf(res); assert.match(pkCookie, /^ct_s=/);
assert.equal((await call('/auth/me', { cookie: pkCookie })).status, 200, 'the passkey session works');
assert.equal((await login({ reuse: s })).res.status, 400, 'a used challenge can’t be reused');
assert.equal((await login({ origin: 'https://evil.example' })).res.status, 400, 'another site is refused');
assert.equal((await login({ rp: 'evil.example' })).res.status, 400, 'a passkey for another site is refused');
assert.equal((await login({ tamper: true })).res.status, 400, 'a bad signature is refused');
assert.equal((await login({ count: 5 })).res.status, 200); assert.equal((await login({ count: 3 })).res.status, 400, 'a counter going backwards (copied key) is refused');

// someone else can't remove it; the owner can
const other = await signIn('other@x.com');
assert.equal((await (await call('/auth/passkeys/remove', { method: 'POST', body: { id: cid }, cookie: other })).json()).changed, 0);
assert.equal((await (await call('/auth/passkeys/remove', { method: 'POST', body: { id: cid }, cookie: fan })).json()).changed, 1);
r = (await login()).res; assert.equal(r.status, 400); assert.match((await r.json()).error, /isn’t on a Card Tab account/);

// deleting the account removes its passkeys
o = await (await call('/auth/passkey/reg/start', { method: 'POST', body: {}, cookie: fan })).json();
await call('/auth/passkey/reg/finish', { method: 'POST', body: { ...reg(o.challenge), authenticatorData: b64u(await authData({ attested: true })) }, cookie: fan });
assert.equal(sq.prepare('SELECT COUNT(*) n FROM passkeys').get().n, 1);
await call('/auth/delete', { method: 'POST', body: {}, cookie: fan });
assert.equal(sq.prepare('SELECT COUNT(*) n FROM passkeys').get().n, 0);
console.log('passkey tests passed');
