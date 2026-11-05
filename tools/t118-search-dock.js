const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:760},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(800);
await p.mouse.wheel(0,900);await p.waitForTimeout(900);await p.mouse.wheel(0,-150);await p.waitForTimeout(1000);
const st=()=>p.evaluate(()=>{const b=document.querySelector('.ct-stick'),rp=document.querySelector('.ct-demo-top .ct-search');return {y:Math.round(scrollY),bar:b.classList.contains('on'),barTop:Math.round(document.querySelector('.ct-stick-q').getBoundingClientRect().top),real:Math.round(rp.getBoundingClientRect().top),realVis:getComputedStyle(rp).visibility,dock:b.style.getPropertyValue('--dock')}});
console.log('bar out',JSON.stringify(await st()));
// scroll up in small steps toward the top
const log=[];let i=0;while(i++<60){const s=await st();log.push(s);if(s.y<=0)break;await p.evaluate(()=>window.scrollBy(0,-14));await p.waitForTimeout(40)}
const sw=log.findIndex((s,k)=>k>0&&log[k-1].bar&&!s.bar);console.log('around the swap:',JSON.stringify(log.slice(Math.max(0,sw-3),sw+2)));
console.log('both pills visible at once at any step:',log.some(s=>s.bar&&s.realVis==='visible'),errs);
await b.close()})();
