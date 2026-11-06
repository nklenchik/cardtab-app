/* Notifications (v38). Saved in each person's own account, on their device for now (synced once accounts move to Cloudflare).
   Kinds, by category:
   - Your cards ("cards"): an entry added as typed that didn't match a card (worked out from the entries themselves);
     "we found your card" (sent by the card service later); a note when a card was fixed.
   - Account and billing ("billing"): renewal coming up, card about to expire (sent by payments later).
     A failed payment ("payfail") always shows, even with notifications off, and is emailed too, plus one reminder email.
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
  const DEF = { all: true, cards: true, billing: true, tips: true, emailOff: false };
  const st = () => Object.assign({ prefs: {}, read: {}, items: [], tips: {} }, S.meta('notif') || {});
  const prefs = () => Object.assign({}, DEF, st().prefs);
  async function save(fn) { const s = st(); fn(s); await S.setMeta('notif', s); }

  const IC = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',
    renew: '<path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/>',
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.9 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    bell: '<path d="M6 9a6 6 0 1112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 004 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'
  };
  const svg = (k, w) => '<svg width="' + (w || 16) + '" height="' + (w || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>';
  const ago = ts => { const d = now() - ts; if (d < 36e5) return Math.max(1, Math.round(d / 6e4)) + 'm'; if (d < DAY) return Math.round(d / 36e5) + 'h'; if (d < 7 * DAY) return Math.round(d / DAY) + 'd'; return Math.round(d / (7 * DAY)) + 'w'; };
  const short = d => new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' });

  // ---------- what's in the list ----------
  function all() {
    const s = st(), p = prefs(), out = [];
    S.all().filter(e => e.unmatched).forEach(e => out.push({ id: 'um:' + e.id, kind: 'unmatched', cat: 'cards', ts: Date.parse(e.createdAt) || now(), entry: e }));
    (s.items || []).forEach(it => out.push(it));
    return out.filter(it => it.kind === 'payfail' || (p.all && p[it.cat] !== false))
      .filter(it => it.kind !== 'tip' || S.plan() === 'free')
      .sort((a, b) => b.ts - a.ts);
  }
  const unread = () => { const r = st().read || {}; return all().filter(it => !r[it.id] && it.kind !== 'fixed').length; };

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
  const GROUP = { cards: 'Your cards', billing: 'Account and billing', tips: 'Tips and offers' };

  function itemHtml(it, read) {
    const nw = read ? '' : ' new', act = (a, label, p) => '<button type="button" class="ntf-btn' + (p ? ' p' : '') + '" data-act="' + a + '" data-id="' + esc(it.id) + '">' + label + '</button>';
    let ic = 'bell', t = '', p = '', acts = '';
    if (it.kind === 'unmatched') { const e = it.entry; ic = 'alert'; t = 'This card wasn’t matched'; p = '<span class="ntf-typo">' + esc(e.name) + '</span>, added as typed on ' + short(e.date) + '. Pick the right card to add its art.'; acts = act('fix', 'Fix it', 1) + act('leave', 'Leave as is'); }
    else if (it.kind === 'found') { ic = 'search'; t = 'We found your card'; p = '“' + esc(it.typed) + '” is ' + esc(it.card) + '.'; acts = act('found', 'Update entry', 1) + act('dismiss', 'Not mine'); }
    else if (it.kind === 'fixed') { ic = 'check'; t = 'Fixed: ' + esc(it.card); p = 'Your entry has its card now. The amount didn’t change.'; }
    else if (it.kind === 'cardexp') { ic = 'card'; t = 'Your card expires soon'; p = 'The card ending ' + esc(it.last4 || '••••') + ' runs out ' + esc(it.when || 'next month') + '. Update it to keep Premium.'; acts = act('billing', 'Update card', 1); }
    else if (it.kind === 'renew') { ic = 'renew'; t = 'Premium renews ' + esc(it.when || 'soon'); p = 'Nothing to do. Change or cancel anytime in Plan and billing.'; }
    else if (it.kind === 'payfail') { ic = 'alert'; t = 'Your payment didn’t go through'; p = 'Update your card to keep Premium. We’ve emailed you too.'; acts = act('billing', 'Update card', 1); }
    else if (it.kind === 'tip') { ic = 'star'; t = esc(it.title); p = esc(it.body); acts = act('premium', 'See Premium', 1) + act('notnow', 'Not now'); }
    return '<div class="ntf-it' + nw + (it.kind === 'payfail' ? ' urgent' : '') + '"><div class="ntf-t"><span class="ntf-ic">' + svg(ic) + '</span><div class="ntf-tx"><b>' + t + '</b><p>' + p + '</p></div><span class="ntf-when">' + ago(it.ts) + '</span></div>' + (acts ? '<div class="ntf-acts">' + acts + '</div>' : '') + '</div>';
  }
  function renderList() {
    const list = all(), r = st().read || {}, p = prefs();
    if (!list.length) return '<div class="ntf-empty">' + svg('bell', 26) + '<b>You’re all caught up</b><p>' + (p.all ? 'Cards that need a look and account news show up here.' : 'Notifications are off. Payment problems still show here.') + '</p></div>';
    const by = {}; list.forEach(it => { const g = it.kind === 'payfail' ? 'billing' : it.cat; (by[g] = by[g] || []).push(it); });
    return ['billing', 'cards', 'tips'].filter(g => by[g]).map(g => '<div class="ntf-gl">' + GROUP[g] + '</div>' + by[g].map(it => itemHtml(it, r[it.id])).join('')).join('');
  }
  const sw = (k, on, label, sub, dis) => '<div class="ntf-sr"><div><b>' + label + '</b><span>' + sub + '</span></div><button type="button" class="swt" role="switch" data-pref="' + k + '" aria-checked="' + on + '" aria-label="' + label + '"' + (dis ? ' disabled' : '') + '><i></i></button></div>';
  function renderSettings() {
    const p = prefs(), off = !p.all;
    return '<div class="ntf-set">' + sw('all', p.all, 'All notifications', 'Turn off to get nothing at all') + '</div>' +
      '<div class="ntf-set' + (off ? ' dim' : '') + '">' +
      sw('cards', p.cards, 'Your cards', 'Cards that weren’t matched, and matches we find later', off) +
      sw('billing', p.billing, 'Account and billing', 'Renewals and cards about to expire', off) +
      sw('tips', p.tips, 'Tips and offers', 'Now and then, at most every two weeks', off) + '</div>' +
      '<p class="ntf-fine">A failed payment always shows here, so Premium never ends without you knowing.</p>' +
      '<div class="ntf-gl">Email</div><div class="ntf-set">' + sw('emailOff', p.emailOff, 'Unsubscribe from all emails', 'No tips, news or reminders by email') + '</div>' +
      '<p class="ntf-fine">You’ll still get an email if a payment fails, plus one reminder. Emails start once accounts go live.</p>';
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
    if (view === 'list') { const ids = all().map(it => it.id); await save(s => { s.read = s.read || {}; ids.forEach(id => { s.read[id] = 1; }); }); }
  }
  function close() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('click', async e => {
    if (e.target === dlg || e.target.closest('[data-ntf-close]')) { close(); return; }
    if (e.target.closest('.ntf-gear')) { view = 'settings'; paint(); return; }
    if (e.target.closest('.ntf-back')) { view = 'list'; paint(); return; }
    const rmp = e.target.closest('[data-rmp]'); if (rmp) { await S.removePlatform(rmp.dataset.rmp); paint(); return; }
    const t = e.target.closest('[data-pref]');
    if (t && !t.disabled) { const k = t.dataset.pref, v = t.getAttribute('aria-checked') !== 'true'; window.ctBuzz && window.ctBuzz(); await save(s => { s.prefs = Object.assign({}, DEF, s.prefs, { [k]: v }); }); paint(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act, it = all().find(x => x.id === id);
    if (act === 'fix' && it) { close(); setTimeout(() => fix.open(it.entry), 280); return; }
    if (act === 'leave' && it) { await S.matchCard(it.entry.id, null); toast('Kept as typed', true); paint(); return; }
    if (act === 'dismiss') { await save(s => { s.items = (s.items || []).filter(x => x.id !== id); }); paint(); return; }
    if (act === 'found' && it) { const e2 = S.get(it.entryId); if (e2) { await S.matchCard(e2.id, { name: it.card }); } await save(s => { s.items = (s.items || []).filter(x => x.id !== id); }); toast('Entry updated. The amount didn’t change.', true); paint(); return; }
    if (act === 'notnow') { await save(s => { s.items = (s.items || []).filter(x => x.id !== id); s.tips = Object.assign({}, s.tips, { dismissed: now() }); }); paint(); return; }
    if (act === 'premium') { close(); window.CTDash && window.CTDash.upgradeNote(); return; }
    if (act === 'billing') { close(); window.CTDash && window.CTDash.toast('Plan and billing arrives with payments.'); return; }
  });
  dlg.addEventListener('submit', async e => { if (e.target.id !== 'ntf-addp') return; e.preventDefault(); const v = $('ntf-pin').value.trim(); if (!v) return;
    const n = await S.addPlatform(v); paint(); const i = $('ntf-pin'); if (i) i.focus(); if (n && n !== v && window.CTDash) window.CTDash.toast(n + ' is already in the list'); });
  const toast = (t, undo) => window.CTDash && window.CTDash.toast(t, undo ? { undo: true } : undefined);

  // ---------- fixing an unmatched card: pick the right printing; only the name and art change ----------
  const fix = (function () {
    const d = document.createElement('dialog'); d.className = 'ed ntf'; d.id = 'fix'; d.setAttribute('aria-labelledby', 'fix-h');
    d.innerHTML = '<div class="ed-form ntf-form"><div class="ed-head"><h2 id="fix-h">Match your card</h2><button type="button" class="ed-x" data-fix-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<p class="ntf-lede" id="fix-lede"></p><label class="ntf-search">' + svg('search', 17) + '<input id="fix-q" type="search" autocomplete="off" enterkeyhint="search" aria-label="Search for the card"></label><div id="fix-res" class="ntf-res"></div><button type="button" class="fix-none" id="fix-none" hidden>No card art for this one</button></div>';
    document.body.appendChild(d);
    let entry = null, list = [], mode = 'fix', qt = 0, tok = 0;
    const listName = c => [c.n, c.num, c.s].filter(Boolean).join(' - ');
    const artBg = c => c.art && c.art.list ? 'center/cover no-repeat url("' + c.art.list + '")' : 'linear-gradient(150deg,hsl(' + (c.h || 210) + ',62%,62%),hsl(' + (((c.h || 210) + 40) % 360) + ',55%,38%))';
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

  // ---------- testing tools: sample notices (payments and the card service send these for real later) ----------
  async function demo() {
    const um = S.all().find(e => e.unmatched), t = now(), d = new Date(t + 27 * DAY);
    await save(s => {
      s.items = (s.items || []).filter(i => !/^demo:/.test(i.id)).concat([
        { id: 'demo:renew', kind: 'renew', cat: 'billing', ts: t - 6 * DAY, when: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }) },
        { id: 'demo:exp', kind: 'cardexp', cat: 'billing', ts: t - 3 * DAY, last4: '4242', when: 'next month' },
        { id: 'demo:fail', kind: 'payfail', cat: 'billing', ts: t - 60 * 6e4 },
        { id: 'demo:tip', kind: 'tip', cat: 'tips', ts: t - 5 * 36e5, title: 'You’ve been close to your 20 free entries three months running', body: 'Premium has no monthly limit, plus every date range on Card Board and Stories.' }
      ].concat(um ? [{ id: 'demo:found', kind: 'found', cat: 'cards', ts: t - 2 * 36e5, entryId: um.id, typed: um.name, card: 'Charizard ex - 199/165 - SV: Scarlet & Violet 151' }] : []));
      s.read = {};
    });
  }
  async function clearDemo() { await save(s => { s.items = []; s.read = {}; s.tips = {}; }); }

  S.on(() => { paintDot(); if (dlg.open) paint(); checkTips(); });
  paintDot();
  window.CTNotify = { open, close, unread, premiumTap, demo, clearDemo, paintDot, fix: e => fix.open(e), change: e => fix.change(e) };
})();
