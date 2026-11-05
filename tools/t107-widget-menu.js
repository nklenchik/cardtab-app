const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:1280,height:900},colorScheme:'dark'})).newPage();
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
await p.evaluate(()=>document.querySelector('#simple .k-spent .wmore').click());await p.waitForTimeout(500);
console.log(await p.evaluate(()=>{const m=document.getElementById('wmenu');return [...m.children].map(c=>{const r=c.getBoundingClientRect(),cs=getComputedStyle(c);return c.tagName+'.'+c.className+' h='+Math.round(r.height)+' bg='+cs.backgroundColor+' hidden='+c.hidden+' txt='+c.textContent.trim().slice(0,30)}).join('\n')}));
await b.close()})();
