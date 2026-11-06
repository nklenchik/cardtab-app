// Sweep: every page × phone 310 / phone 390 / desktop × light / dark × free / premium.
// Reports console errors, sideways scrolling, things hidden under the header, and the Stories header buttons.
const { chromium, devices } = require('playwright');
const CASES = [['p310', 310, 'light', 'free'], ['p310', 310, 'dark', 'premium'], ['p390', 390, 'light', 'premium'], ['p390', 390, 'dark', 'free'], ['desk', 1280, 'light', 'premium'], ['desk', 1280, 'dark', 'free'], ['desk', 1024, 'light', 'premium'], ['desk', 1440, 'dark', 'premium']];
(async () => { const b = await chromium.launch(); const issues = [];
 for (const [kind, w, scheme, plan] of CASES) {
  const ctx = await b.newContext(kind === 'desk' ? { viewport: { width: w, height: 860 }, colorScheme: scheme } : { ...devices['iPhone 13'], viewport: { width: w, height: 760 }, colorScheme: scheme });
  const p = await ctx.newPage(); const tag = kind + w + '-' + scheme + '-' + plan; const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'audit@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async pl => { await CTStore.setPlan(pl); document.querySelector('[data-dev=sample]').click(); }, plan); await p.waitForTimeout(1500);
  for (const pg of ['entries', 'board', 'stories']) {
   await p.evaluate(pg => { const t = [...document.querySelectorAll('.ct-tbar button, .sh-tabs button, .ct-tabs button')].find(x => x.offsetParent && new RegExp(pg, 'i').test(x.textContent)); if (t) t.click(); }, pg);
   await p.waitForTimeout(pg === 'entries' ? 900 : 4200);
   const r = await p.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth + 1, page: document.querySelector('.ct-shell').dataset.page, prem: !!document.querySelector('dialog[open].pms, .pms[open]') }));
   if (r.page !== pg) issues.push(tag + ' ' + pg + ': did not open (on ' + r.page + ')' + (r.prem ? ' — Premium sheet showed' : ''));
   if (r.wide) issues.push(tag + ' ' + pg + ': page scrolls sideways');
   await p.screenshot({ path: 'tests/out-phone/audit-' + tag + '-' + pg + '.png' });
   if (pg === 'stories') {
     let S = null; for (const x of p.frames()) { if (await x.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) S = x; }
     if (!S) { issues.push(tag + ' stories: frame missing'); continue; }
     const sw = await S.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); if (sw) issues.push(tag + ' stories: frame scrolls sideways');
     // what the header's own buttons on the Stories page do now
     const hb = await p.evaluate(() => [...document.querySelectorAll('.ct-shell .sh-ic, .ct-shell button')].filter(x => x.offsetParent && x.getBoundingClientRect().top < 90).map(x => (x.getAttribute('aria-label') || x.textContent || '').trim().slice(0, 30)).filter(Boolean));
     if (w === 390 || w === 1280) console.log('  ' + tag + ' header on Stories:', hb.join(' | '));
   }
  }
  // bell / dot rule
  const bell = await p.evaluate(() => { const bl = document.querySelector('.sh-bell'); return bl && getComputedStyle(bl).display !== 'none'; });
  if (kind === 'desk' && !bell) issues.push(tag + ': bell missing on desktop'); if (kind !== 'desk' && bell) issues.push(tag + ': bell still showing on phone');
  if (errs.length) issues.push(tag + ': console errors: ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await ctx.close();
 }
 console.log(issues.length ? 'ISSUES:\n - ' + issues.join('\n - ') : 'No issues found'); await b.close(); })();
