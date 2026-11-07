// Screenshots of every page and the main windows, phone and desktop, light and dark, for a visual pass.
const { chromium, devices } = require('playwright');
const OUT = 'tests/out-phone/st/'; require('fs').mkdirSync(OUT, { recursive: true });
(async () => { const b = await chromium.launch(); const errs = [];
 for (const [tag, o] of [['ph', { ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }], ['dk', { viewport: { width: 1280, height: 800 } }]]) for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ ...o, colorScheme: scheme }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + scheme + ': ' + e.message));
  const shot = async n => { await p.waitForTimeout(700); await p.screenshot({ path: OUT + tag + '-' + scheme + '-' + n + '.png' }); };
  const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(500); };
  const tab = async t => { await p.evaluate(t => { const x = [...document.querySelectorAll('.ct-tbar button, .sh-tabs button, .ct-tabs button')].find(x => x.offsetParent && new RegExp(t, 'i').test(x.textContent)); x && x.click(); }, t); await p.waitForTimeout(t === 'entries' ? 1000 : 3800); };
  await p.goto('http://localhost:8765/index.html'); await shot('0-signin');
  await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', expires: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1300); await shot('1-empty');
  await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(2600);
  await shot('2-entries');
  await p.evaluate(() => scrollTo(0, 600)); await shot('3-entries-scrolled'); await p.evaluate(() => scrollTo(0, 0));
  await p.evaluate(() => document.querySelector('.ct-row-toggle, [aria-label^="Expand"]').click()); await shot('4-row-open');
  await p.evaluate(() => CTOpenAdd()); await p.waitForTimeout(600); await p.keyboard.type('Charizard'); await shot('5-add'); await esc();
  await p.evaluate(() => CTEditor.open(CTStore.all().find(e => e.type === 'sale'))); await shot('6-edit'); await esc();
  await p.click('#app-avatar').catch(() => {}); await shot('7-menu'); await esc();
  await p.evaluate(() => window.CTBudget && CTBudget.open()); await shot('8-budget'); await esc();
  await p.evaluate(() => CTDash.openImport()); await shot('9-import'); await esc();
  if (tag === 'dk') { await p.click('.sh-bell').catch(() => {}); await shot('10-notif'); await esc(); }
  await tab('board'); await shot('11-board'); await p.evaluate(() => scrollTo(0, 700)); await shot('12-board-scrolled'); await p.evaluate(() => scrollTo(0, 0));
  await tab('stories'); await shot('13-stories');
  let S = null; for (const f of p.frames()) if (await f.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) S = f;
  if (S) { await S.evaluate(() => window.csPlay(0)); await p.waitForTimeout(2500); await shot('14-story-play'); await esc(); await S.evaluate(() => window.csThemes.all()); await shot('15-themes'); await esc(); }
  await ctx.close(); }
 console.log('errors', errs); await b.close(); })();
