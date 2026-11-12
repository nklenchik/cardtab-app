// Fluid audit (v52.52): for each window, how its first frames look on a slowed phone: time from tap to first movement,
// and the biggest visible jump (share of the whole slide skipped in one frame). Run with the app on :8765.
// node fluid-audit.js [phone|tablet|desk]
const { chromium, devices } = require('playwright');
const which = process.argv[2] || 'phone';
const W = [
  ['Add a card', 'CTAddSheet.open()', '#as > *', 'CTAddSheet.close()'],
  ['Budget', 'CTBudget.open()', '#bu-sheet > *', 'CTBudget.shut()'],
  ['Notifications', 'CTNotify.open()', '#ntf > *', 'CTNotify.close()'],
  ['Notification settings', 'CTNotify.open("settings")', '#ntf > *', 'CTNotify.close()'],
  ['Profile menu', 'CTMenu.open(document.getElementById("app-avatar"))', '#app-menu', 'CTMenu.close()'],
  ['Settings page', 'document.querySelector("#app-menu [data-amp=display]").click()', '#amp-display', 'document.querySelector("#amp-display .amp-back").click()', 'menu'],
];
(async () => {
  const b = await chromium.launch();
  const opt = which === 'desk' ? { viewport: { width: 1280, height: 860 } } : which === 'tablet' ? { ...devices['iPad (gen 7)'] } : { ...devices['iPhone 13'] };
  const p = await b.newPage(opt); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'fl@x.test', name: 'Nick', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); });
  await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelectorAll('.ct-hint,.cbhint,.ct-a2hs').forEach(x => x.remove()));
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const watch = (code, sel) => p.evaluate(async ([code, sel]) => {
    const pos = el => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top]; };
    const out = []; let run = true; const t0 = performance.now();
    const tick = t => { const el = document.querySelector(sel); out.push([t - t0, pos(el)]); if (run) requestAnimationFrame(tick); };
    (0, eval)(code); requestAnimationFrame(tick);
    await new Promise(r => setTimeout(r, 800)); run = false;
    const pts = out.filter(x => x[1]); if (pts.length < 2) return { note: 'not found' };
    const end = pts[pts.length - 1][1], start = pts[0][1], dist = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
    // only frames while it's actually moving (and visible), so a hidden start or end doesn't count
    const vis = pts.filter(x => x[1][0] || x[1][1]); let firstMove = null, lastMove = null, gaps = 0, worst = 0;
    for (let i = 1; i < vis.length; i++) { const d = Math.hypot(vis[i][1][0] - vis[i - 1][1][0], vis[i][1][1] - vis[i - 1][1][1]); if (d > 0.5) { if (firstMove == null) firstMove = i; lastMove = i; } }
    if (firstMove != null) for (let i = firstMove; i <= lastMove; i++) { const g = vis[i][0] - vis[i - 1][0]; worst = Math.max(worst, g); if (g > 25) gaps++; }
    return { firstMove: firstMove == null ? null : Math.round(vis[firstMove][0]), frames: firstMove == null ? 0 : lastMove - firstMove + 1, gaps, worst: Math.round(worst) };
  }, [code, sel]);
  for (const [name, open, sel, close, pre] of W) {
    if (pre === 'menu') { await p.evaluate(() => CTMenu.open(document.getElementById('app-avatar'))); await p.waitForTimeout(700); }
    const o = await watch(open, sel); await p.waitForTimeout(400); const c = await watch(close, sel); await p.waitForTimeout(500);
    if (pre === 'menu') { await p.evaluate(() => CTMenu.close()); await p.waitForTimeout(500); }
    const f = r => r.note || (r.firstMove == null ? 'no movement seen' : 'starts ' + r.firstMove + 'ms after the tap, ' + r.frames + ' frames moving, ' + r.gaps + ' slow (worst ' + r.worst + 'ms)');
    console.log(name.padEnd(22) + ' OPEN  ' + f(o) + '\n' + ''.padEnd(22) + ' CLOSE ' + f(c));
  }
  await b.close();
})();
