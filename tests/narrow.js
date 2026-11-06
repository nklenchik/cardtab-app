const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); 
 for (const w of [310, 390]) { const p = await b.newPage({ viewport: { width: w, height: 700 } });
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'n@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(async () => { await CTStore.add({ type: 'sale', name: 'A', amount: 8999, fees: 1192, ship: 475 }); await CTStore.add({ type: 'refund', name: 'R', amount: 1000 }); });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const l = document.querySelector('#ct-after ~ .ct-line'); return [l.textContent, l.scrollWidth, l.clientWidth]; });
  console.log(w, r); await p.locator('.ct-stats').screenshot({ path: 'out-phone/tiles-' + w + '.png' }); }
 await b.close(); })();
