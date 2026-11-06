// Stories on short phones (iPhone with Display Zoom inside an app browser): text and art must not overlap.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const out=[]; const sizes=[[320,560],[320,640],[375,667],[390,760]];
 for (const [w,h] of sizes) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h } }); const p = await ctx.newPage();
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('free'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1200);
  await p.evaluate(() => { [...document.querySelectorAll('.sh-tabs button, .ct-tabs button, .ct-tbar button')].find(x => x.offsetParent && /stories/i.test(x.textContent)).click(); }); await p.waitForTimeout(4000);
  let S=null; for (const x of p.frames()) if (await x.evaluate(()=>!!document.getElementById('shelf')).catch(()=>false)) S=x;
  for (const n of [0,1,2,3,4,5]) {
   await S.evaluate(n => window.csPlay(n), n); await p.waitForTimeout(2600);
   const r = await S.evaluate(() => { const st=document.querySelector('.pl .st.on'); if(!st) return null; const txt=[...st.querySelectorAll('.sin > :not(.svis)')].filter(e=>e.getBoundingClientRect().height); const tb=Math.max(...txt.map(e=>e.getBoundingClientRect().bottom)); const v=st.querySelector('.svis > *'); let vt=1e9; if(v){ if(v.classList.contains('wall')) vt=v.parentElement.getBoundingClientRect().top; else vt=Math.min(...[v,...v.querySelectorAll('*')].map(e=>e.getBoundingClientRect()).filter(r=>r.height>20).map(r=>r.top)); } const k=st.querySelector('small')?.textContent; return {k, tb:Math.round(tb), vt:Math.round(vt)}; });
   if (r) out.push((r.vt >= r.tb - 2 ? 'ok   ' : 'OVER ') + w+'x'+h+' '+r.k+' text ends '+r.tb+', art starts '+r.vt);
   if (n===1 && w===320 && h===560) await p.screenshot({path:'tests/out-phone/short-win.png'});
   if (n===5 && w===320 && h===560) await p.screenshot({path:'tests/out-phone/short-game.png'});
   await S.evaluate(()=>{const x=document.querySelector('.pl [data-x], .pl .px'); if(x) x.click(); else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))}); await p.waitForTimeout(500);
  }
  await ctx.close();
 }
 console.log(out.join('\n')); await b.close(); })();
