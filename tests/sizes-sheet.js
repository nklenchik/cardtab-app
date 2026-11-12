// contact sheet: chosen widgets at chosen sizes, one width. node tests/sizes-sheet.js <width> <S,M,L> <keys...> [dark]
const { chromium, devices } = require('playwright');
const W = +process.argv[2], SZ = process.argv[3].split(','), DARK = process.argv.includes('dark'), FREE = process.argv.includes('free'), KEYS = process.argv.slice(4).filter(x => !['dark', 'free'].includes(x));
(async () => { const b = await chromium.launch(); const ph = W < 601;
 const ctx = await b.newContext(ph ? { ...devices['iPhone 13'], viewport: { width: W, height: 2400 }, colorScheme: DARK ? 'dark' : 'light' } : { viewport: { width: W, height: 2400 }, colorScheme: DARK ? 'dark' : 'light' });
 const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/index.html');
 await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'sz@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); localStorage.setItem('cb.hint', '1'); });
 await p.reload(); await p.waitForTimeout(1200);
 await p.evaluate(async f => { await CTStore.setPlan(f ? 'free' : 'premium'); document.querySelector('[data-dev=sample]').click(); }, FREE); await p.waitForTimeout(1500);
 await p.evaluate(() => { [...document.querySelectorAll('.ct-tbar button, .ct-tabs button')].find(x => x.offsetParent && /board/i.test(x.textContent)).click(); }); await p.waitForTimeout(2600);
 const key = (ph ? 'cb.layout.phone.v2' : 'cb.layout.v4') + (FREE ? '.free' : '');
 const L = []; KEYS.forEach(k => SZ.forEach(s => L.push({ id: 'y' + L.length, k, size: s })));
 await p.evaluate(([k, L]) => { localStorage.setItem(k, JSON.stringify(L)); localStorage.removeItem('cb.ly.cur.desk'); localStorage.removeItem('cb.ly.cur.phone'); window.cbReloadLayout(); document.querySelectorAll('.cbhint').forEach(h => h.remove()); }, [key, L]);
 await p.waitForTimeout(1800);
 const box = await p.evaluate(() => { const ws = [...document.querySelectorAll('#cb .simple>.w')]; const r = ws.map(w => w.getBoundingClientRect()); return { y: Math.min(...r.map(x => x.top)) - 8, b: Math.max(...r.map(x => x.bottom)) + 8 }; });
 await p.screenshot({ path: 'tests/out-qa/sheet-' + W + (DARK ? 'd' : '') + '.png', clip: { x: 0, y: box.y, width: W, height: Math.min(2400 - box.y, box.b - box.y) } });
 console.log('errors', errs); await b.close(); })();
