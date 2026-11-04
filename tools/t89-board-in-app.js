const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const er=[];
for(const [w,m,sc] of [[390,true,'light'],[1280,false,'light'],[390,true,'dark']]){const p=await (await b.newContext({viewport:{width:w,height:844},isMobile:m,hasTouch:m,colorScheme:sc})).newPage();p.on('pageerror',e=>er.push(w+' '+e.message));p.on('console',c=>{if(c.type()==='error')er.push(w+' console '+c.text())});
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'nklenchik@gmail.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{await CTStore.setPlan('premium');document.querySelector('[data-dev=sample]').click()});await p.waitForTimeout(800);
await p.screenshot({path:'shots/ab-'+w+sc+'-0.png'});
await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2500);
await p.screenshot({path:'shots/ab-'+w+sc+'-1.png'});
console.log(w,sc,'board open',await p.evaluate(()=>window.CTBoard&&window.CTBoard.shown), 'entries in board',await p.evaluate(()=>CTBoardData().length));
await p.goBack();await p.waitForTimeout(1000);console.log(w,'back closes board',await p.evaluate(()=>!window.CTBoard.shown),'still in app',await p.evaluate(()=>!!document.getElementById('ct-add')));
await p.screenshot({path:'shots/ab-'+w+sc+'-2.png'});}
console.log('errors',er);await b.close()})();
