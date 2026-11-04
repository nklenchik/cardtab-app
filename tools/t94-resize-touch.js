const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:664},isMobile:true,hasTouch:true})).newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(500);
await p.evaluate(()=>{document.getElementById('cbx').scrollTop=300});await p.waitForTimeout(300);const w0=await p.evaluate(()=>document.querySelector('#simple .k-profit').getBoundingClientRect().width);
const g=await p.evaluate(()=>{const r=document.querySelector('#simple .k-profit .grip').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
const cdp=await p.context().newCDPSession(p);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:g.x,y:g.y}]});
console.log('el at grip',await p.evaluate(g=>{const e=document.elementFromPoint(g.x,g.y);return e.tagName+'.'+e.className},g),'rzing',await p.evaluate(()=>document.getElementById('cb').className));for(let i=1;i<=24;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.min(380,g.x+i*12),y:g.y+i*8}]});await p.waitForTimeout(30)}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(600);
console.log('width',w0,'->',await p.evaluate(()=>document.querySelector('#simple .k-profit').getBoundingClientRect().width));await b.close()})();
