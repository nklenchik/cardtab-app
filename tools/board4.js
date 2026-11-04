// ---------- Card Board: ten widgets, three sizes (preview) ----------
// Sizes are a quarter, half or the full width of a 12-column grid. Each widget lays itself out from its own width
// (container queries), so it stays clean at every size, while a corner is being dragged, and on phones.
const PERIODS=[['l12','Last 12 months'],['ytd','This year'],['y2025','2025'],['all','All time']];
const COLS={S:3,M:6,L:12},SIZE_NAMES={S:'Small',M:'Medium',L:'Large'},ORDER=['S','M','L'];
const CATALOG={
  profit:{t:'Profit',d:'What you kept after fees, minus what you spent'},
  sales:{t:'Sales',d:'Everything you sold, before fees'},
  spent:{t:'Spent',d:'Everything you bought'},
  fees:{t:'Fees and shipping',d:'What platforms and postage took from your sales'},
  month:{t:'Profit by month',d:'Your best and worst months at a glance'},
  sell:{t:'How much of it sold',d:'How many of the cards you bought have sold'},
  where:{t:'Where you buy',d:'Which platforms get most of your spending'},
  kept:{t:'What each platform kept',d:'Fees and shipping as a share of each sale'},
  win:{t:'Your biggest win',d:'The card that made you the most'},
  budget:{t:'Spend vs budget',d:'How many months you stayed under budget'}};
const DEFAULT=[['profit','S'],['sales','S'],['spent','S'],['fees','S'],['month','M'],['sell','S'],['where','S'],['win','S'],['budget','S'],['kept','M']].map(([k,s])=>({k,size:s}));
let layout=(()=>{try{const s=JSON.parse(localStorage.getItem('cb.layout.v2'));if(Array.isArray(s)&&s.every(w=>CATALOG[w.k]&&COLS[w.size]))return s}catch(e){}return JSON.parse(JSON.stringify(DEFAULT))})();
const save=()=>{try{localStorage.setItem('cb.layout.v2',JSON.stringify(layout))}catch(e){}};
let period='l12',plat='all',editing=false;
const BUDGET=15000; // example monthly budget ($150) until the budget setting exists
const phone=matchMedia('(max-width:600px)'),fine=matchMedia('(hover:hover) and (pointer:fine)');

// ---------- data ----------
function keysFor(p){
  if(p==='l12')return monthsBack(12);
  if(p==='ytd'){const y=TODAY.slice(0,4),m=+TODAY.slice(5,7);return Array.from({length:m},(_,i)=>y+'-'+pad(i+1))}
  if(p==='y2025')return Array.from({length:12},(_,i)=>'2025-'+pad(i+1));
  const first=E.reduce((a,e)=>e.date<a?e.date:a,TODAY);const out=[];let d=new Date(first.slice(0,7)+'-01T12:00:00');const end=ym(TODAY);
  while(true){const k=d.getFullYear()+'-'+pad(d.getMonth()+1);out.push(k);if(k>=end)break;d.setMonth(d.getMonth()+1)}return out}
function prevKeys(keys){const n=keys.length,first=new Date(keys[0]+'-15T12:00:00'),out=[];for(let i=n;i>=1;i--){const d=new Date(first.getFullYear(),first.getMonth()-i,1);out.push(d.getFullYear()+'-'+pad(d.getMonth()+1))}return out}
const pool=()=>plat==='all'?E:E.filter(e=>e.platform===plat);
const inKeys=(list,keys)=>{const s=new Set(keys);return list.filter(e=>s.has(ym(e.date)))};
const kshort=v=>(v<0?'−':'')+'$'+Math.round(Math.abs(v)/100).toLocaleString('en-US');
const ksigned=v=>(v>=0?'+':'−')+'$'+(Math.abs(v)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const KPI={profit:t=>t.profit,sales:t=>t.sales,spent:t=>t.spent,fees:t=>t.fees};
const GOOD={profit:'up',sales:'up',spent:'down',fees:'down'};
function ctxNow(){const keys=keysFor(period),p=pool();return {keys,p,inP:inKeys(p,keys),mt:keys.map(k=>({k,list:p.filter(e=>ym(e.date)===k)}))}}

// ---------- the site's tooltip ----------
let tipEl=null;
function tip(){if(!tipEl){tipEl=document.createElement('div');tipEl.className='cb-tip';tipEl.setAttribute('role','status');$('cb').appendChild(tipEl)}return tipEl}
function showTip(anchor,html){const t=tip(),host=$('cb').getBoundingClientRect(),r=anchor.getBoundingClientRect();t.innerHTML=html;const w=t.offsetWidth,h=t.offsetHeight;
  let x=Math.max(8,Math.min(host.width-w-8,r.left-host.left+r.width/2-w/2)),y=r.top-host.top-h-10;if(r.top-h-10<70)y=r.bottom-host.top+10;t.style.left=x+'px';t.style.top=y+'px';t.classList.add('show')}
function hideTip(){if(tipEl)tipEl.classList.remove('show')}
function bindTip(ev,anchor,fn){ev.setAttribute('data-tip','');
  ev.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!rz&&!drag)showTip(anchor,fn())});ev.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hideTip()});
  ev.addEventListener('focus',()=>{if(!rz&&!drag)showTip(anchor,fn())});ev.addEventListener('blur',hideTip);
  ev.addEventListener('click',e=>{if(rz||drag)return;e.stopPropagation();showTip(anchor,fn())})}

