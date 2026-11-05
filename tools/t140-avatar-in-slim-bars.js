const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:760},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}));localStorage.setItem('cb.hint',JSON.stringify({off:1}));localStorage.setItem('cb.avatar',JSON.stringify({color:'#15803d'}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium')});await p.waitForTimeout(4000);
const menuOpen=()=>p.evaluate(()=>!document.getElementById('app-menu').hidden);
// entries: scroll down, then a little up
await p.mouse.wheel(0,900);await p.waitForTimeout(900);await p.mouse.wheel(0,-150);await p.waitForTimeout(1100);
const e=await p.evaluate(()=>{const m=document.querySelector('.ct-stick .ct-me');const r=m.getBoundingClientRect();return {bar:document.querySelector('.ct-stick').classList.contains('on'),size:Math.round(r.width),bg:getComputedStyle(m).backgroundColor,right:Math.round(innerWidth-r.right)}});
await p.screenshot({path:'me-entries.png',clip:{x:0,y:0,width:390,height:90}});
await p.tap('.ct-stick .ct-me');await p.waitForTimeout(600);console.log('entries slim',JSON.stringify(e),'opens menu:',await menuOpen());await p.evaluate(()=>CTMenu.close());await p.waitForTimeout(500);
await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(600);
await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2800);await p.evaluate(()=>{const c=document.querySelector('.cbx');c.scrollTop=500;c.dispatchEvent(new Event('scroll'))});await p.waitForTimeout(1200);
const bb=await p.evaluate(()=>{const m=document.querySelector('.cbslim .ct-me');if(!m)return 'none';const r=m.getBoundingClientRect();return {size:Math.round(r.width),bg:getComputedStyle(m).backgroundColor,right:Math.round(innerWidth-r.right)}});
await p.screenshot({path:'me-board.png',clip:{x:0,y:0,width:390,height:90}});
await p.tap('.cbslim .ct-me');await p.waitForTimeout(600);console.log('board slim',JSON.stringify(bb),'opens menu:',await menuOpen());await p.evaluate(()=>CTMenu.close());await p.waitForTimeout(500);
await p.tap('#ct-tbar [data-tab=stories]');await p.waitForTimeout(3000);const f=p.frames().find(x=>x!==p.mainFrame());await f.evaluate(()=>scrollTo(0,400));await p.waitForTimeout(1200);
const ss=await f.evaluate(()=>{const m=document.querySelector('.csslim .me');if(!m)return 'none';const r=m.getBoundingClientRect();return {on:document.querySelector('.csslim').classList.contains('on'),size:Math.round(r.width),bg:getComputedStyle(m).backgroundColor}});
await p.screenshot({path:'me-stories.png',clip:{x:0,y:0,width:390,height:90}});
await f.tap('.csslim .me');await p.waitForTimeout(700);console.log('stories slim',JSON.stringify(ss),'opens menu:',await menuOpen(),errs);await b.close()})();
