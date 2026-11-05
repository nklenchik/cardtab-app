const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const path of ['in-board','from-entries']){const p=await (await b.newContext({viewport:{width:390,height:730},isMobile:true,hasTouch:true,colorScheme:'light'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(4000);
if(path==='in-board'){await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2600)}
await p.tap('#ct-tbar [data-tab=stories]');await p.waitForTimeout(120);
// what iPhone does: scroll the window to the panel while it's still sliding up
await p.evaluate(()=>{const pp=document.querySelector('#pms .pmp');pp.scrollIntoView({block:'start'})});
await p.waitForTimeout(900);
const r=await p.evaluate(()=>{const d=document.getElementById('pms'),pp=d.querySelector('.pmp').getBoundingClientRect();return {open:d.open,paneTop:Math.round(pp.top),paneBottom:Math.round(pp.bottom),vh:innerHeight,dlgScroll:d.scrollTop,focus:document.activeElement.id}});
console.log(path,JSON.stringify(r),errs);await p.screenshot({path:'pms3-'+path+'.png'});await p.close()}
await b.close()})();
