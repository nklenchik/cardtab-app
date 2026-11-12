// Long lists: 100 / 1,000 / 5,000 entries with card art. Startup, scrolling (fling-speed and a long deep scroll that keeps
// loading more), expanding an entry near the bottom, and search. node tests/perf-lists.js <phone|desktop>
const { chromium, devices } = require('playwright');
const DEV = process.argv[2] || 'phone';
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0; };
(async () => { const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  for (const N of [100, 1000, 5000]) { const ctx = await b.newContext(DEV === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
    await p.goto('http://localhost:8765/index.html');
    await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5, expires: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
    await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
    await p.evaluate(async n => { const base = CTStore.all(); const more = []; const need = n - base.length; for (let i = 0; i < need; i++) { const e = base[i % base.length], d = new Date(Date.UTC(2026, 10, 10) - Math.floor(i * (1100 / Math.max(1, need))) * 864e5); more.push({ type: e.type, name: e.name, amount: String((10 + (i % 90)).toFixed(2)), date: d.toISOString().slice(0, 10), platform: e.platform }); } if (more.length) await CTStore.importMany(more); }, N);
    await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); });
    await p.waitForTimeout(2500); const cdp = await ctx.newCDPSession(p); if (DEV === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.reload(); await p.waitForTimeout(7000);
    const st = await p.evaluate(() => { const lt = window.__lt.filter(x => x[0] < 7000); return { tbt: Math.round(lt.reduce((t, x) => t + Math.max(0, x[1] - 50), 0)), worst: Math.round(Math.max(0, ...lt.map(x => x[1]))), heap: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) }; });
    // all-time range so every entry is in the list
    await p.evaluate(() => { const s = document.getElementById('ct-period'); if (s) { const o = [...s.options].find(o => /all/i.test(o.value) || /all time/i.test(o.textContent)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); } } }); await p.waitForTimeout(1500);
    const rec = async (act, ms) => { await p.evaluate(() => { window.__f = []; window.__t0 = performance.now(); let l = performance.now(); const id = (window.__id = (window.__id || 0) + 1); const k = t => { if (window.__id !== id) return; window.__f.push(t - l); l = t; requestAnimationFrame(k); }; requestAnimationFrame(k); });
      await act(); await p.waitForTimeout(ms); return p.evaluate(() => { window.__id++; const f = window.__f.slice(1), lt = window.__lt.filter(x => x[0] >= window.__t0); return { f, task: Math.round(Math.max(0, ...lt.map(x => x[1]))) }; }); };
    const fmt = r => 'p95 ' + q(r.f, .95).toFixed(0) + ' p99 ' + q(r.f, .99).toFixed(0) + ' >25ms ' + r.f.filter(x => x > 25).length + '/' + r.f.length + ' task ' + r.task;
    const fling = await rec(() => p.evaluate(() => new Promise(r => { let y = 0; const s = () => { y += 45; scrollTo(0, y); if (y < 4000) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 600);
    const deep = await rec(() => p.evaluate(() => new Promise(r => { let y = scrollY, n = 0; const s = () => { y += 70; scrollTo(0, y); if (++n < 400) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 1500);
    const rows = await p.evaluate(() => document.querySelectorAll('#ct-rows .ct-row, #ct-rows .ct-tile').length), dom = await p.evaluate(() => document.getElementsByTagName('*').length);
    const imgs = await p.evaluate(() => { const i = [...document.querySelectorAll('#ct-rows img')]; return i.length + ' imgs, ' + i.filter(x => x.complete && x.naturalWidth).length + ' loaded, widest file ' + Math.max(0, ...i.map(x => x.naturalWidth)) + 'px'; });
    await p.evaluate(() => { window.__t = [...document.querySelectorAll('#ct-rows .ct-row-toggle, #ct-rows .ct-tile')].filter(x => { const r = x.getBoundingClientRect(); return r.top > 100 && r.bottom < innerHeight - 100; })[0]; }); await p.waitForTimeout(500);   // picked before measuring
    const exp = await rec(() => p.evaluate(() => { if (window.__t) window.__t.click(); }), 1000);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
    const search = await rec(async () => { await p.evaluate(() => document.getElementById('ct-search').focus()); await p.keyboard.type('pika', { delay: 90 }); }, 900);
    console.log(DEV, N, 'entries | startup blocked ' + st.tbt + 'ms, longest ' + st.worst + 'ms, heap ' + st.heap + 'MB');
    console.log('   fling scroll   ', fmt(fling)); console.log('   deep scroll    ', fmt(deep), '| rows in page ' + rows + ', DOM ' + dom + ', ' + imgs);
    console.log('   expand an entry', fmt(exp)); console.log('   search typing  ', fmt(search));
    await ctx.close(); }
  await b.close(); })();
