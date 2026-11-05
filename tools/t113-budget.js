const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();for(const [W,cs] of [[390,'light'],[390,'dark'],[1280,'light']]){const p=await (await b.newContext({viewport:{width:W,height:W<500?800:860},deviceScaleFactor:2,colorScheme:cs,isMobile:W<500,hasTouch:W<500})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();indexedDB.databases&&0;localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(800);
const tag=W+cs;const shot=async n=>{const r=await p.evaluate(()=>{const e=document.querySelector('.ct-stats').getBoundingClientRect(),c=document.getElementById('ct-budget').getBoundingClientRect();return {x:Math.min(e.x,c.x),y:e.y,w:Math.max(e.width,c.width),h:c.bottom-e.y}});await p.screenshot({path:`bu-${tag}-${n}.png`,clip:{x:r.x-8,y:r.y-8,width:r.w+16,height:r.h+16}})};
await shot('unset');
// set $150 through the menu + sheet
await p.evaluate(()=>document.getElementById('app-avatar').click());await p.waitForTimeout(400);await p.evaluate(()=>document.getElementById('am-budget').click());await p.waitForTimeout(700);
await p.screenshot({path:`bu-${tag}-sheet.png`});
await p.evaluate(()=>document.querySelector('#bu-sheet [data-q="150"]').click());await p.waitForTimeout(200);await p.evaluate(()=>document.getElementById('bu-save').click());await p.waitForTimeout(800);
await shot('ok');
// cross 80%: set budget a little above spending so it's 83%
const spent=await p.evaluate(()=>{const k=new Date().toISOString().slice(0,7);return CTStore.all().reduce((a,t)=>a+(t.type==='purchase'&&t.date.startsWith(k)?t.amount:0),0)});
await p.waitForTimeout(2600);
await p.evaluate(s=>CTStore.setBudget({cents:Math.round(s/0.83),alert:true}),spent);await p.waitForTimeout(700);
await shot('warn');const note=await p.evaluate(()=>{const n=document.getElementById('bu-note');return n&&!n.hidden?n.textContent:'no note'});
await p.screenshot({path:`bu-${tag}-note.png`});
await p.evaluate(s=>CTStore.setBudget({cents:Math.round(s/1.2),alert:true}),spent);await p.waitForTimeout(700);await shot('over');
const note2=await p.evaluate(()=>{const n=document.getElementById('bu-note');return n&&!n.hidden?n.textContent:'no note'});
console.log(tag,'spent',spent,'| note1:',note,'| note2:',note2,'| menu',await p.evaluate(()=>document.getElementById('am-budget-v').textContent),'errors',errs)}
await b.close()})();