// ---------- charts ----------
function chartSVG(mt,W,H,o){
  const n=mt.length,avail=o.bottom-o.top,pos=Math.max(0,...mt.map(m=>m.v)),neg=Math.max(0,...mt.map(m=>-m.v));
  const sc=avail/((pos+neg)||1),base=o.top+pos*sc,slot=W/n,bw=Math.min(o.maxW,slot*.62);
  let best=-1,bv=-Infinity;mt.forEach((m,i)=>{if(m.v>bv){bv=m.v;best=i}});
  let s='<svg class="pc" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Profit by month"><line x1="0" x2="'+W+'" y1="'+base.toFixed(1)+'" y2="'+base.toFixed(1)+'" stroke="var(--line)" stroke-width="1.5"/>',hit='';
  mt.forEach((m,i)=>{const p=m.v,h=Math.abs(p)*sc,c=i*slot+slot/2,x=c-bw/2,r=Math.min(o.r,bw/4,h*.9),R=r.toFixed(1),X=x.toFixed(1),X2=(x+bw).toFixed(1),B=base.toFixed(1);
    if(h>0.5){const f=o.lab&&i===best&&p>0?'var(--green)':p>=0?'var(--cb-pos)':'var(--cb-neg)';
      if(p>=0){const y=base-h;s+='<path data-i="'+i+'" class="bar" style="transition-delay:'+(i*20)+'ms" d="M'+X+' '+B+'V'+(y+r).toFixed(1)+'A'+R+' '+R+' 0 0 1 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+R+' '+R+' 0 0 1 '+X2+' '+(y+r).toFixed(1)+'V'+B+'Z" fill="'+f+'"/>'}
      else{const y=base+h;s+='<path data-i="'+i+'" class="bar n" style="transition-delay:'+(i*20)+'ms" d="M'+X+' '+B+'V'+(y-r).toFixed(1)+'A'+R+' '+R+' 0 0 0 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+R+' '+R+' 0 0 0 '+X2+' '+(y-r).toFixed(1)+'V'+B+'Z" fill="'+f+'"/>'}}
    const every=n>18?2:1;if(i%every===0)s+='<text x="'+c.toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" class="mt"'+(o.fs?' style="font-size:'+o.fs+'px"':'')+'>'+mLabel(m.k,{month:o.long?'short':'narrow'})+'</text>';
    hit+='<rect data-i="'+i+'" x="'+(i*slot).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'" tabindex="0" role="img" aria-label="'+mLabel(m.k,{month:'long',year:'numeric'})+': profit '+money(p)+'"/>'});
  if(o.lab&&best>-1&&bv>0){const c=best*slot+slot/2,y=base-bv*sc;s+='<text x="'+c.toFixed(1)+'" y="'+Math.max(18,y-25).toFixed(1)+'" text-anchor="middle" fill="var(--green)" style="font:800 17px Manrope,-apple-system,Segoe UI,sans-serif">+'+kshort(bv)+'</text><text x="'+c.toFixed(1)+'" y="'+Math.max(33,y-10).toFixed(1)+'" text-anchor="middle" fill="var(--muted)" style="font:800 12.5px Manrope,-apple-system,Segoe UI,sans-serif">best month</text>'}
  return s+hit+'</svg>'}
function spark(vals){const n=vals.length;if(n<2)return '';const mx=Math.max(...vals),mn=Math.min(0,...vals),r=(mx-mn)||1;const pts=vals.map((v,i)=>[(i/(n-1)*100).toFixed(1),(28-((v-mn)/r)*26).toFixed(1)]);
  return '<svg class="spk" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="M'+pts.map(p=>p.join(' ')).join('L')+'" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
const CHIP={eBay:['--cb-crbg','--cb-cr'],TCGplayer:['--cb-blbg','--cb-bl']};
const chip=p=>{const c=CHIP[p]||['--cb-inkbg','--cb-ink'];return '<span class="ch" style="background:var('+c[0]+');color:var('+c[1]+')">'+esc(p[0])+'</span>'};

// ---------- widget bodies (one design per widget; CSS arranges it for S, M and L) ----------
function body(k,ctx){
  const {keys,p,inP,mt}=ctx,t=totals(inP);
  if(KPI[k]){const v=KPI[k](t),pv=KPI[k](totals(inKeys(p,prevKeys(keys)))),ch=pv?((v-pv)/Math.abs(pv))*100:null,up=ch!=null&&ch>=0,good=ch==null?null:(GOOD[k]==='up'?up:!up);
    const series=mt.map(x=>KPI[k](totals(x.list))),best=mt.reduce((a,x,i)=>series[i]>series[a]?i:a,0);
    const sub=k==='profit'?t.n+' entries':k==='sales'?inP.filter(e=>e.type==='sale').length+' sales':k==='spent'?inP.filter(e=>e.type==='purchase').length+' purchases':(t.sales?(t.fees/t.sales*100).toFixed(1):'0.0')+'% of sales';
    return '<div class="kb"><div class="kn"><div class="big num '+(k==='profit'?(v>=0?'g':'r'):'')+'">'+money(v)+'</div><div class="kd">'+(ch==null?'<span class="sm">'+sub+'</span>':'<span class="dl '+(good?'up':'dn')+'">'+(up?'▲':'▼')+' '+Math.abs(ch).toFixed(0)+'%</span><span class="sm">vs previous period</span>')+'</div><div class="kx">'+sub+(mt.length>1?' · best month '+mLabel(mt[best].k,{month:'short',year:'numeric'}):'')+'</div></div><div class="kspk'+(k==='profit'&&v<0?' r':'')+(k==='profit'?'':' mu')+'">'+spark(series)+'</div></div>'}
  if(k==='month'){const data=mt.map(x=>({k:x.k,v:totals(x.list).profit})),tot=data.reduce((a,d)=>a+d.v,0),act=data.filter((d,i)=>mt[i].list.length),bestM=act.length?act.reduce((a,d)=>d.v>a.v?d:a):null;
    return '<div class="ch-s">'+chartSVG(data,330,160,{top:30,bottom:126,maxW:17,r:5,fs:10.5})+'</div><div class="ch-m">'+chartSVG(data,640,232,{top:50,bottom:198,maxW:34,r:8,lab:1})+'</div><div class="ch-l">'+chartSVG(data,1180,236,{top:52,bottom:202,maxW:46,r:9,lab:1,long:1})+'</div>'+
      '<div class="msum"><span><small>Total</small><b class="num">'+money(tot)+'</b></span><span><small>Average month</small><b class="num">'+money(Math.round(tot/Math.max(1,data.length)))+'</b></span><span><small>Best month</small><b class="num">'+(bestM?mLabel(bestM.k,{month:'short',year:'numeric'}):'—')+'</b></span></div>'}
  if(k==='sell'){const endK=keys[keys.length-1],upTo=p.filter(e=>ym(e.date)<=endK),q=ty=>upTo.filter(e=>e.type===ty),qs=ty=>q(ty).reduce((a,e)=>a+e.qty,0),b=qs('purchase'),s=qs('sale'),r=qs('refund'),pct=b?Math.min(100,Math.round(s/b*100)):0;
    const spent=q('purchase').reduce((a,e)=>a+e.amount,0),made=q('sale').reduce((a,e)=>a+e.net,0);
    const rows=[['Bought',b,100,'var(--cb-gry)','Spent '+kshort(spent)+(b?' · about '+kshort(spent/b)+' each':'')],['Sold',s,b?Math.min(100,s/b*100):0,'var(--cb-pos)','Made back '+kshort(made)+(s?' · about '+kshort(made/s)+' each':'')],['Refunded',r,b?Math.max(r?2:0,r/b*100):0,'var(--cb-neg)',r+' returned · '+(b?(r/b*100).toFixed(1):'0.0')+'% of cards bought']];
    return '<div class="sg"><div class="bigline"><b>'+pct+'%</b><span>of the cards you’ve bought have sold</span></div><div class="st">'+rows.map(([l,n,wd,c,d])=>'<div class="pr" data-row><div class="t"><span>'+l+'</span><span>'+n+(n===1?' card':' cards')+'</span></div><div class="bar"><i style="width:'+wd.toFixed(1)+'%;background:'+c+'"></i></div><div class="d">'+esc(d)+'</div></div>').join('')+'</div></div>'}
  if(k==='where'){const sp={},n={};inP.filter(e=>e.type==='purchase').forEach(e=>{sp[e.platform]=(sp[e.platform]||0)+e.amount;n[e.platform]=(n[e.platform]||0)+e.qty});const rows=Object.keys(sp).map(x=>({k:x,v:sp[x],n:n[x]})).sort((a,b)=>b.v-a.v).slice(0,6);
    return '<div class="lr">'+(rows.length?rows.map((x,i)=>'<div class="r'+(i>2?' xtra':'')+'" data-row>'+chip(x.k)+'<span class="n">'+esc(x.k)+'<small>'+Math.round(x.v/Math.max(1,t.spent)*100)+'% of spend</small></span><span class="v">'+kshort(x.v)+'</span><div class="d">'+x.n+(x.n===1?' card':' cards')+' · about '+kshort(x.v/x.n)+' each</div></div>').join(''):'<p class="eg">No purchases in this period.</p>')+'</div>'}
  if(k==='kept'){const g={};inP.filter(e=>e.type==='sale').forEach(e=>{const o=g[e.platform]||(g[e.platform]={s:0,f:0,n:0});o.s+=e.amount;o.f+=e.amount-e.net;o.n++});
    const rows=Object.keys(g).filter(x=>g[x].s>0).map(x=>({k:x,pct:g[x].f/g[x].s*100,f:g[x].f,n:g[x].n})).sort((a,b)=>b.pct-a.pct).slice(0,6),mx=Math.max(1,...rows.map(r=>r.pct));
    return '<div class="lr kl">'+(rows.length?rows.map((x,i)=>'<div class="r'+(i>2?' xtra':'')+'" data-row>'+chip(x.k)+'<span class="n">'+esc(x.k)+'<small><i class="kb2"><b style="width:'+(x.pct/mx*100).toFixed(1)+'%"></b></i></small></span><span class="v">'+x.pct.toFixed(1)+'%</span><div class="d">'+kshort(x.f)+' in fees and shipping on '+x.n+(x.n===1?' sale':' sales')+'</div></div>').join(''):'<p class="eg">No sales in this period.</p>')+'</div>'}
  if(k==='win'){const key=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+e.no,buys={},sells={};p.filter(e=>e.type==='purchase').forEach(e=>{(buys[key(e)]=buys[key(e)]||[]).push(e)});inP.filter(e=>e.type==='sale').forEach(e=>{(sells[key(e)]=sells[key(e)]||[]).push(e)});
    const wins=Object.keys(sells).filter(x=>buys[x]).map(x=>{const b=buys[x].reduce((a,e)=>a+e.amount,0),s=sells[x].reduce((a,e)=>a+e.net,0);return {g:s-b,b,s,e:sells[x][0]}}).filter(w=>w.g>0).sort((a,b)=>b.g-a.g);
    if(!wins.length)return '<p class="eg">No card bought and sold in this period yet.</p>';const w=wins[0];
    return '<div class="wg"><div class="bestc"><span class="th"><span class="card-ph" aria-hidden="true">'+esc(w.e.name[0])+'</span></span><div><b>'+esc(w.e.name)+'</b><em class="no">'+esc([w.e.no,w.e.set].filter(Boolean).join(' · ')||w.e.platform)+'</em><small>Bought '+kshort(w.b)+' · Sold '+kshort(w.s)+'</small><span class="amt">'+ksigned(w.g)+'</span></div></div>'+
      (wins.length>1?'<div class="alsoup"><p class="mh2">Also up</p>'+wins.slice(1,4).map(x=>'<div class="mr"><span>'+esc(x.e.name)+'</span><b class="num">'+ksigned(x.g)+'</b></div>').join('')+'</div>':'')+'</div>'}
  if(k==='budget'){const bk=keys.slice(-12),bt=bk.map(x=>totals(p.filter(e=>ym(e.date)===x)).spent),bmax=Math.max(BUDGET*1.35,...bt),under=bt.filter(v=>v<=BUDGET).length;
    return '<div class="bg"><div class="hero hero2"><b>'+under+'<i> of '+bk.length+'</i></b><span>months under budget</span></div><div class="bbw"><div class="bb" style="--H:84px"><div class="bars">'+bt.map((v,i)=>'<i data-i="'+i+'" class="'+(v>BUDGET?'o':'')+'" style="--v:'+(v/bmax).toFixed(3)+';transition-delay:'+(i*25)+'ms" tabindex="0" role="img" aria-label="'+mLabel(bk[i],{month:'long',year:'numeric'})+': spent '+money(v)+'"></i>').join('')+'<div class="bl" style="bottom:calc(var(--H)*'+(BUDGET/bmax).toFixed(3)+')"></div></div><div class="mon">'+bk.map(x=>'<span>'+mLabel(x,{month:'narrow'})+'</span>').join('')+'</div></div><span class="eg">Example budget of $150 a month</span></div></div>'}
  return ''}
function widgetHTML(w,ctx,forceCls){
  const cls={profit:'kpi',sales:'kpi',spent:'kpi',fees:'kpi',month:'pmw',sell:'sell',where:'t4',kept:'t4',win:'t4 win',budget:'t4 spend'}[w.k];
  const sz=forceCls||(phone.matches?(w.size==='S'&&KPI[w.k]?'pS':'pF'):'sz'+w.size); // phones: number widgets two across, everything else full width
  return '<section class="w wq '+cls+' '+sz+'" data-k="'+w.k+'"><div class="wh"><h3 class="ttl" style="margin:0">'+CATALOG[w.k].t+'</h3><button type="button" class="wmore" aria-label="Options for '+CATALOG[w.k].t+'" aria-haspopup="true">⋯</button></div>'+body(w.k,ctx)+
    '<div class="wt"><button type="button" class="drag" aria-label="Move '+CATALOG[w.k].t+'" title="Drag to move"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button><button type="button" class="mv" data-move="-1" aria-label="Move up">↑</button><button type="button" class="mv" data-move="1" aria-label="Move down">↓</button><button type="button" class="rm" aria-label="Remove '+CATALOG[w.k].t+'">✕</button></div>'+
    '<button type="button" class="grip" aria-label="Resize '+CATALOG[w.k].t+'. Now '+SIZE_NAMES[w.size]+'" title="Drag to resize"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M13 5L5 13M13 9.5L9.5 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><span class="szlab" aria-hidden="true"></span></section>'}

// ---------- interactions inside widgets, matching the site ----------
function wire(root,ctx){
  root.querySelectorAll('svg.pc').forEach(svg=>svg.querySelectorAll('rect[data-i]').forEach(rc=>{const i=+rc.dataset.i,bar=svg.querySelector('path[data-i="'+i+'"]'),m=ctx.mt[i],t=totals(m.list);
    ['pointerenter','focus'].forEach(ev=>rc.addEventListener(ev,e=>{if(bar&&!rz&&(ev==='focus'||e.pointerType==='mouse'))bar.classList.add('hv')}));
    ['pointerleave','blur'].forEach(ev=>rc.addEventListener(ev,()=>{if(bar)bar.classList.remove('hv')}));
    bindTip(rc,bar||rc,()=>'<b>'+mLabel(m.k,{month:'long',year:'numeric'})+'</b>Sales '+kshort(t.sales)+'<br>Spent '+kshort(t.spent)+'<br>Profit <span class="'+(t.profit>=0?'p':'l')+'">'+kshort(t.profit)+'</span>')}));
  root.querySelectorAll('.spend .bars>i[data-i]').forEach(el=>{const i=+el.dataset.i,bk=ctx.keys.slice(-12),v=totals(ctx.p.filter(e=>ym(e.date)===bk[i])).spent,d=BUDGET-v;
    bindTip(el,el,()=>'<b>'+mLabel(bk[i],{month:'long',year:'numeric'})+'</b>Spent '+kshort(v)+' of '+kshort(BUDGET)+'<br><span class="'+(d>=0?'p':'l')+'">'+kshort(Math.abs(d))+(d>=0?' under':' over')+'</span>')});
  // tap-to-open rows, one open at a time per widget, like the site's FAQs
  root.querySelectorAll('[data-k]').forEach(sec=>{const list=[...sec.querySelectorAll('[data-row]')];list.forEach(el=>{el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-expanded','false');
    const tog=()=>{if(rz||drag)return;const o=el.getAttribute('aria-expanded')==='true';list.forEach(x=>x.setAttribute('aria-expanded','false'));el.setAttribute('aria-expanded',!o)};
    el.addEventListener('click',tog);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog()}})})});
}

// ---------- render, with smooth reflow ----------
function rects(){const m={};$('simple').querySelectorAll('[data-k]').forEach(el=>m[el.dataset.k]=el.getBoundingClientRect());return m}
function flip(before){if(calm.matches)return;$('simple').querySelectorAll('[data-k]').forEach(el=>{const a=before[el.dataset.k],b=el.getBoundingClientRect();
  if(!a){el.animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.7,.2,1)'});return}
  const dx=a.left-b.left,dy=a.top-b.top;if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1)return;
  el.animate([{transform:'translate('+dx+'px,'+dy+'px)',clipPath:'inset(0 '+Math.max(0,b.width-a.width)+'px '+Math.max(0,b.height-a.height)+'px 0 round 22px)'},{transform:'none',clipPath:'inset(0 0 0 0 round 22px)'}],{duration:380,easing:'cubic-bezier(.2,.7,.2,1)'})})}
