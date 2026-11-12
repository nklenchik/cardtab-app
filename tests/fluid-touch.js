// v52.52 finger-following checks on a phone: settings pages swipe back (and settle back on a short drag), a sheet flicked
// down closes, a slow short pull springs back, a sheet can be caught mid-move. Run with the app on :8765.
const { chromium, devices } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices[process.argv[2] === 'tablet' ? 'iPad (gen 7)' : 'iPhone 13'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'tc@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); });
  await p.reload(); await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (x0, y0, x1, y1, ms, hold) => { await touch('touchStart', x0, y0); const n = Math.max(6, Math.round(ms / 16)); for (let i = 1; i <= n; i++) { await touch('touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(ms / n); } if (hold) await p.waitForTimeout(hold); await touch('touchEnd'); };
  const W = await p.evaluate(() => innerWidth), H = await p.evaluate(() => innerHeight);
  // settings page
  await p.evaluate(() => CTMenu.open(document.getElementById('app-avatar'))); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('#app-menu [data-amp=display]').click()); await p.waitForTimeout(700);
  const box = await p.evaluate(() => { const r = document.getElementById('amp-display').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
  const pageX = () => p.evaluate(() => CTMotion.at(document.getElementById('amp-display'))[0]);
  const open = () => p.evaluate(() => !document.getElementById('amp-display').hidden && document.getElementById('amp-display').classList.contains('on'));
  // mid-drag it follows the finger
  await touch('touchStart', box.x + 40, box.y); for (let i = 1; i <= 8; i++) { await touch('touchMove', box.x + 40 + i * 12, box.y + 2); await p.waitForTimeout(16); }
  const mid = await pageX(); assert.ok(mid > 70 && mid < 110, 'follows the finger: ' + mid); await touch('touchEnd'); await p.waitForTimeout(800);
  assert.equal(await pageX(), 0, 'a short slow drag settles back'); assert.ok(await open());
  await drag(box.x + 40, box.y, box.x + 40 + box.w * 0.5, box.y + 5, 50); await p.waitForTimeout(900);
  assert.ok(!(await open()), 'a flick right goes back'); assert.ok(await p.evaluate(() => !document.getElementById('app-menu').hidden), 'the menu stays open');
  // caught mid-slide: reopen, then grab it while it's still sliding in
  await p.evaluate(() => document.querySelector('#app-menu [data-amp=display]').click()); await p.waitForTimeout(60);
  await touch('touchStart', box.x + box.w - 15, box.y); const caught = await pageX(); await p.waitForTimeout(150); const still = await pageX();
  assert.ok(caught > 1 && Math.abs(still - caught) < 1, 'caught mid-slide: stays under the finger ' + caught + ' ' + still); await touch('touchEnd'); await p.waitForTimeout(800); assert.equal(await pageX(), 0);
  // vertical scrolling on the page still scrolls, doesn't swipe
  await drag(box.x + 100, box.y + 100, box.x + 104, box.y - 100, 200); await p.waitForTimeout(500); assert.ok(await open(), 'scrolling stays scrolling');
  // v52.55 opening a page from lower in the menu: the menu stays where it was, the page covers what's showing, back returns there
  await p.evaluate(() => document.querySelector('#amp-display .amp-back').click()); await p.waitForTimeout(700);
  const sc = await p.evaluate(() => { const m = document.getElementById('app-menu'); m.scrollTop = 160; return m.scrollTop; });
  if (sc > 20) {
    await p.evaluate(() => document.querySelector('#app-menu [data-amp=money]').click()); await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const m = document.getElementById('app-menu'), g = document.getElementById('amp-money'); return [m.scrollTop, Math.round(g.getBoundingClientRect().top - m.getBoundingClientRect().top), Math.round(g.getBoundingClientRect().height - m.clientHeight)]; });
    assert.equal(r[0], sc, 'the menu keeps its place'); assert.ok(Math.abs(r[1]) <= 2 && Math.abs(r[2]) <= 2, 'the page covers the visible menu ' + r);
    await p.evaluate(() => document.querySelector('#amp-money .amp-back').click()); await p.waitForTimeout(700);
    assert.equal(await p.evaluate(() => document.getElementById('app-menu').scrollTop), sc, 'back returns to the same spot');
  }
  await p.evaluate(() => CTMenu.close()); await p.waitForTimeout(700);
  if (process.argv[2] === 'tablet') { assert.deepEqual(errs, []); console.log('fluid touch checks passed (tablet: settings pages; windows are centered there, not sheets)'); await b.close(); return; }
  // a sheet: Notification settings
  await p.evaluate(() => CTNotify.open('settings')); await p.waitForTimeout(800);
  const sh = await p.evaluate(() => { const f = document.querySelector('#ntf > *'); const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20 }; });
  const shY = () => p.evaluate(() => CTMotion.at(document.querySelector('#ntf > *'))[1]);
  await drag(sh.x, sh.y, sh.x, sh.y + 80, 500, 120); await p.waitForTimeout(80); const back1 = await shY(); await p.waitForTimeout(900);
  assert.ok(await p.evaluate(() => document.getElementById('ntf').open), 'a slow short pull keeps it open'); assert.ok(Math.abs(await shY()) < 1, 'and it springs back: ' + back1);
  // grab it while springing back, it stays put under the finger
  await drag(sh.x, sh.y, sh.x, sh.y + 90, 400, 120); await p.waitForTimeout(40); await touch('touchStart', sh.x, sh.y + 60); const c1 = await shY(); await p.waitForTimeout(120); const c2 = await shY();
  assert.ok(c1 > 5 && Math.abs(c1 - c2) < 1, 'caught while springing back ' + c1 + ' ' + c2); await touch('touchEnd'); await p.waitForTimeout(900);
  await drag(sh.x, sh.y, sh.x, sh.y + 160, 30); await p.waitForTimeout(900);
  assert.ok(!(await p.evaluate(() => document.getElementById('ntf').open)), 'a flick down closes it');
  // reopens cleanly (no leftover position)
  await p.evaluate(() => CTNotify.open('settings')); await p.waitForTimeout(800); assert.ok(Math.abs(await shY()) < 1, 'reopens in place');
  assert.deepEqual(errs, []); console.log('fluid touch checks passed (' + (process.argv[2] || 'phone') + ')'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
