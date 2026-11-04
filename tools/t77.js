const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];
const LAY=[{id:'a',k:'profit',size:'S'},{id:'b',k:'sales',size:'S'},{id:'c',k:'spent',size:'M'},{id:'d',k:'fees',size:'L'},{id:'e',k:'profit',size:'X'},{id:'f',k:'sales',size:'B'}];
for(const [vw,vh,tag] of [[390,844,'ph'],[375,667,'se'],[1024,1366,'pad']]){const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:true,hasTouch:true});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve('cbt.html'));
 await p.evaluate(L=>{localStorage.clear();localStorage.setItem('cb.layout.v3',JSON.stringify(L));localStorage.setItem('cb.layout.phone.v1',JSON.stringify(L));localStorage.setItem('cb.custom','1')},LAY);await p.reload();
 await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1500);
 for(const id of ['a','b','c','d','e','f']){const sel='#simple .w[data-id="'+id+'"]';if(!(await p.$(sel)))continue;
  await p.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),sel);await p.waitForTimeout(150);
  await p.tap(sel+' .cq.drill').catch(async()=>{await p.tap(sel+' .bn').catch(()=>{})});await p.waitForTimeout(380);
  const r=await p.evaluate(s=>{const w=document.querySelector(s),kb=w.querySelector('.kback');if(!kb)return 'no flip';const R=w.getBoundingClientRect();const ok=[...kb.querySelectorAll('*')].every(el=>{const q=el.getBoundingClientRect();return q.width===0||(q.left>=R.left-1&&q.right<=R.right+1&&q.top>=R.top-1&&q.bottom<=R.bottom+1)});const c=kb.querySelector('.kis').getBoundingClientRect(),g=kb.querySelector('.kgo').getBoundingClientRect();return w.className.match(/sz\w/)[0]+' '+Math.round(R.width)+'x'+Math.round(R.height)+' '+kb.className.replace('kback','').trim()+' fill '+Math.round((g.bottom-c.top)/R.height*100)+'% '+(ok?'fits':'OVERFLOW')},sel);
  log.push(tag+' '+id+' '+r);await p.screenshot({path:'shots/f-'+tag+'-'+id+'.png',clip:await p.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:Math.max(0,r.left-4),y:Math.max(0,r.top-4),width:r.width+8,height:r.height+8}},sel)});
  await p.tap(sel+' .kback .ki');await p.waitForTimeout(300)}
 if(tag==='ph'){ // long press
  const cdp=await ctx.newCDPSession(p);await p.evaluate(()=>document.getElementById('cbx').scrollTo(0,0));await p.waitForTimeout(300);const bb=await (await p.$('#simple .w[data-id="a"]')).boundingBox();
  const pt={x:bb.x+bb.width/2,y:bb.y+bb.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await p.waitForTimeout(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(500);
  log.push('long press → editing: '+(await p.evaluate(()=>document.getElementById('cb').classList.contains('editing')))+' flip opened: '+(await p.evaluate(()=>!!document.querySelector('.kback'))));
  await p.tap('#cb-edit');await p.waitForTimeout(400);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await p.waitForTimeout(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(400);
  log.push('short tap → editing: '+(await p.evaluate(()=>document.getElementById('cb').classList.contains('editing')))+' flip: '+(await p.evaluate(()=>!!document.querySelector('.kback'))))}
 await ctx.close()}
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
