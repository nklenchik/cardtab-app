const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
await p.evaluate(()=>document.getElementById('cbx').scrollTo(0,400));const s=[];for(let i=0;i<10;i++){s.push(await p.evaluate(()=>{const e=document.querySelector('.cbslim');return Math.round(e.getBoundingClientRect().top)+' op'+getComputedStyle(e).opacity}));await p.waitForTimeout(100)}
console.log('slide in:',s.join(' | '));
await p.evaluate(()=>document.getElementById('cbx').scrollTo(0,0));const h=[];for(let i=0;i<10;i++){h.push(await p.evaluate(()=>Math.round(document.querySelector('.cbslim').getBoundingClientRect().top)));await p.waitForTimeout(100)}
console.log('slide away:',h.join(' '));await b.close()})();
