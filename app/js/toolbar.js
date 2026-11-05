/* The toolbar row (v37): the same second row under the header on every page.
   - Left, always in the same spot: the date. Entries and Board share one date (pick October on one, the other shows
     October). Stories keeps its own range, since each story sums up a longer stretch, but uses the same control there.
   - Right: only the tools for the page you're on. Entries: type chips, platform, sort. Board: platform. Stories: themes.
   - Wide screens (1100px and up): the row lives in the header, so it stays put while the pages slide underneath and only
     the parts that differ fade. Narrower screens: each page keeps its controls at its top, and the Board gets its own
     copy of the date switcher (still the same shared date).
   Animations are opacity only. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const sh = document.querySelector('.ct-shell'); if (!sh || !window.CTMonth) return;
  const WIDE = matchMedia('(min-width:1100px)');
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ARROW = d => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (d < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6') + '"/></svg>';
  const CHEV = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  const row = document.createElement('div'); row.className = 'sh-row2';
  row.innerHTML = '<div class="sh-date"><div class="shd on" data-g="shared"></div><div class="shd" data-g="stories"></div></div>' +
    '<div class="sh-tools"><div class="sht on" data-p="entries"></div><div class="sht" data-p="board"></div><div class="sht" data-p="stories"></div></div>';
  sh.appendChild(row);
  const D = g => row.querySelector('.shd[data-g="' + g + '"]'), T = p => row.querySelector('.sht[data-p="' + p + '"]');

  // ---------- where things live: in the header row on wide screens, back on the page otherwise ----------
  const main = CTMonth.main, fbar = document.querySelector('.ct-fbar');
  const home = { main: { p: main.parentElement, n: main.nextSibling }, fbar: fbar && { p: fbar.parentElement, n: fbar.nextSibling } };
  function place() {
    const w = WIDE.matches; document.documentElement.classList.toggle('has-row2', w);
    if (w) { D('shared').appendChild(main); if (fbar) T('entries').appendChild(fbar); }
    else {
      if (main.parentElement !== home.main.p) home.main.p.insertBefore(main, home.main.n && home.main.n.parentElement === home.main.p ? home.main.n : home.main.p.firstChild);
      if (fbar && fbar.parentElement !== home.fbar.p) home.fbar.p.insertBefore(fbar, home.fbar.n && home.fbar.n.parentElement === home.fbar.p ? home.fbar.n : null);
    }
  }
  place(); WIDE.addEventListener('change', place);

  // ---------- which page ----------
  function page() {
    const p = sh.dataset.page || 'entries';
    row.querySelectorAll('.sht').forEach(g => g.classList.toggle('on', g.dataset.p === p));
    D('shared').classList.toggle('on', p !== 'stories'); D('stories').classList.toggle('on', p === 'stories');
    row.querySelectorAll('.shd,.sht').forEach(g => { g.inert = !g.classList.contains('on'); });
    closeDD();
  }
  new MutationObserver(page).observe(sh, { attributes: true, attributeFilter: ['data-page'] });

  // ---------- a small menu, used for the board's platform and Stories' range ----------
  let dd = null;
  function closeDD() { if (!dd) return; const d = dd; dd = null; d.btn.setAttribute('aria-expanded', 'false'); d.btn.classList.remove('open'); d.el.classList.add('out'); setTimeout(() => d.el.remove(), 160); }
  function openDD(btn, items, cur, pick) {
    if (dd && dd.btn === btn) { closeDD(); return; } closeDD();
    const el = document.createElement('div'); el.className = 'ms-pop ms-menu sh-ddm'; el.setAttribute('role', 'menu');
    el.innerHTML = items.map(([k, l]) => (k === 'custom' ? '<hr>' : '') + '<button type="button" role="menuitemradio" aria-checked="' + (k === cur) + '" data-k="' + esc(k) + '"' + (k === cur ? ' class="on"' : '') + '><span>' + esc(l) + '</span>' + (k === cur ? CHECK : '') + '</button>').join('');
    btn.parentElement.appendChild(el); btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open');
    el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; closeDD(); pick(b.dataset.k, b.textContent); });
    dd = { btn, el };
    const f = el.querySelector('.on') || el.querySelector('button'); if (f) f.focus({ preventScroll: true });
  }
  document.addEventListener('pointerdown', e => { if (dd && !e.target.closest('.sh-dd')) closeDD(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && dd) { const b = dd.btn; closeDD(); b.focus(); } });

  // ---------- Board: same date as Entries, platform in the row ----------
  function linkBoard() { if (!window.cbLinkRange) return; const [a, b] = CTMonth.bounds(); window.cbLinkRange(CTMonth.isAll() ? null : a, b, CTMonth.label()); }
  $('ct-period').addEventListener('change', linkBoard);
  if (window.CTStore) CTStore.on(() => { if (CTMonth.isAll()) linkBoard(); });
  let boardDone = false;
  function wireBoard() {
    if (boardDone || !window.cbLinkRange || !$('cb-per')) return; boardDone = true;
    linkBoard();
    // narrower screens: the board's own copy of the switcher, where its old date button was
    const tctl = document.querySelector('#cb .tctl'), own = CTMonth.make('ms-main ms-board');
    if (tctl) tctl.insertBefore(own, $('cb-per').parentElement);
    // wide screens: platform, in the header row
    const w = document.createElement('div'); w.className = 'sh-dd';
    w.innerHTML = '<button type="button" class="sh-ddb" aria-haspopup="menu" aria-expanded="false"><span></span>' + CHEV + '</button>';
    const b = w.firstElementChild, lab = () => { b.firstElementChild.textContent = ($('cb-platl') || {}).textContent || 'All platforms'; };
    lab(); new MutationObserver(lab).observe($('cb-platl'), { childList: true, characterData: true, subtree: true });
    b.addEventListener('click', () => openDD(b, cbPlat.list(), cbPlat.get(), (k, l) => cbPlat.set(k, l)));
    T('board').appendChild(w);
  }

  // ---------- Stories: its own range and the themes, from inside its frame ----------
  const frameWin = () => { try { const f = document.querySelector('#csx iframe'); return f && f.contentWindow; } catch (e) { return null; } };
  let sDone = false, sDate = null, sChips = null;
  const SHORT = { lm: 'Month', ytd: 'This year', l12: '12 months', ly: 'Last year', all: 'All time', custom: 'Custom' };
  function wireStories() {
    const fw = frameWin(); if (sDone || !fw || !fw.csRange || !fw.csThemes) return; sDone = true;
    sDate = document.createElement('div'); sDate.className = 'ct-mstep ms-main sh-sdate'; sDate.setAttribute('role', 'group'); sDate.setAttribute('aria-label', 'Stories date range');
    sDate.innerHTML = '<button type="button" class="ms-prev" aria-label="Back">' + ARROW(-1) + '</button><span class="ms-lab" aria-live="polite"><span></span></span><button type="button" class="ms-next" aria-label="Forward">' + ARROW(1) + '</button>' +
      '<div class="ms-rw sh-dd"><button type="button" class="ms-rng" aria-haspopup="menu" aria-expanded="false"><span></span>' + CHEV + '</button></div>';
    sDate.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.closest('.sh-ddm')) return; const R = frameWin().csRange;
      if (b.classList.contains('ms-rng')) { openDD(b, R.list(), R.per(), k => R.set(k)); return; }
      R.step(b.classList.contains('ms-prev') ? -1 : 1);
    });
    D('stories').appendChild(sDate);
    sChips = document.createElement('div'); sChips.className = 'sh-chips'; sChips.setAttribute('role', 'group'); sChips.setAttribute('aria-label', 'Story theme');
    sChips.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const Th = frameWin().csThemes; if (b.dataset.all != null) Th.all(); else Th.set(+b.dataset.i); });
    T('stories').appendChild(sChips);
    paintStories();
  }
  function paintStories() {
    const fw = frameWin(); if (!sDone || !fw || !fw.csRange) return; const R = fw.csRange, Th = fw.csThemes;
    sDate.querySelector('.ms-lab>span').textContent = R.label();
    sDate.querySelector('.ms-prev').disabled = !R.can(-1); sDate.querySelector('.ms-next').disabled = !R.can(1);
    sDate.classList.toggle('is-all', R.per() === 'all');
    const rb = sDate.querySelector('.ms-rng'); rb.firstElementChild.textContent = SHORT[R.per()] || 'Range'; rb.classList.toggle('act', R.per() !== 'l12');
    const list = Th.list(), cur = Th.cur(), show = list.slice(0, 5); if (cur >= 5) show[4] = list[cur];
    sChips.innerHTML = show.map(t => '<button type="button" class="sh-chip" aria-pressed="' + (t.i === cur) + '" data-i="' + t.i + '"><span class="sw">' + t.sw.map(c => '<i style="background:' + c + '"></i>').join('') + '</span>' + esc(t.name) + '</button>').join('') +
      '<button type="button" class="sh-chip" data-all><span class="rbw" aria-hidden="true"></span>All themes</button>';
  }
  window.csChanged = () => paintStories();

  // the board and Stories arrive after the app; hook them up when they do
  const wait = setInterval(() => { wireBoard(); wireStories(); if (boardDone && sDone) clearInterval(wait); }, 400);
  page();
})();
