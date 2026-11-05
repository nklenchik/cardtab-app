const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const th of ['dark','light']){const p=await (await b.newContext({viewport:{width:390,height:760},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await CTStore.setPlan('premium')});await p.waitForTimeout(400);
await p.evaluate(()=>window.CTBoardLoader.open('stories'));await p.waitForTimeout(3000);
const fr=p.frames().find(f=>f!==p.mainFrame()&&f.url()!=='about:blank')||p.frames().find(f=>f!==p.mainFrame());
if(!fr){console.log('no stories frame');continue}
const r=await fr.evaluate(()=>{const w=document.getElementById('svs'),s=w.querySelector('.sheet');w.hidden=false;return [getComputedStyle(w).backgroundColor,getComputedStyle(w).backdropFilter,getComputedStyle(s).borderTopColor,getComputedStyle(s).borderTopWidth]});
console.log(th,'stories sheet:',r.join(' | '));await p.waitForTimeout(400);await p.screenshot({path:'st-'+th+'.png'});await p.close()}await b.close()})();
