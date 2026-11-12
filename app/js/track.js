/* Card Tab usage counts (v50).
   Counts only — which pages get used and for how long, which widgets, stories, themes and Premium moments — sent to our
   own server in small batches about once a minute and when the app goes to the background. Never card names, prices,
   emails or anything typed. Off when "Share anonymous usage" is switched off (Settings → Your data), and never for
   admin accounts. Local test copies keep everything on the device (nothing is sent). */
(function () {
  'use strict';
  const S = () => window.CTStore, Sess = () => window.CTSession;
  const q = [];               // queued counts
  let page = 'entries', since = performance.now(), visible = !document.hidden, activeMs = 0, lastPrem = '';
  const desk = matchMedia('(min-width:761px)');
  const on = () => { try { const s = Sess() && Sess().get(); if (!s || s.role === 'admin') return false; const v = S() && S().meta('shareUsage'); return v !== false; } catch (e) { return false; } };
  const word = s => String(s == null ? '' : s).toLowerCase().replace(/\d{4}/g, '').replace(/[^a-z0-9 &+\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

  // v50.97: a running tally of what this person uses, kept only on this device (never sent): the Premium sheet leans its
  // bullets toward the features they use most
  const use = (() => { try { return JSON.parse(localStorage.getItem('ct.use') || '{}') || {}; } catch (e) { return {}; } })(); let useDirty = false;
  const USE_EV = /^(entry_add|range|ask|widget_add|widget_size|layout_save|layout_update|export|story_play|story_save|story_share|theme|background)$/;
  const keepUse = () => { if (!useDirty) return; useDirty = false; try { localStorage.setItem('ct.use', JSON.stringify(use)); } catch (e) {} };
  function tallyUse(e, d) { const k = e === 'page_view' ? (/^(board|stories|import)$/.test(d) ? 'page_view:' + d : '') : (USE_EV.test(e) ? e : ''); if (!k) return; use[k] = Math.min(1e6, (use[k] || 0) + 1); useDirty = true; }
  setInterval(keepUse, 15000); addEventListener('pagehide', keepUse);
  function ev(e, d, v) { tallyUse(e, d == null ? '' : String(d)); if (!on()) return; q.push({ e, d: d == null ? '' : String(d), v: +v || 0 }); if (q.length > 100) flush(); }
  // time on the current page, counted only while the app is on screen
  function tickTime() { const t = performance.now(); if (visible) { const ms = t - since; activeMs += ms; if (ms > 400) q.push({ e: 'page_time', d: page, v: Math.round(ms / 1000) }); } since = t; }
  function setPage(p) { p = word(p) || 'entries'; if (p === page) return; tickTime(); page = p; ev('page_view', p); }

  async function flush(beacon) {
    tickTime();
    if (!on()) { q.length = 0; activeMs = 0; return; }
    const secs = Math.round(activeMs / 1000); if (!q.length && secs < 5) return;
    const body = JSON.stringify({ dev: desk.matches ? 'desk' : 'phone', secs, ev: q.splice(0, 120) }); activeMs = 0;
    const s = Sess(); if (!s || !s.REAL) return;   // test copies: nothing leaves the device
    try { await fetch(s.API + '/auth/ev', { method: 'POST', credentials: 'include', keepalive: !!beacon, headers: { 'content-type': 'application/json' }, body }); } catch (e) {}
  }
  setInterval(flush, 60000);
  document.addEventListener('visibilitychange', () => { tickTime(); visible = !document.hidden; since = performance.now(); if (document.hidden) flush(true); });
  addEventListener('pagehide', () => flush(true));

  // health: errors by kind and file only (never the message, which could hold someone's text), and how fast the app opened
  addEventListener('error', e => { const f = String(e.filename || '').split('/').pop().split('?')[0] || 'page'; ev('error', ((e.error && e.error.name) || 'Error') + ' ' + f); });
  addEventListener('unhandledrejection', e => { ev('error', 'Promise ' + ((e.reason && e.reason.name) || 'rejection')); });
  addEventListener('load', () => setTimeout(() => { try { if (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) ev('installed', 'yes'); } catch (e) {} try { const n = performance.getEntriesByType('navigation')[0]; if (n) ev('load_ms', desk.matches ? 'desk' : 'phone', Math.round(n.domContentLoadedEventEnd)); } catch (e) {} ev('page_view', page); }, 0));

  // watch the app's own moments (each wrapper keeps the original behavior exactly)
  const wrap = (obj, key, before) => { const f = obj && obj[key]; if (typeof f !== 'function' || f._ct) return false; const g = function (...a) { try { before.apply(this, a); } catch (e) {} return f.apply(this, a); }; g._ct = 1; obj[key] = g; return true; };
  const PLAT = ['ebay', 'tcgplayer', 'whatnot', 'mercari', 'facebook marketplace', 'local shop', 'card show', 'cardmarket', 'amazon', 'trade'];
  function hook() {
    wrap(window, 'CTBoardUpgrade', () => ev('upgrade', lastPrem || 'other'));
    if (window.CTAddSheet) wrap(window.CTAddSheet, 'open', () => ev('page_view', 'add a card'));
    if (window.CTDash) wrap(window.CTDash, 'exportCSV', () => ev('export', 'csv'));
    if (window.CTImportUI) wrap(window.CTImportUI, 'open', () => ev('page_view', 'import'));
    if (S()) wrap(S(), 'add', input => { const list = Array.isArray(input) ? input : [input]; list.slice(0, 200).forEach(x => { if (!x) return; ev('entry_add', word(x.type) || 'entry'); const p = word(x.platform); if (p) ev('entry_platform', PLAT.includes(p) ? p : 'other'); if (x.game) ev('entry_game', word(x.game)); }); });
  }
  hook(); const iv = setInterval(hook, 1500); setTimeout(() => clearInterval(iv), 60000);
  // which page is on screen: Stories over Board over Entries (read from the page itself, however it was opened)
  const pageNow = () => { const x = document.getElementById('csx'); if (x && x.classList.contains('in')) return 'stories'; const c = document.querySelector('.cbx'); if (c && !c.classList.contains('off')) return 'board'; const m = document.querySelector('.amp:not([hidden])'); if (m && m.dataset.p) return 'settings ' + m.dataset.p; return 'entries'; };
  setInterval(() => { if (visible) setPage(pageNow()); }, 1000);

  // v50.4 ---------------------------------------------------------------------------------------------------------------
  // What the website showed someone before they opened the app (cardtab.app adds ?ctj=source~sections~demos to its links to
  // the app). Kept on this device until they're signed in, sent once, then forgotten. Used only as counts on our dashboard.
  // v52.43: an ad that links straight to the app (utm_source / utm_campaign / utm_content) is kept the same way
  try { const u = new URL(location.href), P = u.searchParams; if (!P.get('ctj') && P.get('utm_source')) { const c = x => (P.get(x) || '').replace(/~/g, ' ').slice(0, 40); P.set('ctj', c('utm_source') + '~~~' + c('utm_campaign') + '~' + c('utm_content')); ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => P.delete(k)); history.replaceState(history.state, '', u.pathname + '?' + P + u.hash); } } catch (e) {}
  try { const u = new URL(location.href), j = u.searchParams.get('ctj'); if (j) { localStorage.setItem('ct.j', JSON.stringify({ j: j.slice(0, 300), t: Date.now() })); u.searchParams.delete('ctj'); history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash); } } catch (e) {}
  function sendJourney() { try { const o = JSON.parse(localStorage.getItem('ct.j') || 'null'); if (!o) return; if (Date.now() - o.t > 30 * 864e5) { localStorage.removeItem('ct.j'); return; } const s = Sess() && Sess().get(); if (!s) return; if (on()) ev('journey', o.j); localStorage.removeItem('ct.j'); } catch (e) {} }
  // the moments that can lead to Premium: running out of free entries, and every Upgrade button (named by where it sits)
  let limitSent = false;
  setInterval(() => { sendJourney(); try { const u = S() && S().usage && S().usage(); if (u && u.blocked && !limitSent) { limitSent = true; ev('limit', 'entries'); } } catch (e) {} }, 5000);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-upgrade],[data-act=premium]'); if (!b) return;
    let ctx = 'upgrade button'; try { const u = S() && S().usage && S().usage(); if (/all time/i.test(b.textContent)) ctx = 'all time'; else if (b.closest('[data-act]') || b.dataset.act) ctx = 'tip'; else if (u && u.blocked) ctx = 'entries used up'; else if (u && u.left != null && u.left <= 5) ctx = 'entries nearly used'; } catch (er) {}
    lastPrem = ctx; }, true);   // v50.96: the Premium sheet it opens counts the open (with this as where it came from)
  // longer ranges (All time and This year are Premium) and exports
  document.addEventListener('change', e => { const t = e.target; if (!t || !window.CTMonth) return; try { const v = String(t.value || ''); if (v === 'all') ev('range', 'all time'); else if (/^year/.test(v)) ev('range', 'year'); } catch (er) {} }, true);

  window.CTTrack = { ev, page: setPage, flush, prem(ctx) { lastPrem = word(ctx) || 'other'; ev('prem_open', lastPrem); }, tap(head) { ev('prem_tap', lastPrem || 'other'); if (head) ev('prem_head_tap', head); }, get premCtx() { return lastPrem; } };
})();
