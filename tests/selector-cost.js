// Which CSS selectors cost the most time when windows open (Chrome's selector stats), on a slowed iPhone with 300
// entries. node selector-cost.js   (v52.55)
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ ...devices['iPhone 13'] });
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'sc@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); });
  await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const rows = []; const d = new Date(); for (let i = 0; i < 300; i++) { const dt = new Date(d); dt.setDate(d.getDate() - Math.floor(i / 2)); rows.push({ date: CTStore.ymd(dt), type: i % 3 ? 'sale' : 'purchase', platform: ['eBay', 'TCGplayer', 'Whatnot'][i % 3], name: 'Card ' + i, amount: String(10 + i % 200), fees: '2', ship: '4' }); } await CTStore._loadSample(rows); });
  await p.waitForTimeout(2500);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const events = []; cdp.on('Tracing.dataCollected', d => events.push(...d.value));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-blink.debug', transferMode: 'ReportEvents' });
  for (const f of [() => CTPremiumOpen('x'), () => document.querySelector('dialog[open]').close(), () => CTAskOpen(), () => document.querySelector('dialog[open]').close(), () => { const q = document.getElementById('ct-search'); q.value = 'car'; q.dispatchEvent(new Event('input', { bubbles: true })); }, () => { const q = document.getElementById('ct-search'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }, () => CTTabGo('board'), () => CTTabGo('entries')]) { await p.evaluate(f); await p.waitForTimeout(800); }
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done;
  const agg = {};
  for (const e of events) { const st = e.args && (e.args.selector_stats || (e.args.data && e.args.data.selector_stats)); if (!st) continue;
    for (const s of (st.selector_timings || [])) { const k = s.selector; const a = agg[k] = agg[k] || { us: 0, tries: 0, hits: 0 }; a.us += s['elapsed (us)'] || 0; a.tries += s.match_attempts || 0; a.hits += s.match_count || 0; } }
  const rows = Object.entries(agg).sort((a, b) => b[1].us - a[1].us); const total = rows.reduce((n, r) => n + r[1].us, 0);
  console.log('selector matching total', Math.round(total / 1000) + 'ms (slowed 4x) across', rows.length, 'selectors');
  rows.slice(0, 30).forEach(([k, v]) => console.log(String(Math.round(v.us / 100) / 10).padStart(6) + 'ms', String(v.tries).padStart(7), 'tries', String(v.hits).padStart(5), 'hits ', k.slice(0, 150)));
  await b.close();
})();
