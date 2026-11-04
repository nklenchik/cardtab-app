const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const log=[];
for(const [vw,vh,mob] of [[1280,720,false],[390,700,true]]){const p=await (await b.newContext({viewport:{width:vw,height:vh},isMobile:mob,hasTouch:mob})).newPage();
  await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.evaluate(()=>document.getElementById('expand').click());await p.waitForTimeout(1200);
  await p.evaluate(()=>{document.getElementById('cb-edit').click();document.getElementById('addw').click()});await p.waitForTimeout(500);
  log.push(vw+': sheet scrolls '+(await p.evaluate(()=>{const a=document.querySelector('#aw .awp');return a.scrollHeight>a.clientHeight+1}))+' | gallery scrolls '+(await p.evaluate(()=>{const a=document.querySelector('#aw .awbody');return a.scrollHeight>a.clientHeight}))+' | first badge fully visible '+(await p.evaluate(()=>{const bd=document.querySelector('#aw .badge').getBoundingClientRect(),bo=document.querySelector('#aw .awbody').getBoundingClientRect();return bd.top>=bo.top})));
  await p.screenshot({path:'shots/v18-'+vw+'.png'});
  await p.evaluate(()=>{document.querySelector('#aw .awbody').scrollTop=200});await p.waitForTimeout(100);await p.screenshot({path:'shots/v18-'+vw+'-s.png'})}
console.log(log.join('\n'));await b.close()})();
