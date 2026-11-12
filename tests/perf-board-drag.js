// Board drag and resize, frame by frame, with touch input on a phone (or mouse on desktop). Long-press to pick up on
// phones is handled by the Board's edit mode (Edit on first). Reports per-frame times during the move and the drop,
// how far the widget lags the finger, and the longest tasks with the functions behind them.
// node tests/perf-board-drag.js <phone|desktop> [slow]
const { chromium, devices } = require('playwright');
const DEV = process.argv[2] || 'phone', SLOW = process.argv[3] === 'slow';
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(DEV === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5, expires: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
  await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); });
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
  await p.evaluate(async n => { const base = CTStore.all(); const more = []; for (let i = 0; i < n; i++) { const e = base[i % base.length], d = new Date(Date.UTC(2026, 10, 10) - Math.floor(i / 2) * 864e5); more.push({ type: e.type, name: e.name, amount: '12.00', date: d.toISOString().slice(0, 10), platform: e.platform }); } await CTStore.importMany(more); }, 985);
  await p.waitForTimeout(8000);
  await p.evaluate(() => { const x = [...document.querySelectorAll('.ct-tbar button, .ct-tabs button')].find(x => x.offsetParent && /board/i.test(x.textContent)); x.click(); }); await p.waitForTimeout(3000);
  await p.evaluate(() => document.getElementById('cb-edit').click()); await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p); if (SLOW) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  const down = (x, y) => DEV === 'phone' ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }) : p.mouse.move(x, y).then(() => p.mouse.down());
  const move = (x, y) => DEV === 'phone' ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }) : p.mouse.move(x, y);
  const up = () => DEV === 'phone' ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : p.mouse.up();
  const top = (prof, n) => { const byId = new Map(prof.nodes.map(x => [x.id, x])), par = new Map(); prof.nodes.forEach(x => (x.children || []).forEach(c => par.set(c, x.id))); const inc = new Map();
    for (let i = 0; i < prof.samples.length; i++) { let id = prof.samples[i]; const seen = new Set(); while (id) { const x = byId.get(id), f = x.callFrame, k = (f.functionName || '(anon)') + ' ' + (f.url || '').split('/').pop().split('?')[0] + ':' + (f.lineNumber + 1); if (!seen.has(k)) { seen.add(k); inc.set(k, (inc.get(k) || 0) + (prof.timeDeltas[i] || 0)); } id = par.get(id); } }
    return [...inc.entries()].filter(([k]) => !/^\((root|program|idle|garbage)|evaluate|InjectedScript|:1$|^\(anon\) :0/.test(k)).sort((a, c) => c[1] - a[1]).slice(0, n).map(([k, v]) => Math.round(v / 1000) + 'ms ' + k).join(' · '); };
  for (const kind of ['move', 'resize']) {
    const sel = kind === 'move' ? '#cb .simple>.w:nth-child(2)' : '#cb .simple>.w .grip';
    const h = await p.$(sel); await h.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(500); const bb = await h.boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
    await p.evaluate(() => { window.__f = []; window.__t0 = performance.now(); let l = performance.now(); const id = (window.__id = (window.__id || 0) + 1); const k = t => { if (window.__id !== id) return; window.__f.push([Math.round(t - window.__t0), Math.round(t - l)]); l = t; requestAnimationFrame(k); }; requestAnimationFrame(k); });
    await cdp.send('Profiler.start');
    await down(x, y); if (DEV === 'phone' && kind === 'move') await p.waitForTimeout(450);   // press and hold to pick up
    const tUp0 = await p.evaluate(() => performance.now());
    const dx = kind === 'move' ? 150 : 170, dy = kind === 'move' ? 220 : 160;
    for (let i = 1; i <= 30; i++) { await move(x + dx * i / 30, y + dy * i / 30); await p.waitForTimeout(16); }
    const tUp = await p.evaluate(() => performance.now()); await up(); await p.waitForTimeout(1200);
    const { profile } = await cdp.send('Profiler.stop');
    const r = await p.evaluate(([a, u]) => { window.__id++; const f = window.__f.slice(1); const during = f.filter(x => x[0] + window.__t0 >= a && x[0] + window.__t0 < u).map(x => x[1]), after = f.filter(x => x[0] + window.__t0 >= u).map(x => x[1]);
      const lt = window.__lt.filter(x => x[0] >= a); return { during, after, ltDuring: lt.filter(x => x[0] < u).map(x => Math.round(x[1])), ltDrop: lt.filter(x => x[0] >= u).map(x => Math.round(x[1])) }; }, [tUp0, tUp]);
    const st = a => 'frames ' + a.length + ', over 25ms ' + a.filter(x => x > 25).length + ', worst ' + Math.max(0, ...a) + 'ms';
    console.log(DEV + (SLOW ? ' (4x slower CPU)' : ''), kind.toUpperCase(), '| while moving: ' + st(r.during) + ' long tasks ' + JSON.stringify(r.ltDuring) + ' | on drop: ' + st(r.after.slice(0, 40)) + ' long tasks ' + JSON.stringify(r.ltDrop));
    console.log('   top functions:', top(profile, 7));
    await p.waitForTimeout(800);
  }
  console.log('errors', errs.slice(0, 3)); await b.close(); })();
