// Rendering breakdown (style, layout, paint, raster, script) for a few interactions, from a Chrome trace. Phone size, CPU 4x.
const { chromium, devices } = require('playwright');
const SIZE = process.argv[2] || 'medium', N = { small: 25, medium: 400, large: 3000 }[SIZE];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'perf@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5, expires: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1800);
  await p.evaluate(async n => { const base = CTStore.all(); const more = []; const need = n - base.length;
    for (let i = 0; i < need; i++) { const e = base[i % base.length], d = new Date(Date.UTC(2026, 10, 10) - Math.floor(i * (1000 / Math.max(1, need))) * 864e5);
      more.push({ type: e.type, name: e.name, amount: String(((e.amount || 1000) / 100).toFixed(2)), date: d.toISOString().slice(0, 10), platform: e.platform }); }
    if (more.length) await CTStore.importMany(more); }, N);
  await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const NAMES = { UpdateLayoutTree: 'style', Layout: 'layout', Paint: 'paint', PrePaint: 'prepaint', Layerize: 'layerize', 'RasterTask': 'raster', CompositeLayers: 'composite', FunctionCall: 'script', EvaluateScript: 'script', 'v8.compile': 'compile', TimerFire: 'script', FireAnimationFrame: 'script', EventDispatch: 'script', ParseHTML: 'parse', 'Decode Image': 'decode', 'ImageDecodeTask': 'decode', 'GPUTask': 'gpu', HitTest: 'hittest', 'ScheduleStyleRecalculation': null };
  const trace = async (label, act, ms) => {
    await b.startTracing(p, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc', 'gpu'] });
    try { await act(); } catch (e) { console.log(label, 'ERR', e.message.slice(0, 80)); } await p.waitForTimeout(ms);
    const buf = await b.stopTracing(); const ev = JSON.parse(buf.toString()).traceEvents;
    const main = ev.find(e => e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain'); const tid = main && main.tid, pid = main && main.pid;
    const sum = {}, big = {}; let styleN = 0, maxStyle = 0, maxEls = 0;
    for (const e of ev) { if (e.ph !== 'X' || !e.dur) continue; const k = NAMES[e.name]; if (!k) continue; const onMain = e.tid === tid && e.pid === pid;
      if (!onMain && !['raster', 'decode', 'gpu'].includes(k)) continue; sum[k] = (sum[k] || 0) + e.dur / 1000; big[k] = Math.max(big[k] || 0, e.dur / 1000);
      if (k === 'style') { styleN++; maxStyle = Math.max(maxStyle, e.dur / 1000); const el = e.args && e.args.elementCount; if (el) maxEls = Math.max(maxEls, el); } }
    console.log(label.padEnd(26), Object.entries(sum).sort((a, c) => c[1] - a[1]).map(([k, v]) => k + ' ' + Math.round(v) + 'ms(max ' + Math.round(big[k]) + ')').join('  '), '| style recalcs ' + styleN + (maxEls ? ', most elements ' + maxEls : ''));
  };
  const tab = t => p.evaluate(t => { const x = [...document.querySelectorAll('.ct-tbar button, .ct-tabs button')].find(x => x.offsetParent && new RegExp(t, 'i').test(x.textContent)); x.click(); }, t);
  await trace('scroll entries', () => p.evaluate(() => new Promise(r => { let y = 0; const s = () => { y += 30; scrollTo(0, y); if (y < 3000) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 500);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  await trace('expand entry', () => p.evaluate(() => document.querySelector('#ct-rows .ct-row-toggle').click()), 900);
  await trace('search typing', async () => { await p.evaluate(() => document.getElementById('ct-search').focus()); await p.keyboard.type('charizard', { delay: 70 }); }, 800);
  await p.evaluate(() => { const s = document.getElementById('ct-search'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); s.blur(); }); await p.waitForTimeout(800);
  await trace('open menu', () => p.click('#app-avatar'), 900);
  await p.evaluate(() => window.CTMenu && CTMenu.close()); await p.waitForTimeout(700);
  await trace('dark mode switch', () => p.emulateMedia({ colorScheme: 'dark' }), 900);
  await trace('to Board', () => tab('board'), 2500);
  await p.evaluate(() => document.querySelectorAll('.cbhint').forEach(h => h.remove()));
  await trace('scroll Board', () => p.evaluate(() => new Promise(r => { let y = 0; const s = () => { y += 30; scrollTo(0, y); if (y < 1500) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 500);
  await p.evaluate(() => scrollTo(0, 0));
  await trace('Board edit on', () => p.evaluate(() => document.getElementById('cb-edit').click()), 1000);
  await trace('Board edit off', () => p.evaluate(() => document.getElementById('cb-edit').click()), 1000);
  await trace('to Stories', () => tab('stories'), 2500);
  for (const fr of p.frames()) { if (await fr.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) { await fr.evaluate(() => document.querySelector('#shelf .hero').click()); break; } }
  await p.waitForTimeout(1500);
  await trace('Stories playing', async () => {}, 2000);
  await b.close();
})();