function render(animate){
  const before=animate?rects():null,ctx=ctxNow();hideTip();
  const missing=Object.keys(CATALOG).filter(k=>!layout.some(w=>w.k===k));
  $('simple').innerHTML=layout.map(w=>widgetHTML(w,ctx)).join('')+(editing&&missing.length?'<button type="button" class="addw '+(phone.matches?'pF':'szS')+'" id="addw"><span class="pl">+</span><b>Add widget</b><small>'+missing.length+' more to choose from</small></button>':'');
  $('cb').classList.toggle('editing',editing);wire($('simple'),ctx);
  if(before)flip(before)}
function grow(){const cb=$('cb');if(calm.matches)return;cb.classList.add('grow');void cb.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>cb.classList.remove('grow')))}
phone.addEventListener('change',()=>render(false));

// ---------- period and platform pickers ----------
function closeMenus(){document.querySelectorAll('.cbx .cb-menu').forEach(m=>{m.hidden=true});document.querySelectorAll('.cbx [aria-haspopup]').forEach(b=>b.setAttribute('aria-expanded','false'))}
function pickMenu(btn,menuEl,items,cur,onPick){
  btn.addEventListener('click',e=>{e.stopPropagation();hideTip();const o=menuEl.hidden;closeMenus();if(!o)return;menuEl.innerHTML=items().map(([k,l])=>'<button type="button" role="menuitemradio" aria-checked="'+(k===cur())+'" data-k="'+esc(k)+'">'+esc(l)+'</button>').join('');menuEl.hidden=false;btn.setAttribute('aria-expanded','true')});
  menuEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;onPick(b.dataset.k,b.textContent);closeMenus()})}
