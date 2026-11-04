const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];const L=(...a)=>log.push(a.join(' '));
const step=async(n,f)=>{try{await f()}catch(e){L('FAIL',n,e.message.split('\n')[0])}};
const open=async(p)=>{await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1300)};
// phone
let ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});let p=await ctx.newPage();p.on('pageerror',e=>errs.push('ph: '+e.message));
await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await open(p);
await step('phone date sheet',async()=>{await p.tap('#cb-per');await p.waitForTimeout(600);await p.screenshot({path:'shots/w-dates.png'});
  L('sheet open',await p.evaluate(()=>document.getElementById('cr').open),'menu hidden',await p.evaluate(()=>document.getElementById('cb-menu').hidden));
  await p.tap('#cr-pre [data-pk="custom"]');await p.waitForTimeout(500);await p.screenshot({path:'shots/w-dates-cust.png'});
  await p.tap('#cr-pre [data-pk="custom"]');await p.waitForTimeout(300);await p.tap('#cr-pre [data-pk="d30"]');await p.waitForTimeout(700);
  L('after pick',await p.evaluate(()=>document.getElementById('cb-perl').textContent),'closed',!(await p.evaluate(()=>document.getElementById('cr').open)))});
await step('phone layout separate',async()=>{
  await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cb.layout.phone.v1')||'null');});
  await p.tap('#cb-edit');await p.waitForTimeout(500);
  await p.tap('#addw');await p.waitForTimeout(600);await p.screenshot({path:'shots/w-aw.png'});
  await p.tap('#aw-cats [data-c="chart"]');await p.waitForTimeout(300);await p.screenshot({path:'shots/w-aw-chart.png'});
  L('tab bg',await p.evaluate(()=>getComputedStyle(document.querySelector('#aw-cats [data-c="chart"]')).backgroundColor));
  await p.tap('#aw .thumb');await p.waitForTimeout(500);await p.keyboard.press('Escape');await p.waitForTimeout(500);
  const st=await p.evaluate(()=>({d:(JSON.parse(localStorage.getItem('cb.layout.v3')||'[]')).map(w=>w.k+':'+w.size),p:(JSON.parse(localStorage.getItem('cb.layout.phone.v1')||'[]')).map(w=>w.k+':'+w.size)}));L('after add',JSON.stringify(st));
});
await p.screenshot({path:'shots/w-phone-board.png'});
await ctx.close();
// desktop: layout still independent; resize something on desktop shouldn't touch phone
ctx=await b.newContext({viewport:{width:1440,height:900}});p=await ctx.newPage();p.on('pageerror',e=>errs.push('d: '+e.message));
await p.goto('file://'+require('path').resolve('cbt.html'));
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('cb.layout.phone.v1',JSON.stringify([{id:'p1',k:'profit',size:'L'}]))});await open(p);
L('desktop widgets',await p.evaluate(()=>document.querySelectorAll('#simple .w').length),'phone kept',await p.evaluate(()=>localStorage.getItem('cb.layout.phone.v1')));
await step('desktop stories anim',async()=>{await p.waitForTimeout(2200);await p.click('#cb-stories');await p.waitForTimeout(160);await p.screenshot({path:'shots/w-st-mid.png'});await p.waitForTimeout(900);await p.screenshot({path:'shots/w-st-end.png'});
  const f=p.frame({url:/about:srcdoc/});await f.click('#perb');await p.waitForTimeout(300);await f.click('#perm [data-p="custom"]');await p.waitForTimeout(500);await p.screenshot({path:'shots/w-st-months.png'});
  await f.click('#mgrid [data-m="2026-03"]');await f.click('#mgrid [data-m="2026-08"]');await p.waitForTimeout(200);await p.screenshot({path:'shots/w-st-months2.png'});await f.click('#cr-go');await p.waitForTimeout(400);L('stories custom',await f.evaluate(()=>document.getElementById('perl').textContent));
  await f.click('.top .back');await p.waitForTimeout(500);L('board restored',await p.evaluate(()=>getComputedStyle(document.getElementById('cbx')).transform))});
await ctx.close();
// stories phone
ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p=await ctx.newPage();p.on('pageerror',e=>errs.push('sp: '+e.message));
await p.goto('file://'+require('path').resolve('stories-t.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(400);
L('phone chips',await p.evaluate(()=>document.querySelectorAll('#thm .tchip').length),'one line',await p.evaluate(()=>{const t=[...document.querySelectorAll('#thm .tchip')].map(x=>x.getBoundingClientRect());return Math.max(...t.map(r=>r.top))-Math.min(...t.map(r=>r.top))<2&&Math.max(...t.map(r=>r.right))<=innerWidth}));
await p.screenshot({path:'shots/w-sp.png'});
await step('stories phone sheet',async()=>{await p.tap('#perb');await p.waitForTimeout(500);await p.screenshot({path:'shots/w-sp-sheet.png'});await p.tap('#spre [data-sp="custom"]');await p.waitForTimeout(500);await p.screenshot({path:'shots/w-sp-cust.png'});await p.tap('#spre [data-sp="ytd"]');await p.waitForTimeout(500);L('stories pick',await p.evaluate(()=>document.getElementById('perl').textContent))});
await ctx.close();
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
