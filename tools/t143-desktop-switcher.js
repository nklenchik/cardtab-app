const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const th of ['light','dark']){const p=await (await b.newContext({viewport:{width:1440,height:900},colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium')});await p.waitForTimeout(4000);
const ctr=await p.evaluate(()=>{const t=document.querySelector('.ct-demo-top .ct-tabs').getBoundingClientRect(),h=document.querySelector('.ct-demo-top').getBoundingClientRect(),a=document.querySelector('.ct-top-actions').getBoundingClientRect();return {tabsMid:Math.round(t.left+t.width/2),hdrMid:Math.round(h.left+h.width/2),gapToActions:Math.round(a.left-t.right)}});
await p.screenshot({path:'sw-'+th+'-entries.png',clip:{x:0,y:0,width:1440,height:110}});
await p.click('.ct-demo-top .ct-tabs [data-tab=board]');await p.waitForTimeout(2600);await p.screenshot({path:'sw-'+th+'-board.png',clip:{x:0,y:0,width:1440,height:110}});
await p.click('.cb-tabs [data-tab=stories]');await p.waitForTimeout(3000);await p.screenshot({path:'sw-'+th+'-stories.png',clip:{x:0,y:0,width:1440,height:110}});
console.log(th,JSON.stringify(ctr),errs);await p.close()}
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage();await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(2500);await p.screenshot({path:'sw-phone.png'});
await b.close()})();
