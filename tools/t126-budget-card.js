const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const [th,cents] of [['dark',15000],['light',7000],['dark',6000]]){const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async c=>{document.querySelector('[data-dev=sample]').click();await CTStore.setBudget({cents:c,alert:false})},cents);await p.waitForTimeout(900);
const r=await p.evaluate(()=>{const c=document.getElementById('ct-budget'),t=document.querySelector('.ct-stats>div');return [Math.round(c.getBoundingClientRect().height*10)/10,Math.round(t.getBoundingClientRect().height*10)/10,c.className]});
console.log(th,cents,'budget/tile height',JSON.stringify(r),errs);
const bx=await (await p.$('.ct-stats')).boundingBox();await p.screenshot({path:'ring-'+th+cents+'.png',clip:{x:0,y:bx.y-4,width:390,height:330}});
await p.tap('#ct-budget .bu-open');await p.waitForTimeout(600);console.log('  opens window:',await p.evaluate(()=>document.getElementById('bu-sheet').open));await p.close()}await b.close()})();
