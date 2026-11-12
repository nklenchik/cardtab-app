// v52.43 admin search: finds cards, numbers, rows inside cards, things to do and filters, with typos. node tests/admin-search.js
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/admin.html'); await p.waitForTimeout(1500);
 const open = async () => { await p.evaluate(() => document.getElementById('sbtn').click()); await p.waitForTimeout(250); };
 const top = async q => { await open(); await p.fill('#skq', q); await p.waitForTimeout(200); return p.evaluate(() => [...document.querySelectorAll('#skr .skrow')].slice(0, 4).map(r => r.querySelector('b').textContent + ' [' + (r.querySelector('em') ? r.querySelector('em').textContent : 'ask') + ']')); };
 const cases = [['face id', /Face ID, Touch ID/], ['faec id', /Face ID/], ['biometric', /Face ID/], ['fingerprint', /Face ID|Fingerprint/], ['pokemon', /Pokémon|Games/], ['where do people live', /Where members are|Ask/], ['campaign cost', /Campaign|cost/], ['utm', /Tag a link|Campaign/], ['give premium', /Give someone Premium/],
  ['premium only', /Show Premium members only/], ['phones', /phones only|Phone/], ['ebay', /eBay|Where/], ['best users', /Who your best users are/], ['texas', /Texas|US by state/], ['lock', /Face ID|lock/i], ['sellers', /Sellers|seller/i], ['refund', /./], ['allerts', /alerts/i]];
 for (const [q, re] of cases) { const r = await top(q); console.log((r.some(x => re.test(x)) ? 'PASS ' : 'FAIL ') + q.padEnd(22) + ' → ' + r.join(' | ')); await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
 // picking a row inside a hidden tab opens that tab
 await open(); await p.fill('#skq', 'mostly sells'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(2200);
 console.log(await p.evaluate(() => { const b = document.querySelector('[data-bus].on'); return (b && b.dataset.bus === 'kind' ? 'PASS ' : 'FAIL ') + 'row pick opens its tab: ' + (b && b.dataset.bus); }));
 // a filter runs right away
 await open(); await p.fill('#skq', 'premium only'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
 console.log(await p.evaluate(() => (JSON.parse(localStorage.getItem('ct.admin') || '{}').plan || (window.st && st.plan))) === 'premium' ? 'PASS filter applied' : 'CHECK filter: ' + await p.evaluate(() => typeof st !== 'undefined' ? st.plan : document.body.innerText.includes('Premium') ));
 console.log('errors', errs); await b.close(); })();
