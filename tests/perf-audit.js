// Performance audit harness (v52.33). Repeatable: node tests/perf-audit.js <desktop|tablet|phone> <small|medium|large> [runs]
// Seeds an account (25 / 400 / 3000 entries), reloads like a returning user, then measures each interaction:
// frame times from requestAnimationFrame (fps, p95, p99, frames over 25ms), long tasks (>50ms) and their blocking time,
// the slowest input event (Event Timing, an INP stand-in), plus startup LCP, CLS, DOM size and JS heap.
// Phone runs slow the CPU 4x (a rough mid-range phone); this is emulation, not a real device.
const { chromium, devices } = require('playwright');
const DEV = process.argv[2] || 'desktop', SIZE = process.argv[3] || 'medium', RUNS = +(process.argv[4] || 1);
const N = { small: 25, medium: 400, large: 3000 }[SIZE];
const CTX = { desktop: { viewport: { width: 1440, height: 900 } }, tablet: { ...devices['iPad Pro 11'] }, phone: { ...devices['iPhone 13'] } }[DEV];
const q = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

(async () => {
  const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const all = {};
  for (let run = 0; run < RUNS; run++) {
    const ctx = await b.newContext(CTX); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8765/index.html');
    await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'perf@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5, expires: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
    await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1800);
    await p.evaluate(async n => { const base = CTStore.all(); const more = []; const need = n - base.length;
      for (let i = 0; i < need; i++) { const e = base[i % base.length], d = new Date(Date.UTC(2026, 10, 10) - Math.floor(i * (1000 / Math.max(1, need))) * 864e5);
        more.push({ type: e.type, name: e.name, amount: String(((e.amount || 1000) / 100 * (0.6 + (i % 9) / 10)).toFixed(2)), net: e.net != null ? String((e.net / 100).toFixed(2)) : undefined, date: d.toISOString().slice(0, 10), platform: e.platform }); }
      if (more.length) await CTStore.importMany(more); }, N);
    await p.waitForTimeout(2500);
    const count = await p.evaluate(() => CTStore.all().length);
    const cdp = await ctx.newCDPSession(p);
    // ---- startup, as a returning user (data already on the device) ----
    await p.addInitScript(() => { window.__lt = []; window.__ev = []; window.__cls = 0; window.__lcp = 0;
      try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push({ s: e.startTime, d: e.duration }))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
      try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__ev.push({ s: e.startTime, d: e.duration, n: e.name }))).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) {}
      try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
      try { new PerformanceObserver(l => l.getEntries().forEach(e => { window.__lcp = e.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {} });
    if (DEV === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.reload(); await p.waitForTimeout(6000);
    const start = await p.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; const lt = window.__lt.filter(x => x.s < 6000);
      return { lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), domReady: Math.round(nav.domContentLoadedEventEnd), loaded: Math.round(nav.loadEventEnd), longTasks: lt.length, tbt: Math.round(lt.reduce((t, x) => t + Math.max(0, x.d - 50), 0)), worstTask: Math.round(Math.max(0, ...lt.map(x => x.d))), lastTaskEnd: Math.round(Math.max(0, ...lt.map(x => x.s + x.d))), dom: document.getElementsByTagName('*').length, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, rows: document.querySelectorAll('#ct-rows .ct-row, #ct-rows .ct-tile').length }; });
    const R = { entries: count, startup: start, ix: {} };
    // ---- interactions ----
    const rec = async (label, act, ms = 1200) => {
      await p.evaluate(() => { window.__f = []; window.__t0 = performance.now(); let last = performance.now(); const id = (window.__id = (window.__id || 0) + 1); const tick = t => { if (window.__id !== id) return; window.__f.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      let err = '';
      try { await act(); } catch (e) { err = String(e.message || e).slice(0, 80); }
      await p.waitForTimeout(ms);
      const r = await p.evaluate(() => { window.__id++; const f = window.__f.slice(1), t0 = window.__t0; const lt = window.__lt.filter(x => x.s >= t0); const ev = window.__ev.filter(x => x.s >= t0);
        return { f, lt: lt.length, tbt: Math.round(lt.reduce((t, x) => t + Math.max(0, x.d - 50), 0)), worstTask: Math.round(Math.max(0, ...lt.map(x => x.d))), inp: Math.round(Math.max(0, ...ev.map(x => x.d))), inpEv: (ev.sort((a, b) => b.d - a.d)[0] || {}).n || '' }; });
      const f = r.f, avg = f.reduce((a, x) => a + x, 0) / Math.max(1, f.length);
      R.ix[label] = { fps: Math.round(1000 / avg), p95: +q(f, .95).toFixed(1), p99: +q(f, .99).toFixed(1), over25: f.filter(x => x > 25).length, frames: f.length, worst: Math.round(Math.max(0, ...f)), longTasks: r.lt, tbt: r.tbt, worstTask: r.worstTask, inp: r.inp, inpEv: r.inpEv, err };
    };
    const tab = t => p.evaluate(t => { const x = [...document.querySelectorAll('.ct-tbar button, .ct-tabs button')].find(x => x.offsetParent && new RegExp(t, 'i').test(x.textContent)); if (!x) throw new Error('no tab ' + t); x.click(); }, t);
    const scroll = (dist, step) => p.evaluate(([dist, step]) => new Promise(r => { let y = scrollY; const end = y + dist; const s = () => { y += step; scrollTo(0, y); if (y < end) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); }), [dist, step]);
    await rec('idle', async () => {}, 1000);
    await rec('scroll entries', () => scroll(DEV === 'desktop' ? 2400 : 3000, 30), 600);
    await rec('scroll deep (loads more)', () => scroll(9000, 60), 1200);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
    if (DEV !== 'phone') await rec('wheel scroll', async () => { await p.mouse.move(800, 500); for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(16); } }, 600);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
    await rec('expand entry', () => p.evaluate(() => document.querySelector('#ct-rows .ct-row-toggle, #ct-rows .ct-tile').click()));
    await rec('close entry', async () => { await p.keyboard.press('Escape'); await p.evaluate(() => { const t = document.querySelector('#ct-rows .ct-row.expanded .ct-row-toggle'); if (t) t.click(); }); });
    await rec('search typing', async () => { await p.evaluate(() => { const s = document.getElementById('ct-search'); if (!s) throw new Error('no search'); s.focus(); }); await p.keyboard.type('charizard', { delay: 70 }); }, 1000);
    await rec('clear search', async () => { await p.evaluate(() => { const s = document.querySelector('#ct-search, input[type=search]'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); s.blur(); }); }, 900);
    await rec('open Add New', () => p.evaluate(() => CTOpenAdd()));
    await rec('type in Add New', () => p.keyboard.type('pikachu ex', { delay: 70 }), 1200);
    await rec('close Add New', () => p.evaluate(() => CTAddSheet.close()));
    await rec('open menu', () => p.click('#app-avatar'));
    await rec('close menu', () => p.evaluate(() => window.CTMenu && CTMenu.close()));
    await rec('open editor', () => p.evaluate(() => CTEditor.open(CTStore.all()[0])));
    await rec('close editor', () => p.evaluate(() => CTEditor.close()));
    await rec('delete + undo', async () => { await p.evaluate(async () => { const e = CTStore.all()[3]; window.__del = JSON.parse(JSON.stringify(e)); await CTStore.remove(e.id); }); await p.waitForTimeout(500); await p.evaluate(async () => { const e = window.__del; delete e.id; await CTStore.add(e); }); }, 1200);
    await rec('dark mode switch', () => p.emulateMedia({ colorScheme: 'dark' }), 900);
    await rec('light mode switch', () => p.emulateMedia({ colorScheme: 'light' }), 900);
    await rec('to Board', () => tab('board'), 2500);
    await p.evaluate(() => document.querySelectorAll('.cbhint').forEach(h => h.remove()));
    await rec('scroll Board', () => p.evaluate(() => new Promise(r => { let y = 0; const s = () => { y += 30; scrollTo(0, y); const c = document.querySelector('#cb .frame, .cbx'); if (c) c.scrollTop = y; if (y < 1500) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 500);
    await p.evaluate(() => { scrollTo(0, 0); const c = document.querySelector('#cb .frame, .cbx'); if (c) c.scrollTop = 0; });
    await rec('Board hover tooltip', async () => { const w = await p.$('#cb .simple>.w'); if (!w) throw new Error('no widget'); const bb = await w.boundingBox(); for (let i = 0; i < 15; i++) { await p.mouse.move(bb.x + 10 + i * (bb.width - 20) / 15, bb.y + bb.height / 2); await p.waitForTimeout(16); } }, 600);
    await rec('Board edit on', () => p.evaluate(() => document.getElementById('cb-edit').click()), 900);
    await rec('Board drag widget', async () => { const w = p.locator('#cb .simple>.w').nth(1); await w.evaluate(el => el.scrollIntoView({ block: 'center' })); const bb = await w.boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
      await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= 24; i++) { await p.mouse.move(x + 180 * i / 24, y + 120 * i / 24); await p.waitForTimeout(16); } await p.mouse.up(); }, 900);
    await rec('Board resize widget', async () => { const g = p.locator('#cb .simple>.w .grip').first(); await g.evaluate(el => el.scrollIntoView({ block: 'center' })); const bb = await g.boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
      await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= 24; i++) { await p.mouse.move(x + 160 * i / 24, y + 140 * i / 24); await p.waitForTimeout(16); } await p.mouse.up(); }, 900);
    await rec('Board edit off', () => p.evaluate(() => document.getElementById('cb-edit').click()), 900);
    await rec('to Stories', () => tab('stories'), 3500);
    const S = async fn => { for (const fr of p.frames()) { if (await fr.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) return fr.evaluate(fn); } throw new Error('no stories frame'); };
    if (DEV === 'desktop') {
      await rec('Stories theme click', () => S(() => { const t = document.querySelector('.stg [data-t]:not(.on)'); if (!t) throw new Error('no theme'); t.click(); }), 1200);
      await rec('Stories background click', () => S(() => { const t = document.querySelector('.stg [data-b]:not(.on)'); if (!t) throw new Error('no bg'); t.click(); }), 1200);
      await rec('Stories playing (idle)', async () => {}, 2000);
    } else {
      await rec('Stories open player', () => S(() => document.querySelector('#shelf .hero').click()), 1500);
      await rec('Stories tap next x3', async () => { for (let i = 0; i < 3; i++) { await p.mouse.click(CTX.viewport.width * 0.85, CTX.viewport.height * 0.5); await p.waitForTimeout(450); } }, 900);
      await rec('Stories playing (idle)', async () => {}, 2000);
    }
    await rec('back to Entries', () => tab('entries'), 1800);
    await rec('return after inactivity', async () => { await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      await p.waitForTimeout(800); await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); }); }, 1500);
    R.end = await p.evaluate(() => ({ dom: document.getElementsByTagName('*').length, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }));
    R.errors = errs.slice(0, 5);
    all['run' + run] = R; await ctx.close();
  }
  console.log(JSON.stringify({ dev: DEV, size: SIZE, runs: all }));
  await b.close();
})();
