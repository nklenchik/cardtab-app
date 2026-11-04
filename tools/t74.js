const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const out=[];
for(const [vw,vh,mob] of [[390,844,true],[1440,900,false]]){const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob});const p=await ctx.newPage();
 await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(4500);
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 for(const [name,sel,close] of [['share','#cb-share','#shd'],['ask','#cb-ask','#askd'],['dates','#cb-per','#cr'],['profile','#cb-acct',null]]){
  await p.evaluate(()=>{window.__f=[];let last=performance.now();const tick=t=>{window.__f.push(t-last);last=t;if(window.__f.length<60)requestAnimationFrame(tick)};requestAnimationFrame(tick)});
  const t0=Date.now();await p.evaluate(s=>document.querySelector(s).click(),sel);await p.waitForTimeout(1400);
  const f=await p.evaluate(()=>window.__f);const slow=f.filter(x=>x>34).map(x=>Math.round(x));
  out.push(vw+' '+name+' frames:'+f.length+' slow:'+JSON.stringify(slow)+' first:'+Math.round(f[0])+','+Math.round(f[1]||0)+','+Math.round(f[2]||0));
  await p.keyboard.press('Escape');await p.waitForTimeout(700);await p.evaluate(()=>document.querySelectorAll('.cb-menu').forEach(m=>m.hidden=true));}
 await ctx.close()}
console.log(out.join('\n'));await b.close()})();
