// What the browser spends its time on when a window opens (style, layout, paint, script), on an emulated iPhone slowed
// 4x with 300 entries. node tap-trace.js ["Premium"]   (v52.55)
const { chromium, devices } = require('playwright');
const only = process.argv[2] || '';
const STEPS = [
  ['Premium', p => p.evaluate(() => CTPremiumOpen('x')), p => p.evaluate(() => document.querySelector('dialog[open]') && document.querySelector('dialog[open]').close())],
  ['Board', p => p.evaluate(() => CTTabGo('board')), p => p.evaluate(() => CTTabGo('entries'))],
  ['Ask', p => p.evaluate(() => CTAskOpen()), p => p.evaluate(() => document.querySelector('dialog[open]') && document.querySelector('dialog[open]').close())],
  ['Entry open', p => p.evaluate(() => document.querySelector('#ct-rows .ct-row:nth-child(3) .ct-row-toggle').click()), p => p.evaluate(() => document.querySelector('#ct-rows .ct-row:nth-child(3) .ct-row-toggle').click())],
  ['Search', p => p.evaluate(() => { const q = document.getElementById('ct-search'); q.value = 'char'; q.dispatchEvent(new Event('input', { bubbles: true })); }), p => p.evaluate(() => { const q = document.getElementById('ct-search'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); })],
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ ...devices['iPhone 13'] }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'tt@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); });
  await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const P = ['eBay', 'TCGplayer', 'Whatnot', 'Card show'], N = ['Charizard ex', 'Pikachu VMAX', 'Lugia V', 'Umbreon VMAX', 'Black Lotus', 'Mewtwo GX'], d = new Date(), rows = [];
    for (let i = 0; i < 300; i++) { const dt = new Date(d); dt.setDate(d.getDate() - Math.floor(i / 2)); rows.push({ date: CTStore.ymd(dt), type: i % 3 ? 'sale' : 'purchase', platform: P[i % 4], name: N[i % 6] + ' #' + i, amount: String(10 + (i * 7) % 300), fees: String((i * 3) % 30), ship: '4' }); }
    await CTStore._loadSample(rows); });
  await p.waitForTimeout(2500);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (const [name, open, close] of STEPS) {
    if (only && !name.includes(only)) continue;
    // warm once (first open loads code), then measure the second
    await open(p); await p.waitForTimeout(900); await close(p); await p.waitForTimeout(900);
    const events = []; cdp.on('Tracing.dataCollected', d => events.push(...d.value));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
    await open(p); await p.waitForTimeout(700);
    const done = new Promise(r => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done; cdp.removeAllListeners('Tracing.dataCollected');
    const tot = {}; let task = 0;
    for (const e of events) { if (e.ph !== 'X' || !e.dur) continue; const n = e.name; if (n === 'RunTask') task = Math.max(task, e.dur / 1000);
      if (['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'FunctionCall', 'EvaluateScript', 'TimerFire', 'HitTest', 'Commit', 'RasterTask'].includes(n)) tot[n] = (tot[n] || 0) + e.dur / 1000; }
    const lay = events.filter(e => e.name === 'Layout' && e.args && e.args.beginData).map(e => [Math.round(e.dur / 1000), e.args.beginData.dirtyObjects, e.args.beginData.totalObjects, (e.args.beginData.stackTrace || [])[0]]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    console.log(name.padEnd(11), 'longest task', Math.round(task) + 'ms |', Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => k.replace('UpdateLayoutTree', 'Style') + ' ' + Math.round(v)).join(', '));
    if (process.env.DEEP) { const lt = events.filter(e => e.name === 'RunTask' && e.dur).sort((a, b) => b.dur - a.dur)[0];
      const inside = events.filter(e => e.ph === 'X' && e.dur && e.ts >= lt.ts && e.ts + e.dur <= lt.ts + lt.dur && e !== lt && e.dur > 1500);
      inside.sort((a, b) => a.ts - b.ts).forEach(e => console.log('              ' + String(Math.round(e.dur / 100) / 10).padStart(6) + 'ms', e.name, e.args && e.args.data ? (e.args.data.functionName || '') + ' ' + String(e.args.data.url || '').split('/').pop() + ':' + e.args.data.lineNumber : '')); }
    const sty = events.filter(e => e.name === 'UpdateLayoutTree' && e.dur).map(e => [Math.round(e.dur / 1000), (e.args && e.args.elementCount) || 0, ((e.args && e.args.beginData && e.args.beginData.stackTrace) || [])[0]]).sort((a, b) => b[0] - a[0]).slice(0, 4);
    sty.forEach(l => console.log('            style', l[0] + 'ms', l[1] + ' elements', l[2] ? l[2].functionName + ' ' + (l[2].url || '').split('/').pop() + ':' + l[2].lineNumber : '(by the browser)'));
    lay.forEach(l => console.log('            layout', l[0] + 'ms', l[1] + '/' + l[2] + ' objects', l[3] ? l[3].functionName + ' ' + (l[3].url || '').split('/').pop() + ':' + l[3].lineNumber : '(by the browser)'));
    await close(p); await p.waitForTimeout(900);
  }
  await b.close();
})();
