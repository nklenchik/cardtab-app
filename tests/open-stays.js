// v50.57: an opening entry keeps its place and never goes above the top of the visible area
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
 for (const [name, opt] of [['phone', { ...devices['iPhone 13'] }], ['phone 320', { ...devices['iPhone 13'], viewport: { width: 320, height: 568 } }], ['desktop', { viewport: { width: 1280, height: 760 } }]]) {
  const p = await b.newPage(opt); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'os' + Math.random() + '@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.view', 'list'); });
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1200);
  await p.evaluate(async () => { const d = new Date().toISOString().slice(0, 10); for (const e of CTStore.all().filter(e => !e.deleted)) await CTStore.update(e.id, { date: d }); for (let k = 0; k < 2; k++) for (const e of CTStore.all().filter(e => !e.deleted)) await CTStore.duplicate(e.id); });
  await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('.fb-vopts [data-view="list"]').click()); await p.waitForTimeout(600);
  const res = [];
  for (const [a, z] of [[3, 7], [7, 4], [4, 12], [12, 13], [20, 22]]) {
   // open row a, then bring row z near the top and open it
   await p.evaluate(a => { const r = document.querySelectorAll('#ct-rows .ct-row')[a]; if (!r.classList.contains('expanded')) r.querySelector('.ct-row-toggle').click(); }, a); await p.waitForTimeout(700);
   await p.evaluate(z => { const r = document.querySelectorAll('#ct-rows .ct-row')[z]; r.scrollIntoView({ block: 'center' }); }, z); await p.waitForTimeout(400);
   const before = await p.evaluate(z => Math.round(document.querySelectorAll('#ct-rows .ct-row')[z].getBoundingClientRect().top), z);
   await p.evaluate(z => document.querySelectorAll('#ct-rows .ct-row')[z].querySelector('.ct-row-toggle').click(), z);
   let minTop = 1e9; for (let i = 0; i < 14; i++) { await p.waitForTimeout(60); const t = await p.evaluate(z => document.querySelectorAll('#ct-rows .ct-row')[z].getBoundingClientRect().top, z); minTop = Math.min(minTop, t); }
   await p.waitForTimeout(700);
   const r = await p.evaluate(z => { const row = document.querySelectorAll('#ct-rows .ct-row')[z], rr = row.getBoundingClientRect(); const hd = document.querySelector('.sh-in'); const l = document.getElementById('ct-rows'); const inner = innerWidth > 760 && l.scrollHeight > l.clientHeight + 1; const top = inner ? l.getBoundingClientRect().top : (hd ? hd.getBoundingClientRect().bottom : 0); return { open: row.classList.contains('expanded'), top: Math.round(rr.top), bottom: Math.round(rr.bottom), limit: Math.round(top), vh: innerHeight }; }, z);
   res.push({ a, z, before, minTop: Math.round(minTop), ...r });
  }
  const bad = res.filter(r => !r.open || r.top < r.limit - 1 || r.minTop < r.limit - 30 || (r.bottom > r.vh - 60 && r.top > r.limit + 4));
  ok(name + ': opened entry stays on screen, top never under the header', !bad.length, JSON.stringify(bad.length ? bad : res.map(r => [r.before, r.minTop, r.top, r.limit])));
  ok(name + ': no errors', !errs.length, errs.join(' | ')); await p.close(); }
 await b.close(); })();
