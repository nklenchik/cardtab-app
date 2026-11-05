const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();for(const cs of ['light','dark']){const p=await (await b.newContext({viewport:{width:390,height:760},deviceScaleFactor:2,colorScheme:cs,isMobile:true,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(800);
const st=()=>p.evaluate(()=>{const b=document.querySelector('.ct-stick');return b.classList.contains('on')+' top '+Math.round(b.getBoundingClientRect().top)});
await p.mouse.wheel(0,900);await p.waitForTimeout(1000);const down=await st();
await p.mouse.wheel(0,-120);await p.waitForTimeout(1000);const up=await st();await p.screenshot({path:'stick-'+cs+'.png',clip:{x:0,y:0,width:390,height:260}});
// type in the bar search
await p.evaluate(()=>document.querySelector('.ct-stick input').focus());await p.keyboard.type('Gengar');await p.waitForTimeout(400);
const sync=await p.evaluate(()=>document.getElementById('ct-search').value+' rows '+document.querySelectorAll('.ct-row').length);
await p.evaluate(()=>{const i=document.querySelector('.ct-stick input');i.value='';i.dispatchEvent(new Event('input'));i.blur()});await p.waitForTimeout(300);
// + opens Add New
await p.evaluate(()=>document.querySelector('.ct-stick-add').click());await p.waitForTimeout(900);const addOpen=await p.evaluate(()=>document.getElementById('as').open);
await p.keyboard.press('Escape');await p.waitForTimeout(600);
await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(1000);const top=await st();
console.log(cs,'after scroll down:',down,'| after small scroll up:',up,'| typed ->',sync,'| + opens add:',addOpen,'| back at top:',top,errs)}
await b.close()})();
