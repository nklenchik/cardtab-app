const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const er=[];
for(const [w,m] of [[390,true],[1280,false]]){const p=await (await b.newContext({viewport:{width:w,height:844},isMobile:m,hasTouch:m})).newPage();p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(700);
await p.evaluate(async()=>{await window.CTStore.setPlan('premium');document.querySelector('[data-dev="sample"]').click()});await p.waitForTimeout(600);
const st=()=>p.evaluate(()=>({as:document.getElementById('as').open,ed:document.getElementById('ed').open,imp:document.getElementById('imp').open,menu:!document.getElementById('app-menu').hidden,url:location.href.endsWith('index.html')}));
const L=async(n)=>console.log(w,n.padEnd(28),JSON.stringify(await st()));
await p.evaluate(()=>document.getElementById('ct-add').click());await p.waitForTimeout(500);await L('add open');
await p.goBack();await p.waitForTimeout(400);await L('back -> add closed');
await p.evaluate(()=>document.getElementById('ct-add').click());await p.waitForTimeout(500);await p.keyboard.press('Escape');await p.waitForTimeout(100);console.log(w,'closing class mid-anim',await p.evaluate(()=>document.getElementById('as').classList.contains('closing')));await p.waitForTimeout(300);await L('esc -> closed');
await p.evaluate(()=>document.getElementById('app-avatar').click());await p.waitForTimeout(300);await L('menu open');
await p.evaluate(()=>document.getElementById('am-import').click());await p.waitForTimeout(600);await L('menu -> import');
await p.goBack();await p.waitForTimeout(400);await L('back -> import closed');
await p.evaluate(()=>document.querySelector('.ct-row-toggle').click());await p.waitForTimeout(500);await p.evaluate(()=>document.querySelector('[data-act=edit]').click());await p.waitForTimeout(500);await L('editor open');
await p.evaluate(()=>document.querySelector('#ed [data-ed-close],#ed .ed-x')?.click());await p.waitForTimeout(400);await L('editor x');
await p.evaluate(()=>document.getElementById('app-avatar').click());await p.waitForTimeout(300);await p.goBack();await p.waitForTimeout(300);await L('menu back');
console.log(w,'history length',await p.evaluate(()=>history.length))}
console.log('errors',er);await b.close()})();
