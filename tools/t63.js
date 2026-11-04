const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];
let ctx=await b.newContext({viewport:{width:1280,height:900}});let p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.click('#expand');await p.waitForTimeout(1200);
log.push('starter: '+(await p.evaluate(()=>[...document.querySelectorAll('#simple>.w')].map(w=>w.dataset.k).join(',')))+' | tile '+(await p.evaluate(()=>!!document.getElementById('mkw'))));
await p.screenshot({path:'shots/v21-start.png'});
await p.click('[data-k="spent"] .cq');await p.waitForTimeout(500);log.push('spent entries: '+(await p.textContent('#ent-sub')));await p.screenshot({path:'shots/v21-ent.png'});
await p.keyboard.press('Escape');await p.waitForTimeout(300);log.push('closed: '+!(await p.evaluate(()=>document.getElementById('ent').open)));
const bar=await p.$('[data-k="month"] rect[data-i="2"]');await bar.click();await p.waitForTimeout(400);log.push('Feb bar: '+(await p.textContent('#ent-h'))+' / '+(await p.textContent('#ent-sub')));await p.click('#ent .x');await p.waitForTimeout(300);
// period + platform remembered
await p.click('#cb-per');await p.click('#cb-menu [data-k="d30"]');await p.click('#cb-plat');await p.click('#cb-pmenu [data-k="eBay"]');await p.reload();await p.click('#expand');await p.waitForTimeout(1200);
log.push('remembered: '+(await p.textContent('#cb-perl'))+' / '+(await p.textContent('#cb-platl')));
await p.click('#cb-per');await p.click('#cb-menu [data-k="l12"]');await p.click('#cb-plat');await p.click('#cb-pmenu [data-k="all"]');
// make it yours -> edit + add sheet; remove + undo
await p.click('#mkw');await p.waitForTimeout(700);log.push('mkw opens add: '+(await p.evaluate(()=>document.getElementById('aw').open)));await p.click('#aw .awfoot .go');await p.waitForTimeout(400);
await p.click('[data-k="sales"] .rm',{force:true});await p.waitForTimeout(400);log.push('undo shown: '+(await p.textContent('#undo-t')));await p.screenshot({path:'shots/v21-undo.png'});
await p.click('#undo-b');await p.waitForTimeout(400);log.push('after undo: '+(await p.evaluate(()=>[...document.querySelectorAll('#simple>.w')].map(w=>w.dataset.k).join(','))));
await p.click('#cb-edit');await p.waitForTimeout(300);log.push('tile after customizing: '+(await p.evaluate(()=>!!document.getElementById('mkw'))));
// opening animation frames for share and profile at 4x
const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
for(const [n,fn] of [['share',()=>document.getElementById('cb-share').click()],['profile',()=>{document.getElementById('cb-acct').click();document.querySelector('[data-am="profile"].amh').click()}],['ask',()=>document.getElementById('cb-ask').click()]]){
  await p.evaluate(()=>{window.__f=[];let l=performance.now(),t0=l;(function t(x){window.__f.push(x-l);l=x;if(x-t0<700)requestAnimationFrame(t)})(l)});await p.evaluate(fn);await p.waitForTimeout(900);
  const f=await p.evaluate(()=>window.__f.slice(1));log.push(n+' open @4x: slow>20ms '+f.filter(x=>x>20).length+'/'+f.length+' worst '+Math.max(...f).toFixed(0));
  if(n==='profile')await p.screenshot({path:'shots/v21-prof.png'});await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await p.waitForTimeout(400)}
await ctx.close();
ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.tap('#expand');await p.waitForTimeout(1200);await p.screenshot({path:'shots/v21-pstart.png'});
await p.tap('[data-k="profit"] .cq');await p.waitForTimeout(600);await p.screenshot({path:'shots/v21-pent.png'});
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
