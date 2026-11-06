const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'l@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.diag', '1'); });
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelector('[data-dev=sample]').click()); await p.waitForTimeout(1500);
 const cdp = await ctx.newCDPSession(p);
 const drag = async (x, y1, y2) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y1 }] });
   for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y1 + (y2 - y1) * i / 8 }] }); await p.waitForTimeout(16); }
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500); };
 await drag(200, 600, 300); const before = await p.evaluate(() => scrollY); console.log('page scrolls normally with no window open:', before > 0, before);
 await p.evaluate(() => document.getElementById('ct-fab').click()); await p.waitForTimeout(800);
 await drag(200, 700, 300); await drag(200, 300, 700);
 const after = await p.evaluate(() => scrollY); console.log('page stays put under Add New:', after === before, after);
 console.log(await p.locator('.as-diag').innerText());
 await p.evaluate(() => document.querySelector('#as [data-as-close]').click()); await p.waitForTimeout(700);
 await drag(200, 300, 700); console.log('page scrolls again after closing:', (await p.evaluate(() => scrollY)) !== after);
 console.log('errors:', errs); await b.close(); })();
