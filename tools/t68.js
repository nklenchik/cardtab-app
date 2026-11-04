const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];
for(const [vw,vh,mob] of [[1366,900,false],[390,844,true]]){const p=await (await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob})).newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+require('path').resolve('stories-t.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(500);
  await p.screenshot({path:'shots/s3-'+vw+'.png'});log.push(vw+' hscroll '+(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))+' chips '+(await p.evaluate(()=>document.querySelectorAll('#thm .tchip').length)));
  await p.click('#perb');await p.waitForTimeout(250);await p.screenshot({path:'shots/s3-'+vw+'-menu.png'});
  await p.click('#perm [data-p="custom"]');await p.waitForTimeout(450);await p.selectOption('#cr-a','2025-12');await p.selectOption('#cr-b','2026-04');await p.screenshot({path:'shots/s3-'+vw+'-cr.png'});await p.click('#cr-go');await p.waitForTimeout(400);
  log.push(vw+' custom: '+(await p.textContent('#perl'))+' / footer '+(await p.textContent('.sl[data-n="0"] .ft span:last-child')));
  await p.click('[data-all]');await p.waitForTimeout(450);await p.screenshot({path:'shots/s3-'+vw+'-themes.png'});
  await p.click('#tgrid [data-i="20"]');await p.waitForTimeout(400);log.push(vw+' chips now: '+(await p.evaluate(()=>[...document.querySelectorAll('#thm .tchip')].map(x=>x.textContent.trim()).join(', '))));
  await p.screenshot({path:'shots/s3-'+vw+'-after.png'})}
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
