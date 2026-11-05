const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const th of ['light','dark']){const p=await (await b.newContext({viewport:{width:390,height:760},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}));localStorage.setItem('cb.hint',JSON.stringify({off:1}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await new Promise(r=>setTimeout(r,300));await CTStore.setPlan('premium')});await p.waitForTimeout(4000);
await p.tap('#app-avatar');await p.waitForTimeout(600);
const m=await p.evaluate(()=>{const r=document.getElementById('app-menu').getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight,left:Math.round(r.left),w:Math.round(r.width)}});
await p.screenshot({path:'sheet-'+th+'.png'});console.log(th,'sheet',JSON.stringify(m));
if(th==='light'){
 // swipe down
 await p.evaluate(()=>{const el=document.getElementById('app-menu');const T=y=>new Touch({identifier:1,target:el,clientX:200,clientY:y});el.dispatchEvent(new TouchEvent('touchstart',{touches:[T(300)],bubbles:true}));el.dispatchEvent(new TouchEvent('touchmove',{touches:[T(360)],bubbles:true,cancelable:true}));el.dispatchEvent(new TouchEvent('touchmove',{touches:[T(440)],bubbles:true,cancelable:true}));el.dispatchEvent(new TouchEvent('touchend',{touches:[],bubbles:true}))});
 await p.waitForTimeout(500);console.log('  swipe down closes:',await p.evaluate(()=>document.getElementById('app-menu').hidden));
 // Edit profile from the header
 await p.tap('#app-avatar');await p.waitForTimeout(600);await p.tap('#app-menu .am-who');await p.waitForTimeout(1600);
 console.log('  edit profile opens:',await p.evaluate(()=>{const d=document.getElementById('av');return !!d&&d.open}),' board stayed closed:',await p.evaluate(()=>document.querySelector('.cbx').classList.contains('off')));
 await p.evaluate(()=>{const sw=[...document.querySelectorAll('#av-sw [data-c]')];sw[3].click()});await p.waitForTimeout(200);
 const col=await p.evaluate(()=>document.querySelectorAll('#av-sw [data-c]')[3].dataset.c);
 await p.evaluate(()=>{const s=[...document.querySelectorAll('#av button')].find(b=>/Save/.test(b.textContent));s.click()});await p.waitForTimeout(600);
 console.log('  saved color',col,'-> app avatar bg:',await p.evaluate(()=>getComputedStyle(document.getElementById('app-avatar')).backgroundColor));
 await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(2600);console.log('  sizes: app',await p.evaluate(()=>{const a=document.getElementById('app-avatar').getBoundingClientRect(),c=document.getElementById('cb-av').getBoundingClientRect();return Math.round(a.width)+' board '+Math.round(c.width)+' board bg '+getComputedStyle(document.getElementById('cb-av')).backgroundColor}));
 await p.tap('#ct-tbar [data-tab=stories]');await p.waitForTimeout(3000);const f=p.frames().find(x=>x!==p.mainFrame());console.log('  stories avatar:',await f.evaluate(()=>{const e=document.getElementById('csacct').getBoundingClientRect();return Math.round(e.width)+' '+getComputedStyle(document.getElementById('csav')).backgroundColor}));
}
console.log('  errs',errs);await p.close()}
await b.close()})();
