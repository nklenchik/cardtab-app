// v50.60: opening entries (and the scrolling the app does for them) doesn't bring back or hide the bottom bar
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
 const p = await b.newPage({ ...devices['iPhone 13'] }); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'tb' + Math.random() + '@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.view', 'list'); });
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1200);
 await p.evaluate(async () => { const d = new Date().toISOString().slice(0, 10); for (const e of CTStore.all().filter(e => !e.deleted)) await CTStore.update(e.id, { date: d }); for (let k = 0; k < 2; k++) for (const e of CTStore.all().filter(e => !e.deleted)) await CTStore.duplicate(e.id); });
 await p.waitForTimeout(800);
 const away = () => p.evaluate(() => document.documentElement.classList.contains('tb-away') || document.documentElement.classList.contains('tb-mini'));
 // scroll down like a person, so the bar slides away
 for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(40); } await p.waitForTimeout(500);
 ok('bar slides away when you scroll down', await away());
 const states = [];
 for (const [a, z] of [[5, 9], [9, 6], [6, 12], [12, 13]]) {
  await p.evaluate(a => { const r = document.querySelectorAll('#ct-rows .ct-row')[a]; const rr = r.getBoundingClientRect(); if (rr.top < 80 || rr.bottom > innerHeight - 100) window.scrollBy(0, rr.top - 300); }, a); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(40); } await p.waitForTimeout(300);
  await p.evaluate(a => { const r = document.querySelectorAll('#ct-rows .ct-row')[a]; if (!r.classList.contains('expanded')) r.querySelector('.ct-row-toggle').click(); }, a); await p.waitForTimeout(800);
  const s1 = await away();
  await p.evaluate(z => { const r = document.querySelectorAll('#ct-rows .ct-row')[z]; const rr = r.getBoundingClientRect(); if (rr.top < 80 || rr.bottom > innerHeight - 100) window.scrollBy(0, rr.top - 300); }, z); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(40); } await p.waitForTimeout(300);
  const before = await away();
  await p.evaluate(z => document.querySelectorAll('#ct-rows .ct-row')[z].querySelector('.ct-row-toggle').click(), z); await p.waitForTimeout(900);
  states.push([before, await away()]);
 }
 ok('opening entries leaves the bar as it was', states.every(([x, y]) => x === y), JSON.stringify(states));
 for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -80); await p.waitForTimeout(40); } await p.waitForTimeout(500);
 ok('scrolling up yourself still brings it back', !(await away()));
 ok('no errors', !errs.length, errs.join(' | ')); await b.close(); })();
