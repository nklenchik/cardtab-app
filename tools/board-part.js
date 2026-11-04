// ---------- Card Board (the site's design, filled with real entries) ----------
const PERIODS=[['l12','Last 12 months'],['ytd','This year'],['y2025','2025'],['all','All time']];
let period='l12';
const BUDGET=15000; // example monthly budget for the preview ($150)
const tip=$('tip');
function showTip(html,x,y){tip.innerHTML=html;tip.classList.add('on');const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(8,Math.min(innerWidth-w-8,x-w/2))+'px';tip.style.top=Math.max(8,y-h-10)+'px'}
function hideTip(){tip.classList.remove('on')}
function keysFor(p){
  if(p==='l12')return monthsBack(12);
  if(p==='ytd'){const y=TODAY.slice(0,4),m=+TODAY.slice(5,7);return Array.from({length:m},(_,i)=>y+'-'+pad(i+1))}
  if(p==='y2025')return Array.from({length:12},(_,i)=>'2025-'+pad(i+1));
  const first=E.reduce((a,e)=>e.date<a?e.date:a,TODAY);const out=[];let d=new Date(first.slice(0,7)+'-01T12:00:00');const end=ym(TODAY);
  while(true){const k=d.getFullYear()+'-'+pad(d.getMonth()+1);out.push(k);if(k>=end)break;d.setMonth(d.getMonth()+1)}return out}
