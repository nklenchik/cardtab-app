const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const W=+process.argv[2]||390,M=W<700;const er=[];
const ctx=await b.newContext({viewport:{width:W,height:844},isMobile:M,hasTouch:M});const p=await ctx.newPage();p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>CTStore.setPlan('premium'));await p.reload();await p.waitForTimeout(700);
await p.evaluate(async()=>{const S=CTStore;await S.setPlan('premium');document.querySelector('[data-dev=sample]').click();const rows=[];const now=new Date();for(let i=0;i<240;i++){const d=new Date(now.getFullYear(),now.getMonth()-(i%12),1+(i*7)%27);const sale=i%3!==0;rows.push({date:S.ymd(d),type:sale?'sale':'purchase',platform:['eBay','TCGplayer','Whatnot'][i%3],name:'Card '+(i%60)+' - '+i%60+'/200 - Set',amount:(20+i*1.37).toFixed(2),fees:sale?'2.00':undefined,ship:sale?'1.25':undefined})}await S._loadSample(rows)});
await p.waitForTimeout(4000); // idle prefetch window
const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await p.evaluate(()=>{window.__f=[];const l=t=>{__f.push(t);requestAnimationFrame(l)};requestAnimationFrame(l);window.__lt=[];new PerformanceObserver(x=>x.getEntries().forEach(e=>__lt.push([e.startTime,e.duration]))).observe({entryTypes:['longtask']})});
const run=async(n,fn,ms=1400)=>{await p.waitForTimeout(300);const t0=await p.evaluate(()=>performance.now());await fn();await p.waitForTimeout(ms);const r=await p.evaluate(t0=>{const f=__f.filter(t=>t>=t0),g=[];for(let i=1;i<f.length;i++)g.push(f[i]-f[i-1]);return {w:Math.round(Math.max(0,...g)),j:g.filter(x=>x>34).length,lt:__lt.filter(x=>x[0]>=t0).map(x=>Math.round(x[1])).join(',')}},t0);console.log(W,n.padEnd(22),'worst',r.w+'ms','janky',r.j,'long',r.lt||'-')};
console.log(W,'board prefetched before tap:',await p.evaluate(()=>!!window.CTBoard));
await run('open board',()=>p.evaluate(()=>document.getElementById('ct-expand').click()),2000);
await run('scroll board',async()=>{for(let i=0;i<8;i++){await p.mouse.wheel(0,300);await p.waitForTimeout(50)}});
await run('edit mode',()=>p.evaluate(()=>{document.getElementById('cbx').scrollTop=0;document.getElementById('cb-edit').click()}),1500);
await run('add widgets',()=>p.evaluate(()=>document.getElementById('addw').click()));
await run('close sheet',()=>p.keyboard.press('Escape'));
await run('done editing',()=>p.evaluate(()=>document.getElementById('cb-edit').click()));
await run('close board',()=>p.evaluate(()=>document.getElementById('close').click()));
console.log('errors',er);await b.close()})();
