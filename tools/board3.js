// ---------- Card Board: a customizable board of widgets (preview) ----------
// A widget = { id, kind, metric, view, size }. Sizes map to columns of a 12-column grid: S 3, M 4, L 6, W 8, F 12.
// The grid packs itself (dense flow), and every change animates widgets from where they were to where they land.
const PERIODS=[['l12','Last 12 months'],['ytd','This year'],['y2025','2025'],['all','All time']];
const SIZES={S:3,M:4,L:6,W:8,F:12},SIZE_NAMES={S:'Small',M:'Medium',L:'Large',W:'Wide',F:'Full'};
const METRICS={
  profit:{label:'Profit',fmt:'money',good:'up'},sales:{label:'Sales',fmt:'money',good:'up'},spent:{label:'Spent',fmt:'money',good:'down'},
  fees:{label:'Fees and shipping',fmt:'money',good:'down'},entries:{label:'Entries',fmt:'count',good:'up'},
  avgSale:{label:'Average sale',fmt:'money',good:'up'},margin:{label:'Profit margin',fmt:'pct',good:'up'},roi:{label:'Return on spend',fmt:'pct',good:'up'}};
const VIEWS={number:'Number',month:'By month',platform:'By platform',top:'Top list'};
const DEFAULT=[
  {id:'w1',kind:'metric',metric:'profit',view:'number',size:'S'},{id:'w2',kind:'metric',metric:'sales',view:'number',size:'S'},
  {id:'w3',kind:'metric',metric:'spent',view:'number',size:'S'},{id:'w4',kind:'metric',metric:'fees',view:'number',size:'S'},
  {id:'w5',kind:'sell',size:'M'},{id:'w6',kind:'metric',metric:'profit',view:'month',size:'W'},
  {id:'w7',kind:'where',size:'M'},{id:'w8',kind:'win',size:'M'},{id:'w9',kind:'budget',size:'M'}];
const SPECIAL={sell:'How much of it sold',where:'Where you buy',win:'Your biggest win',budget:'Spend vs budget'};
const allowed=w=>w.kind!=='metric'?['M','L']:w.view==='number'?['S','M']:w.view==='month'?['L','W','F']:['M','L','W'];
let layout=(()=>{try{const s=JSON.parse(localStorage.getItem('cb.layout.v1'));if(Array.isArray(s)&&s.length)return s}catch(e){}return JSON.parse(JSON.stringify(DEFAULT))})();
const save=()=>{try{localStorage.setItem('cb.layout.v1',JSON.stringify(layout))}catch(e){}};
let period='l12',plat='all',editing=false,nid=Date.now();
const BUDGET=15000; // example monthly budget ($150) until the budget setting exists
const tip=$('tip');
function showTip(html,x,y){tip.innerHTML=html;tip.classList.add('on');const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(8,Math.min(innerWidth-w-8,x-w/2))+'px';tip.style.top=Math.max(8,y-h-10)+'px'}
function hideTip(){tip.classList.remove('on')}
const phone=matchMedia('(max-width:760px)');

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
function val(metric,list){const t=totals(list),ns=list.filter(e=>e.type==='sale').length;
  return metric==='profit'?t.profit:metric==='sales'?t.sales:metric==='spent'?t.spent:metric==='fees'?t.fees:metric==='entries'?t.n:metric==='avgSale'?(ns?Math.round(t.sales/ns):0):metric==='margin'?(t.after?t.profit/t.after*100:0):(t.spent?t.profit/t.spent*100:0)}
