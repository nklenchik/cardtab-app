// Full-page screenshots of the marketing site (served on :8790) in light/dark, desktop/phone, for before/after comparisons: node site-shots.js <label>
const { chromium, devices } = require('playwright');
const O='/tmp/claude-0/-home-claude/0d23d6a4-0497-5286-ae54-9e35a72a5811/scratchpad/opt/';
(async()=>{const b=await chromium.launch();const errs=[];const tag=process.argv[2];
for(const [n,o] of [['dl',{viewport:{width:1440,height:900},colorScheme:'light'}],['dd',{viewport:{width:1440,height:900},colorScheme:'dark'}],['ml',{...devices['iPhone 13'],colorScheme:'light'}],['md',{...devices['iPhone 13'],colorScheme:'dark'}]]){
 const p=await b.newPage({...o,reducedMotion:'reduce'});p.on('pageerror',e=>errs.push(n+': '+e.message));await p.goto('http://localhost:8790/');
 await p.evaluate(async()=>{document.documentElement.style.scrollBehavior='auto';for(let y=0;y<document.body.scrollHeight;y+=500){scrollTo(0,y);await new Promise(r=>setTimeout(r,80))}document.querySelectorAll('.reveal').forEach(e=>e.classList.add('in'));scrollTo(0,0)});
 await p.waitForTimeout(1500);await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} .live-dot::after{display:none} .dm-qw > span{transition:none!important}'});
 await p.evaluate(()=>{document.querySelectorAll('.st-slide video').forEach(v=>v.remove())});await p.waitForTimeout(300);
 await p.screenshot({path:O+tag+'-'+n+'.png',fullPage:true});await p.close()}
console.log(errs.join('\n')||'no errors');await b.close()})();