pickMenu($('cb-per'),$('cb-menu'),()=>PERIODS,()=>period,(k,l)=>{period=k;$('cb-perl').textContent=l;render(false);grow()});
pickMenu($('cb-plat'),$('cb-pmenu'),()=>[['all','All platforms']].concat([...new Set(E.map(e=>e.platform))].sort().map(p=>[p,p])),()=>plat,(k,l)=>{plat=k;$('cb-platl').textContent=l;render(false);grow()});
document.addEventListener('click',e=>{if(!e.target.closest('.perwrap')&&!e.target.closest('#wmenu'))closeMenus();if(!e.target.closest('#cb [data-tip]'))hideTip()});

// ---------- customize ----------
function setEditing(on){editing=on;$('cb-edit').textContent=on?'Done':'Customize';$('cb-edit').classList.toggle('on',on);$('cb-reset').hidden=!on;render(true)}
$('cb-edit').addEventListener('click',()=>setEditing(!editing));
$('cb-reset').addEventListener('click',()=>{layout=JSON.parse(JSON.stringify(DEFAULT));save();render(true)});
$('simple').addEventListener('click',e=>{
  if(e.target.closest('#addw')){openAdd();return}
  const sec=e.target.closest('[data-k]');if(!sec)return;const i=layout.findIndex(w=>w.k===sec.dataset.k);if(i<0)return;
  if(e.target.closest('.rm')){layout.splice(i,1);save();render(true);return}
  const mv=e.target.closest('[data-move]');if(mv){const j=i+(+mv.dataset.move);if(j<0||j>=layout.length)return;layout.splice(j,0,layout.splice(i,1)[0]);save();render(true);return}
  const more=e.target.closest('.wmore');if(more){e.stopPropagation();openWidgetMenu(more,layout[i])}
});
function setSize(k,s){const w=layout.find(x=>x.k===k);if(!w||w.size===s)return;const before=rects();w.size=s;const el=$('simple').querySelector('[data-k="'+k+'"]');
  if(el){el.classList.remove('szS','szM','szL','pS','pF');el.classList.add(phone.matches?(s==='S'&&KPI[k]?'pS':'pF'):'sz'+s);el.querySelector('.grip').setAttribute('aria-label','Resize '+CATALOG[k].t+'. Now '+SIZE_NAMES[s])}
  flip(before);save()}
