const { chromium, devices } = require('playwright');
const MODE = process.argv[2] || 'phone';
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(MODE === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 860 } }); const p = await ctx.newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message)); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + MODE + ': ' + n + (d ? '  — ' + d : ''));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'z@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelector('[data-dev=sample]').click()); await p.waitForTimeout(1500);
 const row = p.locator('.ct-row:has(img.ct-card-art)').first();
 await row.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
 await row.locator('.ct-row-toggle').click(); await p.waitForTimeout(900);
 ok('Entry opens', await row.evaluate(el => el.classList.contains('expanded')));
 const art = row.locator('img.ct-card-art'); const ab = await art.boundingBox();
 await p.mouse.click(ab.x + ab.width / 2, ab.y + ab.height / 2); await p.waitForTimeout(700);
 const st = await p.evaluate(() => { const z = document.querySelector('.zm'), i = z && z.querySelector('.zm-img'); return z && { on: z.classList.contains('on'), w: Math.round(i.getBoundingClientRect().width), nw: i.naturalWidth, vw: innerWidth, dpr: devicePixelRatio }; });
 ok('Viewer opens', st && st.on, JSON.stringify(st));
 ok('Entry stays open behind it', await row.evaluate(el => el.classList.contains('expanded')));
 ok('Picture fits the screen and is never stretched past sharp', st.w <= st.vw && st.w <= st.nw / Math.max(1, Math.min(st.dpr, 2) * .75) + 1);
 await p.screenshot({ path: 'tests/out-phone/zoom-' + MODE + '.png' });
 const scale = () => p.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.zm-img')).transform); return Math.round(m.a * 100) / 100; });
 if (MODE === 'phone') {
   const cdp = await ctx.newCDPSession(p), cx = 195, cy = 420;
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }] });
   for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 30 - i * 9, y: cy, id: 1 }, { x: cx + 30 + i * 9, y: cy, id: 2 }] }); await p.waitForTimeout(16); }
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
   const s1 = await scale(); ok('Pinch zooms in', s1 > 1.8, 'scale ' + s1);
   await p.screenshot({ path: 'tests/out-phone/zoom-pinch.png' });
   const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 3 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
   await tap(cx, cy); await p.waitForTimeout(80); await tap(cx, cy); await p.waitForTimeout(500);
   ok('Double-tap zooms back out', (await scale()) === 1, 'scale ' + await scale());
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: 300, id: 4 }] });
   for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: 300 + i * 18, id: 4 }] }); await p.waitForTimeout(16); }
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(600);
   ok('Swipe down closes it', !(await p.evaluate(() => document.querySelector('.zm').classList.contains('on'))));
 } else {
   await p.mouse.click(640, 430); await p.waitForTimeout(500);
   ok('Click zooms in', (await scale()) > 1.5, 'scale ' + await scale());
   await p.mouse.click(640, 430); await p.waitForTimeout(500);
   ok('Click again zooms out', (await scale()) === 1);
   await p.keyboard.press('Escape'); await p.waitForTimeout(600);
   ok('Esc closes it', !(await p.evaluate(() => document.querySelector('.zm').classList.contains('on'))));
   ok('Entry still open after closing', await row.evaluate(el => el.classList.contains('expanded')));
 }
 ok('Art visible again after closing', await art.evaluate(el => el.style.opacity === ''));
 ok('No errors', !errs.length, errs.join(' | ')); await b.close(); })();
