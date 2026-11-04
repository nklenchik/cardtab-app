const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const errs=[],log=[];
// desktop
let ctx=await b.newContext({viewport:{width:1280,height:900},acceptDownloads:true});let p=await ctx.newPage();await ctx.route(/cdn\.jsdelivr\.net/,r=>{const u=r.request().url();r.fulfill({path:u.includes('xlsx')?'npmx/node_modules/xlsx/dist/xlsx.full.min.js':u.includes('jspdf')?'npmx/node_modules/jspdf/dist/jspdf.umd.min.js':'npmx/node_modules/html-to-image/dist/html-to-image.js',contentType:'text/javascript'})});await ctx.route(/fonts\.g/,r=>r.abort());p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning'||m.type()==='error')log.push(m.text())});
await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.click('#expand');await p.waitForTimeout(1300);
await p.click('#cb-acct');await p.waitForTimeout(250);await p.screenshot({path:'shots/v9-menu.png',clip:{x:880,y:0,width:400,height:700}});
await p.click('[data-am="profile"].amh');await p.waitForTimeout(400);await p.click('#av-sw [data-c="#1d4ed8"]');await p.screenshot({path:'shots/v9-av-color.png'});
await p.setInputFiles('#av-up','shots/face.jpg');await p.waitForTimeout(600);
const c=await (await p.$('#av-c')).boundingBox();await p.mouse.move(c.x+90,c.y+90);await p.mouse.down();await p.mouse.move(c.x+60,c.y+80,{steps:5});await p.mouse.up();
await p.fill('#av-zoom','1.6');await p.dispatchEvent('#av-zoom','input');await p.screenshot({path:'shots/v9-av-photo.png'});
await p.click('#av-save');await p.waitForTimeout(400);
log.push('avatar bg set: '+(await p.evaluate(()=>getComputedStyle(document.getElementById('cb-av')).backgroundImage.slice(0,22))));
// exports
await p.click('#cb-acct');await p.click('[data-am="export"]');await p.waitForTimeout(300);await p.screenshot({path:'shots/v9-export.png'});
for(const k of ['csv','png','xlsx','pdf','webp']){try{const [d]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.click('[data-ex="'+k+'"]')]);const f='shots/out.'+k;await d.saveAs(f);log.push(k+' ok '+require('fs').statSync(f).size+'B')}catch(e){log.push(k+' FAIL '+(await p.textContent('#ex-s')))}}
await p.keyboard.press('Escape');
// dark
await p.click('#cb-acct');await p.click('#am-theme [data-th="dark"]');await p.waitForTimeout(400);await p.screenshot({path:'shots/v9-dark.png'});
await ctx.close();
// phone haptics
ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{window.__v=[];navigator.vibrate=x=>{window.__v.push(JSON.stringify(x));return true}});
await p.goto('file://'+require('path').resolve('cbt.html'));await p.evaluate(()=>localStorage.clear());await p.reload();await p.tap('#expand');await p.waitForTimeout(1300);await p.tap('#cb-edit');await p.waitForTimeout(400);
const cdp=await ctx.newCDPSession(p);const g=await (await p.$('[data-k="profit"] .grip')).boundingBox();const x0=g.x+g.width/2,y0=g.y+g.height/2;
const tp=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
await tp('touchStart',x0,y0);for(let i=1;i<=24;i++){await tp('touchMove',x0+i*8,y0+i*9);await p.waitForTimeout(16)}await tp('touchEnd');await p.waitForTimeout(600);
log.push('haptics during resize: '+(await p.evaluate(()=>window.__v.join(' '))));await p.tap('#cb-edit');await p.waitForTimeout(400);
await p.tap('#cb-acct');await p.waitForTimeout(250);await p.screenshot({path:'shots/v9-pmenu.png'});
await p.tap('[data-am="profile"].amh');await p.waitForTimeout(500);await p.screenshot({path:'shots/v9-pav.png'});
console.log(log.join('\n'));console.log('ERR',JSON.stringify(errs));await b.close()})();
