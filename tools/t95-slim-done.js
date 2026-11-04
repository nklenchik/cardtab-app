const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();for(const dark of [false,true]){const p=await (await b.newContext({viewport:{width:390,height:664},isMobile:true,hasTouch:true,deviceScaleFactor:2,colorScheme:dark?'dark':'light'})).newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(400);
await p.evaluate(()=>{document.getElementById('cbx').scrollTop=500});await p.waitForTimeout(500);
await p.screenshot({path:'done-'+(dark?'d':'l')+'.png',clip:{x:0,y:0,width:390,height:200}});
await p.tap('.cbslim .sdone');await p.waitForTimeout(500);
console.log(dark?'dark':'light','editing after Done:',await p.evaluate(()=>document.getElementById('cb').classList.contains('editing')),'slim:',await p.evaluate(()=>document.querySelector('.cbslim').className));}
await b.close()})();
