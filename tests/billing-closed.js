// v50.72: before launch, the Premium sheet says when Premium opens and the button can't be pressed
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => { const b = await chromium.launch(); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : '')); let bad = 0;
 const p = await b.newPage(devices['iPhone 13']); const errs = []; p.on('pageerror', e => errs.push(e.message));
 const root = path.join(__dirname, '../app');
 await p.route('https://app.cardtab.app/**', r => { let f = new URL(r.request().url()).pathname; if (f === '/') f = '/index.html'; const fp = path.join(root, f.split('?')[0]);
   if (!fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' }); const ext = path.extname(fp); r.fulfill({ status: 200, contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' }[ext] || 'application/octet-stream', body: fs.readFileSync(fp) }); });
 let checkoutCalls = 0;
 await p.route('https://api.cardtab.app/**', r => { const u = r.request().url();
   if (/\/auth\/billing\/checkout/.test(u)) { checkoutCalls++; return r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Premium opens Dec 1.","closed":true}' }); }
   if (/\/auth\/billing$/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ open: false, opens: 'Dec 1', plan: 'free', gift: false, publishableKey: 'pk_test_x', ready: true, founders: { eligible: true }, sub: null }) });
   return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
 await p.goto('https://app.cardtab.app/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'bc@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1500);
 await p.evaluate(() => document.querySelector('.sh-tabs [data-tab="board"]').click()); await p.waitForTimeout(3000);
 await p.evaluate(() => { const d = document.getElementById('pms'); d.classList.remove('prep'); d.showModal(); }); await p.waitForTimeout(1500);
 const r = await p.evaluate(() => { const g = document.getElementById('pm-go'), f = document.querySelector('#pms .pmfine'); return { t: g && g.textContent, dis: g && g.disabled, fine: f && f.textContent }; });
 ok('button says when Premium opens', /Premium opens Dec 1/.test(r.t || ''), JSON.stringify(r)); ok('button can\'t be pressed', r.dis === true);
 ok('small print mentions founders pricing', /lock in founders pricing/.test(r.fine || ''));
 await p.click('#pm-go', { force: true }).catch(() => {}); await p.waitForTimeout(500); ok('no checkout attempted', checkoutCalls === 0);
 await p.screenshot({ path: 'out-qa/billing-closed.png' });
 ok('no errors', !errs.length, errs.join(' | ')); await b.close(); })();
