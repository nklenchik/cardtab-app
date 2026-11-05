const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:1280,height:1100},deviceScaleFactor:1})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
// a fuller board: add a few widgets
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(400);
await p.evaluate(()=>document.getElementById('addw').click());await p.waitForTimeout(900);
for(const k of ['fees','where','best','win']){await p.evaluate(k=>{const t=document.querySelector('#aw-list .thumb[data-k='+k+']');t&&t.click()},k);await p.waitForTimeout(150)}
await p.evaluate(()=>{const d=document.querySelector('#aw .go, #aw [data-close], #aw-done');const b=[...document.querySelectorAll('#aw button')].find(x=>x.textContent.trim()==='Done');(b||d).click()});await p.waitForTimeout(900);
const L=()=>p.evaluate(()=>[...document.querySelectorAll('#simple .w[data-id]')].map(w=>{const r=w.getBoundingClientRect();return w.dataset.k+'@'+Math.round(r.x)+','+Math.round(r.y)+' '+Math.round(r.width)+'x'+Math.round(r.height)}));
console.log('start',JSON.stringify(await L()),'scroll',await p.evaluate(()=>document.getElementById('cbx').scrollTop));await p.screenshot({path:'dh-0.png'});
// drag the Sales (small) widget across to the right and down, sampling frames
const s=await p.evaluate(()=>{const r=document.querySelector('#simple .k-where').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
const t=await p.evaluate(()=>{return {x:1110,y:915}});
await p.mouse.move(s.x,s.y);await p.mouse.down();
const steps=24;for(let i=1;i<=steps;i++){await p.mouse.move(s.x+(t.x-s.x)*i/steps,s.y+(t.y-s.y)*i/steps);await p.waitForTimeout(40);if(i===12)await p.screenshot({path:'dh-1.png'})}
await p.waitForTimeout(300);await p.screenshot({path:'dh-2.png'});await p.mouse.up();await p.waitForTimeout(600);
console.log('end',JSON.stringify(await L()),'scroll',await p.evaluate(()=>document.getElementById('cbx').scrollTop));await p.screenshot({path:'dh-3.png'});
await b.close()})();
