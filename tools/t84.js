const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];const L=(...a)=>log.push(a.join(' '));
const step=async(n,f)=>{try{await f()}catch(e){L('FAIL',n,e.message.split('\n')[0])}};
for(const [vw,vh,mob] of [[390,844,true],[1440,900,false]]){const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(vw+' '+e.message));
 await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();
 const st=()=>p.evaluate(()=>({board:!document.getElementById('cbx').classList.contains('off'),dlg:[...document.querySelectorAll('dialog[open]')].map(d=>d.id).join(','),stories:document.getElementById('csx').classList.contains('in')}));
 await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(3500);
 await step('aw size',async()=>{await p.click('#cb-edit');await p.waitForTimeout(400);await p.click('#addw');await p.waitForTimeout(700);const hs=[];
  for(const c of ['all','num','chart','list','all']){await p.click('#aw-cats [data-c="'+c+'"]');await p.waitForTimeout(300);hs.push(await p.evaluate(()=>Math.round(document.querySelector('#aw .awp').getBoundingClientRect().height)))}
  L(vw,'add widgets heights',hs.join(','),new Set(hs).size===1?'STEADY':'CHANGES');
  await p.evaluate(()=>history.back());await p.waitForTimeout(600);L(vw,'back closes Add widgets',JSON.stringify(await st()));await p.click('#cb-edit');await p.waitForTimeout(400)});
 await step('share back',async()=>{await p.click('#cb-share');await p.waitForTimeout(600);L(vw,'share open',JSON.stringify(await st()));await p.evaluate(()=>history.back());await p.waitForTimeout(600);L(vw,'after back',JSON.stringify(await st()))});
 await step('ui close then back',async()=>{await p.click('#cb-share');await p.waitForTimeout(600);await p.keyboard.press('Escape');await p.waitForTimeout(600);L(vw,'esc closed',JSON.stringify(await st()));});
 if(mob){await step('profile menu',async()=>{await p.tap('#cb-acct');await p.waitForTimeout(500);const r=await p.evaluate(()=>{const m=document.getElementById('cb-amenu').getBoundingClientRect();return {cx:Math.round(m.left+m.width/2),cy:Math.round(m.top+m.height/2),top:Math.round(m.top),bottom:Math.round(m.bottom),dock:document.getElementById('cbdock').classList.contains('on'),bd:document.getElementById('mbd').classList.contains('on')}});
   L('profile menu',JSON.stringify(r),'vw/2',vw/2,'vh/2',vh/2);await p.screenshot({path:'shots/pm.png'});await p.evaluate(()=>history.back());await p.waitForTimeout(500);L('back closes menu',await p.evaluate(()=>document.getElementById('cb-amenu').hidden))})}
 await step('stories back',async()=>{await p.click('#cb-stories');await p.waitForTimeout(1000);const f=p.frame({url:/about:srcdoc/});await f.click('.sl[data-n="0"]');await p.waitForTimeout(600);
   L(vw,'lightbox open',await f.evaluate(()=>!document.getElementById('lb').hidden));
   if(mob){await f.evaluate(()=>{const b=document.querySelector('#lb .box').getBoundingClientRect();});const bx=await f.evaluate(()=>{const s=document.querySelector('#lb .sl').getBoundingClientRect();return {x:Math.round(s.left+s.width/2),y:Math.max(10,Math.round(s.top-20))}});
     await p.touchscreen.tap(bx.x,bx.y);await p.waitForTimeout(500);L('tap outside closes lightbox',await f.evaluate(()=>document.getElementById('lb').hidden));await f.click('.sl[data-n="0"]');await p.waitForTimeout(600)}
   await p.evaluate(()=>history.back());await p.waitForTimeout(600);L(vw,'back: lightbox closed',await f.evaluate(()=>document.getElementById('lb').hidden),'stories still',JSON.stringify(await st()));
   await p.evaluate(()=>history.back());await p.waitForTimeout(700);L(vw,'back: stories closed',JSON.stringify(await st()));
   await p.evaluate(()=>history.back());await p.waitForTimeout(900);L(vw,'back: board closed',JSON.stringify(await st()))});
 await ctx.close()}
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
