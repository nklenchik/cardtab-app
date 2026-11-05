const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}));localStorage.setItem('cb.hint',JSON.stringify({off:1}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium')});await p.waitForTimeout(4000);
await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2800);await p.tap('.cbedl');await p.waitForTimeout(900);
const state=()=>p.evaluate(()=>[...document.querySelectorAll('#simple > .w[data-id]')].slice(0,4).map(e=>{const r=e.getBoundingClientRect();return e.className.match(/k-[a-z]+/)[0]+'@'+Math.round(r.left)+','+Math.round(r.top+document.querySelector('.cbx').scrollTop)+' w'+Math.round(r.width)}));
console.log('before:',JSON.stringify(await state()));
// the right-hand widget in the first two-up row
const g=await p.evaluate(()=>{const ws=[...document.querySelectorAll('#simple > .w.edgeR')];const w=ws.find(x=>x.getBoundingClientRect().width<250);w.scrollIntoView({block:'center'});const gr=w.querySelector('.grip');const r=gr.getBoundingClientRect();return {k:w.className.match(/k-[a-z]+/)[0],x:r.left+r.width/2,y:r.top+r.height/2}});
await p.waitForTimeout(300);const g2=await p.evaluate(k=>{const w=document.querySelector('#simple > .w.'+k);const r=w.querySelector('.grip').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}},g.k);
await p.mouse.move(g2.x,g2.y);await p.mouse.down();for(let i=1;i<=12;i++){await p.mouse.move(g2.x-i*14,g2.y+2);await p.waitForTimeout(16)}await p.mouse.up();
// sample motion of the neighbour during the settle
const moves=await p.evaluate(()=>new Promise(r=>{const out=[];const t0=performance.now();const f=()=>{const ws=[...document.querySelectorAll('#simple > .w[data-id]')];out.push(ws.slice(1,4).map(e=>getComputedStyle(e).transform==='none'?0:1).join(''));if(performance.now()-t0<350)requestAnimationFrame(f);else r(out.slice(0,8).join(' '))};requestAnimationFrame(f)}));
await p.waitForTimeout(600);console.log('resized',g.k,'| animating frames (1=moving):',moves);console.log('after: ',JSON.stringify(await state()),errs);
await p.screenshot({path:'rz-after.png'});await b.close()})();
