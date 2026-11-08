// v50.51 QA: slabs, pills and names in every view and grid size, phone + desktop, light + dark.
// Flags text that spills out of its box, slabs that aren't card-shaped, and console errors. Screenshots to tests/out-qa/.
const { chromium, devices } = require('playwright');
const fs = require('fs'); fs.mkdirSync(__dirname + '/out-qa', { recursive: true });
const OUT = __dirname + '/out-qa/';
const GRADED = [
  { name: 'Pokemon Scarlet & Violet 151 - Charizard ex - 199/165 - Special Illustration Rare', grade: { co: 'PSA', g: '10' } },
  { name: 'Dragon Ball Super Fusion World Awakened Pulse - SS Rose Goku Black - FB02-139 - Future of Despair SLR', grade: { co: 'BGS', g: '10', w: 'PRISTINE' } },
  { name: 'Son Gohan : Youth, Self-Taught Training Grounds Alternate Art Extremely Long Name', grade: { co: 'CGC', g: '9.5' } },
  { name: 'Mega Gengar ex', grade: { co: 'SGC', g: '9' } },
  { name: 'Pikachu Illustrator', grade: { co: 'TAG', g: '10', w: 'PRISTINE' } },
  { name: 'Umbreon VMAX Alt Art', grade: { co: 'BGS', g: '9.5' } },
];
(async () => {
  const b = await chromium.launch(); const issues = []; let shots = 0;
  for (const mode of ['phone', 'desktop']) for (const dark of [false, true]) {
    const ctx = await b.newContext(mode === 'phone' ? { ...devices['iPhone 13'], colorScheme: dark ? 'dark' : 'light' } : { viewport: { width: 1280, height: 860 }, colorScheme: dark ? 'dark' : 'light' });
    const p = await ctx.newPage(); const tag = mode + (dark ? '-dark' : '');
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push(m.text()); });
    await p.goto('http://localhost:8765/index.html');
    await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'qa51@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
    await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
    await p.evaluate(async G => { const all = CTStore.all().filter(e => !e.deleted); for (let i = 0; i < all.length; i++) { const e = all[i];
        if (i < G.length) await CTStore.update(e.id, { name: G[i].name, grade: G[i].grade, condition: 'Graded', date: new Date().toISOString().slice(0, 10) });
        else if (i === G.length) await CTStore.update(e.id, { name: 'Blastoise Base Set Holo Shadowless 1st Edition Very Long Raw Card Name', condition: 'Lightly Played', date: new Date().toISOString().slice(0, 10) });
        else if (i === G.length + 1) await CTStore.update(e.id, { condition: 'Near Mint' }); } }, GRADED);
    await p.waitForTimeout(800);
    const check = async where => {
      const r = await p.evaluate(() => {
        const out = []; const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight * 3; };
        const spill = (el, tol = 1.5) => el.scrollWidth > el.clientWidth + tol;
        document.querySelectorAll('.slab').forEach((s, i) => { if (!vis(s)) return; const r = s.getBoundingClientRect(); const ar = r.height / r.width;
          if (ar < 1.45 || ar > 1.85) out.push('slab ' + i + ' odd shape ' + ar.toFixed(2) + ' (' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
          const lbl = s.querySelector('.sl-lbl'); if (lbl) { const lr = lbl.getBoundingClientRect(); if (lr.right > r.right + 1 || lr.left < r.left - 1) out.push('slab ' + i + ' label wider than slab');
            lbl.querySelectorAll('.sl-co,.sl-gr,.sl-tiny,.sl-meta').forEach(x => { if (vis(x) && spill(x)) out.push('slab ' + i + ' ' + x.className + ' spills: ' + x.textContent.trim().slice(0, 40)); });
            const nm = lbl.querySelector('.sl-nm'); if (nm && vis(nm) && nm.scrollHeight > nm.clientHeight + 2 && getComputedStyle(nm).overflow !== 'hidden') out.push('slab ' + i + ' name overflows'); }
          const w = s.querySelector('.sl-well'); if (w) { const wr = w.getBoundingClientRect(); if (wr.bottom > r.bottom + 1) out.push('slab ' + i + ' art pokes out the bottom'); } });
        document.querySelectorAll('.sl-chip').forEach((c, i) => { if (vis(c) && spill(c)) out.push('pill ' + i + ' text spills: ' + c.textContent.trim()); const pr = c.parentElement && c.parentElement.getBoundingClientRect(), cr = c.getBoundingClientRect(); if (vis(c) && pr && cr.right > pr.right + 2) out.push('pill ' + i + ' sticks out of its row: ' + c.textContent.trim()); });
        document.querySelectorAll('.ct-row,.ct-tile').forEach((row, i) => { if (!vis(row)) return; const rr = row.getBoundingClientRect(); row.querySelectorAll('*').forEach(x => { if (!vis(x) || x.closest('.slab')) return; for (let a = x.parentElement; a && a !== row; a = a.parentElement) if (getComputedStyle(a).overflow !== 'visible') return; const xr = x.getBoundingClientRect(); if (xr.right > rr.right + 2 && getComputedStyle(x).position !== 'absolute') out.push((row.className.includes('tile') ? 'tile ' : 'row ') + i + ' ' + (x.className || x.tagName) + ' sticks out right by ' + Math.round(xr.right - rr.right)); }); });
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page scrolls sideways: ' + document.documentElement.scrollWidth);
        return [...new Set(out)].slice(0, 12);
      });
      r.forEach(x => issues.push(tag + ' / ' + where + ': ' + x));
      await p.evaluate(() => { const l = document.querySelector('.ct-tile,.ct-row'); if (l) l.scrollIntoView({ block: 'start' }); window.scrollBy(0, -60); }); await p.waitForTimeout(250); await p.screenshot({ path: OUT + tag + '-' + where + '.png' }); shots++;
    };
    const view = async (v, gs) => { await p.evaluate(([v, gs]) => { const s = '.fb-view [data-view="' + v + '"]' + (gs ? '[data-gs="' + gs + '"]' : ''); const el = document.querySelector(s); if (el) el.click(); }, [v, gs]); await p.waitForTimeout(700); };
    await view('list'); await check('list');
    // open the first graded row (details)
    await p.evaluate(() => { const r = document.querySelector('.ct-row'); r && r.click(); }); await p.waitForTimeout(700); await check('list-open');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    for (const gs of ['s', 'm', 'l']) { await view('gallery', gs); await check('grid-' + gs); }
    if (mode === 'desktop') for (const w of [1024, 900, 1600]) { await p.setViewportSize({ width: w, height: 860 }); await p.waitForTimeout(500); await check('grid-l-' + w); await view('gallery', 'm'); await check('grid-m-' + w); await view('list'); await check('list-' + w); await view('gallery', 'l'); }
    if (mode === 'phone') { await p.setViewportSize({ width: 320, height: 640 }); await p.waitForTimeout(500); await view('list'); await check('list-320'); await view('gallery', 's'); await check('grid-s-320'); await view('gallery', 'm'); await check('grid-m-320'); }
    if (errs.length) issues.push(tag + ': console errors: ' + errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  console.log(shots + ' screens checked'); console.log(issues.length ? issues.join('\n') : 'No issues found');
  await b.close();
})();
