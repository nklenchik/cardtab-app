const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],bad=[];
for(const [w,m] of [[1440,false],[320,true]]){const p=await (await b.newContext({viewport:{width:w,height:900},isMobile:m})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve('stories-t.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(400);
 for(const per of ['lm','ytd','l12','ly','all'])for(let th of [0,9,15]){await p.evaluate(([per,th])=>{try{localStorage.setItem('cs.theme',th)}catch(e){}},[per,th]);
  for(let o=0;o<3;o++){await p.evaluate(([per,o])=>{const P=window;},[per,o]);
   const r=await p.evaluate(([per,o])=>{ // drive via the page's own controls
     const menuBtn=document.querySelector('#perm [data-p="'+per+'"]');return true},[per,o]);}
 }
 // simpler: click through controls
 for(const per of ['lm','ytd','l12','ly','all']){
  if(m){await p.click('#perb');await p.waitForTimeout(350);await p.click('#spre [data-sp="'+per+'"]');}else{await p.click('#perb');await p.waitForTimeout(200);await p.click('#perm [data-p="'+per+'"]');}
  await p.waitForTimeout(500);
  for(let o=0;o<3;o++){if(o)for(let n=0;n<5;n++){await p.evaluate(n=>document.querySelector('[data-mb="'+n+'"]').click(),n)}await p.waitForTimeout(500);
   const x=await p.evaluate(()=>{const out=[];document.querySelectorAll('#track .sl').forEach(s=>{const R=s.getBoundingClientRect();s.querySelectorAll('.in *').forEach(e=>{const q=e.getBoundingClientRect();if(q.width&&(q.right>R.right+1||q.left<R.left-1||q.bottom>R.bottom+1))out.push(s.dataset.n+':'+(e.className||e.tagName)+':'+e.textContent.slice(0,24))})});return out});
   if(x.length)bad.push(w+' '+per+' opt'+o+' '+JSON.stringify(x.slice(0,4)))}}
 await p.close()}
console.log(bad.length?bad.join('\n'):'no story text overflows');console.log('ERR',JSON.stringify(errs));await b.close()})();
