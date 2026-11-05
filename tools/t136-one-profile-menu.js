const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const dev of ['phone','desk']){const ph=dev==='phone';const p=await (await b.newContext({viewport:ph?{width:390,height:760}:{width:1440,height:900},deviceScaleFactor:ph?2:1,isMobile:ph,hasTouch:ph,colorScheme:'light'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}));localStorage.setItem('cb.hint',JSON.stringify({off:1}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium')});await p.waitForTimeout(4000);
const info=()=>p.evaluate(()=>{const m=document.getElementById('app-menu');const vis=x=>x&&!x.hidden&&x.getClientRects().length;const r=m.getBoundingClientRect();const top=document.elementFromPoint(r.left+r.width/2,r.top+30);
 return {open:!m.hidden,onTop:!!top&&!!top.closest('#app-menu'),here:(m.querySelector('.amgo .here')||{}).dataset?.go,section:vis(document.getElementById('am-page-t'))?document.getElementById('am-page-t').textContent:'(entries)',page:[...m.querySelectorAll('#am-page button')].filter(vis).map(x=>x.textContent.trim()),admin:vis(document.getElementById('am-dev')),left:Math.round(r.left),top:Math.round(r.top)}});
const tap=s=>ph?p.tap(s):p.click(s);
await tap('#app-avatar');await p.waitForTimeout(500);console.log(dev,'entries',JSON.stringify(await info()));await p.keyboard.press('Escape');await p.waitForTimeout(300);
if(ph)await p.tap('#ct-tbar [data-tab=board]');else await p.click('.ct-demo-top .ct-tabs [data-tab=board]');await p.waitForTimeout(2800);
await tap('#cb-av');await p.waitForTimeout(500);console.log(dev,'board',JSON.stringify(await info()));if(ph)await p.screenshot({path:'m2-board.png'});
// Edit board from the menu
await p.evaluate(()=>[...document.querySelectorAll('#am-page .am-pact')].find(b=>/Edit/.test(b.textContent)).click());await p.waitForTimeout(900);
console.log('  Edit board from menu enters edit:',await p.evaluate(()=>document.getElementById('cb-edit').classList.contains('on')),' menu closed:',await p.evaluate(()=>document.getElementById('app-menu').hidden));
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(600);
if(ph)await p.tap('#ct-tbar [data-tab=stories]');else await p.click('.cb-tabs [data-tab=stories]');await p.waitForTimeout(3000);
const f=p.frames().find(x=>x!==p.mainFrame());await f.click('#csacct');await p.waitForTimeout(600);console.log(dev,'stories',JSON.stringify(await info()));if(ph)await p.screenshot({path:'m2-stories.png'});
await p.evaluate(()=>[...document.querySelectorAll('#am-page .am-pact')].find(b=>/themes/.test(b.textContent)).click());await p.waitForTimeout(900);
console.log('  Story themes from menu opens themes:',await f.evaluate(()=>{const t=document.getElementById('ths');return !!t&&!t.hidden}),errs);await p.close()}
await b.close()})();
