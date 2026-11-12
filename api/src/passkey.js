/* Sign in with Face ID / Touch ID (passkeys, v52.38). An option next to Google and email, never instead of them.
   Someone signed in can add a passkey for the device they're on (Settings → Account). Next time, Face ID or Touch ID signs
   them in. The passkey's private half never leaves their device; Card Tab keeps only the public key, which is useless to
   anyone else. Passkeys belong to cardtab.app (not just app.cardtab.app), so they keep working wherever sign-in lives.

   No libraries: the browser hands over the public key itself (getPublicKey), so there's no attestation to unpack. Each
   challenge is random, single use and lasts 5 minutes; every reply is checked for the right site, the right challenge,
   and that the person was really there and verified (Face ID / Touch ID / device passcode).

   POST /auth/passkey/reg/start        signed in: options for adding this device
   POST /auth/passkey/reg/finish       signed in: save it
   POST /auth/passkey/login/start      anyone: a challenge
   POST /auth/passkey/login/finish     anyone: check the signature, start a session
   GET  /auth/passkeys                 signed in: this account's passkeys
   POST /auth/passkeys/remove {id}     signed in: remove one */

const enc = new TextEncoder(), dec = new TextDecoder();
const now = () => Math.floor(Date.now() / 1000);
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const rand = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async u8 => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const CHAL_SEC = 300, MAX_KEYS = 10;
const rpId = env => env.PASSKEY_RP_ID || 'cardtab.app';
const origins = env => [env.APP_URL || 'https://app.cardtab.app'].concat((env.EXTRA_ORIGINS || '').split(/[\s,]+/).filter(Boolean));
const ALG = { '-7': { name: 'ECDSA', namedCurve: 'P-256' }, '-257': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } };

let made = false;
async function ensure(env) {
  if (made) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS passkeys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pk TEXT NOT NULL, alg INTEGER NOT NULL, sign_count INTEGER DEFAULT 0, label TEXT, kind TEXT, created_at INTEGER, used_at INTEGER)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys (user_id)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS pk_chal (id TEXT PRIMARY KEY, user_id TEXT, kind TEXT NOT NULL, ip TEXT, expires_at INTEGER NOT NULL)').run();
  made = true;
}
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

