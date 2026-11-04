const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const W=+process.argv[2];const ctx=await b.newContext({viewport:{width:W,height:W<500?664:900},isMobile:W<500,hasTouch:W<500,deviceScaleFactor:2});const p=await ctx.newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(400);await p.evaluate(()=>document.getElementById('addw').click());await p.waitForTimeout(1200);
await p.evaluate(()=>{const t=document.querySelector('#aw-list .thumb[data-k=budget]');t&&t.scrollIntoView({block:'center'})});await p.waitForTimeout(600);
await p.screenshot({path:'gal-'+W+'.png'});await b.close()})();
