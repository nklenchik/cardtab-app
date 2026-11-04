// Finds every visible control whose text sits closer than MIN px to its left or right edge
const pw=require('playwright');const MIN=+process.env.MIN||10;
const measure=(MIN)=>{const out=[];const dlg=document.querySelector('dialog[open]'),menuOpen=document.querySelector('.app-menu:not([hidden])'),scope=dlg||menuOpen||document;const els=[...scope.querySelectorAll('button,select,a.pill,label.ct-search,[role=radio],[role=switch],.chip,.ct-tag,.prem,.am-prem,.af-lock,.ct-earlier-btn')];
 for(const el of els){if(el.closest('[inert]'))continue;if(!el.offsetParent&&getComputedStyle(el).position!=='fixed')continue;const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;
  const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity===0)continue;
  let tl=Infinity,tr=-Infinity;
  if(el.tagName==='SELECT'){const t=el.options[el.selectedIndex];if(!t)continue;const c=document.createElement('canvas').getContext('2d');c.font=cs.font;const w=c.measureText(t.text).width;tl=r.left+parseFloat(cs.borderLeftWidth)+parseFloat(cs.paddingLeft);tr=tl+w;
   const chev=parseFloat(cs.paddingRight);if(tr>r.right-chev+4)out.push(['SELECT text runs into arrow',t.text,Math.round(r.right-chev-tr)]);}
  else{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(!n.textContent.trim())continue;const pe=n.parentElement;if(pe&&getComputedStyle(pe).display==='none')continue;const rg=document.createRange();rg.selectNodeContents(n);for(const b of rg.getClientRects()){if(b.width<1)continue;tl=Math.min(tl,b.left);tr=Math.max(tr,b.right)}}}
  if(tl===Infinity)continue;
  const bl=r.left+parseFloat(cs.borderLeftWidth),br=r.right-parseFloat(cs.borderRightWidth);
  const gl=Math.round(tl-bl),gr=Math.round(br-tr);
  const rad=parseFloat(cs.borderTopLeftRadius)||0, bg=cs.backgroundColor!=='rgba(0, 0, 0, 0)'||parseFloat(cs.borderLeftWidth)>0||cs.boxShadow!=='none';
  if(!bg)continue; // plain text buttons (links) are fine
  const need=rad>=r.height/2-1?Math.max(MIN,12):MIN;
  if(gl<need||gr<need)out.push([(el.id||el.className||el.tagName).toString().slice(0,28),el.textContent.trim().slice(0,22),'left '+gl,'right '+gr,'h'+Math.round(r.height)])}
 return out};
(async()=>{const b=await pw.chromium.launch();
for(const [w,m] of [[320,true],[390,true],[1280,false]]){const p=await (await b.newContext({viewport:{width:w,height:800},isMobile:m,hasTouch:m})).newPage();
 await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ct.session',JSON.stringify({email:'n@x.com',name:'Nick',via:'email',expires:Date.now()+864e5}))});await p.reload();await p.waitForTimeout(700);
 await p.evaluate(()=>document.querySelector('[data-dev=sample]').click());await p.waitForTimeout(500);await p.evaluate(()=>document.body.click());await p.waitForTimeout(300);
 const show=async n=>{const r=await p.evaluate(measure,MIN);console.log(w,n,r.length?'':'ok');r.forEach(x=>console.log('   ',x.join(' | ')))};
 await show('home');
 await p.evaluate(()=>document.querySelector('.ct-row-toggle').click());await p.waitForTimeout(500);await show('open entry');
 await p.evaluate(()=>document.getElementById('app-avatar').click());await p.waitForTimeout(400);await show('menu');await p.evaluate(()=>document.body.click());await p.waitForTimeout(300);
 await p.evaluate(()=>document.getElementById('ct-add').click());await p.waitForTimeout(600);await show('add sheet');
 await p.fill('#as-in','raichu');await p.waitForTimeout(300);await show('add list');
 await p.evaluate(()=>document.querySelector('#as .li').click());await p.waitForTimeout(500);await show('add price');
 await p.evaluate(()=>document.querySelector('#as [data-as-close]').click());await p.waitForTimeout(500);
 await p.evaluate(()=>document.querySelector('[data-act=edit]').click());await p.waitForTimeout(600);await show('editor');}
await b.close()})();