async function newChallenge(env, kind, userId, ip) {
  await env.DB.prepare('DELETE FROM pk_chal WHERE expires_at < ?').bind(now()).run();
  if (ip) { const r = await env.DB.prepare('SELECT COUNT(*) n FROM pk_chal WHERE ip=?').bind(ip).first(); if (r && r.n >= 30) throw fail('Too many tries. Wait a few minutes, then try again.', 429); }
  const c = rand(32);
  await env.DB.prepare('INSERT INTO pk_chal (id,user_id,kind,ip,expires_at) VALUES (?,?,?,?,?)').bind(c, userId || null, kind, ip || '', now() + CHAL_SEC).run();
  return c;
}
// the browser's clientDataJSON: the right kind, a live challenge of ours (used up here), from the app's own address
async function checkClient(env, cdB64, type, kind, userId) {
  const raw = unb64u(cdB64); let cd; try { cd = JSON.parse(dec.decode(raw)); } catch (e) { throw fail('That didn’t work. Try again.'); }
  if (cd.type !== type || !origins(env).includes(cd.origin)) throw fail('That didn’t work. Try again.');
  const row = await env.DB.prepare('SELECT * FROM pk_chal WHERE id=?').bind(String(cd.challenge || '')).first();
  if (!row || row.kind !== kind || row.expires_at < now() || (userId && row.user_id !== userId)) throw fail('That took too long. Try again.');
  await env.DB.prepare('DELETE FROM pk_chal WHERE id=?').bind(row.id).run();
  return raw;
}
// authenticator data: made for cardtab.app, and the person was there (UP) and verified with Face ID / Touch ID / passcode (UV)
async function checkAuthData(env, ad) {
  if (ad.length < 37 || !same(ad.slice(0, 32), await sha256(enc.encode(rpId(env))))) throw fail('That didn’t work. Try again.');
  if ((ad[32] & 0x05) !== 0x05) throw fail('Face ID or Touch ID didn’t finish. Try again.');
  return { flags: ad[32], count: ((ad[33] << 24) | (ad[34] << 16) | (ad[35] << 8) | ad[36]) >>> 0 };
}
// WebAuthn ECDSA signatures are DER; WebCrypto wants r||s, 32 bytes each
function derToRaw(der) {
  let i = 2; if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const int = () => { if (der[i++] !== 0x02) throw fail('That didn’t work. Try again.'); const len = der[i++]; let v = der.slice(i, i + len); i += len; while (v.length > 32 && v[0] === 0) v = v.slice(1); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
  const r = int(), s = int(), out = new Uint8Array(64); out.set(r, 0); out.set(s, 32); return out;
}
const importKey = (spki, alg) => crypto.subtle.importKey('spki', spki, ALG[String(alg)], false, ['verify']);

export async function handlePasskey(env, req, path, me, out, signIn) {
  try {
    await ensure(env);
    const ip = req.headers.get('cf-connecting-ip') || '';
    if (path === '/auth/passkey/login/start' && req.method === 'POST') return out({ challenge: await newChallenge(env, 'login', null, ip), rpId: rpId(env), timeout: CHAL_SEC * 1000 });
    if (path === '/auth/passkey/login/finish' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const cd = await checkClient(env, b.clientDataJSON, 'webauthn.get', 'login', null);
      const cred = await env.DB.prepare('SELECT * FROM passkeys WHERE id=?').bind(clip(b.id, 400)).first();
      if (!cred) throw fail('This passkey isn’t on a Card Tab account anymore. Sign in with Google or email, then turn Face ID back on in Settings.');
      if (b.userHandle && dec.decode(unb64u(b.userHandle)) !== cred.user_id) throw fail('That didn’t work. Try again.');
      const ad = unb64u(b.authenticatorData), a = await checkAuthData(env, ad);
      const data = new Uint8Array(ad.length + 32); data.set(ad, 0); data.set(await sha256(cd), ad.length);
      let sig = unb64u(b.signature); if (cred.alg === -7) sig = derToRaw(sig);
      const algo = cred.alg === -7 ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };
      if (!await crypto.subtle.verify(algo, await importKey(unb64u(cred.pk), cred.alg), sig, data)) throw fail('That didn’t work. Try again.');
      if (a.count && cred.sign_count && a.count <= cred.sign_count) throw fail('That didn’t work. Sign in with Google or email instead.');   // a copied key (counters only go up)
      await env.DB.prepare('UPDATE passkeys SET sign_count=?, used_at=? WHERE id=?').bind(a.count, now(), cred.id).run();
      return signIn(cred.user_id);
    }

    if (!me) return out({ error: 'Sign in first.' }, 401);
    if (path === '/auth/passkeys' && req.method === 'GET') {
      const rows = (await env.DB.prepare('SELECT id,label,kind,created_at,used_at FROM passkeys WHERE user_id=? ORDER BY created_at').bind(me.id).all()).results || [];
      return out({ items: rows.map(r => ({ id: r.id, label: r.label, kind: r.kind, at: r.created_at, used: r.used_at })) });
    }
    if (path === '/auth/passkeys/remove' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const r = await env.DB.prepare('DELETE FROM passkeys WHERE id=? AND user_id=?').bind(clip(b.id, 400), me.id).run();
      return out({ ok: true, changed: (r.meta && r.meta.changes) || 0 });
    }
    if (path === '/auth/passkey/reg/start' && req.method === 'POST') {
      const have = (await env.DB.prepare('SELECT id FROM passkeys WHERE user_id=?').bind(me.id).all()).results || [];
      if (have.length >= MAX_KEYS) throw fail('You have ' + MAX_KEYS + ' devices set up. Remove one first.');
      return out({ challenge: await newChallenge(env, 'reg', me.id, ip), rp: { id: rpId(env), name: 'Card Tab' }, user: { id: b64u(enc.encode(me.id)), name: me.email, displayName: me.name || me.email }, exclude: have.map(x => x.id), timeout: CHAL_SEC * 1000 });
    }
    if (path === '/auth/passkey/reg/finish' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      await checkClient(env, b.clientDataJSON, 'webauthn.create', 'reg', me.id);
      const ad = unb64u(b.authenticatorData); await checkAuthData(env, ad);
      const id = clip(b.id, 400), rawId = unb64u(id);
      if (!(ad[32] & 0x40) || ad.length < 55 || ((ad[53] << 8) | ad[54]) !== rawId.length || !same(ad.slice(55, 55 + rawId.length), rawId)) throw fail('That didn’t work. Try again.');
      const alg = +b.alg; if (!ALG[String(alg)]) throw fail('This device’s passkeys aren’t supported yet.');
      const spki = unb64u(b.publicKey); await importKey(spki, alg);   // throws if it isn't a real key of that kind
      await env.DB.prepare('INSERT OR REPLACE INTO passkeys (id,user_id,pk,alg,sign_count,label,kind,created_at,used_at) VALUES (?,?,?,?,0,?,?,?,NULL)')
        .bind(id, me.id, b64u(spki), alg, clip(b.label, 40) || 'This device', clip(b.kind, 30), now()).run();
      return out({ ok: true, id });
    }
    return out({ error: 'not found' }, 404);
  } catch (e) { return out({ error: e.status ? e.message : 'That didn’t work. Try again.' }, e.status || 400); }
}
