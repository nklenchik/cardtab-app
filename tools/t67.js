const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[];
for(const [vw,vh,mob] of [[1366,900,false],[390,844,true]]){const p=await (await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob})).newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+require('path').resolve('stories-t.html'));await p.waitForTimeout(500);
  console.log(vw,'hscroll',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'themes',await p.evaluate(()=>document.querySelectorAll('.tchip').length));
  // any text spilling out of a story?
  const chk=async tag=>{const o=await p.evaluate(()=>[...document.querySelectorAll('#track .sl')].map(s=>{const r=s.getBoundingClientRect();const bad=[...s.querySelectorAll('.h,.p,.num,.chips,.tl,.rr')].filter(x=>{const q=x.getBoundingClientRect();return q.right>r.right+1||q.bottom>r.bottom-r.height*.08});return bad.length?s.dataset.n+':'+bad.map(x=>x.className).join(','):null}).filter(Boolean));if(o.length)console.log(vw,tag,'spill',o.join(' '))};
  await chk('default');await p.screenshot({path:'shots/s2-'+vw+'.png'});
  for(let r=0;r<2;r++){for(let n=0;n<5;n++)await p.click('[data-mb="'+n+'"]');await chk('metric'+(r+1));await p.screenshot({path:'shots/s2-'+vw+'-m'+(r+1)+'.png'})}
  for(const t of [1,2,9,21]){await p.click('.tchip[data-i="'+t+'"]');await p.waitForTimeout(500);await p.screenshot({path:'shots/s2-'+vw+'-t'+t+'.png'})}
  for(const pr of ['ly','all']){await p.click('[data-p="'+pr+'"]');await p.waitForTimeout(300);await chk(pr)}
  await p.click('.sl[data-n="1"]');await p.waitForTimeout(500);await p.screenshot({path:'shots/s2-'+vw+'-lb.png'})}
console.log('ERR',JSON.stringify(errs));await b.close()})();
