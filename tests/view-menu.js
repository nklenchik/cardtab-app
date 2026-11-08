// v50.56: phones switch views with one button and a menu; computers keep the four buttons
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
 for (const [name, opt] of [['phone 320', { ...devices['iPhone 13'], viewport: { width: 320, height: 640 }, colorScheme: 'dark' }], ['phone 390', { ...devices['iPhone 13'] }], ['desktop', { viewport: { width: 1280, height: 860 } }]]) {
  const p = await b.newPage(opt); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'vm@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const f = document.querySelector('.ct-fbar'); scrollTo(0, f.getBoundingClientRect().top + scrollY - 160); }); await p.waitForTimeout(400);
  const tag = name.replace(' ', '');
  if (name.startsWith('phone')) {
   const r = await p.evaluate(() => { const v = document.querySelector('.fb-vbtn').getBoundingClientRect(), d = document.querySelector('.fb-dds').getBoundingClientRect(); return { sameRow: Math.abs((v.top + v.bottom) / 2 - (d.top + d.bottom) / 2) < 12, h: Math.round(v.height), w: Math.round(v.width), right: Math.round(v.right), vw: innerWidth }; });
   ok(name + ': one button on the Platform/sort row', r.sameRow && r.h >= 40 && r.right <= r.vw, JSON.stringify(r));
   await p.screenshot({ path: 'out-qa/vm-' + tag + '-closed.png' });
   await p.tap('.fb-vbtn'); await p.waitForTimeout(350);
   ok(name + ': menu opens', await p.evaluate(() => document.querySelector('.fb-view').classList.contains('open') && getComputedStyle(document.querySelector('.fb-vopts')).visibility === 'visible'));
   const mr = await p.evaluate(() => { const m = document.querySelector('.fb-vopts').getBoundingClientRect(); return { l: Math.round(m.left), r: Math.round(m.right), vw: innerWidth }; });
   ok(name + ': menu stays on screen', mr.l >= 0 && mr.r <= mr.vw, JSON.stringify(mr));
   await p.screenshot({ path: 'out-qa/vm-' + tag + '-open.png' });
   await p.tap('.fb-vopts [data-gs="m"]'); await p.waitForTimeout(700);
   ok(name + ': picking Grid switches and closes', await p.evaluate(() => !!document.querySelector('#ct-rows .ct-tile') && !document.querySelector('.fb-view').classList.contains('open')));
   ok(name + ': button shows the grid icon', await p.evaluate(() => document.querySelector('.fb-vi').innerHTML === document.querySelector('.fb-vopts [data-gs="m"] svg').outerHTML));
   await p.tap('.fb-vbtn'); await p.waitForTimeout(300); await p.mouse.click(30, 100); await p.waitForTimeout(300);
   ok(name + ': tapping outside closes it', await p.evaluate(() => !document.querySelector('.fb-view').classList.contains('open')));
  } else {
   const r = await p.evaluate(() => [...document.querySelectorAll('.fb-vopts button')].map(x => { const q = x.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; }));
   ok('desktop: four bigger buttons', r.length === 4 && r.every(([w, h]) => w >= 38 && h >= 34), JSON.stringify(r));
   ok('desktop: no phone button', await p.evaluate(() => getComputedStyle(document.querySelector('.fb-vbtn')).display === 'none'));
   await p.click('.fb-vopts [data-view="list"]'); await p.waitForTimeout(600); ok('desktop: list works', await p.evaluate(() => !!document.querySelector('#ct-rows .ct-row')));
   await p.screenshot({ path: 'out-qa/vm-desktop.png', clip: { x: 300, y: 0, width: 980, height: 400 } });
  }
  ok(name + ': no errors', !errs.length, errs.join(' | ')); await p.close(); }
 await b.close(); })();
