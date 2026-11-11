/* Help and feedback (v52.23): a short form from the menu. Bug, Idea or Other, a message, and an optional screenshot (shrunk on the
   phone before it's sent). It also notes the page you were on, the app version and (on the server) your device, so nobody has to
   ask "what phone?". Messages land in the admin dashboard → Feedback; a reply comes back as a notice in the app. */
(function () {
  'use strict';
  const REAL = /(^|\.)cardtab\.app$/i.test(location.hostname), API = REAL ? 'https://api.cardtab.app' : '';
  const ver = () => { const s = document.querySelector('script[src*="js/main.js"]'); const m = s && /v=([\d.]+)/.exec(s.src); return m ? m[1] : ''; };
  const page = () => { const x = document.getElementById('csx'); if (x && x.classList.contains('in')) return 'Stories'; const c = document.querySelector('.cbx'); if (c && !c.classList.contains('off')) return 'Board'; return 'Entries'; };
  let dlg = null, kind = 'bug', shot = null, busy = false, from = 'Entries';
  const $ = s => dlg.querySelector(s);
  function build() {
    dlg = document.createElement('dialog'); dlg.className = 'fbd'; dlg.setAttribute('aria-labelledby', 'fb-h');
    dlg.innerHTML = '<form method="dialog" class="fbp" novalidate>' +
      '<div class="fbhd"><h2 id="fb-h">Help and feedback</h2><button type="button" class="fbx" aria-label="Close">✕</button></div>' +
      '<p class="fbsub">Spotted a bug or have an idea? It goes straight to the person who makes Card Tab, and you’ll get a reply here in the app.</p>' +
      '<div class="fbseg" role="radiogroup" aria-label="What is it?">' + [['bug', 'Bug'], ['idea', 'Idea'], ['other', 'Other']].map(([k, l]) => '<button type="button" role="radio" data-k="' + k + '">' + l + '</button>').join('') + '</div>' +
      '<label class="fbl"><span class="fbls" id="fb-lab">What happened?</span><textarea id="fb-msg" rows="5" maxlength="4000" placeholder=""></textarea></label>' +
      '<div class="fbshot"><button type="button" class="fbadd" id="fb-add"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>Add a screenshot</button>' +
      '<div class="fbthumb" id="fb-thumb" hidden><img alt="Your screenshot"><button type="button" aria-label="Remove screenshot">✕</button></div><input type="file" id="fb-file" accept="image/*" hidden></div>' +
      '<p class="fberr" id="fb-err" role="alert" hidden></p>' +
      '<button type="submit" class="fbgo" id="fb-go">Send</button>' +
      '<p class="fbfoot">Or email <span>hello@cardtab.app</span></p></form>';
    document.body.appendChild(dlg);
    $('.fbx').onclick = close;
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
    $('.fbseg').onclick = e => { const b = e.target.closest('[data-k]'); if (b) setKind(b.dataset.k); };
    $('#fb-add').onclick = () => $('#fb-file').click();
    $('#fb-file').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) addShot(f); };
    $('#fb-thumb button').onclick = () => { shot = null; $('#fb-thumb').hidden = true; $('#fb-add').hidden = false; };
    $('#fb-msg').addEventListener('input', () => { $('#fb-err').hidden = true; });
    dlg.querySelector('form').addEventListener('submit', e => { e.preventDefault(); send(); });
  }
  const PH = { bug: ['What happened?', 'What were you doing, and what went wrong?'], idea: ['What’s your idea?', 'What would make Card Tab better for you?'], other: ['What’s on your mind?', 'Questions, thoughts, anything at all'] };
  function setKind(k) { kind = k; dlg.querySelectorAll('.fbseg [data-k]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.k === k))); $('#fb-lab').textContent = PH[k][0]; $('#fb-msg').placeholder = PH[k][1]; }
  // shrink to at most 1600px on the long side, as a JPEG, so it sends quickly
  function addShot(file) {
    if (!/^image\//.test(file.type)) return err('That isn’t a picture.');
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let q = .82, d = c.toDataURL('image/jpeg', q); while (d.length > 3.2e6 && q > .4) { q -= .12; d = c.toDataURL('image/jpeg', q); }
      shot = d; $('#fb-thumb img').src = d; $('#fb-thumb').hidden = false; $('#fb-add').hidden = true; };
    img.onerror = () => { URL.revokeObjectURL(url); err('That picture couldn’t be opened.'); };
    img.src = url;
  }
  function err(t) { const e = $('#fb-err'); e.textContent = t; e.hidden = false; }
  async function send() {
    if (busy) return; const msg = $('#fb-msg').value.trim(); if (msg.length < 2) { err('Write a few words first.'); $('#fb-msg').focus(); return; }
    busy = true; const go = $('#fb-go'); go.disabled = true; go.textContent = 'Sending…';
    try {
      const r = await fetch(API + '/auth/feedback', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, msg, page: from, ver: ver(), shot }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? 'Sign in again, then send it.' : j.error || 'It didn’t send. Check your connection and try again.');
      close(true); if (window.CTDash && window.CTDash.toast) window.CTDash.toast('Thanks! Your message was sent.');
    } catch (e) { err(e.message || 'It didn’t send. Try again.'); }
    finally { busy = false; go.disabled = false; go.textContent = 'Send'; }
  }
  function open() {
    if (!dlg) build(); from = page(); shot = null; $('#fb-msg').value = ''; $('#fb-thumb').hidden = true; $('#fb-add').hidden = false; $('#fb-err').hidden = true; setKind('bug');
    dlg.classList.remove('out'); dlg.showModal(); if (!matchMedia('(hover:none)').matches) setTimeout(() => $('#fb-msg').focus(), 60);
  }
  function close() { if (!dlg || !dlg.open) return; dlg.classList.add('out'); setTimeout(() => { dlg.close(); dlg.classList.remove('out'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200); }
  window.CTFeedback = { open };
})();
