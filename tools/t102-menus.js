const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();for(const cs of ['dark','light'])for(const W of [390,320,1280]){const p=await (await b.newContext({viewport:{width:W,height:W<500?760:860},deviceScaleFactor:2,colorScheme:cs,isMobile:W<500,hasTouch:W<500})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.getElementById('app-avatar').click());await p.waitForTimeout(500);
const m=await p.evaluate(()=>{const e=document.getElementById('app-menu'),r=e.getBoundingClientRect();return {w:Math.round(r.width),sw:e.scrollWidth,cw:e.clientWidth,x:Math.round(r.x),right:Math.round(innerWidth-r.right)}});
await p.evaluate(()=>document.querySelector('#am-theme').scrollIntoView({block:'center'}));await p.waitForTimeout(200);
const r=await p.evaluate(()=>{const e=document.getElementById('app-menu').getBoundingClientRect();return {x:e.x,y:e.y,w:e.width,h:e.height}});
await p.screenshot({path:`menu-${cs}-${W}.png`,clip:{x:r.x-4,y:Math.max(0,r.y-4),width:r.w+8,height:Math.min(r.h+8,W<500?740:840)}});
// board menu
await p.keyboard.press('Escape');await p.evaluate(()=>document.body.click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(500);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
await p.evaluate(()=>document.getElementById('cb-acct').click());await p.waitForTimeout(500);
const bm=await p.evaluate(()=>{const e=document.getElementById('cb-amenu'),r=e.getBoundingClientRect();return {w:Math.round(r.width),sw:e.scrollWidth,cw:e.clientWidth,r:{x:r.x,y:r.y,w:r.width,h:r.height}}});
await p.screenshot({path:`bmenu-${cs}-${W}.png`,clip:{x:bm.r.x-4,y:Math.max(0,bm.r.y-4),width:bm.r.w+8,height:Math.min(bm.r.h+8,W<500?740:840)}});
console.log(cs,W,'app menu',JSON.stringify(m),'board menu',bm.w,bm.sw,bm.cw)}
await b.close()})();
