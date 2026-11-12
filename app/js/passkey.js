/* Sign in with Face ID / Touch ID (passkeys, v52.38). An option, never the main way in: Google and email stay first.
   Settings → Account → "Face ID and Touch ID": turn it on for the device you're on (iPhone, iPad, Mac), see each device,
   remove one. Once a device has it, the sign-in screen shows "Sign in with Face ID" (or Touch ID) under Google.
   The server side is api/src/passkey.js. Needs a browser that can hand over the public key (Safari 16+, Chrome 85+). */
(function () {
  'use strict';
  const Sess = window.CTSession, api = (...a) => Sess.api(...a);
  const FLAG = 'ct.pk';   // this device has a passkey ({id, kind}): shows the sign-in button
  const b2u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const u2b = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ua = navigator.userAgent, touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  // what this device is called, and what unlocks it
  // v52.39: Android (fingerprint or face unlock) and Windows (Windows Hello) too
  const dev = /iPhone/.test(ua) ? { label: 'iPhone', kind: 'Face ID', sec: 'Face ID and Touch ID' } : (/iPad/.test(ua) || touchMac) ? { label: 'iPad', kind: 'Face ID or Touch ID', sec: 'Face ID and Touch ID' }
    : /Macintosh/.test(ua) ? { label: 'Mac', kind: 'Touch ID', sec: 'Face ID and Touch ID' } : /Android/.test(ua) ? { label: 'Android phone', kind: 'fingerprint or face', sec: 'Fingerprint and face sign-in' }
    : /Windows NT/.test(ua) ? { label: 'Windows PC', kind: 'Windows Hello', sec: 'Windows Hello' } : null;
  const apple = !!dev;   // (any device we can name: Apple, Android, Windows)
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  const can = !!(Sess && Sess.REAL && window.PublicKeyCredential && navigator.credentials && window.AuthenticatorAttestationResponse && 'getPublicKey' in AuthenticatorAttestationResponse.prototype);
  let platform = null;   // does this device have Face ID / Touch ID ready (checked once)
  const ready = async () => { if (!can) return false; if (platform == null) { try { platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { platform = false; } } return platform; };
  const flag = () => { try { return JSON.parse(localStorage.getItem(FLAG) || 'null'); } catch (e) { return null; } };
  const setFlag = v => { try { v ? localStorage.setItem(FLAG, JSON.stringify(v)) : localStorage.removeItem(FLAG); } catch (e) {} };
  const kindName = () => (flag() && flag().kind) || (dev ? dev.kind : 'passkey');
  const friendly = e => e && e.name === 'NotAllowedError' ? '' : e && e.name === 'InvalidStateError' ? 'This device is already set up.' : (e && e.message) || 'That didn’t work. Try again.';

  async function add() {
    const o = await api('/auth/passkey/reg/start', {});
    const c = await navigator.credentials.create({ publicKey: {
      challenge: u2b(o.challenge), rp: o.rp, user: { id: u2b(o.user.id), name: o.user.name, displayName: o.user.displayName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      attestation: 'none', excludeCredentials: (o.exclude || []).map(id => ({ type: 'public-key', id: u2b(id) })), timeout: o.timeout } });
    const r = c.response;
    await api('/auth/passkey/reg/finish', { id: c.id, clientDataJSON: b2u(r.clientDataJSON), authenticatorData: b2u(r.getAuthenticatorData()), publicKey: b2u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(), label: dev ? dev.label : 'This device', kind: dev ? dev.kind : 'Passkey' });
    setFlag({ id: c.id, kind: dev ? dev.kind : 'passkey' });
    return c.id;
  }
  async function signIn() { try { return await signIn1(); } catch (e) { if (/isn’t on a Card Tab account/.test(e.message || '')) { setFlag(null); const b = document.querySelector('.auth-pk'); if (b) b.hidden = true; } throw e; } }
  async function signIn1() {
    const o = await api('/auth/passkey/login/start', {});
    const c = await navigator.credentials.get({ publicKey: { challenge: u2b(o.challenge), rpId: o.rpId, userVerification: 'required', timeout: o.timeout } });
    const r = c.response;
    const j = await api('/auth/passkey/login/finish', { id: c.id, clientDataJSON: b2u(r.clientDataJSON), authenticatorData: b2u(r.authenticatorData), signature: b2u(r.signature), userHandle: r.userHandle ? b2u(r.userHandle) : '' });
    const f = flag(); setFlag({ id: c.id, kind: (f && f.id === c.id && f.kind) || (dev ? dev.kind : 'passkey') });
    return j;
  }

  // ---------- the sign-in screen: one quiet button under Google, only on a device that has it ----------
  const FACE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16c1.4 1 3.6 1 5 0"/></svg>';
  async function prepButton(btn) {
    if (!btn) return; btn.hidden = true;
    if (!flag() || !(await ready())) return;
    btn.innerHTML = FACE + '<span>Sign in with ' + esc(kindName()) + '</span>'; btn.hidden = false;
  }

  // ---------- Settings → Account ----------
  const ago = t => { const d = new Date(t * 1000); return d.toLocaleString('en-US', { month: 'short', day: 'numeric' }) + (d.getFullYear() !== new Date().getFullYear() ? ', ' + d.getFullYear() : ''); };
  const PHONE = '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>', LAPTOP = '<rect x="3" y="5" width="18" height="11" rx="2"/><path d="M2 19h20"/>';
  const ICON = { iPhone: PHONE, 'Android phone': PHONE, iPad: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M11 18.5h2"/>', Mac: LAPTOP, 'Windows PC': '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>' };
  const svg = p => '<svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  let items = null, busy = false, note = '';
  async function paint() {
    const g = document.getElementById('am-pk'), l = document.getElementById('am-pk-l'); if (!g) return;
    const ok = await ready(), mine = flag();
    if (!can || (!ok && !(items && items.length))) { g.hidden = l.hidden = true; return; }
    if (items === null) { g.hidden = l.hidden = false; g.innerHTML = '<div class="amr am-info">' + svg(FACE_PATH) + '<span class="amgt">Face ID and Touch ID<small class="am-sv">Checking…</small></span></div>';
      try { items = (await api('/auth/passkeys')).items || []; } catch (e) { items = []; } }
    const here = mine && items.some(x => x.id === mine.id);
    if (mine && !here) { setFlag(null); setLock(null); }   // removed on another device
    if (!items.length && !(ok && apple)) { g.hidden = l.hidden = true; return; }
    g.hidden = l.hidden = false;
    g.innerHTML = items.map(x => '<div class="amr am-pkr">' + svg(ICON[x.label] || ICON.Mac) + '<span class="amgt">' + esc(x.label) + '<small class="am-sv">' + esc(cap(x.kind) || 'Passkey') + ' · added ' + ago(x.at) + (mine && mine.id === x.id ? ' · this device' : x.used ? ' · last used ' + ago(x.used) : '') + '</small></span><button type="button" class="am-pkx" data-pkx="' + esc(x.id) + '">Remove</button></div>').join('') +
      (ok && apple && !here ? '<button type="button" role="menuitem" id="am-pkadd">' + svg('<path d="M12 5v14M5 12h14"/>') + '<span class="amgt">Sign in with ' + esc(dev.kind) + '<small class="am-sv">' + esc(note || 'Turn it on for this ' + dev.label + '. Email and Google still work.') + '</small></span></button>' : '') +
      (here ? lockRows() : '') +
      (note && here ? '<p class="am-pknote">' + esc(note) + '</p>' : '');
    if (dev) l.textContent = dev.sec;
  }
  const FACE_PATH = '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16c1.4 1 3.6 1 5 0"/>';
  document.addEventListener('click', async e => {
    const a = e.target.closest('#am-pkadd'), x = e.target.closest('[data-pkx]');
    if (a && !busy) { e.stopPropagation(); busy = true; note = '';
      try { await add(); note = 'Done. Next time, tap “Sign in with ' + dev.kind + '”.'; items = null; window.ctBuzz && window.ctBuzz(); }
      catch (er) { note = friendly(er); }
      busy = false; paint(); return; }
    if (x && !busy) { e.stopPropagation();
      if (!x.classList.contains('confirm')) { x.classList.add('confirm'); x.textContent = 'Tap to remove'; setTimeout(() => { if (x.isConnected) { x.classList.remove('confirm'); x.textContent = 'Remove'; } }, 3500); return; }
      busy = true; x.textContent = 'Removing…';
      try { await api('/auth/passkeys/remove', { id: x.dataset.pkx }); const f = flag(); if (f && f.id === x.dataset.pkx) { setFlag(null); setLock(null); } items = null; note = ''; }
      catch (er) { note = friendly(er); }
      busy = false; paint(); }
  });

  // ---------- v52.39 Require Face ID (etc.) to open: a privacy screen on this device ----------
  // Off by default; only on a device that signs in with a passkey. Always asks when Card Tab opens; coming back from another
  // app it asks every time / after 5 minutes away (default) / after 15 minutes. The check is Face ID / Touch ID / fingerprint on the
  // device itself (the OS does it; the device passcode is the fallback), so it works offline too. It hides the app from
  // someone holding your unlocked phone; your account itself is protected by sign-in as always.
  const LKEY = 'ct.lock', AWAY = 'ct.lock.at';
  const lockPref = () => { try { const v = JSON.parse(localStorage.getItem(LKEY) || 'null'); return v && v.on ? { on: true, after: [0, 300, 900].includes(v.after) ? v.after : 300 } : { on: false, after: 300 }; } catch (e) { return { on: false, after: 300 }; } };
  const setLock = v => { try { v ? localStorage.setItem(LKEY, JSON.stringify(v)) : localStorage.removeItem(LKEY); } catch (e) {} };
  const lockable = () => lockPref().on && !!flag() && !!(Sess && Sess.current());
  function lockRows() {
    const L = lockPref(), k = kindName();
    return '<div class="amr am-lockr"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg><span class="amgt">Require ' + esc(k) + ' to open<small class="am-sv">Asks when Card Tab opens on this ' + esc(dev ? dev.label : 'device') + '</small></span><button type="button" class="swt" id="am-lock" role="switch" aria-checked="' + L.on + '" aria-label="Require ' + esc(k) + ' to open"><i></i></button></div>' +
      (L.on ? '<div class="amr am-lockr amth"><span class="amgt">Ask again<small class="am-sv">After you’ve been in another app</small></span><div class="seg" id="am-lockt" role="radiogroup" aria-label="Ask again">' + [[0, 'Always'], [300, '5 min'], [900, '15 min']].map(([v, t]) => '<button type="button" role="radio" data-lockt="' + v + '" aria-checked="' + (L.after === v) + '"' + (L.after === v ? ' class="on"' : '') + '>' + t + '</button>').join('') + '</div></div>' : '');
  }
  async function check() {   // one Face ID / Touch ID check with this device's passkey
    const f = flag(); if (!f) throw new Error('This device isn’t set up.');
    const c = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: 'cardtab.app', allowCredentials: [{ type: 'public-key', id: u2b(f.id) }], userVerification: 'required', timeout: 60000 } });
    const ad = new Uint8Array(c.response.authenticatorData); if (!(ad[32] & 0x04)) throw new Error('Face ID or Touch ID didn’t finish. Try again.');   // really verified (not just a tap)
  }
  let lockEl = null, asking = false;
  function showLock() {
    document.documentElement.classList.add('ct-locked');
    lockEl = document.getElementById('ct-lock'); if (!lockEl) return;
    const k = kindName();
    lockEl.querySelector('[data-lk=sub]').textContent = 'Use ' + k + ' to open it.';
    lockEl.querySelector('[data-lk=go] span').textContent = 'Unlock with ' + k;
    lockEl.querySelector('[data-lk=err]').hidden = true;
    unlock(true);
  }
  async function unlock(auto) {
    if (asking) return; asking = true; const err = lockEl && lockEl.querySelector('[data-lk=err]');
    try { await check(); document.documentElement.classList.remove('ct-locked'); try { localStorage.removeItem(AWAY); } catch (e) {} }
    catch (e) { if (!auto && err && e.name !== 'NotAllowedError') { err.textContent = friendly(e) || 'That didn’t work. Try again.'; err.hidden = false; } }
    finally { asking = false; }
  }
  function boot() {
    lockEl = document.getElementById('ct-lock');
    if (lockEl) lockEl.addEventListener('click', e => {
      if (e.target.closest('[data-lk=go]')) unlock(false);
      if (e.target.closest('[data-lk=out]')) { setLock(null); document.documentElement.classList.remove('ct-locked'); Sess.signOut(); location.reload(); }
    });
    // the head script hides the app before it draws when a lock is on; here we decide if it really should ask
    if (document.documentElement.classList.contains('ct-locked')) {
      // opening Card Tab always asks; the 5 / 15 minutes are for coming back from another app
      if (lockable()) ready().then(ok => ok ? showLock() : document.documentElement.classList.remove('ct-locked'));
      else document.documentElement.classList.remove('ct-locked');
    }
    const gone = () => { if (lockable() && !document.documentElement.classList.contains('ct-locked')) try { localStorage.setItem(AWAY, String(Date.now())); } catch (e) {} };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { gone(); if (lockable() && lockPref().after === 0) document.documentElement.classList.add('ct-locked'); return; }   // every time: covered before the app switcher's snapshot
      if (!lockable()) { document.documentElement.classList.remove('ct-locked'); return; }
      const away = +(localStorage.getItem(AWAY) || 0), L = lockPref();
      if (document.documentElement.classList.contains('ct-locked') || L.after === 0 || (away && Date.now() - away >= L.after * 1000)) showLock();
    });
    window.addEventListener('pagehide', gone);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('click', async e => {
    const sw = e.target.closest('#am-lock'), t = e.target.closest('[data-lockt]');
    if (sw && !busy) { e.stopPropagation(); const on = sw.getAttribute('aria-checked') !== 'true';
      if (on) { busy = true; note = ''; try { await check(); setLock({ on: true, after: lockPref().after }); try { localStorage.removeItem(AWAY); } catch (er) {} } catch (er) { note = friendly(er); } busy = false; }
      else setLock(null);
      setTimeout(paint); return; }   // after this tap is handled, so the menu still sees the tap as inside it
    if (t) { e.stopPropagation(); setLock({ on: true, after: +t.dataset.lockt }); setTimeout(paint); }
  });

  window.CTPasskey = { can, apple, ready, add, signIn, prepButton, paint, reset() { items = null; note = ''; }, kindName, friendly };
})();
