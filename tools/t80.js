const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[];
const keys=JSON.parse(require('fs').readFileSync('keys.json'));
console.log('kinds',keys.length,keys.join(','));
const SZ=['S','M','L','X','B'];
for(const [vw,vh,mob,tag] of [[1440,900,false,'d'],[390,844,true,'m']]){
 const ctx=await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 for(const sz of SZ){const L=keys.map((k,i)=>({id:'w'+i,k,size:sz}));
  await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(L=>{localStorage.clear();localStorage.setItem('cb.layout.v3',JSON.stringify(L));localStorage.setItem('cb.layout.phone.v1',JSON.stringify(L));localStorage.setItem('cb.custom','1')},L);await p.reload();
  await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1600);
  const of=await p.evaluate(()=>[...document.querySelectorAll('#simple .w')].filter(w=>{const R=w.getBoundingClientRect();return [...w.querySelectorAll('*')].some(el=>{if(el.closest('.rm,.grip,.wmore'))return false;const q=el.getBoundingClientRect();return q.width&&(q.right>R.right+1||q.left<R.left-1||q.bottom>R.bottom+1)})}).map(w=>w.dataset.k||w.className));
  console.log(tag,sz,'overflow:',JSON.stringify(of));
  const h=await p.evaluate(()=>document.getElementById('cbx').scrollHeight);await p.setViewportSize({width:vw,height:Math.min(h,9000)});await p.waitForTimeout(500);
  await p.screenshot({path:'shots/z-'+tag+'-'+sz+'.png',fullPage:false});await p.setViewportSize({width:vw,height:vh})}
 await ctx.close()}
console.log('ERR',JSON.stringify(errs));await b.close()})();
