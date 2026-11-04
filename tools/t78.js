const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const [vw,vh,mob,tag] of [[390,844,true,'m'],[1280,800,false,'d']]){
 const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob,recordVideo:{dir:'vid/'+tag,size:{width:vw,height:vh}}});const p=await ctx.newPage();
 await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(4500);
 const T={};T.ask0=Date.now();await p.evaluate(()=>document.getElementById('cb-ask').click());await p.waitForTimeout(1200);await p.keyboard.press('Escape');await p.waitForTimeout(800);
 T.sh0=Date.now();await p.evaluate(()=>document.getElementById('cb-share').click());await p.waitForTimeout(1200);await p.keyboard.press('Escape');await p.waitForTimeout(800);
 const v=p.video();await ctx.close();const path=await v.path();console.log(tag,path,JSON.stringify(T))}
await b.close()})();
