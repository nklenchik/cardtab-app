const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
const runs=[['iphone',pw.devices['iPhone 13'],'light'],['android',pw.devices['Pixel 5'],'dark'],['desktop',{viewport:{width:1440,height:900}},'light']];
for(const [name,dev,th] of runs){const ctx=await b.newContext({...dev,colorScheme:th});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}));localStorage.setItem('ct.visits','1');localStorage.setItem('ct.visit.day',JSON.stringify('yesterday'))});
await p.reload();await p.waitForTimeout(900);
await p.evaluate(async()=>{const d=new Date().toISOString().slice(0,10);for(let i=0;i<3;i++)await CTStore.add({type:'purchase',name:'Test card '+i,amount:1000+i,date:d,platform:'eBay'})});
await p.reload();await p.waitForTimeout(5200);
const r=await p.evaluate(()=>({card:document.querySelector('.ct-hint').classList.contains('on'),menuRow:!!document.getElementById('am-hs')&&!document.getElementById('am-hs').hidden,fabHidden:getComputedStyle(document.querySelector('.ct-fab')).opacity}));
console.log(name,JSON.stringify(r),errs);
if(r.card){await p.screenshot({path:'hs-card-'+name+'.png'});await p.tap('.ct-hint .h2');await p.waitForTimeout(700);
 console.log('  sheet:',await p.evaluate(()=>document.getElementById('hs-who').textContent+' | '+[...document.querySelectorAll('#hs-steps li')].map(l=>l.textContent.replace(/^\d/,'').trim()).join(' / ')));await p.screenshot({path:'hs-sheet-'+name+'.png'});
 await p.tap('.hs-ok');await p.waitForTimeout(400);
 // same visit: board tip must not also show (one tip per visit)
 await p.tap('#ct-tbar [data-tab=board]');await p.waitForTimeout(3200);console.log('  board tip suppressed this visit:',!(await p.evaluate(()=>document.querySelector('.cbhint').classList.contains('on'))));}
await ctx.close()}
await b.close()})();