const kshort=v=>(v<0?'−':'')+'$'+Math.round(Math.abs(v)/100).toLocaleString('en-US');
const ksigned=v=>(v>=0?'+':'−')+'$'+(Math.abs(v)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function fmt(metric,v,short){const f=METRICS[metric].fmt;if(f==='count')return Math.round(v).toLocaleString('en-US');if(f==='pct')return v.toFixed(1)+'%';return short?kshort(v):money(v)}

// ---------- charts ----------
function chartSVG(mt,W,H,o){
  const n=mt.length,top=o.top,bottom=o.bottom,avail=bottom-top;
  const pos=Math.max(0,...mt.map(m=>m.v)),neg=Math.max(0,...mt.map(m=>-m.v));
  const sc=avail/((pos+neg)||1),base=top+pos*sc,slot=W/n,bw=Math.min(o.maxW,slot*.64);
  let best=-1,bv=-Infinity;if(o.best)mt.forEach((m,i)=>{if(m.v>bv){bv=m.v;best=i}});
  let s='<svg class="pc" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label)+'"><line x1="0" x2="'+W+'" y1="'+base.toFixed(1)+'" y2="'+base.toFixed(1)+'" stroke="var(--line)" stroke-width="1.5"/>';
  mt.forEach((m,i)=>{const p=m.v,h=Math.abs(p)*sc,x=i*slot+(slot-bw)/2,r=Math.min(o.r,bw/4,h/2);
    if(h>0.5){const f=o.single?'var(--cb-bl)':i===best&&p>0?'var(--green)':p>=0?'var(--cb-pos)':'var(--cb-neg)';
      const R=r.toFixed(1),X=x.toFixed(1),X2=(x+bw).toFixed(1),B=base.toFixed(1);
      if(p>=0){const y=base-h;s+='<path class="bar" style="transition-delay:'+(i*20)+'ms" d="M'+X+' '+B+'V'+(y+r).toFixed(1)+'A'+R+' '+R+' 0 0 1 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+R+' '+R+' 0 0 1 '+X2+' '+(y+r).toFixed(1)+'V'+B+'Z" fill="'+f+'"/>'}
      else{const y=base+h;s+='<path class="bar n" style="transition-delay:'+(i*20)+'ms" d="M'+X+' '+B+'V'+(y-r).toFixed(1)+'A'+R+' '+R+' 0 0 0 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+R+' '+R+' 0 0 0 '+X2+' '+(y-r).toFixed(1)+'V'+B+'Z" fill="'+f+'"/>'}}
    const every=n>18?2:1;if(i%every===0)s+='<text x="'+(i*slot+slot/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" class="mt"'+(o.fs?' style="font-size:'+o.fs+'px"':'')+'>'+mLabel(m.k,{month:'narrow'})+'</text>';
    s+='<rect data-i="'+i+'" x="'+(i*slot).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'"/>'});
  if(best>-1&&bv>0){const cx=best*slot+slot/2,y=base-bv*sc;s+='<text x="'+cx.toFixed(1)+'" y="'+Math.max(o.bt,y-o.gap-15).toFixed(1)+'" text-anchor="middle" fill="'+(o.single?'var(--text)':'var(--green)')+'" style="font:800 '+o.b1+'px Manrope,-apple-system,Segoe UI,sans-serif">'+o.f(bv)+'</text><text x="'+cx.toFixed(1)+'" y="'+Math.max(o.bt+15,y-o.gap).toFixed(1)+'" text-anchor="middle" fill="var(--muted)" style="font:800 '+o.b2+'px Manrope,-apple-system,Segoe UI,sans-serif">best month</text>'}
  return s+'</svg>'}
function spark(vals){const n=vals.length;if(n<2)return '';const mx=Math.max(...vals),mn=Math.min(0,...vals),r=(mx-mn)||1;const pts=vals.map((v,i)=>[(i/(n-1)*100).toFixed(1),(28-((v-mn)/r)*26).toFixed(1)]);
  return '<svg class="spk" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="M'+pts.map(p=>p.join(' ')).join('L')+'" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
const CHIP={eBay:['--cb-crbg','--cb-cr'],TCGplayer:['--cb-blbg','--cb-bl']};

// ---------- widget bodies ----------
function body(w,ctx){
  const {keys,inP,mt}=ctx;
  if(w.kind==='sell'){const endK=keys[keys.length-1],upTo=pool().filter(e=>ym(e.date)<=endK),q=ty=>upTo.filter(e=>e.type===ty).reduce((a,e)=>a+e.qty,0),b=q('purchase'),s=q('sale'),r=q('refund'),pct=b?Math.min(100,Math.round(s/b*100)):0;
    return '<div class="bigline"><b>'+pct+'%</b><span>of the cards you’ve bought have sold</span></div><div class="st">'+[['Bought',b,100,'var(--cb-gry)'],['Sold',s,b?Math.min(100,s/b*100):0,'var(--cb-pos)'],['Refunded',r,b?Math.max(r?2:0,r/b*100):0,'var(--cb-neg)']].map(([l,n,wd,c])=>'<div class="pr"><div class="t"><span>'+l+'</span><span>'+n+(n===1?' card':' cards')+'</span></div><div class="bar"><i style="width:'+wd.toFixed(1)+'%;background:'+c+'"></i></div></div>').join('')+'</div>'}
  if(w.kind==='where'){const t=totals(inP),sp={};inP.filter(e=>e.type==='purchase').forEach(e=>sp[e.platform]=(sp[e.platform]||0)+e.amount);const rows=Object.keys(sp).map(k=>({k,v:sp[k]})).sort((a,b)=>b.v-a.v).slice(0,3);
    return '<div class="lr">'+(rows.length?rows.map(x=>{const c=CHIP[x.k]||['--cb-inkbg','--cb-ink'];return '<div class="r"><span class="ch" style="background:var('+c[0]+');color:var('+c[1]+')">'+esc(x.k[0])+'</span><span class="n">'+esc(x.k)+'<small>'+Math.round(x.v/Math.max(1,t.spent)*100)+'% of spend</small></span><span class="v">'+kshort(x.v)+'</span></div>'}).join(''):'<p class="eg">No purchases in this period.</p>')+'</div>'}
  if(w.kind==='win'){const key=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+e.no,buys={},sells={};pool().filter(e=>e.type==='purchase').forEach(e=>{(buys[key(e)]=buys[key(e)]||[]).push(e)});inP.filter(e=>e.type==='sale').forEach(e=>{(sells[key(e)]=sells[key(e)]||[]).push(e)});
    let win=null;Object.keys(sells).forEach(k=>{if(!buys[k])return;const b=buys[k].reduce((a,e)=>a+e.amount,0),s=sells[k].reduce((a,e)=>a+e.net,0);if(!win||s-b>win.g)win={g:s-b,b,s,e:sells[k][0]}});
    return win&&win.g>0?'<div class="bestc"><span class="th"><span class="card-ph" aria-hidden="true">'+esc(win.e.name[0])+'</span></span><div><b>'+esc(win.e.name)+'</b><em class="no">'+esc([win.e.no,win.e.set].filter(Boolean).join(' · ')||win.e.platform)+'</em><small>Bought '+kshort(win.b)+' · Sold '+kshort(win.s)+'</small><span class="amt">'+ksigned(win.g)+'</span></div></div>':'<p class="eg">No card bought and sold in this period yet.</p>'}
  if(w.kind==='budget'){const bk=keys.slice(-12),bt=bk.map(k=>totals(pool().filter(e=>ym(e.date)===k)).spent),bmax=Math.max(BUDGET*1.35,...bt),under=bt.filter(v=>v<=BUDGET).length;
    return '<div class="hero hero2" style="margin-bottom:10px"><b>'+under+'<i> of '+bk.length+'</i></b><span>months under budget</span></div><div class="bb" style="--H:84px"><div class="bars">'+bt.map((v,i)=>'<i class="'+(v>BUDGET?'o':'')+'" style="--v:'+(v/bmax).toFixed(3)+';transition-delay:'+(i*25)+'ms"></i>').join('')+'<div class="bl" style="bottom:calc(var(--H)*'+(BUDGET/bmax).toFixed(3)+')"></div></div><div class="mon">'+bk.map(k=>'<span>'+mLabel(k,{month:'narrow'})+'</span>').join('')+'</div></div><span class="eg">Example budget of $150 a month</span>'}
  const m=w.metric,M=METRICS[m];
  if(w.view==='number'){const v=val(m,inP),pv=val(m,inKeys(pool(),prevKeys(keys))),ch=pv?((v-pv)/Math.abs(pv))*100:null,up=ch!=null&&ch>=0,good=ch==null?null:(M.good==='up'?up:!up);
    const series=mt.map(x=>val(m,x.list));
    return '<div class="big num '+(m==='profit'?(v>=0?'g':'r'):'')+'">'+fmt(m,v)+'</div><div class="kd">'+(ch==null?'<span class="sm">No earlier period to compare</span>':'<span class="dl '+(good?'up':'dn')+'">'+(up?'▲':'▼')+' '+Math.abs(ch).toFixed(0)+'%</span><span class="sm">vs previous period</span>')+'</div><div class="kspk'+(m==='profit'&&v<0?' r':'')+'">'+spark(series)+'</div>'}
  if(w.view==='month'){const data=mt.map(x=>({k:x.k,v:val(m,x.list)}));const single=m!=='profit';
    const f=v=>(m==='profit'?'+':'')+fmt(m,v,true);
    return '<div class="pcd">'+chartSVG(data,640,232,{top:50,bottom:198,maxW:34,r:8,b1:17,b2:12.5,bt:22,gap:10,best:true,single,f,label:M.label+' by month'})+'</div><div class="pcm">'+chartSVG(data,330,160,{top:36,bottom:130,maxW:17,r:5,fs:10.5,b1:14,b2:10.5,bt:16,gap:7,best:true,single,f,label:M.label+' by month'})+'</div>'}
  if(w.view==='platform'){const g={};inP.forEach(e=>{(g[e.platform]=g[e.platform]||[]).push(e)});const rows=Object.keys(g).map(k=>({k,v:val(m,g[k])})).filter(r=>r.v!==0).sort((a,b)=>b.v-a.v).slice(0,5);const mx=Math.max(1,...rows.map(r=>Math.abs(r.v)));
    return rows.length?'<div class="hbars">'+rows.map(r=>'<div class="hr"><span class="l">'+esc(r.k)+'</span><span class="v num">'+fmt(m,r.v,true)+'</span><span class="t"><b style="width:'+Math.max(2,Math.abs(r.v)/mx*100).toFixed(1)+'%;background:'+(r.v<0?'var(--cb-neg)':'var(--cb-bl)')+'"></b></span></div>').join('')+'</div>':'<p class="eg">Nothing in this period.</p>'}
  const ty=m==='spent'?'purchase':'sale',score=e=>m==='fees'?e.amount-e.net:e.amount,list=inP.filter(e=>e.type===ty).sort((a,b)=>score(b)-score(a)).slice(0,5);
  return list.length?'<div class="tl">'+list.map((e,i)=>'<div class="tr"><span class="i">'+(i+1)+'</span><span class="n">'+esc(e.name)+'<small>'+esc(e.platform)+' · '+new Date(e.date+'T12:00:00').toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric'})+'</small></span><span class="v num">'+kshort(score(e))+'</span></div>').join('')+'</div>':'<p class="eg">Nothing in this period.</p>'}
function title(w){return w.kind!=='metric'?SPECIAL[w.kind]:w.view==='number'?METRICS[w.metric].label:w.view==='month'?METRICS[w.metric].label+' by month':w.view==='platform'?METRICS[w.metric].label+' by platform':(w.metric==='spent'?'Biggest purchases':w.metric==='fees'?'Most fees on a sale':'Biggest sales')}
function widgetHTML(w,ctx,i,forceSize){
  const cls=w.kind==='metric'?(w.view==='number'?'kpi':w.view==='month'?'pmw':'t4 lst'):w.kind==='sell'?'sell':w.kind==='win'?'t4 win':w.kind==='budget'?'t4 spend':'t4';
  const sz=forceSize||(phone.matches?(w.size==='S'?'pS':'pF'):'sz'+SIZES[w.size]);
  const tools='<div class="wt"><button type="button" class="drag" aria-label="Move '+esc(title(w))+'" title="Drag to move"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>'+
    '<div class="szs" role="group" aria-label="Size">'+allowed(w).map(s=>'<button type="button" data-size="'+s+'" aria-pressed="'+(w.size===s)+'" title="'+SIZE_NAMES[s]+'">'+s+'</button>').join('')+'</div>'+
    '<button type="button" class="mv" data-move="-1" aria-label="Move up">↑</button><button type="button" class="mv" data-move="1" aria-label="Move down">↓</button>'+
    '<button type="button" class="rm" aria-label="Remove '+esc(title(w))+'">✕</button></div>';
  return '<section class="w '+cls+' '+sz+'" data-id="'+w.id+'"><div class="wh"><h3 class="ttl" style="margin:0">'+esc(title(w))+'</h3><button type="button" class="wmore" aria-label="Options for '+esc(title(w))+'" aria-haspopup="true">⋯</button></div>'+body(w,ctx)+tools+'</section>'}

// ---------- render, with smooth reflow when the layout changes ----------
function rects(){const m={};$('simple').querySelectorAll('[data-id]').forEach(el=>m[el.dataset.id]=el.getBoundingClientRect());return m}
function ctxNow(){const keys=keysFor(period);return {keys,inP:inKeys(pool(),keys),mt:keys.map(k=>({k,list:pool().filter(e=>ym(e.date)===k)}))}}
function render(animateLayout){
  const before=animateLayout?rects():null,ctx=ctxNow();
  $('simple').innerHTML=layout.map((w,i)=>widgetHTML(w,ctx,i)).join('')+(editing?'<button type="button" class="addw '+(phone.matches?'pF':'sz4')+'" id="addw"><span class="pl">+</span><b>Add widget</b><small>Pick a metric and how to show it</small></button>':'');
  $('cb').classList.toggle('editing',editing);
  $('simple').querySelectorAll('svg rect[data-i]').forEach(r=>{const sec=r.closest('[data-id]'),w=layout.find(x=>x.id===sec.dataset.id);if(!w)return;const x=ctx.mt[+r.dataset.i],t=totals(x.list);
    const html='<b>'+mLabel(x.k,{month:'long',year:'numeric'})+'</b><br>'+METRICS[w.metric].label+' '+fmt(w.metric,val(w.metric,x.list))+(w.metric==='profit'?'<br>Sales '+money(t.sales)+' · Spent '+money(t.spent):'');
    const on=()=>{const b=r.getBoundingClientRect();showTip(html,b.left+b.width/2,b.top+30)};r.addEventListener('mouseenter',on);r.addEventListener('mouseleave',hideTip);r.addEventListener('click',()=>{if(editing)return;on();clearTimeout(r._t);r._t=setTimeout(hideTip,2200)})});
  if(before&&!calm.matches){$('simple').querySelectorAll('[data-id]').forEach(el=>{const a=before[el.dataset.id],b=el.getBoundingClientRect();
    if(!a){el.animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.7,.2,1)'});return}
    const dx=a.left-b.left,dy=a.top-b.top,sx=a.width/b.width,sy=a.height/b.height;if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(sx-1)<.01&&Math.abs(sy-1)<.01)return;
    el.animate([{transformOrigin:'0 0',transform:'translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+')'},{transformOrigin:'0 0',transform:'none'}],{duration:380,easing:'cubic-bezier(.2,.7,.2,1)'})})}
}
function grow(){const cb=$('cb');if(calm.matches)return;cb.classList.add('grow');void cb.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>cb.classList.remove('grow')))}
phone.addEventListener('change',()=>render(false));

// ---------- period and platform pickers ----------
function closeMenus(){document.querySelectorAll('.cbx .cb-menu').forEach(m=>{m.hidden=true});document.querySelectorAll('.cbx [aria-haspopup]').forEach(b=>b.setAttribute('aria-expanded','false'))}
function pickMenu(btn,menuEl,items,cur,onPick){
  btn.addEventListener('click',e=>{e.stopPropagation();const o=menuEl.hidden;closeMenus();if(!o)return;menuEl.innerHTML=items().map(([k,l])=>'<button type="button" role="menuitemradio" aria-checked="'+(k===cur())+'" data-k="'+esc(k)+'">'+esc(l)+'</button>').join('');menuEl.hidden=false;btn.setAttribute('aria-expanded','true')});
  menuEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;onPick(b.dataset.k,b.textContent);closeMenus()})}
pickMenu($('cb-per'),$('cb-menu'),()=>PERIODS,()=>period,(k,l)=>{period=k;$('cb-perl').textContent=l;render(false);grow()});
pickMenu($('cb-plat'),$('cb-pmenu'),()=>[['all','All platforms']].concat([...new Set(E.map(e=>e.platform))].sort().map(p=>[p,p])),()=>plat,(k,l)=>{plat=k;$('cb-platl').textContent=l;render(false);grow()});
document.addEventListener('click',e=>{if(!e.target.closest('.perwrap'))closeMenus()});

// ---------- customize ----------
function setEditing(on){editing=on;$('cb-edit').textContent=on?'Done':'Customize';$('cb-edit').classList.toggle('on',on);$('cb-reset').hidden=!on;render(true)}
$('cb-edit').addEventListener('click',()=>setEditing(!editing));
$('cb-reset').addEventListener('click',()=>{layout=JSON.parse(JSON.stringify(DEFAULT));save();render(true)});
$('simple').addEventListener('click',e=>{
  if(e.target.closest('#addw')){openAdd();return}
  const sec=e.target.closest('[data-id]');if(!sec)return;const i=layout.findIndex(w=>w.id===sec.dataset.id),w=layout[i];if(!w)return;
  const sb=e.target.closest('[data-size]');if(sb){w.size=sb.dataset.size;save();render(true);return}
  if(e.target.closest('.rm')){layout.splice(i,1);save();render(true);return}
  const mv=e.target.closest('[data-move]');if(mv){const j=i+(+mv.dataset.move);if(j<0||j>=layout.length)return;layout.splice(j,0,layout.splice(i,1)[0]);save();render(true);return}
  const more=e.target.closest('.wmore');if(more){e.stopPropagation();openWidgetMenu(more,w)}
});
// widget menu (⋯): size, change metric, duplicate, remove
function openWidgetMenu(btn,w){closeMenus();const m=$('wmenu');
  m.innerHTML='<div class="mh">Size</div><div class="msz">'+allowed(w).map(s=>'<button type="button" data-msize="'+s+'" aria-pressed="'+(w.size===s)+'">'+SIZE_NAMES[s]+'</button>').join('')+'</div>'+(w.kind==='metric'?'<button type="button" data-act="change">Change metric</button>':'')+'<button type="button" data-act="dup">Duplicate</button><button type="button" data-act="rm" class="danger">Remove</button>';
  const r=btn.getBoundingClientRect(),host=$('cb').getBoundingClientRect();m.hidden=false;m.style.top=(r.bottom-host.top+6)+'px';m.style.left=Math.max(8,Math.min(r.right-host.left-236,host.width-244))+'px';
  m.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;const i=layout.findIndex(x=>x.id===w.id);
    if(b.dataset.msize)w.size=b.dataset.msize;else if(b.dataset.act==='dup')layout.splice(i+1,0,Object.assign({},w,{id:'w'+(nid++)}));else if(b.dataset.act==='rm')layout.splice(i,1);else if(b.dataset.act==='change'){m.hidden=true;openAdd(w);return}
    m.hidden=true;save();render(true)}}
document.addEventListener('click',e=>{const wm=$('wmenu');if(!wm.hidden&&!e.target.closest('#wmenu')&&!e.target.closest('.wmore'))wm.hidden=true});
// drag to move (desktop): pick a widget up by its handle and drop it on another
let drag=null;
$('simple').addEventListener('pointerdown',e=>{const h=e.target.closest('.drag');if(!h||!editing)return;const sec=h.closest('[data-id]');e.preventDefault();h.setPointerCapture(e.pointerId);drag={id:sec.dataset.id,el:sec,x:e.clientX,y:e.clientY};sec.classList.add('lifted')});
$('simple').addEventListener('pointermove',e=>{if(!drag)return;drag.el.style.transform='translate('+(e.clientX-drag.x)+'px,'+(e.clientY-drag.y)+'px) scale(1.02)';
  const over=[...$('simple').querySelectorAll('[data-id]')].find(el=>{if(el===drag.el)return false;const r=el.getBoundingClientRect();return e.clientX>r.left&&e.clientX<r.right&&e.clientY>r.top&&e.clientY<r.bottom});
  $('simple').querySelectorAll('.drop').forEach(el=>el.classList.remove('drop'));if(over)over.classList.add('drop');drag.over=over?over.dataset.id:null});
function endDrag(){if(!drag)return;const d=drag;drag=null;d.el.classList.remove('lifted');$('simple').querySelectorAll('.drop').forEach(el=>el.classList.remove('drop'));
  if(d.over){d.el.style.transform='';const from=layout.findIndex(w=>w.id===d.id),to=layout.findIndex(w=>w.id===d.over);const [w]=layout.splice(from,1);layout.splice(to,0,w);save();render(true)}
  else{d.el.style.transition='transform .3s cubic-bezier(.2,.7,.2,1)';d.el.style.transform='';setTimeout(()=>{d.el.style.transition=''},320)}}
$('simple').addEventListener('pointerup',endDrag);$('simple').addEventListener('pointercancel',endDrag);

// ---------- add a widget: metric, then how to show it, then size, with a live preview ----------
const aw=$('aw');let draft=null,editingId=null;
function openAdd(existing){editingId=existing?existing.id:null;draft=existing?{metric:existing.metric,view:existing.view,size:existing.size}:{metric:'profit',view:'number',size:'S'};$('aw-h').textContent=existing?'Change widget':'Add a widget';$('aw-go').textContent=existing?'Save widget':'Add to board';drawAdd();aw.showModal()}
function drawAdd(){
  $('aw-metrics').innerHTML=Object.keys(METRICS).map(k=>'<button type="button" data-m="'+k+'" aria-pressed="'+(draft.metric===k)+'">'+METRICS[k].label+'</button>').join('');
  $('aw-views').innerHTML=Object.keys(VIEWS).map(k=>'<button type="button" data-v="'+k+'" aria-pressed="'+(draft.view===k)+'">'+VIEWS[k]+'</button>').join('');
  const w={id:'prev',kind:'metric',metric:draft.metric,view:draft.view,size:draft.size};const al=allowed(w);if(!al.includes(draft.size)){draft.size=al[0];w.size=draft.size}
  $('aw-sizes').innerHTML=al.map(s=>'<button type="button" data-s="'+s+'" aria-pressed="'+(draft.size===s)+'">'+SIZE_NAMES[s]+'</button>').join('');
  $('aw-prev').innerHTML='<div class="simple">'+widgetHTML(w,ctxNow(),0,'szF')+'</div>';
}
aw.addEventListener('click',e=>{if(e.target===aw){aw.close();return}const b=e.target.closest('button');if(!b)return;
  if(b.dataset.m){draft.metric=b.dataset.m;drawAdd()}else if(b.dataset.v){draft.view=b.dataset.v;drawAdd()}else if(b.dataset.s){draft.size=b.dataset.s;drawAdd()}
  else if(b.id==='aw-go'){if(editingId)Object.assign(layout.find(w=>w.id===editingId),draft);else layout.push(Object.assign({id:'w'+(nid++),kind:'metric'},draft));save();aw.close();render(true);
    if(!editingId){const els=$('simple').querySelectorAll('[data-id]');const el=els[els.length-1];if(el)setTimeout(()=>el.scrollIntoView({behavior:calm.matches?'auto':'smooth',block:'nearest'}),60)}}
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
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||cbx.hidden||aw.open)return;if(!$('wmenu').hidden){$('wmenu').hidden=true;return}if(!$('cb-menu').hidden||!$('cb-pmenu').hidden){closeMenus();return}if(editing){setEditing(false);return}close()});
