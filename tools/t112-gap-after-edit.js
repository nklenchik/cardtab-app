const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:1470,height:760}})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
const gap=()=>p.evaluate(()=>{const t=document.querySelector('#cb .topbar').getBoundingClientRect().bottom,s=document.getElementById('simple').getBoundingClientRect().top;return 'gap '+Math.round(s-t)+' topgap '+document.getElementById('cb').style.getPropertyValue('--topgap')+' rowh '+document.getElementById('cb').style.getPropertyValue('--rowh')});
console.log('open',await gap());
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(500);console.log('editing',await gap());
// resize a widget via keyboard on grip (arrow keys change size)
await p.evaluate(()=>document.getElementById('addw').click());await p.waitForTimeout(900);await p.evaluate(()=>{const t=document.querySelector('#aw-list .thumb[data-k=fees]');t.click()});await p.waitForTimeout(300);
await p.evaluate(()=>{const b=[...document.querySelectorAll('#aw button')].find(x=>x.textContent.trim()==='Done');b.click()});await p.waitForTimeout(900);console.log('after add',await gap());
await p.evaluate(()=>{const g=document.querySelector('#simple .k-profit .grip');g.focus()});await p.keyboard.press('ArrowRight');await p.waitForTimeout(500);console.log('after resize',await gap());
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(600);console.log('done',await gap(),'scroll',await p.evaluate(()=>document.getElementById('cbx').scrollTop));await p.screenshot({path:'gapedit.png'});
await b.close()})();
