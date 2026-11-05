const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:1280,height:1000}})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(500);
const order=()=>p.evaluate(()=>[...document.querySelectorAll('#simple .w[data-id]')].map(w=>w.dataset.k).join(','));
console.log('before',await order());
const s=await p.evaluate(()=>{const r=document.querySelector('#simple .k-sales').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,r:[r.x,r.y]}});
await p.mouse.move(s.x,s.y);await p.mouse.down();await p.mouse.move(s.x+8,s.y+3);
const samples=[];for(let i=0;i<8;i++){samples.push(await p.evaluate(()=>{const f=document.querySelector('#simple .floating');if(!f)return 'nofl';const r=f.getBoundingClientRect();return Math.round(r.x)+','+Math.round(r.y)+' tr='+getComputedStyle(f).transitionProperty+':'+getComputedStyle(f).transitionDuration}));await p.waitForTimeout(40)}
console.log('sales at',s.r.map(Math.round),'floating samples',samples);
await p.waitForTimeout(300);console.log('during',await order());
console.log(await p.evaluate(()=>{const g=document.getElementById('simple'),cs=getComputedStyle(g);return 'sim padding '+cs.padding+' rect '+JSON.stringify(g.getBoundingClientRect().toJSON())}));
await p.mouse.up();await b.close()})();
