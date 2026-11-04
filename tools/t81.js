const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];const L=(...a)=>log.push(a.join(' '));
for(const [vw,vh] of [[390,844],[390,560]]){const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:true,hasTouch:true});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(4000);
 for(const [btn,dlg] of [['#cb-per','#cr'],['#cb-share','#shd'],['#cb-ask','#askd'],['#cb-acct',null]]){if(!dlg)continue;
  await p.tap(btn);await p.waitForTimeout(700);
  const r=await p.evaluate(d=>{const el=document.querySelector(d),pn=el.querySelector('.awp'),R=pn.getBoundingClientRect(),sc=pn.querySelector('.awbody')||pn;return {top:Math.round(R.top),bottom:Math.round(R.bottom),vh:innerHeight,scroll:sc.scrollTop,focus:document.activeElement&&document.activeElement.tagName}},dlg);
  L(vh,dlg,JSON.stringify(r),r.bottom<=r.vh+1&&r.top>=0&&r.scroll===0?'OK':'CHECK');await p.screenshot({path:'shots/q-'+vh+dlg.slice(1)+'.png'});
  await p.keyboard.press('Escape');await p.waitForTimeout(500)}
 if(vh===844){await p.tap('#cb-edit');await p.waitForTimeout(500);L('editing',await p.evaluate(()=>document.getElementById('cb').classList.contains('editing')));
  const g=await p.evaluate(()=>{const s=document.getElementById('simple').getBoundingClientRect(),w=[...document.querySelectorAll('#simple .w')].map(x=>x.getBoundingClientRect());const last=w.reduce((a,r)=>r.bottom>a?r.bottom:a,0);return {x:Math.round(s.left+s.width/2),y:Math.round(Math.min(innerHeight-120,last+30))}});
  await p.tap('#simple .w .cq',{force:true});await p.waitForTimeout(300);L('tap widget keeps editing',await p.evaluate(()=>document.getElementById('cb').classList.contains('editing')));
  await p.evaluate(()=>document.getElementById('cbx').scrollTo(0,99999));await p.waitForTimeout(300);
  const y2=await p.evaluate(()=>{const w=[...document.querySelectorAll('#simple .w')].map(x=>x.getBoundingClientRect());const last=w.reduce((a,r)=>r.bottom>a?r.bottom:a,0);const f=document.getElementById('editfoot').getBoundingClientRect();return Math.round((last+f.top)/2)});
  await p.touchscreen.tap(195,y2);await p.waitForTimeout(400);L('tap empty space → done',!(await p.evaluate(()=>document.getElementById('cb').classList.contains('editing'))),'saved layout',!!(await p.evaluate(()=>localStorage.getItem('cb.layout.phone.v1')||localStorage.getItem('cb.layout.v3'))))}
 await ctx.close()}
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
