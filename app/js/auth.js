/* Card Tab sign-in.
   On app.cardtab.app it's real: Google, or an emailed link + 6-digit code (no passwords). The server keeps the session
   in an HttpOnly cookie for 30 days and says who's an admin; this file keeps a small copy of who you are so the app
   opens instantly, then checks it with the server.
   Anywhere else (test copies, previews) it stays in local mode: either button signs you in on this device only. */
(function () {
  'use strict';
  const REAL = /(^|\.)cardtab\.app$/i.test(location.hostname);
  const LOCAL_MODE = !REAL;
  const API = REAL ? 'https://api.cardtab.app' : '';
  const KEY = 'ct.session', DAYS = 30;

  async function api(path, body) {
    const r = await fetch(API + path, body === undefined ? { credentials: 'include' } : { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong. Try again.'), { status: r.status });
    return j;
  }

  const Session = {
    LOCAL_MODE, REAL, API,
    get() {
      try {
        const s = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!s || !s.email || Date.now() > s.expires) return null;
        return s;
      } catch (e) { return null; }
    },
    signIn({ email, name, via, role, plan, id }) {
      const s = { email: String(email).trim().toLowerCase(), name: name || '', via: via || 'email', role: role || 'user', plan: plan || '', id: id || '', expires: Date.now() + DAYS * 864e5 };
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window: session lasts until the tab closes */ }
      Session._mem = s; return s;
    },
    fromUser(u, via) { return Session.signIn({ email: u.email, name: u.name, via: via || 'email', role: u.role, plan: u.plan, id: u.id }); },
    signOut() { if (REAL) api('/auth/logout', {}).catch(() => {}); try { localStorage.removeItem(KEY); } catch (e) {} Session._mem = null; },
    // Settings → Account: ends every session for this account (throws if the account can't be reached, so nothing is half done)
    async signOutAll() { if (REAL) await api('/auth/logout-all', {}); try { localStorage.removeItem(KEY); } catch (e) {} Session._mem = null; },
    current() { return Session.get() || Session._mem || null; },
    // the server's answer about who's signed in (null when signed out). Network trouble keeps the copy we have.
    async check() { if (!REAL) return Session.current(); try { const j = await api('/auth/me'); return Session.fromUser(j.user, (Session.current() || {}).via); } catch (e) { if (e.status === 401) { try { localStorage.removeItem(KEY); } catch (er) {} Session._mem = null; return null; } return Session.current(); } },
    // links from the sign-in email (?login=…) and the return from Google (?signedin=google / ?signin_error=…)
    async fromUrl() {
      const q = new URLSearchParams(location.search), clean = () => history.replaceState(null, '', location.pathname);
      if (!REAL) return null;
      if (q.get('login')) { const t = q.get('login'); clean(); try { const j = await api('/auth/email/verify', { token: t }); return { session: Session.fromUser(j.user, 'email'), isNew: j.isNew }; } catch (e) { return { error: e.message }; } }
      if (q.get('signedin') === 'google') { const isNew = q.has('new'); clean(); const s = await Session.check(); if (s) { s.via = 'google'; Session.signIn(s); } return s ? { session: s, isNew } : { error: 'Google sign-in didn’t finish. Try again.' }; }
      if (q.get('signin_error')) { const k = q.get('signin_error'); clean(); return { error: k === 'google_off' ? 'Google sign-in isn’t switched on yet. Use your email for now.' : 'Google sign-in didn’t finish. Try again.' }; }
      return null;
    },
    api
  };

  // ---------- sign-in page ----------
  function mountAuth(root, onSignedIn) {
    const $ = s => root.querySelector(s);
    const card = $('.auth-card'), seg = $('.auth-seg'), pill = $('.auth-pill'), email = $('#auth-email'), go = $('#auth-go'), err = $('#auth-err');
    const code = $('#auth-code'), codeGo = $('#auth-code-go'), again = $('#auth-again');
    let mode = 'in', sentTo = '', againT = 0;
    const label = () => mode === 'up' ? 'Email me a sign-up link' : 'Email me a sign-in link';
    function setMode(m) {
      mode = m;
      seg.querySelectorAll('button').forEach(b => { const on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      pill.style.transform = m === 'up' ? 'translateX(100%)' : 'none';
      $('#auth-h').textContent = m === 'up' ? 'Start tracking free' : 'Welcome back';
      $('#auth-sub').textContent = m === 'up' ? '20 entries a month, free. No card needed.' : 'Pick up where you left off.';
      go.textContent = label();
      $('#auth-fine').textContent = m === 'up' ? 'No password to set up. We email you a link that creates your account.' : 'No password to remember. We email you a link that signs you in.';
      $('#auth-early').hidden = m !== 'up';
      showErr('');
    }
    function showErr(t) { err.textContent = t || 'Enter a valid email address.'; err.hidden = !t; }
    function busy(btn, on, text) { btn.disabled = on; if (text) btn.textContent = text; }
    seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
    const valid = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    function sentState(on) {
      card.classList.toggle('sent', on);
      if (on) { $('#auth-sent-t').textContent = sentTo; code.value = ''; setTimeout(() => code.focus({ preventScroll: true }), 60); startAgain(); }
      else { clearInterval(againT); setTimeout(() => email.focus({ preventScroll: true }), 60); }
    }
    function startAgain() { let n = 30; again.disabled = true; again.textContent = 'Send again in ' + n; clearInterval(againT);
      againT = setInterval(() => { n--; if (n <= 0) { clearInterval(againT); again.disabled = false; again.textContent = 'Send again'; } else again.textContent = 'Send again in ' + n; }, 1000); }
    async function submit() {
      const v = email.value.trim();
      if (!valid(v)) { showErr('Enter a valid email address.'); email.focus(); return; }
      if (LOCAL_MODE) { onSignedIn(Session.signIn({ email: v, via: 'email', role: 'admin' }), mode === 'up'); return; }
      busy(go, true, 'Sending…');
      try { await api('/auth/email/start', { email: v, mode }); sentTo = v.toLowerCase(); sentState(true); }
      catch (e) { showErr(e.message); }
      finally { busy(go, false, label()); }
    }
    async function submitCode() {
      const c = code.value.replace(/\D/g, '');
      if (c.length !== 6) { $('#auth-code-err').textContent = 'Enter the 6 digits from the email.'; $('#auth-code-err').hidden = false; return; }
      busy(codeGo, true, 'Checking…');
      try { const j = await api('/auth/email/verify', { email: sentTo, code: c }); clearInterval(againT); onSignedIn(Session.fromUser(j.user, 'email'), j.isNew); }
      catch (e) { $('#auth-code-err').textContent = e.message; $('#auth-code-err').hidden = false; }
      finally { busy(codeGo, false, 'Sign in'); }
    }
    go.addEventListener('click', submit);
    email.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    email.addEventListener('input', () => showErr(''));
    codeGo.addEventListener('click', submitCode);
    code.addEventListener('input', () => { $('#auth-code-err').hidden = true; const d = code.value.replace(/\D/g, ''); if (d.length === 6) submitCode(); });
    code.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitCode(); } });
    $('#auth-back').addEventListener('click', () => sentState(false));
    again.addEventListener('click', async () => { again.disabled = true; try { await api('/auth/email/start', { email: sentTo, mode }); startAgain(); $('#auth-code-err').hidden = true; } catch (e) { $('#auth-code-err').textContent = e.message; $('#auth-code-err').hidden = false; again.disabled = false; again.textContent = 'Send again'; } });
    $('.auth-g').addEventListener('click', () => {
      if (LOCAL_MODE) { const v = email.value.trim(); onSignedIn(Session.signIn({ email: valid(v) ? v : 'you@cardtab.local', name: '', via: 'google', role: 'admin' }), mode === 'up'); return; }
      location.href = API + '/auth/google/start?mode=' + mode;
    });
    $('#auth-local').hidden = !LOCAL_MODE;
    // The marketing site links here with ?signup to open on Create account
    // Phones: when you tap the email (or code) box, scroll it to the same spot near the top of what's visible, whichever of Sign in or
    // Create account you're on. On iPhone Chrome the page area already ends above the keyboard and Chrome's own autofill bar, so the
    // visible area is simply the visual viewport; the box lands about 60px below its top (Nick's picked spot, from his Sign in screenshot).
    // Extra room is added at the bottom while a box has focus, so even the taller Create account card can scroll that far.
    { const vv = window.visualViewport, page = document.getElementById('view-auth'), touch = matchMedia('(pointer:coarse)'); let cur = null, timers = [];
      const place = () => { if (!cur || !document.contains(cur) || cur.offsetParent === null) return;
        const vh = vv ? vv.height : window.innerHeight, top = vv ? vv.offsetTop : 0, r = cur.getBoundingClientRect();
        const d = (r.top - top) - Math.min(60, vh * 0.22);
        if (Math.abs(d) > 5) window.scrollBy({ top: d, behavior: 'smooth' }); };
      const run = () => { timers.forEach(clearTimeout); timers = [60, 250, 500, 800, 1200].map(t => setTimeout(place, t)); };
      // only a box the person tapped counts: the page can focus the email box by itself on load, and that must not scroll anything
      let gesture = 0; const settle = () => setTimeout(() => { if (!cur) page.classList.remove('kb-up'); }, 400);   // lets a button tap finish before the extra room goes away
      ['pointerdown', 'touchstart', 'keydown'].forEach(t => page.addEventListener(t, e => { gesture = Date.now(); if (t === 'pointerdown' && !e.target.closest('input,label')) { cur = null; settle(); } }, { passive: true, capture: true }));
      const engage = e => { if (!touch.matches || !e.target.matches('input') || Date.now() - gesture > 900) return; cur = e.target; page.classList.add('kb-up'); run(); };
      page.addEventListener('focusin', engage);
      page.addEventListener('pointerup', engage);   // tapping a box that already has focus gives no focus event
      page.addEventListener('focusout', () => { cur = null; settle(); });
      // the card changes height when you switch between Sign in and Create account: place the box again if one is focused
      seg.addEventListener('click', () => { if (cur) run(); });
      if (vv) { vv.addEventListener('resize', () => { if (cur) run(); }); } }
    const qs = new URLSearchParams(location.search);
    setMode(qs.has('signup') || qs.get('mode') === 'signup' ? 'up' : 'in');
    return { reset() { email.value = ''; card.classList.remove('sent'); clearInterval(againT); setMode('in'); }, error(t) { card.classList.remove('sent'); showErr(t); } };
  }

  window.CTSession = Session;
  window.CTAuth = { mount: mountAuth };
})();
