const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const W=+(process.argv[2]||390);const ctx=await b.newContext({viewport:{width:W,height:W<500?664:860},isMobile:W<500,hasTouch:W<500,deviceScaleFactor:2});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(700);
const mode=process.argv[3]||'sample';
if(mode==='sample')await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);
await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
for(let i=0;i<4;i++){await p.evaluate(()=>document.querySelector('.cbquiet button')?document.querySelector('.cbquiet button').click():document.getElementById('cb-stories').click());await p.waitForTimeout(1000);
 console.log(await p.evaluate(()=>{const h=document.getElementById('pm-art');return h.style.backgroundImage.split('/').pop()+' size='+(h.style.backgroundSize||'cover')+' pos='+h.style.backgroundPosition}));
 await p.screenshot({path:'art'+i+'.png',clip:{x:0,y:W<500?20:100,width:W,height:W<500?320:340}});await p.evaluate(()=>document.getElementById('pms').close());await p.waitForTimeout(450)}
console.log('errors',errs);await b.close()})();
