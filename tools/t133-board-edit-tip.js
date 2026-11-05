const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const th of ['light','dark']){const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium')});await p.waitForTimeout(4000);
await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2800);
const top=await p.evaluate(()=>{const e=document.querySelector('.cbedl').getBoundingClientRect(),w=document.querySelector('.cbic').getBoundingClientRect(),a=document.getElementById('cb-av').getBoundingClientRect();return {editLeft:Math.round(e.left),editMidY:Math.round(e.top+e.height/2),iconsMidY:Math.round(w.top+w.height/2),avMidY:Math.round(a.top+a.height/2),gapToAvatar:Math.round(a.left-w.right)}});
const tip=await p.evaluate(()=>document.querySelector('.cbhint').classList.contains('on'));
console.log(th,'top row',JSON.stringify(top),' tip showing:',tip);await p.screenshot({path:'tip-'+th+'.png'});
if(th==='light'){
 await p.tap('.cbhint .h2');await p.waitForTimeout(400);console.log('  Got it hides:',!(await p.evaluate(()=>document.querySelector('.cbhint').classList.contains('on'))));
 // close and reopen: second visit shows again
 await p.tap('#ct-tbar [data-tab=entries]');await p.waitForTimeout(900);await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2200);console.log('  2nd visit tip:',await p.evaluate(()=>document.querySelector('.cbhint').classList.contains('on')));
 // long press a widget enters edit mode
 const w=await p.evaluate(()=>{const x=document.querySelector('#cb .w, #cb [data-k]');const r=x.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
 await p.tap('.cbedl');await p.waitForTimeout(800);
 console.log('  editing: done fab',await p.evaluate(()=>{const d=document.querySelector('.cbdone');return getComputedStyle(d).display+' op '+getComputedStyle(d).opacity}),' icons hidden',await p.evaluate(()=>getComputedStyle(document.querySelector('.cbic')).display),' tip hidden',!(await p.evaluate(()=>document.querySelector('.cbhint').classList.contains('on'))),' top pill:',await p.evaluate(()=>document.getElementById('cb-edit').textContent.trim()));
 await p.screenshot({path:'tip-edit.png'});
 await p.tap('.cbdone');await p.waitForTimeout(700);console.log('  Done fab exits edit:',!(await p.evaluate(()=>document.getElementById('cb-edit').classList.contains('on'))));
 await p.tap('#ct-tbar [data-tab=entries]');await p.waitForTimeout(900);await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2200);console.log('  after editing once, tip retired:',!(await p.evaluate(()=>document.querySelector('.cbhint').classList.contains('on'))));
}
console.log('  errs',errs);await p.close()}
await b.close()})();
