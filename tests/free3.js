// Free Board stays on the last 3 months even when it follows the Entries date; narrow tiles use short lines.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const out = []; const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);
 for (const w of [310, 1280]) {
  const ctx = await b.newContext(w < 700 ? { ...devices['iPhone 13'], viewport: { width: w, height: 760 } } : { viewport: { width: w, height: 860 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('free'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1200);
  if (w === 310) {
   const t = await p.evaluate(() => [...document.querySelectorAll('.ct-line')].filter(x => !x.hidden).map(x => { const s = x.querySelector('.ct-short'); return { txt: x.innerText.trim(), cut: x.scrollWidth > x.clientWidth + 1 }; }));
   ok(t.every(x => !x.cut), w + ' tile lines fit: ' + t.map(x => x.txt).join(' / '));
  }
  await p.evaluate(() => { [...document.querySelectorAll('.sh-tabs button, .ct-tabs button, .ct-tbar button')].find(x => x.offsetParent && /board/i.test(x.textContent)).click(); }); await p.waitForTimeout(3500);
  const lab = () => p.evaluate(() => document.getElementById('cb-perl').textContent);
  await p.evaluate(() => CTMonth.set('all')); await p.waitForTimeout(700);
  ok(/last 3 months/i.test(await lab()), w + ' free + Entries "All" → Board shows ' + await lab());
  await p.evaluate(() => { const d = new Date(); d.setMonth(d.getMonth() - 8); CTMonth.set('m:' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }); await p.waitForTimeout(700);
  ok(/last 3 months/i.test(await lab()), w + ' free + 8 months ago → Board shows ' + await lab());
  await p.evaluate(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); CTMonth.set('m:' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }); await p.waitForTimeout(700);
  ok(!/last 3 months/i.test(await lab()), w + ' free + last month → Board follows: ' + await lab());
  await p.evaluate(() => CTMonth.set('all')); await p.waitForTimeout(500);
  await p.evaluate(() => CTStore.setPlan('premium')); await p.waitForTimeout(900);
  ok(!/last 3 months/i.test(await lab()), w + ' upgrade → Board gets full range: ' + await lab());
  ok(!errs.length, w + ' no page errors ' + errs.slice(0, 2).join(' | '));
  await ctx.close();
 }
 console.log(out.join('\n')); await b.close(); })();
