const pw=require('playwright');const tag=process.argv[2]||'before';(async()=>{const b=await pw.chromium.launch();
for(const W of [390,1280]){const p=await (await b.newContext({viewport:{width:W,height:W<500?760:860},deviceScaleFactor:2,colorScheme:'dark',isMobile:W<500,hasTouch:W<500})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(800);
await p.screenshot({path:`dk-${tag}-${W}-dash.png`});
// expand first entry
await p.evaluate(()=>{const r=document.querySelector('.ct-row-toggle');r&&r.click()});await p.waitForTimeout(700);
await p.evaluate(()=>{const r=document.querySelector('.ct-row.expanded');r&&r.scrollIntoView({block:'center'})});await p.waitForTimeout(300);
await p.screenshot({path:`dk-${tag}-${W}-entry.png`});
// profile menu
await p.evaluate(()=>window.scrollTo(0,0));await p.evaluate(()=>document.getElementById('app-avatar').click());await p.waitForTimeout(600);
await p.screenshot({path:`dk-${tag}-${W}-menu.png`});
await p.keyboard.press('Escape');await p.waitForTimeout(400);await p.evaluate(()=>{document.body.click()});await p.waitForTimeout(300);
// add sheet
await p.evaluate(()=>document.getElementById('ct-add').click());await p.waitForTimeout(900);
await p.screenshot({path:`dk-${tag}-${W}-add.png`});
console.log(W,'errors',errs)}
await b.close()})();
