// Settings pages: time from the tap to the first frame the page moves, and how long until it's in place, on an
// emulated iPhone slowed 4x. node subpage-latency.js   (v52.56)
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ ...devices['iPhone 13'] });
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'sl@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); });
  await p.reload(); await p.waitForTimeout(1500);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => CTMenu.open(document.getElementById('app-avatar'))); await p.waitForTimeout(900);
  for (const id of ['account', 'billing', 'entries', 'money', 'display', 'sharing', 'data', 'help']) {
    const r = await p.evaluate(async id => { const row = document.querySelector('#app-menu [data-amp="' + id + '"]'), pg = document.getElementById('amp-' + id); if (!row || !pg) return null;
      const xs = []; let run = true; const t0 = performance.now(); let work = 0;
      const tick = t => { const x = pg.hidden ? null : Math.round(pg.getBoundingClientRect().left); xs.push([Math.round(t - t0), x]); if (run) requestAnimationFrame(tick); };
      requestAnimationFrame(tick); const w0 = performance.now(); row.click(); work = performance.now() - w0;
      await new Promise(r => setTimeout(r, 900)); run = false;
      const end = xs[xs.length - 1][1], vis = xs.filter(x => x[1] != null); const first = vis.find((x, i) => i && x[1] !== vis[0][1]) || vis[0]; const settle = vis.find(x => Math.abs(x[1] - end) < 2);
      return { work: Math.round(work), first: first && first[0], settle: settle && settle[0] }; }, id);
    if (r) console.log(id.padEnd(9), 'tap handler', String(r.work).padStart(4) + 'ms', '| first move', String(r.first).padStart(4) + 'ms', '| in place', String(r.settle).padStart(4) + 'ms');
    await p.evaluate(id => { const b = document.querySelector('#amp-' + id + ' .amp-back'); if (b) b.click(); }, id); await p.waitForTimeout(800);
  }
  await b.close(); })();
