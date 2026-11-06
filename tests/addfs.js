// v41 phone Add New: full screen, focused, matches high on the screen, Bought/Sold chip flips, price step shows the switch again.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const out=[]; const ok=(c,m)=>out.push((c?'PASS ':'FAIL ')+m);
 for (const [w,h,scheme] of [[390,760,'light'],[320,568,'dark']]) {
  const p = await (await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h }, colorScheme: scheme })).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const tag=w+'x'+h;
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200);
  await p.tap('#ct-fab, #ct-add').catch(async()=>{ await p.evaluate(()=>{ (document.querySelector('#ct-fab')||document.querySelector('#ct-add')).click(); }); });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const ph=document.querySelector('#as .phone').getBoundingClientRect(); return { top:Math.round(ph.top), h:Math.round(ph.height), focused: document.activeElement && document.activeElement.id, ctx: getComputedStyle(document.querySelector('#as .ctx')).display, chip: (document.querySelector('#as [data-tchip]')||{}).textContent }; });
  ok(r.top <= 1 && r.h >= h - 2, tag+' full screen ('+r.top+', '+r.h+')'); ok(r.focused==='as-in', tag+' search has the cursor on open'); ok(r.ctx==='none', tag+' Purchase/Sale row hidden while searching'); ok(/Bought/.test(r.chip||''), tag+' chip: '+r.chip);
  await p.fill('#as-in', 'Raichu 14'); await p.waitForTimeout(500);
  const m = await p.evaluate(() => { const li=document.querySelector('#as .li'); return li ? Math.round(li.getBoundingClientRect().bottom) : -1; });
  ok(m > 0 && m < h * 0.55, tag+' first match ends at '+m+'px, above where the keyboard starts (~'+Math.round(h*0.58)+')');
  if (w===390) await p.screenshot({path:'tests/out-phone/addfs-'+tag+'.png'});
  await p.tap('#as [data-tchip]'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ chip: document.querySelector('#as [data-tchip]').textContent, pressed: document.querySelector('#as-type [aria-pressed=true]').dataset.v, focused: document.activeElement.id }));
  ok(/Sold/.test(after.chip) && after.pressed==='sale', tag+' chip flips to Sale ('+after.chip+')');
  await p.tap('#as .li'); await p.waitForTimeout(600);
  const s2 = await p.evaluate(() => ({ ctx: getComputedStyle(document.querySelector('#as .ctx')).display, step: document.querySelector('#as').className }));
  ok(s2.ctx !== 'none', tag+' price step shows Purchase/Sale and platform again');
  ok(!errs.length, tag+' no errors '+errs.join('|'));
 }
 console.log(out.join('\n')); await b.close(); })();
