const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const old of [false,true]){const ctx=await b.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
if(old)await p.route('**/index.html*',async r=>{const res=await r.fetch();let t=await res.text();t=t.replace(/<div class="bu-ru">[\s\S]*?<\/div>/,'');r.fulfill({response:res,body:t})});
await p.goto('http://localhost:8765/index.html?preview&v=30.2');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
const vis=()=>p.evaluate(()=>{const c=document.getElementById('ct-budget');return c.hidden?'HIDDEN':c.className});
console.log(old?'old page:':'normal:','no budget ->',await vis());
await p.evaluate(async()=>{await CTStore.setBudget({cents:15000,alert:true})});await p.waitForTimeout(300);console.log('   with budget ->',await vis());
await p.tap('#ct-budget .bu-open');await p.waitForTimeout(700);console.log('   window opens ->',await p.evaluate(()=>document.getElementById('bu-sheet').open),'errors:',errs);await ctx.close()}
await b.close()})();
