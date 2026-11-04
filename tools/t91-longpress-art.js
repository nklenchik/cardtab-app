const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
const r=await p.evaluate(()=>{const e=document.querySelector('.k-feat .fw').getBoundingClientRect();return {x:e.x+e.width/2,y:e.y+e.height/2}});
console.log('element under finger:',await p.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return e.tagName+'.'+e.className},r));
// press and hold with a touch pointer
const cdp=await p.context().newCDPSession(p);
await p.touchscreen.tap(r.x,r.y);await p.waitForTimeout(900);console.log('tap opens entries:',await p.evaluate(()=>!!document.querySelector('#ent[open], dialog[open]')));await p.goBack();await p.waitForTimeout(700);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y}]});await p.waitForTimeout(700);
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(800);
console.log('editing:',await p.evaluate(()=>document.getElementById('cb').classList.contains('editing')),'entries sheet open:',await p.evaluate(()=>[...document.querySelectorAll('dialog[open]')].map(d=>d.id).join(',')||'none'));
console.log(er);await b.close()})();
