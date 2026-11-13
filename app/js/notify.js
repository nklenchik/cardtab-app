/* Notifications (v38). Saved in each person's own account, on their device for now (synced once accounts move to Cloudflare).
   Kinds, by category:
   - Your cards ("cards"): an entry added as typed that didn't match a card (worked out from the entries themselves);
     "we found your card" (sent by the card service later); a note when a card was fixed.
   - Account and billing ("billing"): renewal coming up, card about to expire (sent by payments later).
     A failed payment ("payfail") always shows, even with notifications off, and is emailed too, plus one reminder email.
   - Monthly update ("monthly", Free only, v52.37): on the first visit of a new month, one notice with this month's free
     entries, how many new stories there are, and last month's numbers. The reset happens either way; the switch only hides it.
   - Tips and offers ("tips", Free only): close to the entry limit month after month, or tapping Premium features often.
     At most one every two weeks, and none for a month after one is dismissed.
   Every fix is a suggestion the person confirms. Nothing here ever changes an amount. */
(function () {
  // opening a window puts focus on the window itself, not its close button (no blue ring on tap)
  function calmFocus(d) { const f = d.querySelector('.ed-form, .ntf-form, form') || d; f.tabIndex = -1; f.style.outline = 'none'; try { f.focus({ preventScroll: true }); } catch (e) {} }
  'use strict';
  const S = window.CTStore; if (!S) return;
  const $ = id => document.getElementById(id);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DAY = 864e5, now = () => Date.now();
  const DEF = { all: true, cards: true, billing: true, monthly: true, tips: true, emailOff: false };
  const st = () => Object.assign({ prefs: {}, read: {}, items: [], tips: {} }, S.meta('notif') || {});
  const prefs = () => Object.assign({}, DEF, st().prefs);
  async function save(fn) { const s = st(); fn(s); await S.setMeta('notif', s); }

  const IC = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',
    renew: '<path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/>',
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.9 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    bell: '<path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 004 0"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'
  };
  const svg = (k, w) => '<svg width="' + (w || 16) + '" height="' + (w || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>';
  const ago = ts => { const d = now() - ts; if (d < 36e5) return Math.max(1, Math.round(d / 6e4)) + 'm'; if (d < DAY) return Math.round(d / 36e5) + 'h'; if (d < 7 * DAY) return Math.round(d / DAY) + 'd'; return Math.round(d / (7 * DAY)) + 'w'; };
  const short = d => new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' });

  // ---------- what's in the list ----------
  function all() {
    const s = st(), p = prefs(), out = [];
    const hid = s.hidden || {};
    S.all().filter(e => e.unmatched && !hid['um:' + e.id]).forEach(e => out.push({ id: 'um:' + e.id, kind: 'unmatched', cat: 'cards', ts: Date.parse(e.createdAt) || now(), entry: e }));
    (s.items || []).forEach(it => out.push(it));
    return out.filter(it => it.kind === 'payfail' || (p.all && p[it.cat] !== false))
      .filter(it => (it.kind !== 'tip' && it.kind !== 'monthly') || S.plan() === 'free')
      .sort((a, b) => b.ts - a.ts);
  }
  const unread = () => { const r = st().read || {}; return all().filter(it => !r[it.id] && it.kind !== 'fixed').length + ADM.length; };

  // ---------- v52.31 admin alerts: only on the admin's own account. The same list as the admin dashboard's bell, kept on the
  // server until marked done (Done here clears it there too). They count toward the dot until they're done. ----------
  let ADM = [];
  const CS = () => window.CTSession;
  const isAdm = () => { try { const c = CS(), s = c && c.get(); return !!(s && s.role === 'admin' && (c.REAL || localStorage.getItem('ct.alerts.sample') === '1')); } catch (e) { return false; } };
  const ADM_IC = { x: 'alert', g: 'renew', m: 'bell', p: 'search', c: 'card' };
  async function admLoad() {
    if (!isAdm()) { if (ADM.length) { ADM = []; paintDot(); } return; }
    const c = CS();
    if (!c.REAL) { if (!ADM.length && !admLoad.done) { const t = Math.floor(Date.now() / 1000); ADM = [{ id: 'a1', grp: 'now', kind: 'r', icon: 'x', title: 'Payments (Stripe) key works failed', sub: 'Stripe refused the key (401)', go: 'health', at: t - 720 }, { id: 'a3', grp: 'you', kind: 'b', icon: 'm', title: 'New bug report: “Can’t find Shimmering Skies”', sub: 'From a tester · Entries', go: 'feedback:s1', at: t - 86400 }]; admLoad.done = 1; } }
    else { try { const r = await fetch(c.API + '/auth/admin/alerts', { credentials: 'include' }); if (!r.ok) return; const j = await r.json(); ADM = (j.items || []).filter(a => !admGone.has(a.id)); } catch (e) { return; } }
    paintDot(); if (dlg.open && view === 'list') paint();
  }
  const admGone = new Set();
  function admHtml() {
    if (!ADM.length) return '';
    const row = a => '<div class="ntf-it new adm-it' + (a.grp === 'now' ? ' urgent' : '') + '" data-aid="' + esc(a.id) + '"><div class="ntf-t"><span class="ntf-ic">' + svg(ADM_IC[a.icon] || 'alert') + '</span><div class="ntf-tx"><b>' + esc(a.title) + '</b><p>' + esc(a.sub || '') + '</p></div><span class="ntf-when">' + ago(a.at * 1000) + '</span></div>' +
      '<div class="ntf-acts"><button type="button" class="ntf-btn p" data-act="ago" data-id="' + esc(a.id) + '">Open</button><button type="button" class="ntf-btn" data-act="adone" data-id="' + esc(a.id) + '">Done</button></div></div>';
    const n = ADM.filter(a => a.grp === 'now'), y = ADM.filter(a => a.grp !== 'now'), tag = ' <span class="adm-tag">Admin</span>';
    return (n.length ? '<div class="ntf-gl">Needs attention now' + tag + '</div>' + n.map(row).join('') : '') + (y.length ? '<div class="ntf-gl">Waiting on you' + (n.length ? '' : tag) + '</div>' + y.map(row).join('') : '');
  }
  setTimeout(admLoad, 1500); setInterval(() => { if (!document.hidden) admLoad(); }, 180000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) admLoad(); });

  // ---------- the dot and the menu count ----------
  function paintDot() {
    // the dot sits on the bell in the header (next to Ask); the menu row keeps its count
    const n = unread();
    // phones: no bell in the header; the dot sits on your profile picture and the list lives in the profile menu
    const av = $('app-avatar'); if (av) av.classList.toggle('has-ntf', n > 0);
    document.querySelectorAll('.sh-bell').forEach(bl => { bl.classList.toggle('has-ntf', n > 0); bl.setAttribute('aria-label', n ? 'Notifications, ' + n + ' new' : 'Notifications'); });
    const b = $('am-ntf-n'); if (b) { b.textContent = n; b.hidden = !n; }
  }

  // ---------- the window ----------
  const dlg = document.createElement('dialog'); dlg.className = 'ed ntf'; dlg.id = 'ntf'; dlg.setAttribute('aria-labelledby', 'ntf-h');
  dlg.innerHTML = '<div class="ed-form ntf-form"><div class="ed-head"><button type="button" class="ntf-back" aria-label="Back to notifications" hidden>‹</button><h2 id="ntf-h">Notifications</h2>' +
    '<button type="button" class="ntf-gear" aria-label="Notification settings">' + svg('gear', 17) + '</button>' +
    '<button type="button" class="ed-x" data-ntf-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="ntf-body" id="ntf-body"></div></div>';
  document.body.appendChild(dlg);
  let view = 'list';
  const GROUP = { cards: 'Your cards', billing: 'Account and billing', monthly: 'Your month', tips: 'Tips and offers' };

  function itemHtml(it, read) {
    const nw = read ? '' : ' new', act = (a, label, p) => '<button type="button" class="ntf-btn' + (p ? ' p' : '') + '" data-act="' + a + '" data-id="' + esc(it.id) + '">' + label + '</button>';
    let ic = 'bell', t = '', p = '', acts = '';
    if (it.kind === 'unmatched') { const e = it.entry; ic = 'alert'; t = 'This card wasn’t matched'; p = '<span class="ntf-typo">' + esc(e.name) + '</span>, added as typed on ' + short(e.date) + '. Pick the right card to add its art.'; acts = act('fix', 'Fix it', 1) + act('leave', 'Leave as is'); }
    else if (it.kind === 'found') { ic = 'search'; t = 'We found your card'; p = '“' + esc(it.typed) + '” is ' + esc(it.card) + '.'; acts = act('found', 'Update entry', 1) + act('dismiss', 'Not mine'); }
    else if (it.kind === 'fixed') { ic = 'check'; t = 'Fixed: ' + esc(it.card); p = 'Your entry has its card now. The amount didn’t change.'; }
    else if (it.kind === 'cardexp') { ic = 'card'; t = 'Your card expires soon'; p = 'The card ending ' + esc(it.last4 || '••••') + ' runs out ' + esc(it.when || 'next month') + '. Update it to keep Premium.'; acts = act('billing', 'Update card', 1); }
    else if (it.kind === 'renew') { ic = 'renew'; t = 'Premium renews ' + esc(it.when || 'soon'); p = 'Nothing to do. Change or cancel anytime in Plan and billing.'; }
    else if (it.kind === 'payfail') { ic = 'alert'; t = 'Your payment didn’t go through'; p = 'Update your card to keep Premium. We’ve emailed you too.'; acts = act('billing', 'Update card', 1); }
    else if (it.kind === 'admin') { ic = 'star'; t = esc(it.title); p = esc(it.body); }   // v52.10: from Card Tab (a gift, extras, a reset)
    else if (it.kind === 'monthly') { ic = 'cal'; t = esc(it.title); p = esc(it.body); acts = (it.stories ? act('stories', 'See Stories', 1) : '') + act('dismiss', 'Got it'); }
    else if (it.kind === 'tip') { ic = 'star'; t = esc(it.title); p = esc(it.body); acts = act('premium', 'See Premium', 1) + act('notnow', 'Not now'); }
    return '<div class="ntf-it' + nw + (it.kind === 'payfail' ? ' urgent' : '') + '" data-nid="' + esc(it.id) + '"><div class="ntf-t"><span class="ntf-ic">' + svg(ic) + '</span><div class="ntf-tx"><b>' + t + '</b><p>' + p + '</p></div><span class="ntf-when">' + ago(it.ts) + '</span>' + (it.kind === 'payfail' ? '' : '<button type="button" class="ntf-x" data-act="x" data-id="' + esc(it.id) + '" aria-label="Dismiss">' + svg('x', 13) + '</button>') + '</div>' + (acts ? '<div class="ntf-acts">' + acts + '</div>' : '') + '</div>';
  }
  function renderList() {
    const list = all(), r = st().read || {}, p = prefs();
    if (!list.length && ADM.length) return admHtml();
    if (!list.length) return '<div class="ntf-empty">' + svg('bell', 26) + '<b>You’re all caught up</b><p>' + (p.all ? 'Cards that need a look and account news show up here.' : 'Notifications are off. Payment problems still show here.') + '</p></div>';
    const by = {}; list.forEach(it => { const g = it.kind === 'payfail' ? 'billing' : it.cat; (by[g] = by[g] || []).push(it); });
    const n = list.filter(it => it.kind !== 'payfail').length;
    return admHtml() + ['billing', 'monthly', 'cards', 'tips'].filter(g => by[g]).map(g => '<div class="ntf-gl">' + GROUP[g] + '</div>' + by[g].map(it => itemHtml(it, r[it.id])).join('')).join('') +
      (n > 1 ? '<button type="button" class="ntf-clear" data-act="clearall">Clear all</button>' : '');
  }
  const sw = (k, on, label, sub, dis) => '<div class="ntf-sr"><div><b>' + label + '</b><span>' + sub + '</span></div><button type="button" class="swt" role="switch" data-pref="' + k + '" aria-checked="' + on + '" aria-label="' + label + '"' + (dis ? ' disabled' : '') + '><i></i></button></div>';
  function renderSettings() {
    const p = prefs(), off = !p.all;
    return '<div class="ntf-set">' + sw('all', p.all, 'All notifications', 'Turn off to get nothing at all') + '</div>' +
      '<div class="ntf-set' + (off ? ' dim' : '') + '">' +
      sw('cards', p.cards, 'Your cards', 'Cards that weren’t matched, and matches we find later', off) +
      sw('billing', p.billing, 'Account and billing', 'Renewals and cards about to expire', off) +
      (S.plan() === 'free' ? sw('monthly', p.monthly, 'Monthly update', 'Your new entries, new stories and last month’s numbers', off) : '') +
      sw('tips', p.tips, 'Tips and offers', 'Now and then, at most every two weeks', off) + '</div>' +
      '<p class="ntf-fine">A failed payment always shows here, so Premium never ends without you knowing.</p>' +
      '<div class="ntf-gl" id="ntf-email">Email</div><div class="ntf-set">' + sw('emailOn', !p.emailOff, 'Tips and summaries', 'A few emails in your first weeks, with tips and your numbers') + '</div>' +
      '<p class="ntf-fine">Sign-in links and anything about payments always come by email.</p>';
  }
  // Your platforms (opened from the profile menu): the ones you added yourself, to add more or remove a typo
  function renderPlats() {
    const mine = S.customPlatforms(), used = new Set(S.platforms());
    return '<p class="ntf-lede">Platforms you add show up in Add New and the full form, after the standard ones like eBay and TCGplayer.</p>' +
      '<form class="ntf-addp" id="ntf-addp"><input id="ntf-pin" maxlength="40" autocomplete="off" placeholder="Add a platform, like a local shop" aria-label="New platform name" enterkeyhint="done"><button type="submit" class="ntf-btn p">Add</button></form>' +
      (mine.length ? '<div class="ntf-set">' + mine.map(p => '<div class="ntf-sr"><div><b>' + esc(p) + '</b><span>' + (used.has(p) ? 'Used in your entries' : 'Not used yet') + '</span></div><button type="button" class="ntf-btn" data-rmp="' + esc(p) + '">Remove</button></div>').join('') + '</div>'
        : '<p class="ntf-fine">No platforms of your own yet.</p>') +
      '<p class="ntf-fine">Removing one takes it off the list. Entries that already use it keep it.</p>';
  }
  function paint() {
    dlg.querySelector('#ntf-h').textContent = view === 'settings' ? 'Notification settings' : view === 'plats' ? 'Your platforms' : 'Notifications';
    dlg.querySelector('.ntf-back').hidden = view !== 'settings'; dlg.querySelector('.ntf-gear').hidden = view !== 'list';
    $('ntf-body').innerHTML = view === 'settings' ? renderSettings() : view === 'plats' ? renderPlats() : renderList();
  }
  async function open(v) {
    view = v === 'settings' || v === 'plats' ? v : 'list'; paint(); dlg.showModal(); { const f = dlg.querySelector('.ntf-form'); if (f) { f.tabIndex = -1; f.focus({ preventScroll: true }); } }
    // opening the list counts as seeing what's there: the dot clears, the "new" marks stay until next time
    if (view === 'list') admLoad();
    if (view === 'list') { const ids = all().map(it => it.id); await save(s => { s.read = s.read || {}; ids.forEach(id => { s.read[id] = 1; }); }); }
  }
  function close() { if (dlg.open) dlg.close(); }
  // dismissing: a notification slides away (transform and opacity only), then the list repaints without it.
  // Cards that weren't matched stay unmatched on the entry; they just leave this list.
  async function forget(its) {
    await save(s => { const ids = new Set(its.map(x => x.id)); s.items = (s.items || []).filter(x => !ids.has(x.id)); s.hidden = s.hidden || {};
      its.forEach(x => { if (x.kind === 'unmatched') s.hidden[x.id] = 1; if (x.kind === 'tip') s.tips = Object.assign({}, s.tips, { dismissed: now() }); }); });
  }
  function dismissOut(els, its) {
    els = [].concat(els).filter(Boolean); const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.forEach((el, i) => { el.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1) ' + (i * 30) + 'ms, opacity .22s ease ' + (i * 30) + 'ms'; el.style.transform = calm ? '' : 'translateX(' + (el.dataset.sx === '-1' ? '-' : '') + '110%)'; el.style.opacity = '0'; });
    return new Promise(r => setTimeout(async () => { await forget(its); paint(); r(); }, calm ? 120 : 260 + Math.min(els.length, 8) * 30));
  }
  // touch: swipe a notification sideways to dismiss it
  (function swipe() {
    let d = null;
    dlg.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.target.closest('button,a,input')) return; const el = e.target.closest('.ntf-it'); if (!el || el.classList.contains('urgent')) return; d = { el, x: e.clientX, y: e.clientY, dx: 0, on: false }; });
    dlg.addEventListener('pointermove', e => { if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.on) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { d = null; return; } if (Math.abs(dx) < 10) return; d.on = true; d.el.style.transition = 'none'; }
      d.dx = dx; d.el.style.transform = 'translateX(' + dx + 'px)'; d.el.style.opacity = String(Math.max(.25, 1 - Math.abs(dx) / 320)); });
    const end = () => { if (!d) return; const { el, dx, on } = d; d = null; if (!on) return;
      if (Math.abs(dx) > Math.min(110, el.offsetWidth * .3)) { el.dataset.sx = dx < 0 ? '-1' : '1'; const it = all().find(x => x.id === el.dataset.nid); if (it) { window.ctBuzz && window.ctBuzz(); dismissOut(el, [it]); return; } }
      el.style.transition = 'transform .3s cubic-bezier(.2,.8,.2,1), opacity .3s'; el.style.transform = ''; el.style.opacity = ''; };
    dlg.addEventListener('pointerup', end); dlg.addEventListener('pointercancel', end);
  })();
  dlg.addEventListener('click', async e => {
    if (e.target === dlg || e.target.closest('[data-ntf-close]')) { close(); return; }
    if (e.target.closest('.ntf-gear')) { view = 'settings'; paint(); return; }
    if (e.target.closest('.ntf-back')) { view = 'list'; paint(); return; }
    const rmp = e.target.closest('[data-rmp]'); if (rmp) { await S.removePlatform(rmp.dataset.rmp); paint(); return; }
    const t = e.target.closest('[data-pref]');
    if (t && !t.disabled) { let k = t.dataset.pref, v = t.getAttribute('aria-checked') !== 'true'; if (k === 'emailOn') { k = 'emailOff'; v = !v; } /* v52.51: shown as on = get emails, saved as emailOff */ window.ctBuzz && window.ctBuzz(); await save(s => { s.prefs = Object.assign({}, DEF, s.prefs, { [k]: v }, k === 'emailOff' && !v ? { emailOnAt: Math.floor(Date.now() / 1000) } : {}); }); paint(); return; }   // v52.62 emailOnAt: when you turned emails back on yourself
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act, it = all().find(x => x.id === id);
    if (act === 'adone') { const el = b.closest('.ntf-it'); admGone.add(id); el.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1), opacity .22s ease'; el.style.transform = 'translateX(110%)'; el.style.opacity = '0';
      setTimeout(() => { ADM = ADM.filter(a => a.id !== id); paint(); paintDot(); }, 260);
      const c = CS(); if (c && c.REAL) { try { await fetch(c.API + '/auth/admin/alerts/done', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); } catch (er) {} }
      return; }
    if (act === 'ago') { close(); window.open('/admin.html#al=' + encodeURIComponent(id), '_blank', 'noopener'); return; }
    if (act === 'x' && it) { window.ctBuzz && window.ctBuzz(); await dismissOut(b.closest('.ntf-it'), [it]); return; }
    if (act === 'clearall') { const its = all().filter(x => x.kind !== 'payfail'); await dismissOut([...dlg.querySelectorAll('.ntf-it:not(.urgent)')], its); return; }
    if (act === 'fix' && it) { close(); setTimeout(() => fix.open(it.entry), 280); return; }
    if (act === 'leave' && it) { await S.matchCard(it.entry.id, null); toast('Kept as typed', true); paint(); return; }
    if (act === 'dismiss') { await save(s => { s.items = (s.items || []).filter(x => x.id !== id); }); paint(); return; }
    if (act === 'found' && it) { const e2 = S.get(it.entryId); if (e2) { await S.matchCard(e2.id, { name: it.card }); } await save(s => { s.items = (s.items || []).filter(x => x.id !== id); }); toast('Entry updated. The amount didn’t change.', true); paint(); return; }
    if (act === 'notnow') { await save(s => { s.items = (s.items || []).filter(x => x.id !== id); s.tips = Object.assign({}, s.tips, { dismissed: now() }); }); paint(); return; }
    if (act === 'stories') { await save(s => { s.items = (s.items || []).filter(x => x.id !== id); }); close(); setTimeout(() => { const t = [...document.querySelectorAll('.ct-tbar button, .ct-tabs button')].find(x => x.offsetParent && /stories/i.test(x.textContent)); if (t) t.click(); }, 280); return; }
    if (act === 'premium') { close(); window.CTDash && window.CTDash.upgradeNote(); return; }
    if (act === 'billing') { close(); if (window.CTBilling) window.CTBilling.portal(); return; }
  });
  dlg.addEventListener('submit', async e => { if (e.target.id !== 'ntf-addp') return; e.preventDefault(); const v = $('ntf-pin').value.trim(); if (!v) return;
    const n = await S.addPlatform(v); paint(); const i = $('ntf-pin'); if (i) i.focus(); if (n && n !== v && window.CTDash) window.CTDash.toast(n + ' is already in the list'); });
  const toast = (t, undo) => window.CTDash && window.CTDash.toast(t, undo ? { undo: true } : undefined);

  // ---------- fixing an unmatched card: pick the right printing; only the name and art change ----------
  const fix = (function () {
    const d = document.createElement('dialog'); d.className = 'ed ntf'; d.id = 'fix'; d.setAttribute('aria-labelledby', 'fix-h');
    d.innerHTML = '<div class="ed-form ntf-form"><div class="ed-head"><h2 id="fix-h">Match your card</h2><button type="button" class="ed-x" data-fix-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<p class="ntf-lede" id="fix-lede"></p><label class="ntf-search">' + svg('search', 17) + '<input id="fix-q" type="search" autocomplete="off" enterkeyhint="search" aria-label="Search for the card"></label><div id="fix-res" class="ntf-res"></div><button type="button" class="fix-up" id="fix-up"><i aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></i><span><b>Upload your own photo</b><small>Snap or pick a photo of your card</small></span></button><button type="button" class="fix-none" id="fix-none" hidden>No card art for this one</button></div>';
    document.body.appendChild(d);
    let entry = null, list = [], mode = 'fix', qt = 0, tok = 0;
    const listName = c => [c.n, c.num, c.s].filter(Boolean).join(' - ');
    // the card's picture over the cranberry placeholder, so a picture that can't load still shows the placeholder
    const PH = 'linear-gradient(150deg,#d9577a,#a50e37 55%,#6e0723)';
    // (single quotes inside: this goes into a style="..." attribute, where a double quote would cut it off)
    const artBg = c => (c.art && c.art.list ? "center/cover no-repeat url('" + String(c.art.list).replace(/['"()\\\s]/g, encodeURIComponent) + "'), " : '') + PH;
    function search() {
      const q = $('fix-q').value.trim(), p = window.CardParser ? window.CardParser.parse(q) : { name: q };
      // the real card search when it's switched on (app.cardtab.app), otherwise the built-in catalog
      if (window.CARDTAB_API && q) {
        const my = ++tok; clearTimeout(qt); $('fix-res').innerHTML = '<p class="ntf-fine">Looking it up…</p>';
        qt = setTimeout(() => window.CardLookup.remote(p).then(r => { if (my !== tok) return; paint(q, r, p); }), 320); return;
      }
      paint(q, window.CardLookup.search(p), p);
    }
    function paint(q, r, p) {
      list = r.list.length ? r.list : window.CardLookup.suggest(p);
      $('fix-res').innerHTML = !q ? '' : list.length ? (r.list.length ? '' : '<div class="ntf-gl">Did you mean</div>') + '<div class="ntf-lst">' + list.map((c, i) => '<button type="button" class="ntf-li" data-i="' + i + '"><span class="ntf-art" style="background:' + artBg(c) + '"></span><span><b>' + esc(c.n) + '</b><small>' + esc([c.num, c.s].filter(Boolean).join(' · ')) + '</small></span></button>').join('') + '</div>'
        : '<p class="ntf-fine">No match yet. Try the card number, or leave it as typed. We’ll keep looking once card search goes live.</p>';
    }
    $('fix-q').addEventListener('input', search);
    d.addEventListener('click', async e => {
      if (e.target === d || e.target.closest('[data-fix-close]')) { d.close(); return; }
      const li = e.target.closest('.ntf-li'); if (!li || !entry) return;
      const c = list[+li.dataset.i], nm = listName(c);
      if (mode === 'card') {   // keep the entry as typed; only the card (and its art) changes, and the pick is remembered
        await S._artPatch(entry.id, { art: c.art ? { list: c.art.list, detail: c.art.detail } : null, artFrom: 'pick', cardId: c.id, cardName: nm, artV2: 1 });
        if (window.CTArtFill) window.CTArtFill.learn(entry);
        d.close(); toast('Card changed to ' + c.n + (c.num ? ' · ' + c.num : '') + '.', true); return;
      }
      await S.matchCard(entry.id, { name: nm, art: c.art || null, artFrom: 'pick', cardId: c.id, artV2: 1 });
      await save(s => { s.items = (s.items || []).concat([{ id: 'fx:' + entry.id + ':' + now(), kind: 'fixed', cat: 'cards', ts: now(), card: [c.n, c.num].filter(Boolean).join(' · ') }]).slice(-40); s.read = Object.assign({}, s.read); });
      d.close(); toast('Fixed: ' + c.n + '. The amount didn’t change.', true);
    });
    // v50.46: no picture, or the wrong one: use your own photo of the card
    $('fix-up').addEventListener('click', () => { if (!entry || !window.CTArtUpload) return; window.CTArtUpload.open(entry, () => { if (d.open) d.close(); }); });
    $('fix-none').addEventListener('click', async () => { if (!entry) return; await S._artPatch(entry.id, { art: null, artFrom: 'none', artV2: 1 }); if (window.CTArtFill) window.CTArtFill.learn(entry); d.close(); toast('No card art for this entry.', true); });
    return {
      open(e) { mode = 'fix'; entry = e; $('fix-h').textContent = 'Match your card'; $('fix-none').hidden = true; $('fix-lede').innerHTML = 'You typed <b>“' + esc(e.name) + '”</b>. Pick the right card and we’ll add its name and art. Amounts stay the same.'; $('fix-q').value = e.name; search(); d.showModal(); calmFocus(d); },
      change(e) { mode = 'card'; entry = e; $('fix-h').textContent = 'Change card'; $('fix-none').hidden = false; $('fix-lede').innerHTML = 'Pick the printing that matches <b>“' + esc(e.name) + '”</b>. Your entry stays as you typed it; only the card and its art change. Entries with the same name will use your pick too.'; $('fix-q').value = (e.source || e.name); search(); d.showModal(); calmFocus(d); }
    };
  })();

  // ---------- Free tips: patterns, capped ----------
  async function premiumTap() { await save(s => { s.tips = Object.assign({}, s.tips); s.tips.taps = (s.tips.taps || []).filter(t => now() - t < 30 * DAY).concat([now()]); }); }
  function monthCount(k) { return S.all().filter(e => e.counted !== false && String(e.createdAt).slice(0, 7) === k).length; }
  let checking = false;
  async function checkTips() {
    if (checking || S.plan() !== 'free') return; const s = st(), p = prefs(); if (!p.all || !p.tips) return;
    const tp = s.tips || {}, last = Math.max(tp.last || 0, (tp.dismissed || 0) + 16 * DAY);
    if (now() - last < 14 * DAY) return;
    const d = new Date(), keys = [0, 1, 2].map(i => { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); });
    const near = keys.filter(k => (k === keys[0] ? S.usage().used : monthCount(k)) >= S.WARN_AT).length;
    let tip = null;
    if (near >= 2) tip = { title: 'You’ve been close to your 20 free entries ' + (near === 3 ? 'three months running' : 'more than once lately'), body: 'Premium has no monthly limit, plus every date range on Card Board and Stories.' };
    else if ((tp.taps || []).filter(t => now() - t < 30 * DAY).length >= 5) tip = { title: 'Looking at Premium features?', body: 'Premium unlocks Import, every Board period and Card Stories. Try it when it opens at launch.' };
    if (!tip) return;
    checking = true;
    await save(x => { x.tips = Object.assign({}, x.tips, { last: now(), taps: [] }); x.items = (x.items || []).filter(i => i.kind !== 'tip').concat([Object.assign({ id: 'tip:' + now(), kind: 'tip', cat: 'tips', ts: now() }, tip)]); });
    checking = false;
  }

  // ---------- v52.37 Free: the monthly update ----------
  // Once a month, on the first visit of a new month. The first month someone is seen (just signed up, or this version is
  // new to them) only remembers the month, so nobody gets a notice about a month they never had.
  const ymOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  // how many stories rotate in this month: the same pick Stories makes (board.js rotMode/rotSeed), 3 or 2 of the 4 free ones
  function newStories() {
    try {
      const ss = window.CTSession && window.CTSession.current(), em = (ss && ss.email) || '', base = [...em].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
      const d = new Date(), m = d.getFullYear() * 12 + d.getMonth() + 1;
      let x = (base ^ Math.imul(m, 2654435761)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489917) >>> 0; x ^= x >>> 16;
      return (x >>> 0) % 2 === 1 ? 2 : 3;
    } catch (e) { return 0; }
  }
  let mChecking = false;
  async function checkMonthly(force) {
    if (mChecking || S.plan() !== 'free') return;
    if (!force && performance.now() < 5000) { clearTimeout(checkMonthly.t); checkMonthly.t = setTimeout(checkMonthly, 5200 - performance.now()); return; }   // after the start-up sync, so extra entries from Card Tab are counted
    const s = st(), key = ymOf(new Date());
    if (!force && s.month === key) return;
    mChecking = true;
    try {
      if (!force && !s.month) { await save(x => { x.month = key; }); return; }
      const p = prefs(), d = new Date(), prev = new Date(d.getFullYear(), d.getMonth() - 1, 1), pk = ymOf(prev), pname = prev.toLocaleString('en-US', { month: 'long' }), name = d.toLocaleString('en-US', { month: 'long' });
      const L = S.usage().limit, ns = newStories(), last = S.all().filter(e => String(e.date).slice(0, 7) === pk), t = S.totals(last);
      const money = c => (c < 0 ? '−' : '+') + '$' + Math.round(Math.abs(c) / 100).toLocaleString('en-US');
      const bits = ['Your free entries are back to ' + L + (ns ? ', and there are ' + ns + ' new stories to try.' : '.')];
      if (last.length) bits.push('In ' + pname + ' you added ' + last.length + (last.length === 1 ? ' entry' : ' entries') + ' and made ' + money(t.profit) + '.');
      await save(x => { x.month = key; if (!(p.all && p.monthly)) return;
        x.items = (x.items || []).filter(i => i.kind !== 'monthly').concat([{ id: 'mon:' + key, kind: 'monthly', cat: 'monthly', ts: now(), title: name + ' is here: ' + L + ' new entries', body: bits.join(' '), stories: ns > 0 }]);
        if (x.read) delete x.read['mon:' + key]; });
    } finally { mChecking = false; }
  }

  // ---------- testing tools: sample notices (payments and the card service send these for real later) ----------
  async function demo() {
    const um = S.all().find(e => e.unmatched), t = now(), d = new Date(t + 27 * DAY);
    await save(s => {
      s.items = (s.items || []).filter(i => !/^demo:/.test(i.id)).concat([
        { id: 'demo:renew', kind: 'renew', cat: 'billing', ts: t - 6 * DAY, when: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }) },
        { id: 'demo:exp', kind: 'cardexp', cat: 'billing', ts: t - 3 * DAY, last4: '4242', when: 'next month' },
        { id: 'demo:fail', kind: 'payfail', cat: 'billing', ts: t - 60 * 6e4 },
        { id: 'demo:mon', kind: 'monthly', cat: 'monthly', ts: t - 2 * 6e4, title: new Date().toLocaleString('en-US', { month: 'long' }) + ' is here: 20 new entries', body: 'Your free entries are back to 20, and there are 3 new stories to try. Last month you added 18 entries and made +$412.', stories: true },
        { id: 'demo:tip', kind: 'tip', cat: 'tips', ts: t - 5 * 36e5, title: 'You’ve been close to your 20 free entries three months running', body: 'Premium has no monthly limit, plus every date range on Card Board and Stories.' }
      ].concat(um ? [{ id: 'demo:found', kind: 'found', cat: 'cards', ts: t - 2 * 36e5, entryId: um.id, typed: um.name, card: 'Charizard ex - 199/165 - SV: Scarlet & Violet 151' }] : []));
      s.read = {};
    });
  }
  async function clearDemo() { await save(s => { s.items = []; s.read = {}; s.tips = {}; }); }

  S.on(() => { paintDot(); if (dlg.open) paint(); checkTips(); checkMonthly(); }, true);
  paintDot(); checkMonthly();
  // v52.10 messages from Card Tab: when an admin gives Premium, extra entries or Ask questions, or resets something,
  // the server keeps a message; the app picks new ones up on start and when you come back to it (at most every 5 minutes)
  let pulling = false, pulledAt = 0;
  async function pull(force) {
    const Sess = window.CTSession; if (!Sess || !Sess.REAL || !Sess.current() || pulling) return;
    if (!force && now() - pulledAt < 5 * 6e4) return;
    pulling = true; pulledAt = now();
    try {
      const j = await Sess.api('/auth/notes', {}), notes = (j && j.notes) || [];
      if (notes.length) {
        await save(s => { const have = new Set((s.items || []).map(x => x.id)); s.items = (s.items || []).concat(notes.filter(n => !have.has('adm:' + n.id)).map(n => ({ id: 'adm:' + n.id, kind: 'admin', cat: 'billing', ts: (n.at || 0) * 1000 || now(), title: n.title, body: n.body || '' }))); });
        paintDot();
        if (window.CTDash && window.CTDash.toast) window.CTDash.toast(notes.length > 1 ? notes.length + ' new notifications from Card Tab' : notes[0].title);
        if (window.CTRecheck) window.CTRecheck();   // a gift changes the plan: ask the server again
      }
    } catch (e) { /* try again next time */ }
    pulling = false;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
  window.CTNotify = { open, close, unread, premiumTap, demo, clearDemo, paintDot, pull, monthly: () => checkMonthly(true), fix: e => fix.open(e), change: e => fix.change(e) };
})();
