const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const W=+(process.argv[2]||390),H=W<500?664:860;const ctx=await b.newContext({viewport:{width:W,height:H},isMobile:W<500,hasTouch:W<500,deviceScaleFactor:2,colorScheme:process.argv[3]||'light'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(600);
console.log('plan',await p.evaluate(()=>CTStore.plan()));
await p.evaluate(()=>document.getElementById('ct-expand').click());await p.waitForTimeout(2600);
const st=()=>p.evaluate(()=>({kinds:[...document.querySelectorAll('#simple .w[data-id]')].map(w=>[...w.classList].find(c=>c.startsWith('k-'))),per:document.getElementById('cb-perl').textContent,quiet:!document.querySelector('.cbquiet').hidden,free:document.documentElement.classList.contains('cbfree')}));
console.log('free board',JSON.stringify(await st()));
await p.screenshot({path:'free-board.png'});
// range menu
await p.evaluate(()=>document.getElementById('cb-per').click());await p.waitForTimeout(400);
console.log('menu',await p.evaluate(()=>[...document.querySelectorAll(innerWidth<761?'#cr-pre > *':'#cb-menu > *')].map(x=>(x.classList.contains('lockd')?'🔒':'')+x.textContent).join(' | ')));
await p.screenshot({path:'free-range.png'});
await p.evaluate(()=>document.querySelector(innerWidth<761?'#cr-pre .lockd':'#cb-menu button.lockd').click());await p.waitForTimeout(700);
console.log('sheet after range lock',await p.evaluate(()=>({open:document.getElementById('pms').open,h:document.getElementById('pm-h').textContent})));
await p.screenshot({path:'free-sheet.png'});
await p.evaluate(()=>document.getElementById('pms').close());await p.waitForTimeout(500);
// three generic opens rotate
const hs=[];for(let i=0;i<3;i++){await p.evaluate(()=>document.querySelector('.cbquiet button').click());await p.waitForTimeout(500);hs.push(await p.evaluate(()=>document.getElementById('pm-h').textContent+' @ '+getComputedStyle(document.getElementById('pm-art')).backgroundImage.split('/').pop()));await p.evaluate(()=>document.getElementById('pms').close());await p.waitForTimeout(450)}
console.log('rotation',hs);
// stories lock
await p.evaluate(()=>document.getElementById('cb-stories').click());await p.waitForTimeout(600);
console.log('stories ->',await p.evaluate(()=>({sheet:document.getElementById('pms').open,h:document.getElementById('pm-h').textContent,csx:document.getElementById('csx').className})));
await p.evaluate(()=>document.getElementById('pms').close());await p.waitForTimeout(450);
// add widget gallery
await p.evaluate(()=>document.getElementById('cb-edit').click());await p.waitForTimeout(400);await p.evaluate(()=>document.getElementById('addw').click());await p.waitForTimeout(900);
console.log('gallery locked',await p.evaluate(()=>document.querySelectorAll('#aw-list .thumb.lockd').length),'free',await p.evaluate(()=>document.querySelectorAll('#aw-list .thumb:not(.lockd)').length));
await p.screenshot({path:'free-gallery.png'});
await p.evaluate(()=>document.querySelector('#aw-list .thumb.lockd').click());await p.waitForTimeout(800);
console.log('locked thumb -> sheet',await p.evaluate(()=>document.getElementById('pms').open));
// Get Premium
await p.evaluate(()=>document.getElementById('pm-go').click());await p.waitForTimeout(1500);
console.log('after upgrade',await p.evaluate(()=>CTStore.plan()),JSON.stringify(await st()));
console.log('stats',JSON.stringify(await p.evaluate(()=>CTPremiumStats())));
await p.screenshot({path:'free-after.png'});
console.log('errors',errs);await b.close()})();
