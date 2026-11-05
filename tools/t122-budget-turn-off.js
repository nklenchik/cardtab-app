const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
const vis=()=>p.evaluate(()=>document.querySelector('.ct-budtile .ct-line').textContent);
// simulate someone who turned it off under the old rules: dismissed, no v30 flag
await p.evaluate(async()=>{await CTStore.setBudget(null);await CTStore.setBudgetFlag('dismissed',true);await CTStore.setBudgetFlag('v30',false)});await p.reload();await p.waitForTimeout(900);
console.log('old-rules hidden card after update ->',await vis());
await p.evaluate(async()=>{await CTStore.setBudget({cents:15000,alert:true})});await p.waitForTimeout(300);
await p.tap('.ct-budtile');await p.waitForTimeout(700);await p.tap('#bu-off');await p.waitForTimeout(200);
console.log('one tap on Turn off ->',await p.evaluate(()=>[document.getElementById('bu-sheet').open,document.getElementById('bu-off').textContent]));
await p.tap('#bu-off');await p.waitForTimeout(600);console.log('second tap ->',await p.evaluate(()=>document.getElementById('bu-sheet').open),'card:',await vis());
await p.reload();await p.waitForTimeout(900);console.log('after reload card:',await vis(),errs);await b.close()})();
