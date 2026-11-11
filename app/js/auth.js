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
    signIn({ email, name, via, role, plan, id, bonus }) {
      const s = { email: String(email).trim().toLowerCase(), name: name || '', via: via || 'email', role: role || 'user', plan: plan || '', id: id || '', bonus: bonus || null, expires: Date.now() + DAYS * 864e5 };
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window: session lasts until the tab closes */ }
      Session._mem = s; return s;
    },
    fromUser(u, via) { return Session.signIn({ email: u.email, name: u.name, via: via || 'email', role: u.role, plan: u.plan, id: u.id, bonus: u.bonus || null }); },
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
      if (q.get('signin_error')) { const k = q.get('signin_error'); clean(); return { error: k === 'google_off' ? 'Google sign-in isn’t switched on yet. Use your email for now.' : k === 'paused' ? 'This account is paused. Email hello@cardtab.app and we’ll sort it out.' : 'Google sign-in didn’t finish. Try again.' }; }
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
      const touchOnly = matchMedia('(pointer:coarse)').matches;   // phones: no automatic focus (it opens no keyboard); the page just returns to the top
      root.dispatchEvent(new Event('auth-reset'));
      if (on) { $('#auth-sent-t').textContent = sentTo; code.value = ''; if (!touchOnly) setTimeout(() => code.focus({ preventScroll: true }), 60); startAgain(); }
      else { clearInterval(againT); if (!touchOnly) setTimeout(() => email.focus({ preventScroll: true }), 60); }
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
    // Phones: when you tap the email (or code) box, the page glides ONCE to put that box about 60px below the top of what's visible,
    // the same spot on Sign in and Create account (the card hangs from the top, so both tabs line up). The glide starts the moment the
    // finger lands, before the keyboard has finished rising, so iPhone's own scrolling has nothing left to do. It isn't repeated while the
    // keyboard animates. When the keyboard goes away the page glides back up once. While a box has focus the page has extra room at the
    // bottom (`kb-up`, `--pad`) so it can scroll that far; once things settle that room is trimmed to exactly what the spot needs, so you
    // can't scroll into an empty page.
    { const vv = window.visualViewport, page = document.getElementById('view-auth'), touch = matchMedia('(pointer:coarse)');
      let cur = null, placedAt = 0, downAt = 0, downPlain = false, fixT = 0, relT = 0, trimT = 0;
      const calm = matchMedia('(prefers-reduced-motion: reduce)');
      const dist = el => { const top = vv ? vv.offsetTop : 0, vh = vv ? vv.height : window.innerHeight; return (el.getBoundingClientRect().top - top) - Math.min(60, vh * 0.22); };
      const glide = (el, smooth) => { const d = dist(el); if (Math.abs(d) > 3) window.scrollBy({ top: d, behavior: smooth && !calm.matches ? 'smooth' : 'auto' }); };
      let touching = false, lastTouch = 0, tapBox = null, downXY = [0, 0];
      // extra room below the card is trimmed to exactly what the placement spot needs (measured from where the box WOULD sit, not where
      // the page happens to be scrolled), and never while a finger is on the page
      const trim = () => { if (!cur) return; if (touching || Date.now() - lastTouch < 600) { later(); return; }
        const cs = getComputedStyle(page), base = Math.max(window.innerHeight, card.offsetHeight + parseFloat(cs.paddingTop) + 24);
        const need = Math.max(0, Math.ceil(window.scrollY + dist(cur) + window.innerHeight - base)); page.style.setProperty('--pad', need + 'px'); };
      const later = () => { clearTimeout(trimT); trimT = setTimeout(trim, 450); };
      const engage = el => {
        if (!touch.matches || Date.now() - downAt > 900 || el === cur && Date.now() - placedAt < 1500) return;
        clearTimeout(relT); cur = el; lowIh = 0; placedAt = Date.now(); page.style.removeProperty('--pad'); page.classList.add('kb-up');
        glide(el, true);
        clearTimeout(fixT); fixT = setTimeout(() => { if (cur === el && !touching && Date.now() - lastTouch > 600 && Math.abs(dist(el)) > 24) glide(el, true); }, 1100);   // one quiet correction only if iPhone moved it, never against a finger
        clearTimeout(trimT); trimT = setTimeout(trim, 1500);
      };
      const drop = () => { clearTimeout(relT); relT = setTimeout(() => { if (!cur) { page.classList.remove('kb-up'); page.style.removeProperty('--pad'); } }, 520); };
      const release = () => { clearTimeout(fixT); clearTimeout(trimT); if (cur) return;
        if (!touching && (!downPlain || Date.now() - downAt > 700)) window.scrollTo({ top: 0, behavior: calm.matches ? 'auto' : 'smooth' });   // keyboard hidden: one glide back up
        drop(); };
      // Only a tap on a box ever moves the page. Touching anywhere else (including dragging to scroll) just stops anything pending,
      // so the page is only ever moved by your finger.
      page.addEventListener('pointerdown', e => { downAt = lastTouch = Date.now(); touching = true; const t = e.target;
        downPlain = !!t.closest('button,a,select,summary') && !t.closest('input,label');
        tapBox = t.closest('input'); downXY = [e.clientX, e.clientY]; clearTimeout(fixT); }, { passive: true, capture: true });
      // a tap (finger lifts without the browser taking over to scroll) on a box glides the page; a drag that starts on a box just scrolls
      addEventListener('pointerup', e => { touching = false; lastTouch = Date.now();
        if (tapBox && Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) < 10) engage(tapBox); tapBox = null; }, { passive: true });
      addEventListener('pointercancel', () => { touching = false; lastTouch = Date.now(); tapBox = null; }, { passive: true });
      const up = () => { touching = false; lastTouch = Date.now(); };
      addEventListener('touchend', up, { passive: true }); addEventListener('touchcancel', up, { passive: true });
      page.addEventListener('keydown', () => { downAt = Date.now(); }, { passive: true, capture: true });
      page.addEventListener('focusin', e => { if (e.target.matches('input') && Date.now() - downAt <= 900) engage(e.target); });
      page.addEventListener('focusout', () => { cur = null; setTimeout(() => { if (!cur) release(); }, 60); });
      // switching between Sign in and Create account: the card is taller or shorter, so glide the focused box into place again
      seg.addEventListener('click', () => { if (cur) { placedAt = 0; setTimeout(() => { if (cur) { glide(cur, true); later(); } }, 120); } });
      // the page changed (sent / back): go to the top and drop the extra room
      root.addEventListener('auth-reset', () => { cur = null; clearTimeout(fixT); clearTimeout(trimT); window.scrollTo({ top: 0, behavior: 'auto' }); drop(); });
      // keyboard hidden while the box is still focused (swipe-down / Done on iPhone doesn't blur it): the page grew back, so let go of the
      // box, which glides the page to the top and removes the extra room right away
      let lowIh = 0;
      const sizeWatch = () => { if (!cur) { lowIh = 0; return; } const ih = window.innerHeight; lowIh = lowIh ? Math.min(lowIh, ih) : ih;
        if (ih - lowIh > 120) { lowIh = 0; clearTimeout(trimT); cur.blur(); } else later(); };
      addEventListener('resize', sizeWatch); if (vv) vv.addEventListener('resize', sizeWatch); }
    const qs = new URLSearchParams(location.search);
    setMode(qs.has('signup') || qs.get('mode') === 'signup' ? 'up' : 'in');
    return { reset() { email.value = ''; card.classList.remove('sent'); clearInterval(againT); setMode('in'); }, error(t) { card.classList.remove('sent'); showErr(t); } };
  }

  window.CTSession = Session;
  window.CTAuth = { mount: mountAuth };
})();
