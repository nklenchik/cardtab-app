/* Card Tab sign-in (Drop 1: local mode).
   Real sign-in is Google plus an emailed sign-in link, no passwords (single-use link, about 15 minutes,
   device session about 30 days). That needs the backend and the login@cardtab.app sender, which come after
   the Cloudflare move. Until then LOCAL_MODE signs you in on this device only, so the screens can be used for real.
*/
(function () {
  'use strict';
  const LOCAL_MODE = true;
  const KEY = 'ct.session', DAYS = 30;

  const Session = {
    LOCAL_MODE,
    get() {
      try {
        const s = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!s || !s.email || Date.now() > s.expires) return null;
        return s;
      } catch (e) { return null; }
    },
    signIn({ email, name, via }) {
      const s = { email: String(email).trim().toLowerCase(), name: name || '', via: via || 'email', expires: Date.now() + DAYS * 864e5 };
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window: session lasts until the tab closes */ }
      Session._mem = s; return s;
    },
    signOut() { try { localStorage.removeItem(KEY); } catch (e) {} Session._mem = null; },
    current() { return Session.get() || Session._mem || null; }
  };

  // ---------- sign-in page ----------
  function mountAuth(root, onSignedIn) {
    const $ = s => root.querySelector(s);
    const seg = $('.auth-seg'), pill = $('.auth-pill'), email = $('#auth-email'), go = $('#auth-go');
    let mode = 'in';
    function setMode(m) {
      mode = m;
      seg.querySelectorAll('button').forEach(b => { const on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      pill.style.transform = m === 'up' ? 'translateX(100%)' : 'none';
      $('#auth-h').textContent = m === 'up' ? 'Start tracking free' : 'Welcome back';
      $('#auth-sub').textContent = m === 'up' ? '20 entries a month, free. No card needed.' : 'Pick up where you left off.';
      go.textContent = m === 'up' ? 'Email me a sign-up link' : 'Email me a sign-in link';
      $('#auth-fine').textContent = m === 'up' ? 'No password to set up. We email you a link that creates your account.' : 'No password to remember. We email you a link that signs you in.';
      $('#auth-early').hidden = m !== 'up';
      $('#auth-err').hidden = true;
    }
    seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
    const valid = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    function submit() {
      const v = email.value.trim();
      if (!valid(v)) { $('#auth-err').hidden = false; email.focus(); return; }
      if (LOCAL_MODE) { onSignedIn(Session.signIn({ email: v, via: 'email' }), mode === 'up'); return; }
      // Real flow (later): POST /auth/link, then show the "Check your inbox" state
      $('#auth-sent-t').textContent = 'We sent a link to ' + v + '. It works for 15 minutes.';
      $('#auth-sent').hidden = false;
    }
    go.addEventListener('click', submit);
    email.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    email.addEventListener('input', () => { $('#auth-err').hidden = true; });
    $('.auth-g').addEventListener('click', () => {
      if (LOCAL_MODE) {
        const v = email.value.trim();
        onSignedIn(Session.signIn({ email: valid(v) ? v : 'you@cardtab.local', name: '', via: 'google' }), mode === 'up');
      }
    });
    $('#auth-local').hidden = !LOCAL_MODE;
    // The marketing site links here with ?signup to open on Create account
    const qs = new URLSearchParams(location.search);
    setMode(qs.has('signup') || qs.get('mode') === 'signup' ? 'up' : 'in');
    return { reset() { email.value = ''; setMode('in'); } };
  }

  window.CTSession = Session;
  window.CTAuth = { mount: mountAuth };
})();
