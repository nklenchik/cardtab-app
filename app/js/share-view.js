/* Shared Card Board viewer (v50.5): shows the board someone shared, exactly as they chose to share it. The page runs no
   code from the board itself (its security policy only allows this file), keeps nothing in the browser, and needs no account. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const id = (location.pathname.match(/\/b\/([a-z0-9]{8,16})/) || [])[1] || new URLSearchParams(location.search).get('id') || '';
  const say = (h, p) => { $('simple').innerHTML = '<div class="shgone"><h2>' + h + '</h2><p>' + p + '</p><a class="shcta big" href="https://cardtab.app/?utm_source=shared-board">See what Card Tab is</a></div>'; };
  if (!/^[a-z0-9]{8,16}$/.test(id)) { say('This link isn’t right', 'Check that the whole link was copied.'); return; }
  fetch('https://api.cardtab.app/s/b/' + id).then(r => r.json().then(j => ({ r, j }))).then(({ r, j }) => {
    if (r.status === 410) return say('This link has ended', 'The person who shared it set it to stop working after a while.');
    if (!r.ok || !j.html) return say('This board isn’t shared anymore', 'The link was turned off or replaced with a new one.');
    const m = j.meta || {};
    if (m.theme === 'light' || m.theme === 'dark') document.documentElement.dataset.theme = m.theme;
    const cb = $('cb'); if (m.cbClass) m.cbClass.split(/\s+/).forEach(c => c && cb.classList.add(c)); cb.classList.add('viewing');
    // the board's row height was worked out for the sharer's screen: keep it on wide screens, let phones lay out on their own
    if (m.cbStyle && innerWidth >= 761) cb.setAttribute('style', m.cbStyle.replace(/--topgap:[^;]*;?/, ''));
    $('shv-t').textContent = m.title || 'Card Board'; document.title = (m.title || 'Card Board') + ' · Card Tab';
    $('shv-s').textContent = [m.label, m.plat].filter(Boolean).join(' · ');
    const sim = $('simple'); sim.innerHTML = j.html; if (m.simStyle && innerWidth >= 761) sim.setAttribute('style', m.simStyle);
    sim.querySelectorAll('a').forEach(a => { a.removeAttribute('href'); });
    const d = j.updated ? new Date(j.updated * 1000) : null;
    if (d) $('shv-u').textContent = (j.live ? 'Kept up to date · last updated ' : 'A snapshot from ') + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + '.';
  }).catch(() => say('Couldn’t load this board', 'Check your connection and try again.'));
})();
