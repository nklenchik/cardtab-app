// v52.36: every widget at every size it allows, on many screen widths (browser zoom is the same as a narrower screen).
// node tests/sizes-all.js <width> [dark] [free] — prints anything cut off or spilling, and saves a screenshot per size.
const { chromium, devices } = require('playwright');
const W = +(process.argv[2] || 1280), DARK = process.argv.includes('dark'), FREE = process.argv.includes('free');
(async () => { const b = await chromium.launch(); const ph = W < 601;
 const ctx = await b.newContext(ph ? { ...devices['iPhone 13'], viewport: { width: W, height: +(process.env.H || 3400) }, colorScheme: DARK ? 'dark' : 'light' } : { viewport: { width: W, height: +(process.env.H || 2600) }, colorScheme: DARK ? 'dark' : 'light' });
 const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/index.html');
 await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'sz@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
 await p.reload(); await p.waitForTimeout(1200);
 await p.evaluate(async f => { await CTStore.setPlan(f ? 'free' : 'premium'); document.querySelector('[data-dev=sample]').click(); }, FREE); await p.waitForTimeout(1500);
 const KEYS = FREE ? ['profit', 'sales', 'after', 'spent', 'month'] : ['profit', 'sales', 'spent', 'fees', 'after', 'budget', 'hit', 'tts', 'tied', 'win', 'feat', 'pricey', 'glance', 'where', 'kept', 'best', 'sell', 'bd', 'ppc', 'month', 'inout'];
 const key = (ph ? 'cb.layout.phone.v2' : 'cb.layout.v4') + (FREE ? '.free' : '');
 const report = [];
 for (const S of ['S', 'M', 'L']) {
  if (S === 'S') { await p.evaluate(() => { [...document.querySelectorAll('.ct-tbar button, .ct-tabs button, .sh-tabs button')].find(x => x.offsetParent && /board/i.test(x.textContent)).click(); }); await p.waitForTimeout(2600); }
  await p.evaluate(([k, keys, S]) => { localStorage.setItem(k, JSON.stringify(keys.map((x, i) => ({ id: 'z' + i, k: x, size: S })))); localStorage.removeItem('cb.ly.cur.desk'); localStorage.removeItem('cb.ly.cur.phone'); window.cbReloadLayout(); }, [key, KEYS, S]);
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelectorAll('.cbhint').forEach(h => h.remove()));
  const r = await p.evaluate(() => [...document.querySelectorAll('#cb .simple>.w')].map(w => {
   const R0 = w.getBoundingClientRect(), wb = w.querySelector('.wb'), R = wb ? wb.getBoundingClientRect() : R0, bad = [];
   const sz = [...w.classList].find(c => /^sz/.test(c));
   w.querySelectorAll('.wb *').forEach(el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]') || el.closest('.d')) return; const q = el.getBoundingClientRect(); if (!q.width || !q.height) return;
    const txt = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (txt && !el.closest('.cv') && (q.right > R.right + 2 || q.bottom > R.bottom + 3 || q.left < R.left - 2 || q.top < R.top - 3)) bad.push('spill ' + (el.className.baseVal ?? el.className) + ' ' + el.tagName);
    if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis') bad.push('cut "' + el.textContent.trim().slice(0, 24) + '"'); });
   return w.dataset.k + ' ' + sz + ' ' + Math.round(R0.width) + 'x' + Math.round(R0.height) + (bad.length ? '  !! ' + [...new Set(bad)].slice(0, 4).join('; ') : '');
  }));
  report.push('== ' + S, ...r);
  await p.screenshot({ path: 'tests/out-qa/sz-' + W + (DARK ? 'd' : '') + (FREE ? 'f' : '') + '-' + S + '.png', fullPage: true });
 }
 console.log(report.join('\n')); console.log('wider than screen:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'errors:', errs.slice(0, 3));
 await b.close(); })();
