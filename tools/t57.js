// every widget at every size with Compare off and with a single platform: nothing may throw or overflow
const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],out=[];
const K=['profit','sales','spent','fees','month','sell','where','kept','win','budget'];
for(const [vw,mob] of [[1280,false],[390,true]])for(const size of ['S','M','B','L','X'])for(const cmp of ['off','year','prev'])for(const per of ['d7','l12']){
  const ctx=await b.newContext({viewport:{width:vw,height:2600},isMobile:mob,hasTouch:mob});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(vw+size+cmp+per+': '+e.message));
  await p.goto('file://'+require('path').resolve('cbt.html'));
  await p.evaluate(([K,size,cmp])=>{localStorage.clear();localStorage.setItem('cb.compare',cmp);localStorage.setItem('cb.layout.v3',JSON.stringify(K.map((k,i)=>({id:'t'+i,k,size,trend:i%2?false:undefined}))))},[K,size,cmp]);await p.reload();
  await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(900);
  await p.evaluate(per=>{document.getElementById('cb-per').click();document.querySelector('#cb-menu [data-k="'+per+'"]').click()},per);await p.waitForTimeout(150);
  const o=await p.evaluate(()=>[...document.querySelectorAll('#simple .w')].map(w=>{const b=w.querySelector('.wb');return b.scrollHeight>b.clientHeight+2?w.dataset.k+'/'+w.className.match(/e[SMLXB]/)[0]:null}).filter(Boolean).join(' '));
  if(o)out.push(vw+' '+size+' '+cmp+' '+per+': '+o);await ctx.close()}
console.log(out.join('\n')||'no overflow');console.log('ERR',JSON.stringify(errs.slice(0,5)),errs.length);await b.close()})();
