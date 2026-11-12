// v52.59 swipe test (opt-in with ?swipe=1): swipe right on the Board goes back to Entries, on Stories back to the Board;
// a short slow drag springs back; mid-drag the page follows the finger. Run with the app on :8765.
const { chromium, devices } = require('playwright');
const assert = require('assert');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'sw@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); });
  await p.goto('http://localhost:8765/index.html?swipe=1'); await p.waitForTimeout(1500);
  await p.evaluate(async () => { await CTStore.setPlan('premium'); await CTStore._loadSample([{ date: CTStore.ymd(new Date()), type: 'sale', platform: 'eBay', name: 'Lugia V', amount: '200', fees: '20', ship: '4' }, { date: CTStore.ymd(new Date()), type: 'purchase', platform: 'TCGplayer', name: 'Umbreon', amount: '90' }]); });
  const cdp = await ctx.newCDPSession(p); const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (x0, y0, x1, ms) => { await touch('touchStart', x0, y0); const n = Math.max(5, Math.round(ms / 12)); for (let i = 1; i <= n; i++) { await touch('touchMove', x0 + (x1 - x0) * i / n, y0 + 2); await p.waitForTimeout(ms / n); } await touch('touchEnd'); };
  const cur = () => p.evaluate(() => CTPage.cur);
  // a spot on the board that isn't a button or chart
  const spot = () => p.evaluate(() => { const ok = el => el && el.closest('.cbx') && !el.closest('svg,canvas,input,button,a,.grip'); for (let y = 200; y < 700; y += 20) for (let x = 60; x < 330; x += 20) { const el = document.elementFromPoint(x, y); if (ok(el)) return { x, y }; } return null; });
  await p.evaluate(() => CTTabGo('board')); await p.waitForTimeout(2500); assert.equal(await cur(), 'board');
  let pt = await spot(); assert.ok(pt, 'found a spot on the board');
  // mid-drag: follows the finger
  await touch('touchStart', Math.max(30, pt.x), pt.y); for (let i = 1; i <= 8; i++) { await touch('touchMove', Math.max(30, pt.x) + i * 12, pt.y + 1); await p.waitForTimeout(16); }
  const mid = await p.evaluate(() => CTMotion.at(document.querySelector('.cbx'))[0]); assert.ok(mid > 50 && mid < 100, 'board follows the finger: ' + mid); await touch('touchEnd'); await p.waitForTimeout(900);
  assert.equal(await cur(), 'board', 'a short slow drag springs back'); assert.equal(await p.evaluate(() => CTMotion.at(document.querySelector('.cbx'))[0]), 0);
  await drag(Math.max(30, pt.x), pt.y, Math.max(30, pt.x) + 150, 40); await p.waitForTimeout(1000);
  assert.equal(await cur(), 'entries', 'a flick right goes back to Entries');
  assert.equal(await p.evaluate(() => CTMotion.at(document.querySelector('#view-app .ct-app'))[0]), 0, 'entries in place');
  // Stories -> Board
  await p.evaluate(() => CTTabGo('stories')); await p.waitForTimeout(4000); assert.equal(await cur(), 'stories');
  const off = await p.evaluate(() => { const r = document.querySelector('#csx iframe').getBoundingClientRect(); return { x: r.left, y: r.top }; });
  const fr = p.frames().find(f => f !== p.mainFrame());
  const sp = await fr.evaluate(() => { const ok = el => el && !el.closest('svg,canvas,input,button,a,.sheetw'); for (let y = 250; y < 650; y += 25) for (let x = 60; x < 330; x += 25) { const el = document.elementFromPoint(x, y); if (ok(el)) { let sc = false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) sc = true; } if (!sc) return { x, y }; } } return null; });
  assert.ok(sp, 'found a spot on Stories');
  await p.waitForTimeout(400); 
  await drag(off.x + Math.max(30, sp.x), off.y + sp.y, off.x + Math.max(30, sp.x) + 240, 40); await p.waitForTimeout(1200);
  assert.equal(await cur(), 'board', 'a flick right on Stories goes back to the Board');
  // off unless switched on
  await p.goto('http://localhost:8765/index.html?swipe=0'); await p.waitForTimeout(1200); assert.equal(await p.evaluate(() => localStorage.getItem('ct.swipe')), null);
  assert.deepEqual(errs, []); console.log('swipe test passed'); await b.close(); })().catch(e => { console.error(e.message); process.exit(1); });
