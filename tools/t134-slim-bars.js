const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const th of ['light','dark']){const p=await (await b.newContext({viewport:{width:390,height:760},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}));localStorage.setItem('cb.hint',JSON.stringify({off:1}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium')});await p.waitForTimeout(4000);
await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2800);
await p.evaluate(()=>{const c=document.querySelector('.cbx');c.scrollTop=500;c.dispatchEvent(new Event('scroll'))});await p.waitForTimeout(1000);
const s1=await p.evaluate(()=>{const s=document.querySelector('.cbslim');return {on:s.classList.contains('on'),title:s.querySelector('b').textContent,back:getComputedStyle(s.querySelector('.sback')).display,icons:[...s.querySelectorAll('.sic button')].map(x=>x.getAttribute('aria-label'))}});
await p.screenshot({path:'sl-'+th+'-board.png',clip:{x:0,y:0,width:390,height:120}});
await p.tap('.cbslim .sic .se');await p.waitForTimeout(900);await p.evaluate(()=>{const c=document.querySelector('.cbx');c.scrollTop=400;c.dispatchEvent(new Event('scroll'))});await p.waitForTimeout(900);
const s2=await p.evaluate(()=>{const s=document.querySelector('.cbslim');return {on:s.classList.contains('on'),title:s.querySelector('b').textContent,done:getComputedStyle(s.querySelector('.sdone')).display,icons:getComputedStyle(s.querySelector('.sic')).display}});
await p.screenshot({path:'sl-'+th+'-edit.png',clip:{x:0,y:0,width:390,height:120}});
await p.tap('.cbslim .sdone');await p.waitForTimeout(800);
await p.tap('#ct-tbar [data-tab=stories]');await p.waitForTimeout(2800);
const f=p.frames().find(x=>x!==p.mainFrame());const sc=await f.evaluate(()=>{const se=document.scrollingElement;return [se.scrollHeight,innerHeight]});
await f.evaluate(()=>{scrollTo(0,400)});await p.waitForTimeout(1000);const s3=await f.evaluate(()=>{const s=document.querySelector('.csslim');return s?{on:s.classList.contains('on'),icons:s.querySelectorAll('.sic button').length}:'none'});
await p.screenshot({path:'sl-'+th+'-stories.png',clip:{x:0,y:0,width:390,height:120}});
console.log(th,'board',JSON.stringify(s1),' editing',JSON.stringify(s2),' stories scroll',sc,JSON.stringify(s3),errs);await p.close()}
await b.close()})();
