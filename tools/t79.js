const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const [vw,vh,mob,tag,which] of [[390,844,true,'m','share'],[390,844,true,'m','ask'],[1280,800,false,'d','ask']]){
 const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob});const p=await ctx.newPage();
 await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(4500);
 const cdp=await ctx.newCDPSession(p);await cdp.send('Animation.enable');await cdp.send('Animation.setPlaybackRate',{playbackRate:0.08});
 await p.evaluate(w=>document.getElementById('cb-'+w).click(),which);
 for(let i=0;i<8;i++){await p.waitForTimeout(i===0?60:650);await p.screenshot({path:'shots/s-'+tag+which+i+'.png'})}
 await ctx.close()}
await b.close()})();
