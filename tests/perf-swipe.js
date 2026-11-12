// Stories gestures with real touch input (Chrome's touch emulation): the shelf strip swipe, and swipe-down to close the player
// (a short swipe that springs back, and a long one that closes). For each frame it records where the moving element is,
// so a gesture that lags the finger, starts late or jumps at release shows up. Phone size; pass "slow" for 4x CPU.
const { chromium, devices } = require('playwright');
const SLOW = process.argv[2] === 'slow';
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5, expires: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
  await p.evaluate(async n => { const base = CTStore.all(); const more = []; for (let i = 0; i < n; i++) { const e = base[i % base.length], d = new Date(Date.UTC(2026, 10, 10) - Math.floor(i / 2) * 864e5); more.push({ type: e.type, name: e.name, amount: '12.00', date: d.toISOString().slice(0, 10), platform: e.platform }); } await CTStore.importMany(more); }, 385);
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const x = [...document.querySelectorAll('.ct-tbar button')].find(x => /stories/i.test(x.textContent)); x.click(); }); await p.waitForTimeout(3500);
  let F = null; for (const f of p.frames()) if (await f.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) F = f;
  const cdp = await ctx.newCDPSession(p); if (SLOW) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  // per-frame sampler inside the Stories page: frame times and the watched value
  const startRec = sel => F.evaluate(sel => { window.__s = []; const id = (window.__sid = (window.__sid || 0) + 1); let last = performance.now();
    const read = () => { const el = sel === 'track' ? document.querySelector('.track') : document.querySelector('.pl .pcard'); if (!el) return null; if (sel === 'track') return el.scrollLeft; const m = new DOMMatrix(getComputedStyle(el).transform); return Math.round(m.m42 * 10) / 10; };
    const tick = t => { if (window.__sid !== id) return; window.__s.push([Math.round(t - last), read(), window.__fy == null ? null : window.__fy]); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, sel);
  const stopRec = () => F.evaluate(() => { window.__sid++; return window.__s.slice(1); });
  const report = (label, s, opts = {}) => { const ft = s.map(x => x[0]), over = ft.filter(x => x > 25).length, worst = Math.max(...ft);
    // biggest jump between consecutive frames in the watched value (px)
    let jump = 0; for (let i = 1; i < s.length; i++) if (s[i][1] != null && s[i - 1][1] != null) jump = Math.max(jump, Math.abs(s[i][1] - s[i - 1][1]));
    console.log(label.padEnd(34), 'frames', s.length, ' >25ms', over, ' worst', worst + 'ms', ' biggest frame-to-frame move', Math.round(jump) + 'px', opts.extra || ''); };
  // 1) the shelf strip (phones): swipe left across the story covers
  { const r = await F.evaluate(() => { const t = document.querySelector('.track'); const b = t.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, sw: t.scrollWidth, cw: t.clientWidth }; });
    const fr = await p.$('#csx iframe'); const off = await fr.boundingBox(); const y = off.y + r.y + r.h / 2, x0 = off.x + r.x + r.w * 0.8;
    await startRec('track'); await touch('touchStart', x0, y); const lag = [];
    for (let i = 1; i <= 20; i++) { await touch('touchMove', x0 - i * 12, y); await p.waitForTimeout(16); }
    await touch('touchEnd'); await p.waitForTimeout(1200); const s = await stopRec();
    const moved = s.filter(x => x[1] > 0); const firstMove = s.findIndex(x => x[1] > 0);
    report('shelf strip swipe', s, { extra: '| scrolled to ' + Math.round(s[s.length - 1][1]) + 'px of ' + (r.sw - r.cw) + ', first movement on frame ' + firstMove }); }
  // open the player
  await F.evaluate(() => document.querySelector('#shelf .hero').click()); await p.waitForTimeout(1500);
  const pc = await F.evaluate(() => { const b = document.querySelector('.pl .pcard').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height * 0.35 }; });
  const fr = await p.$('#csx iframe'); const off = await fr.boundingBox();
  // 2) short swipe down that springs back, 3) a long one that closes
  for (const [label, dist] of [['player swipe down 90px (springs back)', 90], ['player swipe down 220px (closes)', 220]]) {
    const x = off.x + pc.x, y0 = off.y + pc.y; await startRec('pcard'); await touch('touchStart', x, y0); const steps = 16; const lagPx = [];
    for (let i = 1; i <= steps; i++) { const dy = dist * i / steps; await touch('touchMove', x, y0 + dy); await p.waitForTimeout(16); const v = await F.evaluate(() => { const el = document.querySelector('.pl .pcard'); return el ? new DOMMatrix(getComputedStyle(el).transform).m42 : 0; }); lagPx.push(Math.round(dy - v)); }
    await touch('touchEnd'); await p.waitForTimeout(900); const s = await stopRec();
    report(label, s, { extra: '| finger vs card gap while dragging: max ' + Math.max(...lagPx.map(Math.abs)) + 'px | after release: ' + s.slice(-1)[0][1] + 'px, player open ' + await F.evaluate(() => !document.querySelector('.pl').hidden) });
    if (dist < 120) await p.waitForTimeout(300); }
  await b.close(); })();
