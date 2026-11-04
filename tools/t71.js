const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];
const step=async(n,f)=>{try{await f()}catch(e){log.push('FAIL '+n+': '+e.message.split('\n')[0])}};
for(const v of ['a','b'])for(const [vw,vh,mob,sc] of [[390,844,true,'light'],[375,667,true,'dark'],[1280,800,false,'light']]){
  const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob,colorScheme:sc});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(v+vw+': '+e.message));
  await p.goto('file://'+require('path').resolve('cbt-'+v+'.html'));await p.evaluate(()=>localStorage.clear());await p.reload();
  await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1300);
  const k=v+'-'+vw;await p.evaluate(()=>document.getElementById('simple').style.paddingBottom='900px');await p.screenshot({path:'shots/v-'+k+'-top.png'});
  log.push(k+' '+JSON.stringify(await p.evaluate(()=>({hs:document.documentElement.scrollWidth>innerWidth,dock:document.getElementById('cbdock').classList.contains('on'),title:document.getElementById('cbtn').getBoundingClientRect().width|0}))));
  if(mob){
    if(v==='b'){await p.tap('.cbseg [data-k="d30"]');await p.waitForTimeout(500);log.push(k+' seg: '+(await p.evaluate(()=>document.getElementById('cb-perl').textContent)));
      await p.tap('.cbmore');await p.waitForTimeout(500);await p.screenshot({path:'shots/v-'+k+'-more.png'});await p.tap('#mo-plats [data-p="eBay"]');await p.waitForTimeout(600);log.push(k+' plat: '+(await p.evaluate(()=>document.getElementById('cb-platl').textContent+' open:'+document.getElementById('mored').open)));
      await p.tap('#cb-per');await p.waitForTimeout(400);await p.screenshot({path:'shots/v-'+k+'-cal.png'});await p.mouse.click(5,400);await p.waitForTimeout(300)}
    await p.evaluate(()=>document.getElementById('cbx').scrollTo(0,500));await p.waitForTimeout(900);await p.screenshot({path:'shots/v-'+k+'-scroll.png'});
    if(v==='a')log.push(k+' slim: '+(await p.evaluate(()=>document.querySelector('.cbslim').classList.contains('on'))));
    await p.evaluate(()=>document.getElementById('cbx').scrollTo(0,0));await p.waitForTimeout(500);
    await step(k+' edit',async()=>{if(v==='b'){await p.tap('.cbmore');await p.waitForTimeout(400);await p.tap('#mo-edit');await p.waitForTimeout(700)}else{await p.tap('#cb-edit',{timeout:4000});await p.waitForTimeout(500)}await p.screenshot({path:'shots/v-'+k+'-edit.png'});log.push(k+' dock hidden in edit: '+!(await p.evaluate(()=>document.getElementById('cbdock').classList.contains('on'))));await p.tap('#cb-edit',{timeout:4000});await p.waitForTimeout(400)});
    await p.tap('#cb-stories');await p.waitForTimeout(1200);await p.screenshot({path:'shots/v-'+k+'-stories.png'});
    log.push(k+' dock hidden in stories: '+!(await p.evaluate(()=>document.getElementById('cbdock').classList.contains('on'))));
    const f=p.frame({url:/about:srcdoc/});await f.tap('#csdock [data-d="share"]');await p.waitForTimeout(400);await p.screenshot({path:'shots/v-'+k+'-stoast.png'});
    await f.tap('.top .back');await p.waitForTimeout(600);log.push(k+' back, dock: '+(await p.evaluate(()=>document.getElementById('cbdock').classList.contains('on'))));
  }
  await ctx.close()}
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