// widget menu (⋯): size and remove
function openWidgetMenu(btn,w){closeMenus();hideTip();const m=$('wmenu');
  m.innerHTML='<div class="mh">Size</div><div class="msz">'+ORDER.map(s=>'<button type="button" data-msize="'+s+'" aria-pressed="'+(w.size===s)+'">'+SIZE_NAMES[s]+'</button>').join('')+'</div><button type="button" data-act="rm" class="danger">Remove from board</button>';
  const r=btn.getBoundingClientRect(),host=$('cb').getBoundingClientRect();m.hidden=false;m.style.top=(r.bottom-host.top+6)+'px';m.style.left=Math.max(8,Math.min(r.right-host.left-236,host.width-244))+'px';
  m.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;m.hidden=true;if(b.dataset.msize){setSize(w.k,b.dataset.msize);return}const i=layout.findIndex(x=>x.k===w.k);layout.splice(i,1);save();render(true)}}
// corner resize: drag the grip and the widget snaps between Small, Medium and Large; the board makes room as you go
let rz=null;
$('simple').addEventListener('pointerdown',e=>{
  const g=e.target.closest('.grip');
  if(g&&editing){const sec=g.closest('[data-k]'),grid=$('simple').getBoundingClientRect(),gap=parseFloat(getComputedStyle($('simple')).columnGap)||14;e.preventDefault();$('simple').setPointerCapture(e.pointerId);
    rz={k:sec.dataset.k,left:sec.getBoundingClientRect().left,col:(grid.width-11*gap)/12,gap,el:sec};sec.classList.add('resizing');return}
  const h=e.target.closest('.drag');if(h&&editing){const sec=h.closest('[data-k]');e.preventDefault();$('simple').setPointerCapture(e.pointerId);drag={k:sec.dataset.k,el:sec,x:e.clientX,y:e.clientY};sec.classList.add('lifted')}});
