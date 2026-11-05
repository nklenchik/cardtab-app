const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const [dev,th] of [['phone','dark'],['phone','light'],['desk','dark']]){const ph=dev==='phone';const p=await (await b.newContext({viewport:ph?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:ph?2:1,isMobile:ph,hasTouch:ph,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium');await CTStore.setBudget({cents:15000,alert:false})});await p.waitForTimeout(4200);
const cur=()=>p.evaluate(()=>{const q=document.querySelector('#ct-tbar [aria-current]');return q?q.dataset.tab:'-'});
await p.screenshot({path:'b-'+dev+'-'+th+'-entries.png'});console.log(dev,th,'entries cur:',await cur());
if(ph){await p.tap('#ct-fab');await p.waitForTimeout(800);console.log('  fab opens Add New:',await p.evaluate(()=>!!document.querySelector('dialog#as[open]')));await p.keyboard.press('Escape');await p.waitForTimeout(600)}
const tab=t=>ph?p.tap('#ct-tbar [data-tab='+t+']'):p.click('.ct-demo-top .ct-tabs [data-tab='+t+']');
await tab('board');await p.waitForTimeout(2600);await p.screenshot({path:'b-'+dev+'-'+th+'-board.png'});
console.log('  board cur:',await cur(),' tbar visible over board:',await p.evaluate(()=>{const r=document.getElementById('ct-tbar').getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+20);return !!el&&!!el.closest('#ct-tbar')}),' cbic:',await p.evaluate(()=>{const w=document.querySelector('.cbic');if(!w)return 'none';const r=w.getBoundingClientRect(),e=document.getElementById('cb-edit').getBoundingClientRect();return getComputedStyle(w).display+' dy '+Math.round((r.top+r.height/2)-(e.top+e.height/2))+' gap '+Math.round(e.left-r.right)}),' desk tabs:',await p.evaluate(()=>{const t=document.querySelector('.cb-tabs');return t?getComputedStyle(t).display:'none'}));
// to stories
if(ph)await tab('stories');else await p.click('.cb-tabs [data-tab=stories]');await p.waitForTimeout(2800);await p.screenshot({path:'b-'+dev+'-'+th+'-stories.png'});
console.log('  stories cur:',await cur(),' csx bottom gap:',await p.evaluate(()=>Math.round(innerHeight-document.getElementById('csx').getBoundingClientRect().bottom)));
// stories -> entries
if(ph)await tab('entries');else{const f=p.frames().find(f=>f!==p.mainFrame());await f.click('.cstabs [data-tab=entries]')}await p.waitForTimeout(1500);
console.log('  back to entries:',await p.evaluate(()=>document.querySelector('.cbx').classList.contains('off')),'cur:',await cur(),errs);await p.close()}
await b.close()})();
