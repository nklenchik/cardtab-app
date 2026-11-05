const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const th of ['light','dark']){const p=await (await b.newContext({viewport:{width:390,height:760},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium')});await p.waitForTimeout(4000);
await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2200);await p.waitForTimeout(900);
const r=await p.evaluate(()=>{const t=document.querySelector('.cbtouch');return t?{target:t.parentElement.className.split(' ').slice(-2).join(' '),tip:document.querySelector('.cbhint').classList.contains('on')}:'none'});
await p.screenshot({path:'pulse-'+th+'.png'});
await p.tap('.cbhint .h2');await p.waitForTimeout(400);const gone=await p.evaluate(()=>!document.querySelector('.cbtouch'));
// editing: only one Done
await p.tap('.cbedl');await p.waitForTimeout(700);await p.evaluate(()=>{const c=document.querySelector('.cbx');c.scrollTop=400;c.dispatchEvent(new Event('scroll'))});await p.waitForTimeout(900);
const dn=await p.evaluate(()=>({slimDone:getComputedStyle(document.querySelector('.cbslim .sdone')).display,fab:getComputedStyle(document.querySelector('.cbdone')).display,fabColor:getComputedStyle(document.querySelector('.cbdone')).color}));
await p.screenshot({path:'pulse-edit-'+th+'.png'});
console.log(th,JSON.stringify(r),'gesture removed after Got it:',gone,JSON.stringify(dn),errs);await p.close()}
await b.close()})();
