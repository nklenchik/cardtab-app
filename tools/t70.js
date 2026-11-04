const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];
for(const [vw,vh,mob,sc] of [[1440,900,false,'light'],[1280,800,false,'dark'],[390,844,true,'light'],[375,667,true,'dark']]){
  const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob,colorScheme:sc});const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(vw+': '+e.message));
  await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());
  await p.evaluate(()=>localStorage.setItem('cb.view',JSON.stringify({period:'ytd',plat:'all',custom:{}})));await p.reload();
  await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1200);
  const tb=await p.evaluate(()=>{const ids=['cbtn','cb-stories','cb-ask','cb-share','cb-acct'];const r=ids.map(i=>document.getElementById(i).getBoundingClientRect());const tops=r.map(x=>Math.round(x.top));return {title:document.getElementById('cbtn').textContent,tops,inView:r.every(x=>x.right<=innerWidth+1&&x.left>=0),hs:document.documentElement.scrollWidth>innerWidth}});
  log.push(vw+' '+JSON.stringify(tb));await p.screenshot({path:'shots/l-'+vw+'-board.png'});
  await p.waitForTimeout(2500);await p.click('#cb-stories');await p.waitForTimeout(150);await p.screenshot({path:'shots/l-'+vw+'-mid.png'});await p.waitForTimeout(700);
  const fr=p.frameLocator('#csx iframe');
  const st=await p.frame({url:/about:srcdoc/}).evaluate(()=>({t:document.querySelector('.ttl').textContent,per:document.getElementById('perl').textContent,ft:document.querySelector('.sl .ft span').textContent,hs:document.documentElement.scrollWidth>innerWidth}));
  log.push(vw+' stories '+JSON.stringify(st));await p.screenshot({path:'shots/l-'+vw+'-stories.png'});
  await fr.locator('.top .back').click();await p.waitForTimeout(500);
  log.push(vw+' back closed: '+(await p.evaluate(()=>!document.getElementById('csx').classList.contains('in'))));
  // reopen keeps working, range synced after board change
  await p.evaluate(()=>{localStorage.setItem('cb.view',JSON.stringify({period:'all',plat:'all',custom:{}}))});await p.click('#cb-stories');await p.waitForTimeout(700);
  log.push(vw+' resync: '+(await p.frame({url:/about:srcdoc/}).evaluate(()=>document.getElementById('perl').textContent)));
  await p.keyboard.press('Escape');await p.waitForTimeout(500);log.push(vw+' esc closed: '+(await p.evaluate(()=>!document.getElementById('csx').classList.contains('in'))));
  // viewing as someone else shows the name
  await ctx.close()}
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
