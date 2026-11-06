// The theme sheet on a short phone browser screen: themes stay full size, the sheet scrolls, Done stays visible.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const out=[];
 for (const [w,h] of [[390,560],[390,700],[320,520]]) {
  const p = await (await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h }, colorScheme:'dark' })).newPage();
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('free'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1200);
  await p.evaluate(() => { [...document.querySelectorAll('.sh-tabs button, .ct-tabs button, .ct-tbar button')].find(x => x.offsetParent && /stories/i.test(x.textContent)).click(); }); await p.waitForTimeout(4000);
  let S=null; for (const x of p.frames()) if (await x.evaluate(()=>!!document.getElementById('shelf')).catch(()=>false)) S=x;
  await S.evaluate(() => window.csThemes.all()); await p.waitForTimeout(700);
  const r = await S.evaluate(() => { const g=document.getElementById('tgrid'), go=document.querySelector('#ths .go'), sh=document.querySelector('#ths .sheet'); const gr=g.getBoundingClientRect(), b=go.getBoundingClientRect(); return { gridH:Math.round(gr.height), tile:Math.round((g.firstElementChild||g).getBoundingClientRect().height), doneVisible: b.bottom<=innerHeight+1 && b.top>=0, scrolls: sh.scrollHeight>sh.clientHeight }; });
  out.push(((r.gridH>r.tile*2 && r.doneVisible)?'PASS ':'FAIL ')+w+'x'+h+' '+JSON.stringify(r));
  if (w===390&&h===560) await p.screenshot({path:'tests/out-phone/thsheet.png'});
 }
 console.log(out.join('\n')); await b.close(); })();
