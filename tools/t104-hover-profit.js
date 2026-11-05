const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();for(const cs of ['light','dark']){const p=await (await b.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,colorScheme:cs})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(4500);
const r=await p.evaluate(()=>{const e=document.querySelectorAll('.ct-row')[1].getBoundingClientRect();return {x:e.x+200,y:e.y+30}});await p.mouse.move(r.x,r.y);await p.waitForTimeout(400);
console.log(cs,await p.evaluate(()=>{const rows=document.querySelectorAll('.ct-row');return getComputedStyle(rows[1]).backgroundColor+' vs '+getComputedStyle(rows[2]).backgroundColor+' | profit tile '+getComputedStyle(document.getElementById('ct-profit').parentElement).backgroundImage.slice(0,70)}));
await p.screenshot({path:'hover-'+cs+'.png'})}
await b.close()})();