$('simple').addEventListener('pointermove',e=>{
  if(rz){const want=(e.clientX-rz.left+rz.gap)/(rz.col+rz.gap);let best='S',bd=Infinity;ORDER.forEach(s=>{const d=Math.abs(COLS[s]-want);if(d<bd){bd=d;best=s}});
    const el=$('simple').querySelector('[data-k="'+rz.k+'"]');el.querySelector('.szlab').textContent=SIZE_NAMES[best];setSize(rz.k,best);return}
  if(!drag)return;drag.el.style.transform='translate('+(e.clientX-drag.x)+'px,'+(e.clientY-drag.y)+'px) scale(1.02)';
  const over=[...$('simple').querySelectorAll('[data-k]')].find(el=>{if(el===drag.el)return false;const r=el.getBoundingClientRect();return e.clientX>r.left&&e.clientX<r.right&&e.clientY>r.top&&e.clientY<r.bottom});
  $('simple').querySelectorAll('.drop').forEach(el=>el.classList.remove('drop'));if(over)over.classList.add('drop');drag.over=over?over.dataset.k:null});
let drag=null;
function endPointer(){
  if(rz){const el=$('simple').querySelector('[data-k="'+rz.k+'"]');if(el)el.classList.remove('resizing');rz=null;return}
  if(!drag)return;const d=drag;drag=null;d.el.classList.remove('lifted');$('simple').querySelectorAll('.drop').forEach(el=>el.classList.remove('drop'));
  if(d.over){d.el.style.transform='';const from=layout.findIndex(w=>w.k===d.k),to=layout.findIndex(w=>w.k===d.over);const [w]=layout.splice(from,1);layout.splice(to,0,w);save();render(true)}
  else{d.el.style.transition='transform .3s cubic-bezier(.2,.7,.2,1)';d.el.style.transform='';setTimeout(()=>{d.el.style.transition=''},320)}}
