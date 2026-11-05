const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:800},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(500);
await p.evaluate(async()=>{await CTStore.setBudget({cents:15000,alert:true})});await p.waitForTimeout(300);
await p.evaluate(()=>{scrollTo(0,250)});await p.waitForTimeout(300);
await p.tap('#ct-budget .bu-open');await p.waitForTimeout(80);await p.screenshot({path:'ru-mid.png'});await p.waitForTimeout(600);
const center=()=>p.evaluate(()=>{const sc=document.getElementById('bu-sc'),nd=document.querySelector('.bu-nd').getBoundingClientRect(),nx=nd.left+nd.width/2;
  let best=null;[...sc.children].forEach((t,i)=>{const r=t.getBoundingClientRect(),cx=r.left+5;if(!best||Math.abs(cx-nx)<Math.abs(best.d))best={i,d:cx-nx}});
  return {val:document.getElementById('bu-amt').value,focused:document.activeElement.id||document.activeElement.className,sl:sc.scrollLeft,tick$:best.i*5,off:+best.d.toFixed(2),panelMid:Math.round(document.querySelector('.bu-p').getBoundingClientRect().top+document.querySelector('.bu-p').getBoundingClientRect().height/2)}});
console.log('open',JSON.stringify(await center()));
await p.screenshot({path:'ru-open.png'});
await p.tap('#bu-amt');await p.evaluate(()=>{const i=document.getElementById('bu-amt');i.value='';});await p.keyboard.type('400');await p.waitForTimeout(150);console.log('typing (before glide)',JSON.stringify(await center()));await p.waitForTimeout(900);console.log('after glide',JSON.stringify(await center()));
await p.keyboard.press('Backspace');await p.keyboard.press('Backspace');await p.keyboard.press('Backspace');await p.keyboard.type('237');await p.waitForTimeout(1100);console.log('typed 237',JSON.stringify(await center()));
// simulate repeated swipes for the speed-up classes
const swipe=()=>p.evaluate(()=>{const sc=document.getElementById('bu-sc');const T=(x)=>new Touch({identifier:1,target:sc,clientX:x,clientY:400});sc.dispatchEvent(new TouchEvent('touchstart',{touches:[T(300)],bubbles:true}));sc.dispatchEvent(new TouchEvent('touchmove',{touches:[T(250)],bubbles:true}));sc.scrollLeft+=100;return sc.className+' | '+document.getElementById('bu-fast').className+' '+document.getElementById('bu-fast').textContent});
for(let i=0;i<7;i++){console.log('swipe',i+1,await swipe());await p.waitForTimeout(250)}
await p.screenshot({path:'ru-fast.png'});
console.log('errs',errs);await b.close()})();
