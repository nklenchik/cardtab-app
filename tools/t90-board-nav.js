const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const er=[];
for(const [w,m] of [[390,true],[1280,false]]){const p=await (await b.newContext({viewport:{width:w,height:844},isMobile:m,hasTouch:m})).newPage();p.on('pageerror',e=>er.push(w+' '+e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);
const st=()=>p.evaluate(()=>({board:!!(window.CTBoard&&CTBoard.shown),stories:!!document.querySelector('#csx.in'),menu:!document.getElementById('app-menu').hidden,app:!!document.getElementById('ct-add')}));
const L=async n=>console.log(w,n.padEnd(30),JSON.stringify(await st()));
await p.evaluate(()=>document.getElementById('app-avatar').click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#app-menu [data-go=board]').click());await p.waitForTimeout(2200);await L('menu > Go to Card Board');
await p.goBack();await p.waitForTimeout(900);await L('back');
await p.evaluate(()=>document.getElementById('app-avatar').click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#app-menu [data-go=stories]').click());await p.waitForTimeout(3200);await L('menu > Go to Card Stories');
await p.goBack();await p.waitForTimeout(900);await L('back (stories closes)');
await p.goBack();await p.waitForTimeout(900);await L('back (board closes)');
// metric menu on a Featured card
await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2200);
const t0=await p.evaluate(()=>document.querySelector('.k-feat .ttl').textContent);
await p.evaluate(()=>document.querySelector('.k-feat .wmore').click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#wmenu [data-fm=roi]').click());await p.waitForTimeout(600);
const t1=await p.evaluate(()=>[document.querySelector('.k-feat .ttl').textContent,document.querySelector('.k-feat .fn')&&document.querySelector('.k-feat .fn').textContent,document.querySelector('.k-feat .fbig')&&document.querySelector('.k-feat .fbig').textContent]);
console.log(w,'Featured:',t0,'->',JSON.stringify(t1));
await p.evaluate(()=>document.querySelector('#wmenu [data-fs=\"%\"]')?.click());
// board's own menu: Go to Entries closes the board
await p.keyboard.press('Escape');await p.waitForTimeout(300);
await p.evaluate(()=>document.getElementById('cb-acct').click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#cb-amenu [data-am=go-app]').click());await p.waitForTimeout(900);await L('board menu > Entries');
// adding an entry while the board exists updates it
await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2200);
const before=await p.evaluate(()=>document.querySelector('.k-profit .bn, .k-profit .num')?.textContent);
await p.evaluate(async()=>{await CTStore.add({type:'sale',name:'Test - 1/1 - X',platform:'eBay',amount:1000,fees:0,ship:0,qty:1})});await p.waitForTimeout(600);
const after=await p.evaluate(()=>document.querySelector('.k-profit .bn, .k-profit .num')?.textContent);
console.log(w,'profit tile live update:',before,'->',after);}
console.log('errors',er);await b.close()})();
