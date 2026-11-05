const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();
for(const [w,h,th] of [[390,760,'dark'],[1280,800,'light']]){const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:w<500,hasTouch:w<500,colorScheme:th})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(800);
await p.evaluate(async()=>{document.querySelector('[data-dev=sample]').click();await CTStore.setPlan('premium')});await p.waitForTimeout(500);
// open the board so its CSS is in
await p.evaluate(()=>window.CTBoardLoader&&window.CTBoardLoader.open());await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const out={};const pane={'bu-sheet':'.bu-p','ed':'.ed-form','as':'.phone','imp':'.ed-form','aw':'.awp','pms':'.awp','askd':'.awp','shd':'.awp','ent':'.awp'};
 for(const [id,sel] of Object.entries(pane)){const d=document.getElementById(id);if(!d){out[id]='missing';continue}const bd=getComputedStyle(d,'::backdrop'),pn=d.querySelector(sel);out[id]=[bd.backgroundColor,bd.backdropFilter,pn?getComputedStyle(pn).borderTopColor+' '+getComputedStyle(pn).borderTopWidth:'no pane'].join(' | ')}return out});
console.log(w,th);for(const k in r)console.log('  ',k.padEnd(9),r[k]);
await p.evaluate(()=>document.getElementById('aw')&&document.getElementById('cb-add')&&document.getElementById('cb-add').click());await p.waitForTimeout(900);
await p.screenshot({path:'win-'+w+'.png'});console.log('  errs',errs);await p.close()}await b.close()})();
