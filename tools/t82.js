const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],out=[];const keys=JSON.parse(require('fs').readFileSync('keys.json'));
for(const [vw,vh,mob,sc] of [[1440,900,false,'light'],[390,844,true,'dark']])for(const sz of ['S','M','L','X','B']){const L=keys.map((k,i)=>({id:'w'+i,k,size:sz}));const res={};
 for(const f of ['preview','soft']){const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob,colorScheme:sc});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(f+' '+e.message));
  await p.goto('file://'+require('path').resolve('cbt-'+f+'.html'));await p.evaluate(L=>{localStorage.clear();localStorage.setItem('cb.layout.v3',JSON.stringify(L));localStorage.setItem('cb.layout.phone.v1',JSON.stringify(L));localStorage.setItem('cb.custom','1')},L);await p.reload();
  await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1400);
  res[f]=await p.evaluate(()=>[...document.querySelectorAll('#simple .w, #simple .w *')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(x=>Math.round(x)).join(',')}).join('|'));
  if(sz==='M'){await p.screenshot({path:'shots/sk-'+f+'-'+vw+'.png'})}
  await ctx.close()}
 out.push(vw+' '+sz+' layout identical: '+(res.preview===res.soft))}
console.log(out.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