const kshort=(v)=>(v<0?'−':'')+'$'+Math.round(Math.abs(v)/100).toLocaleString('en-US');
const ksigned=(v)=>(v>=0?'+':'−')+'$'+(Math.abs(v)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
// Profit-by-month bars, drawn like the site: rounded data ends, one baseline, the best month called out
function chartSVG(mt,W,H,o){
  const n=mt.length,top=o.top,bottom=o.bottom,avail=bottom-top;
  const pos=Math.max(0,...mt.map(m=>m.t.profit)),neg=Math.max(0,...mt.map(m=>-m.t.profit));
  const sc=avail/((pos+neg)||1),base=top+pos*sc,slot=W/n,bw=Math.min(o.maxW,slot*.64);
  let best=-1,bv=-Infinity;mt.forEach((m,i)=>{if(m.t.n&&m.t.profit>bv){bv=m.t.profit;best=i}});
  let s='<svg class="pc" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Profit by month"><line x1="0" x2="'+W+'" y1="'+base.toFixed(1)+'" y2="'+base.toFixed(1)+'" stroke="var(--line)" stroke-width="1.5"/>';
  mt.forEach((m,i)=>{const p=m.t.profit,h=Math.abs(p)*sc,x=i*slot+(slot-bw)/2,r=Math.min(o.r,bw/4,h/2);
    if(h>0.5){const f=i===best&&p>0?'var(--green)':p>=0?'var(--cb-pos)':'var(--cb-neg)';
      if(p>=0){const y=base-h;s+='<path class="bar" style="transition-delay:'+(i*22)+'ms" d="M'+x.toFixed(1)+' '+base.toFixed(1)+'V'+(y+r).toFixed(1)+'A'+r.toFixed(1)+' '+r.toFixed(1)+' 0 0 1 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+r.toFixed(1)+' '+r.toFixed(1)+' 0 0 1 '+(x+bw).toFixed(1)+' '+(y+r).toFixed(1)+'V'+base.toFixed(1)+'Z" fill="'+f+'"/>'}
      else{const y=base+h;s+='<path class="bar n" style="transition-delay:'+(i*22)+'ms" d="M'+x.toFixed(1)+' '+base.toFixed(1)+'V'+(y-r).toFixed(1)+'A'+r.toFixed(1)+' '+r.toFixed(1)+' 0 0 0 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+r.toFixed(1)+' '+r.toFixed(1)+' 0 0 0 '+(x+bw).toFixed(1)+' '+(y-r).toFixed(1)+'V'+base.toFixed(1)+'Z" fill="'+f+'"/>'}}
    const every=n>18?2:1;if(i%every===0)s+='<text x="'+(i*slot+slot/2).toFixed(1)+'" y="'+(H-o.lb)+'" text-anchor="middle" class="mt"'+(o.fs?' style="font-size:'+o.fs+'px"':'')+'>'+mLabel(m.k,{month:'narrow'})+'</text>';
    s+='<rect data-i="'+i+'" x="'+(i*slot).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'"/>'});
  if(best>-1&&bv>0){const cx=best*slot+slot/2,y=base-bv*sc;s+='<text x="'+cx.toFixed(1)+'" y="'+Math.max(o.bt,y-o.gap-15).toFixed(1)+'" text-anchor="middle" fill="var(--green)" style="font:800 '+o.b1+'px Manrope,-apple-system,Segoe UI,sans-serif">'+kshort(bv).replace('$','+$')+'</text><text x="'+cx.toFixed(1)+'" y="'+Math.max(o.bt+15,y-o.gap).toFixed(1)+'" text-anchor="middle" fill="var(--muted)" style="font:800 '+o.b2+'px Manrope,-apple-system,Segoe UI,sans-serif">best month</text>'}
  return s+'</svg>'}
const CHIP={eBay:['--cb-crbg','--cb-cr'],TCGplayer:['--cb-blbg','--cb-bl']};
function render(){
  const keys=keysFor(period),inP=E.filter(e=>keys.includes(ym(e.date))),t=totals(inP);
  const mt=keys.map(k=>({k,t:totals(E.filter(e=>ym(e.date)===k))}));
  // sell-through counts everything bought and sold up to the end of the period (a sale this month can be a card bought last year)
  const endK=keys[keys.length-1],upTo=E.filter(e=>ym(e.date)<=endK),qty=ty=>upTo.filter(e=>e.type===ty).reduce((a,e)=>a+e.qty,0),bought=qty('purchase'),sold=qty('sale'),ref=qty('refund');
  const sp={};inP.filter(e=>e.type==='purchase').forEach(e=>sp[e.platform]=(sp[e.platform]||0)+e.amount);
  const where=Object.keys(sp).map(k=>({k,v:sp[k]})).sort((a,b)=>b.v-a.v).slice(0,3);
  // biggest win: a card bought (any time) and sold in this period, with the largest gain
  const key=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+e.no;
  const buys={};E.filter(e=>e.type==='purchase').forEach(e=>{const k=key(e);(buys[k]=buys[k]||[]).push(e)});
  const sells={};inP.filter(e=>e.type==='sale').forEach(e=>{const k=key(e);(sells[k]=sells[k]||[]).push(e)});
  let win=null;Object.keys(sells).forEach(k=>{if(!buys[k])return;const b=buys[k].reduce((a,e)=>a+e.amount,0),s=sells[k].reduce((a,e)=>a+e.net,0),g=s-b;if(!win||g>win.g)win={g,b,s,e:sells[k][0]}});
  const fp=t.sales?(t.fees/t.sales*100).toFixed(1):'0.0';
  const sellPct=bought?Math.min(100,Math.round(sold/bought*100)):0;
  const bk=keys.slice(-12),bt=bk.map(k=>totals(E.filter(e=>ym(e.date)===k)).spent),bmax=Math.max(BUDGET*1.35,...bt),under=bt.filter(v=>v<=BUDGET).length;
  let h='';
  h+='<section class="w kpi kp1"><h3 class="ttl">Profit</h3><div class="big num '+(t.profit>=0?'g':'r')+'">'+money(t.profit)+'</div><span class="sm">'+t.n+' entries</span></section>';
  h+='<section class="w kpi"><h3 class="ttl">Sales</h3><div class="big num">'+money(t.sales)+'</div><span class="sm">'+inP.filter(e=>e.type==='sale').length+' sales</span></section>';
  h+='<section class="w kpi"><h3 class="ttl">Spent</h3><div class="big num">'+money(t.spent)+'</div><span class="sm">'+inP.filter(e=>e.type==='purchase').length+' purchases</span></section>';
  h+='<section class="w kpi fee"><h3 class="ttl">Fees and shipping</h3><div class="big num">'+money(t.fees)+'</div><span class="sm">'+fp+'% of sales</span></section>';
  h+='<section class="w sell"><div class="wh"><h3 class="ttl" style="margin:0">How much of it sold</h3></div><div class="bigline"><b>'+sellPct+'%</b><span>of the cards you’ve bought have sold</span></div><div class="st">'+
     [['Bought',bought,100,'var(--cb-gry)'],['Sold',sold,bought?Math.min(100,sold/bought*100):0,'var(--cb-pos)'],['Refunded',ref,bought?Math.max(ref?2:0,ref/bought*100):0,'var(--cb-neg)']].map(([l,n,w,c])=>'<div class="pr"><div class="t"><span>'+l+'</span><span>'+n+(n===1?' card':' cards')+'</span></div><div class="bar"><i style="width:'+w.toFixed(1)+'%;background:'+c+'"></i></div></div>').join('')+'</div></section>';
  h+='<section class="w pmw"><div class="wh"><h3 class="ttl" style="margin:0">Profit by month</h3></div><div class="pcd">'+chartSVG(mt,640,232,{top:50,bottom:198,maxW:34,r:8,lb:8,b1:17,b2:12.5,bt:22,gap:10})+'</div><div class="pcm">'+chartSVG(mt,330,160,{top:36,bottom:130,maxW:17,r:5,lb:8,fs:10.5,b1:14,b2:10.5,bt:16,gap:7})+'</div></section>';
  h+='<section class="w t4"><div class="wh"><h3 class="ttl" style="margin:0">Where you buy</h3></div><div class="lr">'+(where.length?where.map(w=>{const c=CHIP[w.k]||['--cb-inkbg','--cb-ink'];return '<div class="r"><span class="ch" style="background:var('+c[0]+');color:var('+c[1]+')">'+esc(w.k[0])+'</span><span class="n">'+esc(w.k)+'<small>'+Math.round(w.v/Math.max(1,t.spent)*100)+'% of spend</small></span><span class="v">'+kshort(w.v)+'</span></div>'}).join(''):'<p class="eg">No purchases in this period.</p>')+'</div></section>';
  h+='<section class="w t4 win"><div class="wh"><h3 class="ttl" style="margin:0">Your biggest win</h3></div>'+(win&&win.g>0?'<div class="bestc"><span class="th"><span class="card-ph" aria-hidden="true">'+esc(win.e.name[0])+'</span></span><div><b>'+esc(win.e.name)+'</b><em class="no">'+esc([win.e.no,win.e.set].filter(Boolean).join(' · ')||win.e.platform)+'</em><small>Bought '+kshort(win.b)+' · Sold '+kshort(win.s)+'</small><span class="amt">'+ksigned(win.g)+'</span></div></div>':'<p class="eg">No card bought and sold in this period yet.</p>')+'</section>';
  h+='<section class="w t4 spend"><div class="wh"><h3 class="ttl" style="margin:0">Spend vs budget</h3></div><div class="hero hero2" style="margin-bottom:10px"><b>'+under+'<i> of '+bk.length+'</i></b><span>months under budget</span></div><div class="bb" style="--H:84px"><div class="bars">'+bt.map((v,i)=>'<i class="'+(v>BUDGET?'o':'')+'" style="--v:'+(v/bmax).toFixed(3)+';transition-delay:'+(i*25)+'ms"></i>').join('')+'<div class="bl" style="bottom:calc(var(--H)*'+(BUDGET/bmax).toFixed(3)+')"></div></div><div class="mon">'+bk.map(k=>'<span>'+mLabel(k,{month:'narrow'})+'</span>').join('')+'</div></div><span class="eg">Example budget of $150 a month</span></section>';
  $('simple').innerHTML=h;
  $('simple').querySelectorAll('svg rect[data-i]').forEach(r=>{const m=mt[+r.dataset.i];const html='<b>'+mLabel(m.k,{month:'long',year:'numeric'})+'</b><br>Profit '+money(m.t.profit)+'<br>Sales '+money(m.t.sales)+' · Spent '+money(m.t.spent);
    const on=()=>{const b=r.getBoundingClientRect();showTip(html,b.left+b.width/2,b.top+30)};r.addEventListener('mouseenter',on);r.addEventListener('mouseleave',hideTip);r.addEventListener('click',()=>{on();clearTimeout(r._t);r._t=setTimeout(hideTip,2200)})});
}
function grow(){const cb=$('cb');if(calm.matches)return;cb.classList.add('grow');void cb.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>cb.classList.remove('grow')))}
// period menu, like the site's
const per=$('cb-per'),menu=$('cb-menu');
function fillMenu(){menu.innerHTML=PERIODS.map(([k,l])=>'<button type="button" role="menuitemradio" aria-checked="'+(k===period)+'" data-k="'+k+'">'+l+'</button>').join('')}
per.addEventListener('click',e=>{e.stopPropagation();const o=menu.hidden;fillMenu();menu.hidden=!o;per.setAttribute('aria-expanded',o)});
menu.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;period=b.dataset.k;$('cb-perl').textContent=b.textContent;menu.hidden=true;per.setAttribute('aria-expanded','false');render();grow()});
document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('.perwrap')){menu.hidden=true;per.setAttribute('aria-expanded','false')}});

