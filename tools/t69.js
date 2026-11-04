const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];
for(const [vw,vh,sc] of [[390,844,'dark'],[375,667,'light'],[430,932,'dark']]){const p=await (await b.newContext({viewport:{width:vw,height:vh},isMobile:true,hasTouch:true,colorScheme:sc})).newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+require('path').resolve('stories-t.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(500);
  await p.screenshot({path:'shots/s4-'+vw+'.png'});
  await p.tap('#perb');await p.waitForTimeout(300);log.push(vw+' menu on screen: '+(await p.evaluate(()=>{const r=document.getElementById('perm').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})));await p.screenshot({path:'shots/s4-'+vw+'-menu.png'});await p.tap('#perb');
  log.push(vw+' theme row one line: '+(await p.evaluate(()=>{const t=[...document.querySelectorAll('#thm .tchip')].map(x=>x.getBoundingClientRect().top);return Math.max(...t)-Math.min(...t)<2})));
  await p.tap('.sl[data-n="0"]');await p.waitForTimeout(600);await p.screenshot({path:'shots/s4-'+vw+'-lb.png'});
  log.push(vw+' lightbox fits: '+(await p.evaluate(()=>{const s=document.querySelector('#lb .sl').getBoundingClientRect(),a=document.querySelector('#lb .acts').getBoundingClientRect();const one=[...document.querySelectorAll('#lb .acts button')].every(x=>x.getBoundingClientRect().height<=50);return s.bottom<=a.top&&a.bottom<=innerHeight&&s.right<=innerWidth&&one})));
  await p.tap('#lb [data-a="close"]');await p.waitForTimeout(300)}
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
