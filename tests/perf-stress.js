// Rapid navigation stress: many fast tab switches and panel open/close cycles. Tracks memory after garbage collection,
// page size (elements), event listeners, long tasks, and how quickly each tap gets a response (Event Timing).
// node tests/perf-stress.js <phone|desktop> [cycles]
const { chromium, devices } = require('playwright');
const DEV = process.argv[2] || 'phone', CYC = +(process.argv[3] || 50);
(async () => { const b = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await b.newContext(DEV === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5, expires: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
  await p.addInitScript(() => { window.__lt = []; window.__ev = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => { if (/click|pointer(down|up)|keydown/.test(e.name)) window.__ev.push([e.startTime, e.duration, e.name]); })).observe({ type: 'event', durationThreshold: 16, buffered: true }); });
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
  await p.evaluate(async n => { const base = CTStore.all(); const more = []; for (let i = 0; i < n; i++) { const e = base[i % base.length], d = new Date(Date.UTC(2026, 10, 10) - Math.floor(i / 2) * 864e5); more.push({ type: e.type, name: e.name, amount: '12.00', date: d.toISOString().slice(0, 10), platform: e.platform }); } await CTStore.importMany(more); }, 385);
  await p.waitForTimeout(9000);
  const cdp = await ctx.newCDPSession(p); if (DEV === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const snap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await p.waitForTimeout(300); const m = await cdp.send('Performance.getMetrics').catch(() => null);
    const met = {}; if (m) m.metrics.forEach(x => met[x.name] = x.value);
    return { heapMB: +(met.JSHeapUsedSize / 1048576).toFixed(1), nodes: met.Nodes, listeners: met.JSEventListeners, docs: met.Documents, frames: met.Frames }; };
  await cdp.send('Performance.enable');
  const tabs = ['board', 'stories', 'entries'];
  const click = async sel => { const el = await p.$(sel); if (!el) return false; await el.click({ force: true, timeout: 2000 }).catch(() => {}); return true; };
  const tabSel = t => DEV === 'phone' ? '.ct-tbar button[data-tab="' + t + '"]' : '.ct-tabs button[data-tab="' + t + '"]';
  const per = {}; const mark = async (k, fn, wait) => { const a = await p.evaluate(() => performance.now()); await fn(); await p.waitForTimeout(wait); const lt = await p.evaluate(a => window.__lt.filter(x => x[0] >= a).map(x => x[1]), a); (per[k] = per[k] || []).push(...lt); };
  const s0 = await snap(); const t0 = await p.evaluate(() => performance.now()); const rows = [['start', s0]];
  for (let i = 1; i <= CYC; i++) {
    for (const t of tabs) await mark('tab ' + t, () => click(tabSel(t)), DEV === 'phone' ? 260 : 180);   // faster than the slide animations
    await mark('open Add New', () => p.evaluate(() => CTOpenAdd()), 150); await mark('close Add New', () => p.evaluate(() => CTAddSheet.close()), 150);
    await mark('open menu', () => click('#app-avatar'), 150); await mark('close menu', () => p.evaluate(() => window.CTMenu && CTMenu.close()), 150);
    await mark('open editor', () => p.evaluate(() => CTEditor.open(CTStore.all()[0])), 150); await mark('close editor', () => p.evaluate(() => CTEditor.close()), 150);
    if (i % 10 === 0) rows.push(['after ' + i, await snap()]);
  }
  await p.waitForTimeout(2500); rows.push(['settled', await snap()]);
  const r = await p.evaluate(t0 => { const lt = window.__lt.filter(x => x[0] >= t0), ev = window.__ev.filter(x => x[0] >= t0).map(x => x[1]).sort((a, b) => a - b);
    const q = pp => ev.length ? Math.round(ev[Math.min(ev.length - 1, Math.floor(pp * ev.length))]) : 0;
    return { longTasks: lt.length, worstTask: Math.round(Math.max(0, ...lt.map(x => x[1]))), tbt: Math.round(lt.reduce((t, x) => t + Math.max(0, x[1] - 50), 0)), slowTaps: ev.length, tapP75: q(.75), tapP98: q(.98), tapMax: Math.round(ev[ev.length - 1] || 0) }; }, t0);
  const page = await p.evaluate(() => ({ dialogsOpen: document.querySelectorAll('dialog[open]').length, onPage: window.CTPage && CTPage.cur, overflow: document.documentElement.style.overflow || document.body.style.overflow }));
  console.log(DEV, CYC, 'cycles (each: 3 tab switches, Add New, menu, editor open/close)');
  rows.forEach(([k, s]) => console.log('  ' + k.padEnd(10), 'heap ' + s.heapMB + 'MB  elements ' + s.nodes + '  listeners ' + s.listeners + '  documents ' + s.docs + '  frames ' + s.frames));
  console.log('  long tasks', r.longTasks, 'worst', r.worstTask + 'ms', 'blocked total', r.tbt + 'ms | taps slower than 16ms:', r.slowTaps, 'p75', r.tapP75 + 'ms', 'p98', r.tapP98 + 'ms', 'max', r.tapMax + 'ms');
  Object.entries(per).forEach(([k, v]) => { const n = v.length; console.log('    ' + k.padEnd(14), 'long tasks', n, 'avg', n ? Math.round(v.reduce((a, x) => a + x, 0) / n) : 0, 'max', Math.round(Math.max(0, ...v))); });
  console.log('  end state', JSON.stringify(page), 'errors', errs.slice(0, 3));
  await b.close(); })();