// ---------- the morph: Insights panel grows into the full page, and shrinks back into it ----------
const cbx=$('cbx'),ins=$('ins'),xb=$('expand'),EASE='cubic-bezier(.2,.7,.2,1)';
let busy=false;
function clipFor(r){return 'inset('+r.top+'px '+(innerWidth-r.right)+'px '+(innerHeight-r.bottom)+'px '+r.left+'px round 11px)'}
function open(){
  if(busy||!cbx.hidden)return;busy=true;xb.classList.remove('hint');$('note').hidden=true;
  render();$('cb').classList.add('grow');
  cbx.hidden=false;cbx.classList.add('enter');cbx.scrollTop=0;document.documentElement.style.overflow='hidden';xb.setAttribute('aria-expanded','true');
  if(calm.matches){cbx.classList.remove('enter');$('cb').classList.remove('grow');busy=false;$('close').focus();return}
  cbx.style.transition='none';cbx.style.clipPath=clipFor(ins.getBoundingClientRect());void cbx.offsetWidth;
  cbx.style.transition='clip-path .52s '+EASE;cbx.style.clipPath='inset(0px 0px 0px 0px round 0px)';
  const parts=[cbx.querySelector('.topbar'),...cbx.querySelectorAll('.w')];
  parts.forEach((p,i)=>{p.style.transitionDelay=(200+i*30)+'ms'});
  requestAnimationFrame(()=>cbx.classList.remove('enter'));
  setTimeout(()=>$('cb').classList.remove('grow'),380);
  setTimeout(()=>{cbx.style.transition='';cbx.style.clipPath='';parts.forEach(p=>p.style.transitionDelay='');busy=false;$('close').focus({preventScroll:true})},580+parts.length*30);
}
function close(){
  if(busy||cbx.hidden)return;busy=true;hideTip();menu.hidden=true;xb.setAttribute('aria-expanded','false');
  const finish=()=>{cbx.hidden=true;cbx.style.transition='';cbx.style.clipPath='';document.documentElement.style.overflow='';busy=false;xb.focus({preventScroll:true})};
  if(calm.matches){finish();return}
  cbx.classList.add('enter');cbx.style.transition='none';cbx.style.clipPath='inset(0px 0px 0px 0px round 0px)';void cbx.offsetWidth;
  setTimeout(()=>{cbx.style.transition='clip-path .44s '+EASE;cbx.style.clipPath=clipFor(ins.getBoundingClientRect())},90);
  setTimeout(finish,560);
}
xb.addEventListener('click',open);$('close').addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!cbx.hidden){if(!menu.hidden){menu.hidden=true;per.focus()}else close()}});