$('simple').addEventListener('pointerup',endPointer);$('simple').addEventListener('pointercancel',endPointer);
// keyboard: arrow keys on the grip change size
$('simple').addEventListener('keydown',e=>{const g=e.target.closest('.grip');if(!g)return;const k=g.closest('[data-k]').dataset.k,w=layout.find(x=>x.k===k),i=ORDER.indexOf(w.size);
  if(e.key==='ArrowRight'&&i<2){e.preventDefault();setSize(k,ORDER[i+1])}if(e.key==='ArrowLeft'&&i>0){e.preventDefault();setSize(k,ORDER[i-1])}});

// ---------- add a widget: pick one of the ten, pick a size, see it ----------
const aw=$('aw');let draft=null;
function openAdd(){const missing=Object.keys(CATALOG).filter(k=>!layout.some(w=>w.k===k));if(!missing.length)return;draft={k:missing[0],size:'S'};drawAdd();aw.showModal()}
function drawAdd(){const missing=Object.keys(CATALOG).filter(k=>!layout.some(w=>w.k===k));
  $('aw-list').innerHTML=missing.map(k=>'<button type="button" class="opt" data-pick="'+k+'" aria-pressed="'+(draft.k===k)+'"><b>'+CATALOG[k].t+'</b><span>'+CATALOG[k].d+'</span></button>').join('');
  $('aw-sizes').innerHTML=ORDER.map(s=>'<button type="button" data-s="'+s+'" aria-pressed="'+(draft.size===s)+'">'+SIZE_NAMES[s]+'</button>').join('');
  const ctx=ctxNow();$('aw-prev').innerHTML='<div class="prevgrid"><div class="simple">'+widgetHTML({k:draft.k,size:draft.size},ctx,'pv'+draft.size)+'</div></div>';
  $('aw-go').textContent='Add '+CATALOG[draft.k].t}
