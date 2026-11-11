/* In-app browsers (v52.23). Links tapped in Instagram, Facebook, TikTok, Messenger and similar apps open inside that app's own
   browser, where Google refuses to sign anyone in ("disallowed_useragent"). On the sign-in screen this shows a short note with a
   button that opens Card Tab in the phone's real browser (Chrome on Android, which is reliable; Safari on iPhone, which works on
   recent iOS versions), plus a copy-link fallback. "Continue with Google" points at the note instead of failing at Google's page.
   The email link and code work fine here, so they stay as they are. */
(function () {
  'use strict';
  const ua = navigator.userAgent || '';
  const APPS = [[/Instagram/i, 'Instagram'], [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i, 'Facebook'], [/Messenger/i, 'Messenger'], [/Barcelona/i, 'Threads'],
    [/musical_ly|Bytedance|TikTok/i, 'TikTok'], [/Snapchat/i, 'Snapchat'], [/LinkedInApp/i, 'LinkedIn'], [/Pinterest/i, 'Pinterest'], [/\bLine\//i, 'LINE'], [/Twitter/i, 'X']];
  const hit = APPS.find(a => a[0].test(ua));
  const android = /Android/i.test(ua), ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = !!hit || (android && /; wv\)/.test(ua));
  window.CTInApp = { inApp, app: hit ? hit[1] : '' };
  if (!inApp) return;
  const name = hit ? hit[1] + '’s' : 'this app’s';
  const here = () => location.host + location.pathname + location.search;
  function openOutside() {
    if (android) location.href = 'intent://' + here() + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end';
    else if (ios) location.href = 'x-safari-https://' + here();
    // if we're still here a moment later, the app didn't let us out: show the manual steps
    setTimeout(() => { if (document.visibilityState === 'visible') { const s = document.getElementById('ia-steps'); if (s) s.hidden = false; } }, 1400);
  }
  function mount() {
    const form = document.querySelector('#view-auth .auth-form'); if (!form || document.getElementById('ia-note')) return;
    const n = document.createElement('div'); n.className = 'ia-note'; n.id = 'ia-note'; n.setAttribute('role', 'note');
    n.innerHTML = '<b>You’re in ' + name + ' browser</b><span>Google sign-in only works in your phone’s browser. The email link below works right here.</span>' +
      '<div class="ia-btns"><button type="button" class="ia-open">Open in browser</button><button type="button" class="ia-copy">Copy link</button></div>' +
      '<p class="ia-steps" id="ia-steps" hidden>If it didn’t open: tap <b>•••</b> (top or bottom corner) and choose <b>Open in browser</b>' + (ios ? ' or <b>Open in Safari</b>' : '') + '.</p>';
    form.parentNode.insertBefore(n, form);
    n.querySelector('.ia-open').addEventListener('click', openOutside);
    n.querySelector('.ia-copy').addEventListener('click', async e => {
      const b = e.currentTarget, url = location.href;
      try { await navigator.clipboard.writeText(url); b.textContent = 'Copied'; } catch (er) { b.textContent = url.replace(/^https?:\/\//, ''); }
      document.getElementById('ia-steps').hidden = false; setTimeout(() => { b.textContent = 'Copy link'; }, 2500);
    });
    // Google would only show its "Access blocked" page here: point at the note instead (capture runs before the app's own handler)
    const g = form.querySelector('.auth-g');
    if (g) { g.classList.add('ia-g'); g.addEventListener('click', e => { e.stopImmediatePropagation(); e.preventDefault(); n.classList.remove('ia-pulse'); void n.offsetWidth; n.classList.add('ia-pulse'); n.scrollIntoView({ block: 'center', behavior: 'smooth' }); document.getElementById('ia-steps').hidden = false; }, true); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
