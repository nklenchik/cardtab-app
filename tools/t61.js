const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[];
for(const [vw,vh,mob,sc] of [[1280,800,false,'dark'],[390,844,true,'light']]){const p=await (await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob,colorScheme:sc})).newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1200);
  await p.screenshot({path:'shots/v19-'+vw+'-a.png',clip:{x:0,y:0,width:vw,height:mob?200:120}});
  await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(500);await p.screenshot({path:'shots/v19-'+vw+'-b.png',clip:{x:0,y:0,width:vw,height:mob?260:200}});
  await p.evaluate(()=>document.getElementById('cbx').scrollTop=1e5);await p.waitForTimeout(200);await p.screenshot({path:'shots/v19-'+vw+'-c.png',clip:{x:0,y:vh-160,width:vw,height:160}});
  await p.evaluate(()=>document.getElementById('cb-reset').click());await p.waitForTimeout(300);console.log(vw,'reset dialog open',await p.evaluate(()=>document.getElementById('rs').open));
  await p.evaluate(()=>{document.getElementById('rs').close();document.getElementById('cb-edit').click()});await p.waitForTimeout(400);
  console.log(vw,'after Done, filters back:',await p.evaluate(()=>getComputedStyle(document.getElementById('cb-per')).display!=='none'&&getComputedStyle(document.getElementById('cb-ask')).display!=='none'))}
console.log('ERR',JSON.stringify(errs));await b.close()})();
