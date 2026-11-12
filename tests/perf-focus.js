// Focused check: a delete + undo, then (after a settle gap) a light/dark switch and a Board edit toggle, each measured on its own.
// node tests/perf-focus.js <gapMs> — phone size, CPU 4x, 3,000 entries, 3 runs; prints the longest task per step.
const { chromium, devices } = require('playwright');
const GAP = +(process.argv[2] || 4000);
(async () => { const b = await chromium.launch(); const out = {};
  for (let run = 0; run < 3; run++) { const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
    await p.goto('http://localhost:8765/index.html');
    await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5, expires: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
    await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); });
    await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
    await p.evaluate(async n => { const base = CTStore.all(); const more = []; for (let i = 0; i < n; i++) { const e = base[i % base.length], d = new Date(Date.UTC(2026, 10, 10) - Math.floor(i / 3) * 864e5); more.push({ type: e.type, name: e.name, amount: '12.00', date: d.toISOString().slice(0, 10), platform: e.platform }); } await CTStore.importMany(more); }, 2980);
    await p.reload(); await p.waitForTimeout(9000);
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const step = async (k, act, ms) => { const t0 = await p.evaluate(() => performance.now()); await act(); await p.waitForTimeout(ms); const m = await p.evaluate(t0 => Math.round(Math.max(0, ...window.__lt.filter(x => x[0] >= t0).map(x => x[1]))), t0); (out[k] = out[k] || []).push(m); };
    await step('delete + undo (interaction window 1.7s)', async () => { await p.evaluate(async () => { const e = CTStore.all()[3]; window.__d = JSON.parse(JSON.stringify(e)); await CTStore.remove(e.id); }); await p.waitForTimeout(500); await p.evaluate(async () => { const e = window.__d; delete e.id; await CTStore.add(e); }); }, 1200);
    await step('...the quiet catch-up after it', async () => {}, GAP);
    await step('dark mode switch', () => p.emulateMedia({ colorScheme: 'dark' }), 1200);
    await step('light mode switch', () => p.emulateMedia({ colorScheme: 'light' }), 1200);
    await ctx.close(); }
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(42), 'longest task per run', v.join(' / '), 'ms');
  await b.close(); })();
