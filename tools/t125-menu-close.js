const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const th of ['dark','light']){const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await CTStore.setPlan('premium')});await p.waitForTimeout(400);
await p.tap('#app-avatar');await p.waitForTimeout(500);
const bd=await p.evaluate(()=>{const b=document.getElementById('am-bd');return [b.hidden,getComputedStyle(b).backdropFilter,getComputedStyle(b).backgroundColor]});
await p.screenshot({path:'menu-'+th+'.png'});
await p.tap('#app-menu .am-x');await p.waitForTimeout(400);console.log(th,'app menu backdrop',bd.join(' | '),'-> closed by X:',await p.evaluate(()=>document.getElementById('app-menu').hidden));
// board profile menu
await p.evaluate(()=>window.CTBoardLoader.open());await p.waitForTimeout(2500);
await p.evaluate(()=>{const a=document.querySelector('#cb [aria-controls="cb-amenu"]')||document.getElementById('cb-av');a&&a.click()});await p.waitForTimeout(500);
const bm=await p.evaluate(()=>{const m=document.getElementById('cb-amenu'),x=m.querySelector('.am-x');const r=x.getBoundingClientRect(),mr=m.getBoundingClientRect();return [m.hidden,getComputedStyle(document.getElementById('mbd')).backdropFilter,Math.round(r.right-mr.right),Math.round(r.top-mr.top),getComputedStyle(x).display]});
await p.screenshot({path:'bmenu-'+th+'.png'});
await p.tap('#cb-amenu .am-x');await p.waitForTimeout(400);console.log('  board menu [hidden,blur,xRightOffset,xTop,display]',JSON.stringify(bm),'-> closed by X:',await p.evaluate(()=>document.getElementById('cb-amenu').hidden),errs);await p.close()}
await b.close()})();
