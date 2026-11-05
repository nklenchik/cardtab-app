const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();for(const cs of ['light','dark'])for(const W of [390,320]){const p=await (await b.newContext({viewport:{width:W,height:700},deviceScaleFactor:3,colorScheme:cs,isMobile:true,hasTouch:true})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
const r=await p.evaluate(()=>{const s=document.querySelector('.ct-search').getBoundingClientRect(),a=document.getElementById('ct-add').getBoundingClientRect(),i=document.getElementById('ct-search').getBoundingClientRect();return {s:[s.x,s.right,s.top,s.height],a:[a.x,a.right,a.top,a.height],inputRight:i.right}});
console.log(cs,W,JSON.stringify(r));await p.screenshot({path:`head-${cs}-${W}.png`,clip:{x:0,y:0,width:W,height:130}})}
await b.close()})();
