const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const out = [];
 for (const [plan, o] of [['premium', { viewport: { width: 1280, height: 800 }, acceptDownloads: true }], ['free', { viewport: { width: 1280, height: 800 }, acceptDownloads: true }], ['premium-phone', { ...devices['iPhone 13'], viewport: { width: 390, height: 664 }, acceptDownloads: true }]]) {
  const p = await (await b.newContext(o)).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', expires: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1300); await p.evaluate(async pl => { await CTStore.setPlan(pl); document.querySelector('[data-dev=sample]').click(); }, plan.startsWith('premium') ? 'premium' : 'free'); await p.waitForTimeout(1500);
  await p.evaluate(() => { [...document.querySelectorAll('.sh-tabs button, .ct-tbar button')].find(x => x.offsetParent && /stories/i.test(x.textContent)).click(); }); await p.waitForTimeout(4000);
  await p.click('.sh-save'); await p.waitForTimeout(500);
  const menu = await p.evaluate(() => [...document.querySelectorAll('.sh-savem button')].map(b => b.textContent.trim()));
  out.push(plan + ' menu: ' + JSON.stringify(menu));
  await p.screenshot({ path: `tests/out-phone/savemenu-${plan}.png` });
  if (plan === 'premium') {
   const dl = p.waitForEvent('download', { timeout: 150000 }); await p.click('.sh-savem [data-k="videos"]'); const d = await dl; console.log('videos ok');out.push('videos download: ' + d.suggestedFilename());
   const path = await d.path(); const buf = require('fs').readFileSync(path); out.push('zip size ' + buf.length + ' entries ' + (buf.toString('latin1').match(/PK\x01\x02/g) || []).length);
   await p.click('.sh-save'); await p.waitForTimeout(300); const dl2 = p.waitForEvent('download', { timeout: 40000 }).catch(() => null); await p.click('.sh-savem [data-k="photos"]'); const d2 = await dl2; if (!d2) { let S = null; for (const f of p.frames()) if (await f.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) S = f; out.push('photos FAILED, page says: ' + await S.evaluate(() => [...document.querySelectorAll('.say, #say, .toast, .ptoast')].map(x => x.textContent).join(' | '))); console.log(out.join('\n')); process.exit(1); } const b2 = require('fs').readFileSync(await d2.path());
   out.push('photos download: ' + d2.suggestedFilename() + ' entries ' + (b2.toString('latin1').match(/PK\x01\x02/g) || []).length);
  }
  if (plan === 'free') { await p.click('.sh-savem [data-k="videos"]'); await p.waitForTimeout(800); out.push('free videos -> premium sheet: ' + await p.evaluate(() => !!document.querySelector('dialog[open].pms, .pms[open]'))); }
  out.push(plan + ' errors ' + JSON.stringify(errs));
 }
 console.log(out.join('\n')); await b.close(); })();
