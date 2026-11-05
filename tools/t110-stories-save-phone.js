const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:760},acceptDownloads:true,isMobile:true,hasTouch:true});const p=await ctx.newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
await p.evaluate(()=>document.getElementById('cb-stories').click());await p.waitForTimeout(2500);const f=p.frames().find(x=>x!==p.mainFrame());
const names=[];p.on('download',d=>names.push(d.suggestedFilename()));
await f.evaluate(()=>document.querySelector('#csdock [data-d=save]').click());await p.waitForTimeout(400);await f.evaluate(()=>document.querySelector('#svs [data-sv=all]').click());await p.waitForTimeout(6000);
console.log('phone fallback downloads:',names);console.log(await f.evaluate(()=>document.getElementById('cstoast').textContent));await b.close()})();
