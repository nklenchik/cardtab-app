// v52.54 sheets stay exactly under the finger: drag the profile menu and Notification settings down a few pixels at a
// time, and check the gap between finger and sheet never changes (it used to trail by the pixels it took to decide).
const { chromium, devices } = require('playwright');
const assert = require('assert');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'sf@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); });
  await p.reload(); await p.waitForTimeout(1500); const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  for (const [name, open, sel, dy0] of [['Profile menu', 'CTMenu.open(document.getElementById("app-avatar"))', '#app-menu', 20], ['Notification settings (list)', 'CTNotify.open("settings")', '#ntf > *', 160]]) {
    await p.evaluate(open); await p.waitForTimeout(900);
    const top = () => p.evaluate(s => document.querySelector(s).getBoundingClientRect().top, sel);
    const t0 = await top(), x = 195, y0 = t0 + dy0; const gaps = [];
    await touch('touchStart', x, y0);
    for (let i = 1; i <= 12; i++) { const y = y0 + i * 3; await touch('touchMove', x, y); gaps.push(Math.round((y - await top()) * 10) / 10); }
    await touch('touchEnd'); await p.waitForTimeout(900);
    // (Chrome holds back the first ~15px of touch moves; Safari sends them all)
    const moving = gaps.slice(6); const spread = Math.max(...moving) - Math.min(...moving);
    console.log(name.padEnd(30), 'finger − sheet top:', gaps.join(' '), '| start gap', dy0);
    assert.ok(spread < 0.6 && Math.abs(moving[0] - dy0) < 0.6, name + ' should stay exactly under the finger');
    await p.evaluate(() => { CTMenu.close(); if (document.getElementById('ntf').open) CTNotify.close(); }); await p.waitForTimeout(700);
  }
  assert.deepEqual(errs, []); console.log('sheets follow the finger exactly'); await b.close(); })().catch(e => { console.error(e.message); process.exit(1); });
