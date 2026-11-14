/* Premium sheet copy test (v50.95).
   The Premium sheet comes in three versions, by where it was opened: Entries, Board or Stories. Each time it opens it shows
   one of that version's three headlines and six bullets: three about that page's Premium features (whatever was just tapped
   is always one, so a locked theme always says "All 24 Stories themes") and three from elsewhere in the app, leaning toward
   what this person uses most (v50.97). What was shown is counted (views), so is a
   tap on Continue, and the server keeps each person's last-shown copy so a purchase can be credited to the copy that made it.
   The admin page's Premium tab reads the results. Every bullet stays 27 characters or fewer.
   This file is also loaded by admin.html for the headline and bullet wording. */
(function () {
  'use strict';
  const HEADS = {
    e1: ['entries', 'Log every card, every month.'],
    e2: ['entries', 'No limits on your collection.'],
    e3: ['entries', 'Your whole history, in one place.'],
    b1: ['board', 'Unlock the rest of your board.'],
    b2: ['board', 'See everything your collection is doing.'],
    b3: ['board', 'Ask your board anything.'],
    s1: ['stories', 'Turn your months into Card Stories.'],
    s2: ['stories', 'Every theme. Every story.'],
    s3: ['stories', 'Share your best pulls in motion.']
  };
  const I = p => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = {
    cal: I('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
    hist: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    range: I('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M8 14h3M13 14h3"/>'),
    imp: I('<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>'),
    ask: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    board: I('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/>'),
    widget: I('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>'),
    save: I('<path d="M7 3h10a1 1 0 011 1v17l-6-4-6 4V4a1 1 0 011-1z"/>'),
    exp: I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    story: I('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>'),
    theme: I('<path d="M12 3a9 9 0 100 18c1 0 1.5-.7 1.5-1.5 0-.5-.2-.8-.5-1.2-.3-.4-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 005-5c0-4-4-7.5-9-7.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'),
    video: I('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>'),
    bg: I('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>'),
    win: I('<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 21h8M10 17h4"/>'),
    bars: I('<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/>'),
    cam: I('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>')
  };
  // id: [words, icon] — 27 characters or fewer
  const BUL = {
    1: ['No monthly entry limit', 'cal'], 2: ['All your history', 'hist'], 3: ['Any date range', 'range'], 4: ['Import a spreadsheet', 'imp'],
    5: ['50 Ask questions a month', 'ask'], 6: ['All Card Board features', 'board'], 7: ['Every Card Board widget', 'widget'], 8: ['Save every board layout', 'save'],
    9: ['Export to PDF and Excel', 'exp'], 10: ['Every Stories theme + video', 'story'], 11: ['All 24 Stories themes', 'theme'], 12: ['Unlimited Stories video', 'video'],
    13: ['Every Stories background', 'bg'], 14: ['Stories for any date range', 'range'], 15: ['All-time biggest profits', 'win'], 16: ['Profit by month, all time', 'bars'],
    17: ['50 photo scans a month', 'cam']
  };
  // v50.97: each bullet's home page. A sheet shows 3 from the page it opened on (what was tapped is always one of them) and
  // 3 from elsewhere in the app, leaning toward the features this person uses most (counted on this device only).
  const HOME = { entries: [1, 2, 3, 4, 17], board: [5, 6, 7, 8, 9, 15, 16], stories: [10, 11, 12, 13, 14] };
  const ALL = Object.keys(BUL).map(Number);
  const POOL = { entries: ALL, board: ALL, stories: ALL };   // any bullet can show on any page (the admin page lists them all)
  // what this person has used, by bullet (from the app's own usage counts, kept on this device: see track.js)
  const USE = { 1: ['entry_add'], 2: ['range'], 3: ['range'], 4: ['page_view:import'], 5: ['ask'], 6: ['page_view:board', 'widget_add'], 7: ['widget_add', 'widget_size'],
    8: ['layout_save', 'layout_update', 'widget_add'], 9: ['export'], 10: ['story_play', 'theme'], 11: ['theme'], 12: ['story_save', 'story_share'], 13: ['background'],
    14: ['story_play', 'page_view:stories'], 15: ['page_view:board'], 16: ['page_view:board'] };
  const used = () => { let u = {}; try { u = JSON.parse(localStorage.getItem('ct.use') || '{}') || {}; } catch (e) {} return u; };
  // weighted pick without repeats: a bullet's chance grows with how much its feature gets used (everything keeps a chance)
  // v52.19: bullets that say nearly the same thing never show together (e.g. "Every Stories theme + video" and "All 24 Stories themes")
  const CLASH = [[10, 11, 12], [6, 7, 8], [2, 3, 16], [3, 14]];
  const fits = (taken, b) => !taken.some(x => CLASH.some(g => g.includes(x) && g.includes(b)));
  function pickWeighted(list, n, taken) { taken = taken || []; const u = used(), w = list.map(b => 1 + Math.sqrt((USE[b] || []).reduce((a, k) => a + (+u[k] || 0), 0))), out = [];
    const L = list.slice(); while (out.length < n && L.length) { const tot = w.reduce((a, x) => a + x, 0); let r = Math.random() * tot, i = 0; while (i < L.length - 1 && (r -= w[i]) > 0) i++; if (fits(taken.concat(out), L[i])) out.push(L[i]); L.splice(i, 1); w.splice(i, 1); } return out; }
  // what was tapped -> the bullet that always shows
  const MUST = { 'locked theme': 11, 'locked background': 13, 'locked story': 12, video: 12, stories: 14, range: 3, 'all time': 2, ask: 5, scan: 17, layouts: 8, export: 9, share: 9, import: 4, 'entries used up': 1, 'entries nearly used': 1, limit: 1 };
  const STORIES_CTX = /^(locked theme|locked background|locked story|stories|video)$/;
  const pageNow = () => { const x = document.getElementById('csx'); if (x && x.classList.contains('in')) return 'stories'; const c = document.querySelector('.cbx'); if (c && !c.classList.contains('off') && !c.classList.contains('pmonly')) return 'board'; return 'entries'; };
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const T = () => window.CTTrack;
  let shown = null;

  function fill(ctx) {
    const pms = document.getElementById('pms'); if (!pms) return null;
    const page = STORIES_CTX.test(ctx || '') ? 'stories' : pageNow();
    const heads = Object.keys(HEADS).filter(k => HEADS[k][0] === page), head = heads[rnd(heads.length)];
    const must = MUST[ctx] || null;
    const own = must ? [must] : []; shuffle(HOME[page].filter(b => b !== must)).forEach(b => { if (own.length < 3 && fits(own, b)) own.push(b); });
    const other = pickWeighted(ALL.filter(b => !HOME[page].includes(b) && !own.includes(b)), 6 - own.length, own);
    const ids = shuffle(own.concat(other));
    const h = document.getElementById('pm-h'); if (h) h.textContent = HEADS[head][1];
    const f = pms.querySelector('.pmf'); if (f) f.innerHTML = ids.map(b => '<div>' + IC[BUL[b][1]] + '<span>' + BUL[b][0] + '</span></div>').join('');
    shown = { page, head, ids, tag: head + ':' + ids.join('.') };
    const t = T(); if (t && t.ev) { t.ev('pc_view', head); ids.forEach(b => t.ev('pc_bul', page[0] + ':' + b)); t.ev('pc_last', shown.tag); }
    return { head, text: HEADS[head][1] };
  }
  function tap() {
    const t = T(); if (!shown || !t || !t.ev) return;
    t.ev('pc_tap', shown.head); shown.ids.forEach(b => t.ev('pc_btap', shown.page[0] + ':' + b)); t.ev('pc_last', shown.tag);
    try { t.flush && t.flush(); } catch (e) {}   // so the server knows this copy before the purchase lands
  }
  window.CTPremCopy = { HEADS, BUL, POOL, HOME, fill, tap, get shown() { return shown; } };
})();