aw.addEventListener('click',e=>{if(e.target===aw){aw.close();return}const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pick){draft.k=b.dataset.pick;drawAdd()}else if(b.dataset.s){draft.size=b.dataset.s;drawAdd()}
  else if(b.id==='aw-go'){layout.push({k:draft.k,size:draft.size});save();aw.close();render(true);const el=$('simple').querySelector('[data-k="'+draft.k+'"]');if(el)setTimeout(()=>el.scrollIntoView({behavior:calm.matches?'auto':'smooth',block:'nearest'}),60)}
  else if(b.hasAttribute('data-close'))aw.close()});

// ---------- the morph: Insights panel grows into the full page, and shrinks back into it ----------
const cbx=$('cbx'),ins=$('ins'),xb=$('expand'),EASE='cubic-bezier(.2,.7,.2,1)';
let busy=false;
function clipFor(r){return 'inset('+r.top+'px '+(innerWidth-r.right)+'px '+(innerHeight-r.bottom)+'px '+r.left+'px round 11px)'}
function open(){
  if(busy||!cbx.hidden)return;busy=true;xb.classList.remove('hint');$('note').hidden=true;
  render(false);$('cb').classList.add('grow');
  cbx.hidden=false;cbx.classList.add('enter');cbx.scrollTop=0;document.documentElement.style.overflow='hidden';xb.setAttribute('aria-expanded','true');
  if(calm.matches){cbx.classList.remove('enter');$('cb').classList.remove('grow');busy=false;$('close').focus();return}
  cbx.style.transition='none';cbx.style.clipPath=clipFor(ins.getBoundingClientRect());void cbx.offsetWidth;
  cbx.style.transition='clip-path .52s '+EASE;cbx.style.clipPath='inset(0px 0px 0px 0px round 0px)';
  const parts=[cbx.querySelector('.topbar'),...cbx.querySelectorAll('.simple > .w')];
  parts.forEach((p,i)=>{p.style.transitionDelay=(200+i*30)+'ms'});
  requestAnimationFrame(()=>cbx.classList.remove('enter'));
  setTimeout(()=>$('cb').classList.remove('grow'),380);
  setTimeout(()=>{cbx.style.transition='';cbx.style.clipPath='';parts.forEach(p=>p.style.transitionDelay='');busy=false;$('close').focus({preventScroll:true})},580+parts.length*30);
}
function close(){
  if(busy||cbx.hidden)return;busy=true;hideTip();closeMenus();$('wmenu').hidden=true;xb.setAttribute('aria-expanded','false');
  const finish=()=>{cbx.hidden=true;cbx.style.transition='';cbx.style.clipPath='';document.documentElement.style.overflow='';busy=false;if(editing)setEditing(false);xb.focus({preventScroll:true})};
  if(calm.matches){finish();return}
  cbx.classList.add('enter');cbx.style.transition='none';cbx.style.clipPath='inset(0px 0px 0px 0px round 0px)';void cbx.offsetWidth;
  setTimeout(()=>{cbx.style.transition='clip-path .44s '+EASE;cbx.style.clipPath=clipFor(ins.getBoundingClientRect())},90);
  setTimeout(finish,560);
}
xb.addEventListener('click',open);$('close').addEventListener('click',close);
document.addEventListener('click',e=>{const wm=$('wmenu');if(!wm.hidden&&!e.target.closest('#wmenu')&&!e.target.closest('.wmore'))wm.hidden=true});
cbx.addEventListener('scroll',hideTip,{passive:true});
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||cbx.hidden||aw.open)return;if(!$('wmenu').hidden){$('wmenu').hidden=true;return}if(!$('cb-menu').hidden||!$('cb-pmenu').hidden){closeMenus();return}if(editing){setEditing(false);return}close()});
