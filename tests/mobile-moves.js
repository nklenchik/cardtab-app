// Mobile moves check (v52.17): times page switches and every window opening/closing on an emulated iPhone slowed 4x,
// with 300 entries, and flags big freezes. Run: cd app && python3 -m http.server 8765, then node tests/mobile-moves.js
// (PROF="Notifications: open" prints where the time goes for matching steps).
const { chromium, devices } = require('playwright');
const RATE = +process.env.RATE || 4;
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await ctx.addInitScript(() => { const W = window; W.__raf = new Map(); W.__mut = 0; W.__lt = [];
   const raf = requestAnimationFrame.bind(W); W.requestAnimationFrame = f => { if (!f.__probe) { const k = String(f).slice(0, 80); W.__raf.set(k, (W.__raf.get(k) || 0) + 1); } return raf(f); };
   const MO = W.MutationObserver; W.MutationObserver = class extends MO { constructor(cb) { super((ms, o) => { W.__mut += ms.length; cb(ms, o); }); } };
   try { new PerformanceObserver(l => l.getEntries().forEach(e => W.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false }); } catch (e) {} });
 await p.goto('http://localhost:8765/index.html');
 await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'm@x.test', name: 'Mo', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); for (const x of ['ct.hint.board', 'cb.hint', 'ct.hint']) localStorage.setItem(x, '1'); });
 await p.reload(); await p.waitForTimeout(2500);
 await p.evaluate(async () => { await CTStore.setPlan('premium'); const t = new Date(); const N = ['charizard-ex','gengar-ex','pikachu-ex','greninja-ex','chi-yu-ex'];
   await CTStore._loadSample(Array.from({ length: 300 }, (_, i) => ({ date: CTStore.ymd(new Date(t - (i % 80) * 864e5)), type: i % 3 ? 'purchase' : 'sale', platform: ['eBay', 'TCGplayer', 'Whatnot'][i % 3], name: N[i % 5] + ' ex ' + i, amount: String(5 + i * 3.13), fees: '1', ship: '0', art: { list: 'assets/card-art/' + N[i % 5] + '-sm.webp', detail: 'assets/card-art/' + N[i % 5] + '.webp' } }))); });
 await p.waitForTimeout(2500);
 // warm everything once (first opens load code); then measure the second time, like a real session
 const cdp = await ctx.newCDPSession(p);
 const start = () => p.evaluate(() => { window.__f = []; window.__lt = []; const tok = window.__tok = (window.__tok || 0) + 1; const t = ts => { if (window.__tok !== tok) return; window.__f.push(ts); requestAnimationFrame(t); }; t.__probe = 1; requestAnimationFrame(t); });
 const stop = () => p.evaluate(() => { const f = window.__f, d = []; for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]); window.__tok++; return { frames: d.length, drops: d.filter(x => x > 34).length, worst: Math.round(Math.max(0, ...d)), long: window.__lt.length, longMax: Math.max(0, ...window.__lt) }; });
 const rows = [];
 const PROF = (process.env.PROF || '').split(',').filter(Boolean);
 async function m(label, fn, wait = 900) { const prof = rows.length >= 0 && throttled && PROF.some(x => label.includes(x)); if (prof) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); } await start(); const t0 = Date.now(); await fn(); await p.waitForTimeout(wait); const r = await stop(); r.ms = Date.now() - t0; rows.push([label, r]);
  if (prof) { const { profile } = await cdp.send('Profiler.stop'); const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map(n => [n.id, n])); const tot = new Map();
    profile.samples.forEach((id, i) => { const n = byId.get(id), c = n.callFrame, k = (c.functionName || '(anon)') + ' ' + c.url.split('/').pop().split('?')[0] + ':' + (c.lineNumber + 1); self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
    console.log('\nPROFILE ' + label + ' (self time, ms):\n  ' + [...self.entries()].filter(([k]) => !/\(idle\)|\(program\)|\(garbage/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => (v / 1000).toFixed(1).padStart(6) + '  ' + k).join('\n  ')); } }
 const tap = sel => p.locator(sel + ' >> visible=true').first().click();
 const esc = () => p.keyboard.press('Escape');
 const steps = async () => {
  await m('Tab: Entries → Board', () => tap('button:has-text("Board")'));
  await m('Tab: Board → Stories', () => tap('button:has-text("Stories")'));
  await m('Tab: Stories → Entries', () => tap('button:has-text("Entries")'));
  await m('Profile menu: open', () => tap('.ct-me, #app-avatar'));
  await m('Profile menu: close', esc);
  await m('Settings: open (from menu)', async () => { await tap('.ct-me, #app-avatar'); await p.waitForTimeout(350); await tap('[data-amp="display"]'); });
  await m('Settings: close', esc);
  await m('Add card: open', () => p.evaluate(() => CTAddSheet.open()));
  await m('Add card: close', () => p.evaluate(() => CTAddSheet.close()));
  await m('Premium: open', () => p.evaluate(() => CTPremiumOpen('x')));
  await m('Premium: close', () => p.evaluate(() => document.getElementById('pms').close()));
  await m('Notifications: open', () => p.evaluate(() => CTNotify.open()));
  await m('Notifications: close', () => p.evaluate(() => CTNotify.close()));
  await m('Ask: open', () => p.evaluate(() => CTAskOpen()));
  await m('Ask: close', esc);
  await m('Date menu: open', () => tap('.ms-main .ms-rng'));
  await m('Date menu: close', esc);
  await m('Entry: open', () => tap('#ct-rows .ct-row:nth-child(3) .ct-row-toggle'));
  await m('Entry: close', () => tap('#ct-rows .ct-row.expanded .ct-row-toggle'));
  await m('Search: type "char"', async () => { await tap('#ct-search'); await p.keyboard.type('char', { delay: 60 }); });
  await m('Search: clear', async () => { await p.fill('#ct-search', ''); await p.locator('#ct-search').dispatchEvent('input'); });
 };
 let throttled = false;
 await steps(); rows.length = 0;          // first pass loads everything
 await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE }); throttled = true;
 await steps();
 // anything left running after all that?
 await p.waitForTimeout(2000); await p.evaluate(() => { window.__raf.clear(); window.__mut = 0; }); await p.waitForTimeout(3000);
 const left = await p.evaluate(() => ({ raf: [...window.__raf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => Math.round(v / 3) + '/s ' + k), mut: Math.round(window.__mut / 3) }));
 console.log('CPU slowed ' + RATE + 'x (mid-range phone). drops = frames over 34ms; long = main thread busy 50ms+\n');
 rows.forEach(([l, r]) => console.log((r.longMax > 200 || r.drops > 6 ? '!! ' : '   ') + l.padEnd(30) + ' drops ' + String(r.drops).padStart(2) + '/' + String(r.frames).padEnd(3) + ' worst ' + String(r.worst).padStart(4) + 'ms  long ' + r.long + (r.long ? ' (max ' + r.longMax + 'ms)' : '')));
 console.log('\nleft running after: ' + JSON.stringify(left));
 console.log('errors', errs); await b.close(); })();
