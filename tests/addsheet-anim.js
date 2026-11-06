const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1200);
 for (let i = 0; i < 2; i++) {
 const r = await p.evaluate(() => new Promise(res => { const out = [], t0 = performance.now(); document.getElementById('ct-fab').click();
  (function f() { const ph = document.querySelector('#as .phone'), cs = getComputedStyle(ph), d = document.getElementById('as'); out.push(Math.round(performance.now() - t0) + ' ' + d.className + ' ' + cs.animationName + ' ' + cs.transform.slice(0, 40) + ' anims:' + ph.getAnimations().map(a => a.animationName + '@' + Math.round(a.currentTime)).join(',')); if (performance.now() - t0 < 200) requestAnimationFrame(f); else res(out); })(); }));
 console.log(r.join('\n')); await p.locator('#as [data-as-close]').click(); await p.waitForTimeout(700); console.log('---'); }
 await b.close(); })();
