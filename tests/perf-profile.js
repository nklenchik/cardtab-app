// CPU profiles of the slowest interactions found by perf-audit.js, to find the functions responsible.
// node tests/perf-profile.js [size] — phone-sized screen, CPU slowed 4x. Prints the top self-time functions per scenario.
const { chromium, devices } = require('playwright');
const SIZE = process.argv[2] || 'large', N = { small: 25, medium: 400, large: 3000 }[SIZE];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'perf@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5, expires: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1800);
  await p.evaluate(async n => { const base = CTStore.all(); const more = []; const need = n - base.length;
    for (let i = 0; i < need; i++) { const e = base[i % base.length], d = new Date(Date.UTC(2026, 10, 10) - Math.floor(i * (1000 / Math.max(1, need))) * 864e5);
      more.push({ type: e.type, name: e.name, amount: String(((e.amount || 1000) / 100).toFixed(2)), net: e.net != null ? String((e.net / 100).toFixed(2)) : undefined, date: d.toISOString().slice(0, 10), platform: e.platform }); }
    if (more.length) await CTStore.importMany(more); }, N);
  await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  const top = (prof, label) => {
    const self = new Map(), total = prof.endTime - prof.startTime, dt = {}; const byId = new Map(prof.nodes.map(n => [n.id, n]));
    for (let i = 0; i < prof.samples.length; i++) { const n = byId.get(prof.samples[i]); const f = n.callFrame; const k = (f.functionName || '(anon)') + ' ' + (f.url || '').split('/').slice(-2).join('/').split('?')[0] + ':' + (f.lineNumber + 1) + ':' + (f.columnNumber + 1); self.set(k, (self.get(k) || 0) + (prof.timeDeltas[i] || 0)); }
    const rows = [...self.entries()].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 9);
    const gc = [...self.entries()].filter(([k]) => /garbage/.test(k)).reduce((t, [, v]) => t + v, 0);
    console.log('\n## ' + label + '  (profile ' + Math.round(total / 1000) + 'ms, GC ' + Math.round(gc / 1000) + 'ms)');
    rows.forEach(([k, v]) => console.log('  ' + String(Math.round(v / 1000)).padStart(5) + 'ms  ' + k.slice(0, 150)));
  };
  const prof = async (label, act, ms = 1200) => { await cdp.send('Profiler.start'); try { await act(); } catch (e) { console.log(label, 'ERR', e.message.slice(0, 80)); } await p.waitForTimeout(ms); const { profile } = await cdp.send('Profiler.stop'); top(profile, label); };
  const tab = t => p.evaluate(t => { const x = [...document.querySelectorAll('.ct-tbar button, .ct-tabs button')].find(x => x.offsetParent && new RegExp(t, 'i').test(x.textContent)); x.click(); }, t);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await prof('startup (reload)', async () => { await p.reload(); }, 5000);
  await prof('scroll entries', () => p.evaluate(() => new Promise(r => { let y = 0; const s = () => { y += 30; scrollTo(0, y); if (y < 3000) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 600);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  await prof('search typing', async () => { await p.evaluate(() => document.getElementById('ct-search').focus()); await p.keyboard.type('charizard', { delay: 70 }); }, 800);
  await p.evaluate(() => { const s = document.getElementById('ct-search'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); s.blur(); }); await p.waitForTimeout(800);
  await prof('delete + undo', async () => { await p.evaluate(async () => { const e = CTStore.all()[3]; window.__del = JSON.parse(JSON.stringify(e)); await CTStore.remove(e.id); }); await p.waitForTimeout(500); await p.evaluate(async () => { const e = window.__del; delete e.id; await CTStore.add(e); }); }, 1500);
  await prof('dark mode switch', () => p.emulateMedia({ colorScheme: 'dark' }), 900);
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(800);
  await prof('close editor', async () => { await p.evaluate(() => CTEditor.open(CTStore.all()[0])); await p.waitForTimeout(700); await p.evaluate(() => CTEditor.close()); }, 900);
  await prof('to Board', () => tab('board'), 2500);
  await p.evaluate(() => document.querySelectorAll('.cbhint').forEach(h => h.remove()));
  await prof('scroll Board', () => p.evaluate(() => new Promise(r => { let y = 0; const s = () => { y += 30; scrollTo(0, y); if (y < 1500) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 500);
  await p.evaluate(() => scrollTo(0, 0));
  await prof('Board edit on', () => p.evaluate(() => document.getElementById('cb-edit').click()), 1000);
  await prof('Board drag widget', async () => { const w = p.locator('#cb .simple>.w').nth(1); await w.evaluate(el => el.scrollIntoView({ block: 'center' })); const bb = await w.boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
    await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= 24; i++) { await p.mouse.move(x + 120 * i / 24, y + 160 * i / 24); await p.waitForTimeout(16); } await p.mouse.up(); }, 900);
  await prof('Board edit off', () => p.evaluate(() => document.getElementById('cb-edit').click()), 1000);
  await prof('to Stories + open player', async () => { await tab('stories'); await p.waitForTimeout(2500); for (const fr of p.frames()) { if (await fr.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) { await fr.evaluate(() => document.querySelector('#shelf .hero').click()); break; } } }, 2000);
  await prof('Stories playing', async () => {}, 2000);
  await b.close();
})();
