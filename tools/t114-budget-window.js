const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();for(const W of [390,1280]){const p=await (await b.newContext({viewport:{width:W,height:W<500?760:860},deviceScaleFactor:2,isMobile:W<500,hasTouch:W<500})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(800);await p.evaluate(()=>CTStore.setBudget({cents:15000,alert:true}));await p.waitForTimeout(400);
await p.evaluate(()=>document.getElementById('ct-budget').scrollIntoView({block:'center'}));await p.waitForTimeout(300);
const c=await p.evaluate(()=>{const r=document.getElementById('ct-budget').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
await p.screenshot({path:'bu2-card-'+W+'.png',clip:{x:c.x-8,y:c.y-8,width:c.w+16,height:c.h+16}});
if(W<500)await p.tap('#ct-budget .bu-open');else await p.click('#ct-budget .bu-open');
await p.waitForTimeout(160);await p.screenshot({path:'bu2-mid-'+W+'.png'});await p.waitForTimeout(600);
console.log(W,JSON.stringify(await p.evaluate(()=>{const d=document.getElementById('bu-sheet'),pn=d.querySelector('.bu-p').getBoundingClientRect(),dr=d.getBoundingClientRect();return {open:d.open,focused:document.activeElement.id,above:Math.round(pn.top-dr.top),below:Math.round(dr.bottom-pn.bottom),dlgScroll:d.scrollHeight-d.clientHeight,pageLocked:getComputedStyle(document.documentElement).overflow}})),errs);
await p.screenshot({path:'bu2-open-'+W+'.png'});
await p.keyboard.type('200');await p.waitForTimeout(100);console.log('typed value',await p.evaluate(()=>document.getElementById('bu-amt').value));
await p.evaluate(()=>document.querySelector('#bu-sheet [data-close]').click());await p.waitForTimeout(500);console.log('closed',await p.evaluate(()=>!document.getElementById('bu-sheet').open))}
await b.close()})();
