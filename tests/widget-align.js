// v50.70: every board widget, at every size, on phones: labels in a row stay on one line and no amount is cut off with "…"
const { chromium, devices } = require('playwright');
const KINDS = ['profit','sales','spent','fees','after','month','sell','where','kept','win','budget','feat','best','pricey','glance','bd','tied','hit','tts','inout','ppc'];
(async () => { const b = await chromium.launch(); let bad = 0;
 for (const w of [320, 390, 430]) {
  const p = await b.newPage({ ...devices['iPhone 13'], viewport: { width: w, height: 844 } }); p.on('pageerror', e => { bad++; console.log('ERR', e.message) });
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'wa@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(800);
  // bigger numbers than the sample, like a real collection
  await p.evaluate(async () => { for (let i = 0; i < 40; i++) { const d = '2026-' + String(1 + i % 10).padStart(2, '0') + '-1' + (i % 9); await CTStore.add({ type: 'purchase', name: 'Card ' + i + ' - ' + i + '/200 - Set', platform: 'eBay', amount: 6655 + i * 731, qty: 1, date: d }); await CTStore.add({ type: 'sale', name: 'Card ' + i + ' - ' + i + '/200 - Set', platform: 'TCGplayer', amount: 9733 + i * 977, net: 8733 + i * 911, qty: 1, date: d }); } });
  await p.evaluate(() => document.querySelector('.sh-tabs [data-tab="board"]').click()); await p.waitForTimeout(2500);
  for (const size of ['S', 'M', 'L', 'X']) {
   await p.evaluate(([K, size]) => { localStorage.setItem('cb.layout.v4', JSON.stringify(K.map((k, i) => ({ id: 'w' + i, k, size })))); cbReloadLayout(); cbLinkRange('2026-01-01', '2026-12-31', '2026'); }, [KINDS, size]);
   await p.waitForTimeout(1800);
   const issues = await p.evaluate(() => { const out = [];
    document.querySelectorAll('#cbx .w, #cbx [data-wid], #cbx .widget').forEach(wd => { const name = (wd.querySelector('h3,.wt,.wh') || {}).textContent || wd.className;
     wd.querySelectorAll('.num, b, strong').forEach(n => { const cs = getComputedStyle(n); if (cs.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 1 && /\$|\d/.test(n.textContent)) out.push(name.trim().slice(0, 30) + ': amount cut off "' + n.textContent.trim() + '"'); });
     // a row of label/value pairs: every label on one line
     wd.querySelectorAll('.msum, .x2').forEach(row => { const ls = [...row.querySelectorAll(':scope > * > small, :scope > * > .lab')]; const hs = ls.map(l => Math.round(l.getBoundingClientRect().height)); if (hs.length > 1 && Math.max(...hs) > Math.min(...hs) * 1.5) out.push(name.trim().slice(0, 30) + ': a label wraps (' + ls.map(l => l.textContent).join(' | ') + ')'); });
    }); return [...new Set(out)]; });
   issues.forEach(i => { bad++; console.log('FAIL', w, size, i) });
  }
  await p.close() }
 console.log(bad ? bad + ' problems' : 'PASS every widget, every size, 320–430 wide'); await b.close(); process.exit(bad ? 1 : 0) })();
