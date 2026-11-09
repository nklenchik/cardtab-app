// v50.67: Biggest win finds a sale's purchase even when they were written differently, and changes with the range
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
 const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'wm' + Date.now() + '@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1200);
 await p.evaluate(async () => { await CTStore.setPlan('premium');
   const add = o => CTStore.add(Object.assign({ platform: 'eBay', qty: 1 }, o));
   // Jan-Jun 2025: bought with the full name, sold with just the name
   await add({ type: 'purchase', name: 'Wartortle - 008/165 - 151', amount: 3000, date: '2025-01-10' });
   await add({ type: 'sale', name: 'Wartortle', amount: 20957, net: 16546, date: '2025-03-02' });
   // same card matched to the catalog on both entries, written differently
   await add({ type: 'purchase', name: 'Gohan Beyond the Ultimate SCR', amount: 5000, date: '2025-02-01', cardId: 'bt19-152' });
   await add({ type: 'sale', name: 'Son Gohan, Beyond the Ultimate - BT19-152', amount: 9000, net: 8000, date: '2025-04-01', cardId: 'bt19-152' });
   // Supreme Kai: many small sales across the year
   await add({ type: 'purchase', name: 'Supreme Kai of Time - BT13-135', amount: 1000, qty: 10, date: '2024-12-01' });
   for (const d of ['2025-02-05', '2025-05-05', '2025-09-05']) await add({ type: 'sale', name: 'Supreme Kai of Time - BT13-135', amount: 1700, net: 1700, date: d });
   // the same card in two grades: a BGS 9.5 bought and sold, then a CGC 10 Pristine bought later for more
   await add({ type: 'purchase', name: "Son Gohan, Beyond the Ultimate - Fighter's Ambition", amount: 10500, date: '2025-06-01', grade: { co: 'BGS', g: '9.5' }, condition: 'Graded' });
   await add({ type: 'sale', name: "Son Gohan, Beyond the Ultimate - Fighter's Ambition", amount: 25537, net: 22206, date: '2025-10-11', grade: { co: 'BGS', g: '9.5' }, condition: 'Graded' });
   await add({ type: 'purchase', name: "Son Gohan, Beyond the Ultimate - Fighter's Ambition", amount: 32690, date: '2025-09-28', grade: { co: 'CGC', g: '10', w: 'PRISTINE' }, condition: 'Graded' });
   // Jul-Dec 2025: a different winner
   await add({ type: 'purchase', name: 'Mew ex - 151/165', amount: 2000, date: '2025-07-01' });
   await add({ type: 'sale', name: 'Mew ex', amount: 6000, net: 5200, date: '2025-08-01' });
 });
 await p.waitForTimeout(600); await p.evaluate(() => document.querySelector('.sh-tabs [data-tab="board"]').click()); await p.waitForTimeout(2500);
 const winFor = async (a, z) => { await p.evaluate(([a, z]) => { cbLinkRange(a, z, a + ' – ' + z); }, [a, z]);
   await p.waitForTimeout(900);
   return p.evaluate(() => { const all = [...document.querySelectorAll('*')].filter(e => e.children.length < 40 && /Your biggest win/.test(e.textContent) && (e.querySelector('.num') || /No card/.test(e.textContent))); const w = all.sort((a, z) => a.textContent.length - z.textContent.length)[0]; return w ? w.innerText.replace(/\s+/g, ' ').slice(0, 160) : 'not found'; }); };
 const hasSetter = await p.evaluate(() => typeof window.cbLinkRange === 'function');
 ok('range can be set for the test', hasSetter);
 if (hasSetter) {
  const h1 = await winFor('2025-01-01', '2025-06-30'), h2 = await winFor('2025-07-01', '2025-12-31');
  ok('Jan–Jun 2025: Wartortle (sold under a shorter name)', /Wartortle/.test(h1) && /135/.test(h1), h1);
  ok('Jul–Dec 2025: a different card (the BGS 9.5 Gohan sale)', /Gohan/.test(h2) && !/Wartortle/.test(h2), h2);
 }
 if (hasSetter) {
  await p.evaluate(() => { localStorage.setItem('cb.layout.v4', JSON.stringify([{ id: 'pz', k: 'pricey', size: 'L' }, { id: 'wz', k: 'win', size: 'L' }])); cbReloadLayout(); cbLinkRange('2025-09-01', '2025-10-31', 'Sep – Oct 2025'); }); await p.waitForTimeout(1200);
  const pr = await p.evaluate(() => { const all = [...document.querySelectorAll('*')].filter(e => e.children.length < 60 && /Priciest card/.test(e.textContent) && /\$/.test(e.textContent)); const w = all.sort((a, z) => a.textContent.length - z.textContent.length)[0]; return w ? { t: w.innerText.replace(/\s+/g, ' ').slice(0, 220), slab: (w.querySelector('.slab') || {}).textContent || '' } : null; });
  ok('Priciest card shows the CGC 10 Pristine it priced, not the BGS 9.5', pr && /326\.90/.test(pr.t) && /CGC/.test(pr.slab) && !/BGS/.test(pr.slab) && /Still yours/.test(pr.t), JSON.stringify(pr));
  const w2 = await winFor('2025-10-01', '2025-10-31');
  ok('the BGS 9.5 sale is matched to the BGS 9.5 purchase', /\+\$117\.06|117/.test(w2), w2);
 }
 ok('no errors', !errs.length, errs.join(' | ')); await b.close(); })();
