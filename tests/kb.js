// Fake on-screen keyboard: visualViewport shrinks to KB px while a text field is focused (like iPhone Chrome)
const { chromium, devices } = require('playwright');
const tag = process.argv[2] || 'before', KBH = 330;
(async () => { const b = await chromium.launch();
 const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }); const p = await ctx.newPage();
 await p.addInitScript(KBH => { const et = new EventTarget(); let h = null;
  const vv = { get height() { return h || innerHeight; }, get width() { return innerWidth; }, offsetTop: 0, offsetLeft: 0, pageTop: 0, scale: 1,
   addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a) };
  Object.defineProperty(window, 'visualViewport', { get: () => vv });
  const set = () => { const a = document.activeElement, on = a && (a.matches('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea,[contenteditable]')); const nh = on ? KBH : null; if (nh !== h) { h = nh; et.dispatchEvent(new Event('resize')); } };
  document.addEventListener('focusin', () => setTimeout(set, 30)); document.addEventListener('focusout', () => setTimeout(set, 30));
  window.__kbH = () => vv.height; }, KBH);
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', expires: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1200);
 await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1200);
 const shot = async n => { await p.waitForTimeout(700); await p.screenshot({ path: `tests/out-phone/kb-${n}-${tag}.png` });
   const r = await p.evaluate(() => { const a = document.activeElement; const ar = a && a.getBoundingClientRect(); return { el: a && (a.id || a.name || a.tagName), top: ar && Math.round(ar.top), bottom: ar && Math.round(ar.bottom), vis: window.__kbH() }; });
   console.log((r.bottom && r.bottom <= r.vis && r.top >= 0 ? 'ok   ' : 'HIDDEN ') + n + ' ' + JSON.stringify(r)); };
 // Add New -> sale
 await p.evaluate(() => CTOpenAdd()); await p.waitForTimeout(900);
 await p.fill('#as-in', 'Charizard').catch(async () => { await p.keyboard.type('Charizard'); });
 await p.waitForTimeout(1500); await shot('1search');
 await p.evaluate(() => { const c = document.querySelector('[data-tchip]'); if (c && !/sold/i.test(document.querySelector('#as-type [aria-pressed=true]').textContent)) c.click(); });
 await p.waitForTimeout(400); await p.evaluate(() => { const li = document.querySelector('#as .li') || document.querySelector('#as [data-typed]'); li && li.click(); }); await shot('2price');
 await p.focus('#as-fees'); await shot('3fees'); await p.focus('#as-ship'); await shot('4ship');
 await p.evaluate(() => CTAddSheet.close()); await p.waitForTimeout(700);
 // Editor on an existing sale
 await p.evaluate(() => { const e = CTStore.all().find(x => x.type === 'sale'); CTEditor.open(e); }); await p.waitForTimeout(900);
 const ids = await p.evaluate(() => [...document.querySelectorAll('#ed input:not([type=file]):not([type=checkbox]):not([type=radio]), #ed textarea')].filter(x => x.offsetParent).map(x => x.name).filter(Boolean));
 for (const id of ids) { await p.focus('#ed [name="' + id + '"]'); await shot('ed-' + id); }
 await b.close(); })();
