const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];const L=(...a)=>log.push(a.join(' '));
const step=async(n,f)=>{try{await f()}catch(e){L('FAIL',n,e.message.split('\n')[0])}};
for(const sc of ['light','dark']){const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:sc});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1500);
L(sc,'touch',await p.evaluate(()=>matchMedia('(hover:none)').matches));
await step('tap bar',async()=>{const svg=p.locator('#simple .w svg.pc').first();const bb=await svg.boundingBox();await p.touchscreen.tap(bb.x+bb.width*0.37,bb.y+bb.height*0.4);await p.waitForTimeout(400);
  L('readout',await p.evaluate(()=>{const r=document.querySelector('#simple .scr.on');return r?r.querySelector('.st').textContent:'none'}),'sheet open',await p.evaluate(()=>document.getElementById('ent').open));await p.screenshot({path:'shots/u-'+sc+'-bar.png'});
  await p.tap('#simple .scr .sgo');await p.waitForTimeout(700);await p.screenshot({path:'shots/u-'+sc+'-ent.png'});L('entries open',await p.evaluate(()=>document.getElementById('ent').open),'top',await p.evaluate(()=>Math.round(document.querySelector('#ent .awp').getBoundingClientRect().top)));
  await p.keyboard.press('Escape');await p.waitForTimeout(500);
  await p.touchscreen.tap(200,30);await p.waitForTimeout(300);L('cleared',await p.evaluate(()=>!document.querySelector('#simple .scr.on')))});
await step('flip profit',async()=>{await p.tap('#simple .kS .cq.drill');await p.waitForTimeout(400);await p.screenshot({path:'shots/u-'+sc+'-flip.png'});
  L('back',await p.evaluate(()=>{const k=document.querySelector('#simple .kback');return k?k.innerText.replace(/\s+/g,' '):'none'}),'ent',await p.evaluate(()=>document.getElementById('ent').open));
  await p.tap('#simple .kback .kr');await p.waitForTimeout(400);L('unflipped',await p.evaluate(()=>!document.querySelector('#simple .kback')))});
await ctx.close()}
// desktop unchanged: click bar opens entries
const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push('d '+e.message));
await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1500);
await p.click('#simple svg.pc rect[data-i="4"]');await p.waitForTimeout(600);L('desktop bar click opens entries',await p.evaluate(()=>document.getElementById('ent').open));
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
