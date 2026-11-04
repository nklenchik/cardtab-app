const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const f=process.argv[2]||'cbt-soft.html';
for(const [w,h,m] of [[1440,900,false],[390,844,true]]){const p=await (await b.newContext({viewport:{width:w,height:h},isMobile:m,hasTouch:m,deviceScaleFactor:m?2:1})).newPage();
await p.goto('file://'+require('path').resolve(f));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1500);
await p.click('#cb-edit');await p.waitForTimeout(400);await p.click('#addw');await p.waitForTimeout(900);await p.screenshot({path:'shots/aw-'+w+'.png'});
console.log(w,await p.evaluate(()=>{const t=document.querySelector('#aw .tbox'),c=getComputedStyle(t),iw=t.querySelector('.w');return 'tbox border '+c.border+' shadow '+c.boxShadow+' | inner w '+(iw?getComputedStyle(iw).border+' '+getComputedStyle(iw).boxShadow:'none')}))}
await b.close()})();
