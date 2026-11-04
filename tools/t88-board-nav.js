const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const er=[];
for(const [w,m] of [[390,true],[1280,false]]){const p=await (await b.newContext({viewport:{width:w,height:844},isMobile:m,hasTouch:m})).newPage();p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.cwd()+'/cbt.html');await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(1200);
const st=()=>p.evaluate(()=>({board:!document.getElementById('cbx').classList.contains('off'),dlg:[...document.querySelectorAll('dialog[open]')].map(d=>d.id).join(','),menu:!document.getElementById('cb-amenu').hidden,stories:document.getElementById('csx').classList.contains('in')}));
const L=async n=>console.log(w,n.padEnd(26),JSON.stringify(await st()));
await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1500);
await p.evaluate(()=>document.getElementById('cb-acct').click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#cb-amenu [data-am=export]').click());await p.waitForTimeout(700);await L('menu -> export');
await p.goBack();await p.waitForTimeout(600);await L('back -> export closed');
await p.goBack();await p.waitForTimeout(900);await L('back -> board closed');
await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1500);
await p.evaluate(()=>document.getElementById('cb-stories').click());await p.waitForTimeout(1300);
await p.frameLocator('#csx iframe').locator('#csacct').evaluate(e=>e.click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#cb-amenu [data-am=profile]').click());await p.waitForTimeout(1200);await L('stories menu -> profile');
await p.goBack();await p.waitForTimeout(600);await L('back -> profile closed');
await p.goBack();await p.waitForTimeout(900);await L('back -> board closed');
console.log(w,'still on page',await p.evaluate(()=>!!document.getElementById('cbx')))}
console.log('errors',er);await b.close()})();
