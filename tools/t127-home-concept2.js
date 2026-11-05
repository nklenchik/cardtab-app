const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
const runs=[['phone','dark',15000,'free'],['phone','light',7000,'premium'],['phone','dark',0,'free'],['desk','dark',15000,'free'],['desk','light',15000,'premium']];
for(const [dev,th,cents,plan] of runs){const ph=dev==='phone';const p=await (await b.newContext({viewport:ph?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:ph?2:1,isMobile:ph,hasTouch:ph,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async([c,pl])=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan(pl);if(c)await CTStore.setBudget({cents:c,alert:false})},[cents,plan]);await p.waitForTimeout(4200);
const r=await p.evaluate(()=>{const tiles=[...document.querySelectorAll('.ct-stats>div')];const hdr=document.querySelector('.ct-demo-top').getBoundingClientRect();
 return {tileH:tiles.map(t=>Math.round(t.getBoundingClientRect().height)),lines:tiles.map(t=>{const l=t.querySelector('.ct-line');return l?l.textContent+(l.className.includes('is-')?' ['+l.className.split('is-')[1]+']':''):'-'}),
 firstEntry:Math.round(document.querySelector('.ct-rows > *').getBoundingClientRect().top+scrollY),gap:Math.round(tiles[0].getBoundingClientRect().top-hdr.bottom),fill:getComputedStyle(document.getElementById('ct-spent').parentElement).getPropertyValue('--fill')}});
console.log(dev,th,plan,'budget',cents,JSON.stringify(r),errs);
await p.screenshot({path:'home-'+dev+'-'+th+'-'+cents+'.png'});
// Spent tile opens the budget window
await p.click('#ct-spent');await p.waitForTimeout(700);const op=await p.evaluate(()=>document.getElementById('bu-sheet').open);await p.keyboard.press('Escape');await p.waitForTimeout(500);
// Board tab
await p.click(ph?'#ct-tbar [data-tab=board]':'.ct-tabs [data-tab=board]');await p.waitForTimeout(2500);const bo=await p.evaluate(()=>{const c=document.querySelector('.cbx');return !!c&&!c.classList.contains('off')});
console.log('   spent tile opens budget:',op,' board tab opens board:',bo,errs.length?errs:'');await p.close()}
await b.close()})();
