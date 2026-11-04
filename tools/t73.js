const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];
for(const [vw,vh,mob,sc] of [[1440,900,false,'light'],[390,844,true,'dark']]){const p=await (await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob,colorScheme:sc})).newPage();p.on('pageerror',e=>errs.push(vw+': '+e.message));
 await p.goto('file://'+require('path').resolve('stories-t.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(400);
 await p.screenshot({path:'shots/x-'+vw+'.png'});
 if(mob){await p.tap('#perb');await p.waitForTimeout(400);await p.screenshot({path:'shots/x-'+vw+'-sheet.png'});await p.tap('#spre [data-sp="lm"]');await p.waitForTimeout(600)}
 else{await p.click('#perb');await p.waitForTimeout(250);await p.screenshot({path:'shots/x-'+vw+'-menu.png'});await p.click('#perm [data-p="lm"]');await p.waitForTimeout(600)}
 log.push(vw+' '+(await p.evaluate(()=>document.getElementById('perl').textContent+' | '+[...document.querySelectorAll('#track .sl')].map(s=>s.querySelector('.h,.num')?.textContent.slice(0,40)).join(' / '))));
 await p.screenshot({path:'shots/x-'+vw+'-lm.png'});
 // cycle the options on story 4 and 5 to see week versions
 for(const n of [3,4])for(let i=0;i<3;i++){await p.locator('[data-mb="'+n+'"]').click();await p.waitForTimeout(450);log.push(vw+' s'+n+' '+(await p.evaluate(n=>{const s=document.querySelector('#track .sl[data-n="'+n+'"]');return s.innerText.replace(/\s+/g,' ').slice(0,110)},n)))}
 if(!mob)await p.screenshot({path:'shots/x-'+vw+'-weeks.png'});
}
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
