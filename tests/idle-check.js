// Idle check (v52.15). Run before every app update: an app sitting still should do (almost) nothing.
// On Nov 11, 2026 the Card Board's number fitting was found re-triggering itself every frame, forever, even off screen,
// which slowed every tap and scroll in the app without breaking anything visibly. This check catches that kind of bug:
//  - frames while idle (should be a steady ~60 a second, even on a slowed-down phone)
//  - any one piece of code asking for the next frame over and over while nothing is happening
//  - the page's own content changing over and over while nothing is happening
// It checks Entries and Board, on a phone and a desktop, with a few hundred entries.
// Run:  cd app && python3 -m http.server 8765   then   node tests/idle-check.js   (exits 1 on a problem)
const { chromium, devices } = require('playwright');
const URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const LIMITS = { minFps: 50, maxRafPerFn: 20, maxMutations: 40 };   // per second, while idle

(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const dev of ['iPhone 13', 'Desktop Chrome']) {
    const ctx = await b.newContext({ ...devices[dev] }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => {
      const raf = requestAnimationFrame.bind(window); window.__raf = new Map(); window.__mut = 0; window.__mutBy = new Map();
      window.requestAnimationFrame = f => { if (!f.__probe) { const k = String(f).slice(0, 90); window.__raf.set(k, (window.__raf.get(k) || 0) + 1); } return raf(f); };
      const MO = window.MutationObserver; window.MutationObserver = class extends MO { constructor(cb) { super((ms, o) => { window.__mut += ms.length;
        ms.forEach(m => { const t = m.target && m.target.nodeType === 1 ? m.target : m.target && m.target.parentElement; const k = t ? t.tagName.toLowerCase() + (t.className && typeof t.className === 'string' ? '.' + t.className.trim().split(/\s+/).slice(0, 2).join('.') : '') : '?'; window.__mutBy.set(k, (window.__mutBy.get(k) || 0) + 1); });
        cb(ms, o); }); } };
    });
    await p.goto(URL);
    await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'idle@x.test', name: 'Idle', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); for (const x of ['ct.hint.board', 'cb.hint', 'ct.hint']) localStorage.setItem(x, '1'); });
    await p.reload(); await p.waitForTimeout(2500);
    await p.evaluate(async () => { await CTStore.setPlan('premium'); const t = new Date();
      await CTStore._loadSample(Array.from({ length: 300 }, (_, i) => ({ date: CTStore.ymd(new Date(t - (i % 80) * 864e5)), type: i % 3 ? 'purchase' : 'sale', platform: ['eBay', 'TCGplayer', 'Whatnot'][i % 3], name: 'Card ' + i, amount: String(5 + i * 37.13), fees: '1', ship: '0' }))); });
    for (const page of ['Entries', 'Board']) {
      if (page === 'Board') await p.locator('button:has-text("Board") >> visible=true').first().click();
      await p.waitForTimeout(4000);   // let opening animations finish
      const r = await p.evaluate(async () => {
        window.__raf.clear(); window.__mut = 0; window.__mutBy.clear();
        const f = []; const tick = ts => { f.push(ts); if (f.length < 400) requestAnimationFrame(tick); }; tick.__probe = 1; requestAnimationFrame(tick);
        await new Promise(r => setTimeout(r, 3000));
        const secs = 3, top = [...window.__raf.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0], mtop = [...window.__mutBy.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
        return { fps: Math.round(f.length / secs), raf: Math.round(top[1] / secs), rafFn: top[0], mut: Math.round(window.__mut / secs), mutAt: mtop[0] };
      });
      const probs = [];
      if (r.fps < LIMITS.minFps) probs.push('only ' + r.fps + ' frames a second');
      if (r.raf > LIMITS.maxRafPerFn) probs.push('one piece of code asks for a frame ' + r.raf + 'x a second: ' + r.rafFn);
      if (r.mut > LIMITS.maxMutations) probs.push('content changing ' + r.mut + 'x a second, mostly in ' + r.mutAt);
      console.log((probs.length ? 'FAIL ' : 'ok   ') + dev.padEnd(15) + page.padEnd(8) + ' ' + r.fps + ' fps, busiest frame request ' + r.raf + '/s, changes ' + r.mut + '/s' + (probs.length ? '\n       ' + probs.join('\n       ') : ''));
      if (probs.length) bad++;
    }
    if (errs.length) { console.log('FAIL ' + dev + ' page errors: ' + errs.join(' | ')); bad++; }
    await ctx.close();
  }
  await b.close();
  console.log(bad ? '\nIdle check found ' + bad + ' problem(s).' : '\nIdle check passed: the app rests when nothing is happening.');
  process.exit(bad ? 1 : 0);
})();
