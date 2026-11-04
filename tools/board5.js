// ---------- Card Board v5: every widget at every size, on a grid of squares (preview) ----------
// The board is a grid of square-ish cells: 4 across on desktop and tablets, 2 across on phones.
// Small = 1 cell, Wide = 2 across, Large = 2 across x 2 tall, Extra large = the full width x 2 tall (desktop/tablet).
// Each metric has its own hand-made layout for each size. Charts are drawn at the exact pixel size of their box.
const PERIODS=[['l12','Last 12 months'],['ytd','This year'],['y2025','2025'],['all','All time']];
const SIZES=['S','M','L','X'],SIZE_NAMES={S:'Small',M:'Wide',L:'Large',X:'Extra large'},DIM={S:[1,1],M:[2,1],L:[2,2],X:[4,2]};
const CATALOG={
  profit:{t:'Profit',s:'Profit',d:'What you kept after fees, minus what you spent'},
  sales:{t:'Sales',s:'Sales',d:'Everything you sold, before fees'},
  spent:{t:'Spent',s:'Spent',d:'Everything you bought'},
  fees:{t:'Fees and shipping',s:'Fees',d:'What platforms and postage took from your sales'},
  month:{t:'Profit by month',s:'Best month',d:'Your best and worst months at a glance'},
  sell:{t:'How much of it sold',s:'Sold',d:'How many of the cards you bought have sold'},
  where:{t:'Where you buy',s:'Buy from',d:'Which platforms get most of your spending'},
  kept:{t:'What each platform kept',s:'Top fees',d:'Fees and shipping as a share of each sale'},
  win:{t:'Your biggest win',s:'Biggest win',d:'The card that made you the most'},
  budget:{t:'Spend vs budget',s:'Budget',d:'How many months you stayed under budget'}};
const DEFAULT=[['profit','S'],['sales','S'],['spent','S'],['fees','S'],['month','L'],['sell','M'],['where','S'],['win','S'],['budget','M'],['kept','M']].map(([k,size],i)=>({id:'d'+i,k,size}));
const LKEY='cb.layout.v3';
let layout=(()=>{try{const s=JSON.parse(localStorage.getItem(LKEY));if(Array.isArray(s)&&s.every(w=>w.id&&CATALOG[w.k]&&DIM[w.size]))return s}catch(e){}return JSON.parse(JSON.stringify(DEFAULT))})();
const save=()=>{try{localStorage.setItem(LKEY,JSON.stringify(layout))}catch(e){}};
const newId=()=>'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
let period='l12',plat='all',editing=false;
const BUDGET=15000; // example monthly budget ($150) until the budget setting exists
const phone=matchMedia('(max-width:600px)');
const units=()=>phone.matches?2:4;
const sizesNow=()=>phone.matches?['S','M','L']:SIZES;
const eff=s=>phone.matches&&s==='X'?'L':s; // on phones Extra large is the same as Large
const byId=id=>layout.find(w=>w.id===id);

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
const KCOL={sales:'var(--cb-pos)',spent:'var(--cb-bl)',fees:'var(--cb-gry)'};
function ctxNow(){const keys=keysFor(period),p=pool();return {keys,p,inP:inKeys(p,keys),mt:keys.map(k=>({k,list:p.filter(e=>ym(e.date)===k)})),cv:[]}}
const mShort=k=>mLabel(k,{month:'short',year:'numeric'});
const mLong=k=>mLabel(k,{month:'long',year:'numeric'});
// a big number that always fits its box: the font size comes from the box width and the number of characters
const bn=(txt,cls,mx)=>'<div class="bn num '+(cls||'')+'" style="--len:'+Math.max(4,String(txt).length)+(mx?';--mx:'+mx+'px':'')+'">'+txt+'</div>';
const cnt=(n,one,many)=>n+' '+(n===1?one:many);

// ---------- the site's tooltip ----------
let tipEl=null;
function tip(){if(!tipEl){tipEl=document.createElement('div');tipEl.className='cb-tip';tipEl.setAttribute('role','status');$('cb').appendChild(tipEl)}return tipEl}
function showTip(anchor,html){const t=tip(),host=$('cb').getBoundingClientRect(),r=anchor.getBoundingClientRect();t.innerHTML=html;const w=t.offsetWidth,h=t.offsetHeight;
  let x=Math.max(8,Math.min(host.width-w-8,r.left-host.left+r.width/2-w/2)),y=r.top-host.top-h-10;if(r.top-h-10<70)y=r.bottom-host.top+10;t.style.left=x+'px';t.style.top=y+'px';t.classList.add('show')}
function hideTip(){if(tipEl)tipEl.classList.remove('show')}
function bindTip(ev,anchor,fn){ev.setAttribute('data-tip','');
  ev.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!rz&&!drag)showTip(anchor,fn())});ev.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hideTip()});
  ev.addEventListener('focus',()=>{if(!rz&&!drag)showTip(anchor,fn())});ev.addEventListener('blur',hideTip);
  ev.addEventListener('click',e=>{if(rz||drag||editing)return;e.stopPropagation();showTip(anchor,fn())})}

// ---------- charts, drawn at the exact size of their box ----------
// cv() leaves a placeholder; fillCharts() measures it after layout and draws the SVG to fit.
function cv(ctx,spec){ctx.cv.push(spec);return '<div class="cv" data-cv="'+(ctx.cv.length-1)+'"></div>'}
function barsSVG(sp,W,H){
  const d=sp.data,n=d.length;if(!n||W<30||H<24)return '';
  const slot=W/n,labs=sp.labels&&H>=70,every=slot<15?3:slot<22?2:1,fs=slot>40?11.5:10.5;
  const top=sp.best&&H>=110?32:4,bottom=H-(labs?20:0)-1;
  const vals=d.map(x=>x.v),lim=sp.limit||0,pos=Math.max(0,lim,...vals),neg=Math.max(0,...vals.map(v=>-v));
  const avail=bottom-top,sc=avail/((pos+neg)||1),base=top+pos*sc,bw=Math.max(2,Math.min(sp.maxW||44,slot*.62));
  let best=-1,bv=-Infinity;vals.forEach((v,i)=>{if(d[i].on!==false&&v>bv){bv=v;best=i}});
  let s='<svg class="pc" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(sp.aria||'Chart')+'"><line x1="0" x2="'+W+'" y1="'+base.toFixed(1)+'" y2="'+base.toFixed(1)+'" stroke="var(--line)" stroke-width="1.5"/>',hit='';
  d.forEach((m,i)=>{const p=m.v,h=Math.abs(p)*sc,c=i*slot+slot/2,x=c-bw/2,r=Math.min(sp.r||8,bw/3,h*.9),R=r.toFixed(1),X=x.toFixed(1),X2=(x+bw).toFixed(1),B=base.toFixed(1);
    if(h>0.5){let f=sp.color||(p>=0?'var(--cb-pos)':'var(--cb-neg)');if(lim)f=p>lim?'var(--cb-neg)':'var(--cb-gry)';if(sp.best&&i===best&&p>0&&!lim)f=sp.color?f:'var(--green)';
      if(p>=0){const y=base-h;s+='<path data-i="'+i+'" class="bar" style="transition-delay:'+(i*18)+'ms" d="M'+X+' '+B+'V'+(y+r).toFixed(1)+'A'+R+' '+R+' 0 0 1 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+R+' '+R+' 0 0 1 '+X2+' '+(y+r).toFixed(1)+'V'+B+'Z" fill="'+f+'"/>'}
      else{const y=base+h;s+='<path data-i="'+i+'" class="bar n" style="transition-delay:'+(i*18)+'ms" d="M'+X+' '+B+'V'+(y-r).toFixed(1)+'A'+R+' '+R+' 0 0 0 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+R+' '+R+' 0 0 0 '+X2+' '+(y-r).toFixed(1)+'V'+B+'Z" fill="'+f+'"/>'}}
    if(labs&&i%every===0)s+='<text x="'+c.toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle" class="mt" style="font-size:'+fs+'px">'+mLabel(m.k,{month:slot>46?'short':'narrow'})+'</text>';
    hit+='<rect data-i="'+i+'" x="'+(i*slot).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'" tabindex="0" role="img" aria-label="'+esc(mLong(m.k)+': '+(sp.unit||'')+' '+money(p))+'"/>'});
  if(lim){const y=(base-lim*sc).toFixed(1);s+='<line x1="0" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="var(--text)" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="4 4"/>'}
  if(sp.best&&top>4&&best>-1&&bv>0){const c=Math.max(28,Math.min(W-28,best*slot+slot/2)),y=base-bv*sc;s+='<text x="'+c.toFixed(1)+'" y="'+Math.max(14,y-22).toFixed(1)+'" text-anchor="middle" fill="var(--green)" style="font:800 15px Manrope,-apple-system,Segoe UI,sans-serif">+'+kshort(bv)+'</text><text x="'+c.toFixed(1)+'" y="'+Math.max(28,y-8).toFixed(1)+'" text-anchor="middle" fill="var(--muted)" style="font:800 11.5px Manrope,-apple-system,Segoe UI,sans-serif">best month</text>'}
  return s+hit+'</svg>'}
function fillCharts(root,ctx){root.querySelectorAll('.cv[data-cv]').forEach(el=>{const sp=ctx.cv[+el.dataset.cv];if(!sp)return;const W=Math.floor(el.clientWidth),H=Math.floor(el.clientHeight);el.innerHTML=barsSVG(sp,W,H);
  const svg=el.querySelector('svg');if(!svg||!sp.tip)return;
  svg.querySelectorAll('rect[data-i]').forEach(rc=>{const i=+rc.dataset.i,bar=svg.querySelector('path[data-i="'+i+'"]');
    ['pointerenter','focus'].forEach(ev=>rc.addEventListener(ev,e=>{if(bar&&!rz&&(ev==='focus'||e.pointerType==='mouse'))bar.classList.add('hv')}));
    ['pointerleave','blur'].forEach(ev=>rc.addEventListener(ev,()=>{if(bar)bar.classList.remove('hv')}));
    bindTip(rc,bar||rc,()=>sp.tip(i))})})}
function spark(vals){const n=vals.length;if(n<2)return '';const mx=Math.max(...vals),mn=Math.min(0,...vals),r=(mx-mn)||1;const pts=vals.map((v,i)=>[(i/(n-1)*100).toFixed(1),(28-((v-mn)/r)*26).toFixed(1)]);
  return '<svg class="spk" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="M'+pts.map(p=>p.join(' ')).join('L')+'" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
const CHIP={eBay:['--cb-crbg','--cb-cr'],TCGplayer:['--cb-blbg','--cb-bl']};
const chip=p=>{const c=CHIP[p]||['--cb-inkbg','--cb-ink'];return '<span class="ch" style="background:var('+c[0]+');color:var('+c[1]+')">'+esc(p[0])+'</span>'};
const segCol=p=>CHIP[p]?'var('+CHIP[p][1]+')':'var(--cb-gry)';
// one bar split by share: the top two platforms, then everything else as "Other"
function shareBar(rows,total){if(!rows.length||!total)return '';const top=rows.slice(0,2),rest=total-top.reduce((a,x)=>a+x.v,0),segs=top.map(x=>({k:x.k,v:x.v}));if(rest>0)segs.push({k:'Other',v:rest});
  return '<div class="shb" role="img" aria-label="'+esc(segs.map(x=>x.k+' '+Math.round(x.v/total*100)+'%').join(', '))+'">'+segs.map(x=>'<i style="flex:'+x.v+';background:'+segCol(x.k)+'" title="'+esc(x.k)+'"></i>').join('')+'</div>'}
// list rows: big sizes open in place like the site's FAQs; small sizes show the same detail in a tooltip
const row=(inner,detail,open)=>'<div class="r" '+(open?'data-row':'data-tipd="'+esc(detail)+'"')+'>'+inner+'<div class="d">'+esc(detail)+'</div></div>';

// ---------- widget bodies: one layout per metric per size ----------
function body(k,ctx,s){
  const {keys,p,inP,mt}=ctx,t=totals(inP);
  if(KPI[k])return kpiBody(k,ctx,s,t);
  if(k==='month'){const data=mt.map(x=>({k:x.k,v:totals(x.list).profit,on:x.list.length>0})),tot=data.reduce((a,d)=>a+d.v,0),act=data.filter(d=>d.on),bestM=act.length?act.reduce((a,d)=>d.v>a.v?d:a):null;
    const tipf=i=>{const tt=totals(mt[i].list);return '<b>'+mLong(mt[i].k)+'</b>Sales '+kshort(tt.sales)+'<br>Spent '+kshort(tt.spent)+'<br>Profit <span class="'+(tt.profit>=0?'p':'l')+'">'+kshort(tt.profit)+'</span>'};
    const ch=o=>cv(ctx,Object.assign({data,tip:tipf,aria:'Profit by month',unit:'profit'},o));
    if(!act.length)return '<p class="eg">No entries in this period.</p>';
    if(s==='S')return '<div class="mS"><div class="cq">'+bn((bestM.v>=0?'+':'')+kshort(bestM.v),bestM.v>=0?'g':'r',30)+'</div><small class="cap">'+mShort(bestM.k)+'</small>'+ch({labels:false,maxW:14,r:3})+'</div>';
    const sum='<div class="msum"><span><small>Total</small><b class="num">'+money(tot)+'</b></span><span><small>Average month</small><b class="num">'+money(Math.round(tot/Math.max(1,data.length)))+'</b></span><span><small>Best month</small><b class="num">'+mShort(bestM.k)+'</b></span></div>';
    if(s==='M')return '<div class="fill">'+ch({labels:true,best:true,maxW:30,r:6})+'</div>';
    return '<div class="fill">'+ch({labels:true,best:true,maxW:s==='X'?46:34,r:8})+sum+'</div>'}
  if(k==='sell'){const endK=keys[keys.length-1],upTo=p.filter(e=>ym(e.date)<=endK),q=ty=>upTo.filter(e=>e.type===ty),qs=ty=>q(ty).reduce((a,e)=>a+e.qty,0),b=qs('purchase'),sd=qs('sale'),r=qs('refund'),pct=b?Math.min(100,Math.round(sd/b*100)):0;
    const spent=q('purchase').reduce((a,e)=>a+e.amount,0),made=q('sale').reduce((a,e)=>a+e.net,0);
    if(!b)return '<p class="eg">No purchases yet.</p>';
    const rows=[['Bought',b,100,'var(--cb-gry)','Spent '+kshort(spent)+' · about '+kshort(spent/b)+' each'],['Sold',sd,Math.min(100,sd/b*100),'var(--cb-pos)','Made back '+kshort(made)+(sd?' · about '+kshort(made/sd)+' each':'')],['Refunded',r,Math.max(r?2:0,r/b*100),'var(--cb-neg)',r+' returned · '+(r/b*100).toFixed(1)+'% of cards bought']];
    const prs=open=>rows.map(([l,n,wd,c,d])=>'<div class="pr" '+(open?'data-row':'data-tipd="'+esc(d)+'"')+'><div class="t"><span>'+l+'</span><span>'+cnt(n,'card','cards')+'</span></div><div class="bar"><i style="width:'+wd.toFixed(1)+'%;background:'+c+'"></i></div><div class="d">'+esc(d)+'</div></div>').join('');
    const hero='<div class="cq">'+bn(pct+'%','g',s==='S'?44:64)+'</div><small class="cap">of the cards you’ve bought have sold</small>';
    if(s==='S')return '<div class="sS"><div class="cq">'+bn(pct+'%','g',44)+'</div><small class="cap">of cards sold</small><div class="prog"><div class="bar"><i style="width:'+pct+'%"></i></div><small>'+sd+' of '+b+'</small></div></div>';
    if(s==='M')return '<div class="split"><div class="hz">'+hero+'</div><div class="st tight">'+prs(false)+'</div></div>';
    if(s==='L')return '<div class="col"><div class="hz">'+hero+'</div><div class="st">'+prs(true)+'</div></div>';
    return '<div class="split wide"><div class="hz">'+hero+'<div class="facts"><span><small>Spent</small><b class="num">'+money(spent)+'</b></span><span><small>Made back</small><b class="num">'+money(made)+'</b></span></div></div><div class="st">'+prs(true)+'</div></div>'}
  if(k==='where'){const sp={},n={};inP.filter(e=>e.type==='purchase').forEach(e=>{sp[e.platform]=(sp[e.platform]||0)+e.amount;n[e.platform]=(n[e.platform]||0)+e.qty});const rows=Object.keys(sp).map(x=>({k:x,v:sp[x],n:n[x]})).sort((a,b)=>b.v-a.v);
    if(!rows.length)return '<p class="eg">No purchases in this period.</p>';
    const pc=x=>Math.round(x.v/Math.max(1,t.spent)*100)+'% of spend',det=x=>cnt(x.n,'card','cards')+' · about '+kshort(x.v/x.n)+' each';
    const list=(m,open)=>'<div class="lr">'+rows.slice(0,m).map(x=>row(chip(x.k)+'<span class="n">'+esc(x.k)+'<small>'+pc(x)+'</small></span><span class="v">'+kshort(x.v)+'</span>',det(x),open)).join('')+'</div>';
    if(s==='S'){const x=rows[0];return '<div class="wS"><div class="who">'+chip(x.k)+'<b>'+esc(x.k)+'</b></div><div class="cq">'+bn(kshort(x.v),'',30)+'</div><small class="cap">'+pc(x)+'</small>'+shareBar(rows,t.spent)+'</div>'}
    if(s==='M')return list(3,false);
    if(s==='L')return '<div class="col">'+shareBar(rows,t.spent)+list(5,true)+'</div>';
    return '<div class="split wide"><div class="hz"><small class="cap">Spent across '+cnt(rows.length,'platform','platforms')+'</small><div class="cq">'+bn(money(t.spent),'',44)+'</div>'+shareBar(rows,t.spent)+'</div>'+list(6,true)+'</div>'}
  if(k==='kept'){const g={};inP.filter(e=>e.type==='sale').forEach(e=>{const o=g[e.platform]||(g[e.platform]={s:0,f:0,n:0});o.s+=e.amount;o.f+=e.amount-e.net;o.n++});
    const rows=Object.keys(g).filter(x=>g[x].s>0).map(x=>({k:x,pct:g[x].f/g[x].s*100,f:g[x].f,n:g[x].n})).sort((a,b)=>b.pct-a.pct),mx=Math.max(1,...rows.map(r=>r.pct));
    if(!rows.length)return '<p class="eg">No sales in this period.</p>';
    const det=x=>kshort(x.f)+' in fees and shipping on '+cnt(x.n,'sale','sales');
    const list=(m,open,cls)=>'<div class="lr kl '+(cls||'')+'">'+rows.slice(0,m).map(x=>row(chip(x.k)+'<span class="n">'+esc(x.k)+'<small><i class="kb2"><b style="width:'+(x.pct/mx*100).toFixed(1)+'%"></b></i></small></span><span class="v">'+x.pct.toFixed(1)+'%</span>',det(x),open)).join('')+'</div>';
    if(s==='S'){const x=rows[0];return '<div class="wS"><div class="who">'+chip(x.k)+'<b>'+esc(x.k)+'</b></div><div class="cq">'+bn(x.pct.toFixed(1)+'%','',34)+'</div><small class="cap">of each '+esc(x.k)+' sale</small></div>'}
    if(s==='M')return list(3,false);
    if(s==='L')return list(5,true);
    return list(6,true,'two')}
  if(k==='win'){const key=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+e.no,buys={},sells={};p.filter(e=>e.type==='purchase').forEach(e=>{(buys[key(e)]=buys[key(e)]||[]).push(e)});inP.filter(e=>e.type==='sale').forEach(e=>{(sells[key(e)]=sells[key(e)]||[]).push(e)});
    const wins=Object.keys(sells).filter(x=>buys[x]).map(x=>{const b=buys[x].reduce((a,e)=>a+e.amount,0),sv=sells[x].reduce((a,e)=>a+e.net,0);return {g:sv-b,b,s:sv,e:sells[x][0]}}).filter(w=>w.g>0).sort((a,b)=>b.g-a.g);
    if(!wins.length)return '<p class="eg">No card bought and sold in this period yet.</p>';const w=wins[0];
    const art='<span class="art" aria-hidden="true">'+esc(w.e.name[0])+'</span>',meta=esc([w.e.no,w.e.set].filter(Boolean).join(' · ')||w.e.platform);
    const also=m=>wins.length>1?'<div class="alsoup"><p class="mh2">Also up</p>'+wins.slice(1,m+1).map(x=>'<div class="mr"><span>'+esc(x.e.name)+'</span><b class="num">'+ksigned(x.g)+'</b></div>').join('')+'</div>':'';
    if(s==='S')return '<div class="winS">'+art+'<div class="wtx"><div class="cq">'+bn(ksigned(w.g),'g',28)+'</div><b class="nm">'+esc(w.e.name)+'</b><small>Bought '+kshort(w.b)+' · Sold '+kshort(w.s)+'</small></div></div>';
    const hero='<div class="bestc">'+art+'<div class="wtx"><b class="nm">'+esc(w.e.name)+'</b><em class="no">'+meta+'</em><small>Bought '+kshort(w.b)+' · Sold '+kshort(w.s)+'</small><span class="amt num">'+ksigned(w.g)+'</span></div></div>';
    if(s==='M')return hero;
    if(s==='L')return '<div class="col">'+hero+also(3)+'</div>';
    return '<div class="split wide">'+hero+also(5)+'</div>'}
  if(k==='budget'){const bk=keys.slice(-12),bt=bk.map(x=>totals(p.filter(e=>ym(e.date)===x)).spent),under=bt.filter(v=>v<=BUDGET).length,now=bt[bt.length-1]||0;
    const data=bk.map((x,i)=>({k:x,v:bt[i]})),tipf=i=>{const d=BUDGET-bt[i];return '<b>'+mLong(bk[i])+'</b>Spent '+kshort(bt[i])+' of '+kshort(BUDGET)+'<br><span class="'+(d>=0?'p':'l')+'">'+kshort(Math.abs(d))+(d>=0?' under':' over')+'</span>'};
    const ch=o=>cv(ctx,Object.assign({data,limit:BUDGET,tip:tipf,aria:'Spending by month against a $150 budget',unit:'spent'},o));
    const hero='<div class="bh"><b class="num">'+under+'<i> of '+bk.length+'</i></b><small class="cap">months under budget</small></div>';
    const note='<span class="eg">Example budget of $150 a month</span>';
    if(s==='S')return '<div class="bS">'+hero.replace('months under budget','under budget')+ch({labels:false,maxW:12,r:3})+'</div>';
    if(s==='M')return '<div class="split"><div class="hz">'+hero+'</div>'+ch({labels:true,maxW:18,r:4})+'</div>';
    const thisM='<div class="facts"><span><small>This month</small><b class="num">'+kshort(now)+' of '+kshort(BUDGET)+'</b></span></div>';
    if(s==='L')return '<div class="col">'+hero+ch({labels:true,maxW:24,r:5})+note+'</div>';
    return '<div class="split wide"><div class="hz">'+hero+thisM+note+'</div>'+ch({labels:true,maxW:36,r:7})+'</div>'}
  return ''}
function kpiBody(k,ctx,s,t){
  const {keys,p,inP,mt}=ctx,v=KPI[k](t),pv=KPI[k](totals(inKeys(p,prevKeys(keys)))),chg=pv?((v-pv)/Math.abs(pv))*100:null,up=chg!=null&&chg>=0,good=chg==null?null:(GOOD[k]==='up'?up:!up);
  const series=mt.map(x=>KPI[k](totals(x.list))),bi=series.reduce((a,x,i)=>x>series[a]?i:a,0);
  const sub=k==='profit'?cnt(t.n,'entry','entries'):k==='sales'?cnt(inP.filter(e=>e.type==='sale').length,'sale','sales'):k==='spent'?cnt(inP.filter(e=>e.type==='purchase').length,'purchase','purchases'):(t.sales?(t.fees/t.sales*100).toFixed(1):'0.0')+'% of sales';
  const cls=k==='profit'?(v>=0?'g':'r'):'',dl=chg==null?'<span class="sm">'+sub+'</span>':'<span class="dl '+(good?'up':'dn')+'">'+(up?'▲':'▼')+' '+Math.abs(chg).toFixed(0)+'%</span><span class="sm">vs previous period</span>';
  const spk='<div class="kspk'+(k==='profit'?(v<0?' r':''):' mu')+'">'+spark(series)+'</div>';
  const nm=CATALOG[k].t.toLowerCase(),tipf=i=>{const tt=totals(mt[i].list);return '<b>'+mLong(mt[i].k)+'</b>'+CATALOG[k].t+' <span class="'+(k==='profit'?(tt.profit>=0?'p':'l'):'')+'">'+kshort(KPI[k](tt))+'</span>'};
  const bars=o=>cv(ctx,Object.assign({data:mt.map((x,i)=>({k:x.k,v:series[i],on:x.list.length>0})),color:KCOL[k],tip:tipf,aria:CATALOG[k].t+' by month',unit:nm},o));
  const avg=money(Math.round(series.reduce((a,x)=>a+x,0)/Math.max(1,series.length)));
  if(s==='S')return '<div class="kS"><div class="cq">'+bn(money(v),cls,34)+'</div><div class="kd">'+dl+'</div>'+spk+'</div>';
  if(s==='M')return '<div class="split"><div class="hz"><div class="cq">'+bn(money(v),cls,40)+'</div><div class="kd">'+dl+'</div><small class="cap">'+sub+'</small></div>'+spk+'</div>';
  const facts='<div class="facts"><span><small>Average month</small><b class="num">'+avg+'</b></span><span><small>Best month</small><b class="num">'+mShort(mt[bi].k)+'</b></span>'+(s==='X'?'<span><small>'+(k==='fees'?'Share of sales':'Count')+'</small><b class="num">'+(k==='fees'?sub.replace(' of sales',''):sub)+'</b></span>':'')+'</div>';
  if(s==='L')return '<div class="col"><div class="cq">'+bn(money(v),cls,48)+'</div><div class="kd">'+dl+'</div>'+bars({labels:true,maxW:26,r:6})+facts+'</div>';
  return '<div class="split wide"><div class="hz"><div class="cq">'+bn(money(v),cls,56)+'</div><div class="kd">'+dl+'</div>'+facts+'</div>'+bars({labels:true,maxW:40,r:8})+'</div>'}

const GRIP='<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M13 5L5 13M13 9.5L9.5 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
function widgetHTML(w,ctx,extra){const s=eff(w.size),t=CATALOG[w.k].t,tt=s==='S'?CATALOG[w.k].s:t;
  return '<section class="w wq sz'+w.size+' e'+s+' k-'+w.k+(extra?' '+extra:'')+'" data-id="'+w.id+'" data-k="'+w.k+'" aria-label="'+esc(t)+', '+SIZE_NAMES[s]+'"><div class="wh"><h3 class="ttl" title="'+esc(t)+'">'+tt+'</h3><button type="button" class="wmore" aria-label="Options for '+t+'" aria-haspopup="true">⋯</button></div><div class="wb">'+body(w.k,ctx,s)+'</div>'+
    '<button type="button" class="rm" aria-label="Remove '+t+'"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>'+
    '<button type="button" class="grip" aria-label="Resize '+t+'. Now '+SIZE_NAMES[s]+'. Arrow keys change the size." title="Drag to resize">'+GRIP+'</button></section>'}

// ---------- interactions inside widgets, matching the site ----------
function wire(root,ctx){
  fillCharts(root,ctx);
  root.querySelectorAll('[data-tipd]').forEach(el=>{el.tabIndex=0;bindTip(el,el,()=>esc(el.dataset.tipd))});
  // tap-to-open rows, one open at a time per widget, like the site's FAQs
  (root.matches&&root.matches('.w')?[root]:[...root.querySelectorAll('.w')]).forEach(sec=>{const list=[...sec.querySelectorAll('[data-row]')];list.forEach(el=>{el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-expanded','false');
    const tog=()=>{if(rz||drag||editing)return;const o=el.getAttribute('aria-expanded')==='true';list.forEach(x=>x.setAttribute('aria-expanded','false'));el.setAttribute('aria-expanded',!o)};
    el.addEventListener('click',tog);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog()}})})});
}

// ---------- render, with smooth reflow ----------
function rects(){const m={};$('simple').querySelectorAll('.w[data-id]').forEach(el=>m[el.dataset.id]=el.getBoundingClientRect());return m}
function flip(before,skip){if(calm.matches)return;$('simple').querySelectorAll('.w[data-id]').forEach(el=>{if(el.dataset.id===skip)return;const a=before[el.dataset.id],b=el.getBoundingClientRect();
  if(!a){el.animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.7,.2,1)'});return}
  const dx=a.left-b.left,dy=a.top-b.top;if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1)return;
  el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{duration:380,easing:'cubic-bezier(.2,.7,.2,1)'})})}
function render(animate){
  const before=animate?rects():null,ctx=ctxNow();hideTip();
  $('simple').innerHTML=layout.map(w=>widgetHTML(w,ctx)).join('')+(editing?'<button type="button" class="addw szS" id="addw"><span class="pl">+</span><b>Add widget</b></button>':'');
  $('cb').classList.toggle('editing',editing);wire($('simple'),ctx);
  if(before)flip(before)}
function grow(){const cb=$('cb');if(calm.matches)return;cb.classList.add('grow');void cb.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>cb.classList.remove('grow')))}
phone.addEventListener('change',()=>{if(!cbx.hidden)render(false)});
let rsT=0,lastW=innerWidth;addEventListener('resize',()=>{if(cbx.hidden||rz||drag||Math.abs(innerWidth-lastW)<2)return;clearTimeout(rsT);rsT=setTimeout(()=>{lastW=innerWidth;render(false)},120)});

// ---------- period and platform pickers ----------
function closeMenus(){document.querySelectorAll('.cbx .cb-menu').forEach(m=>{m.hidden=true});document.querySelectorAll('.cbx [aria-haspopup]').forEach(b=>b.setAttribute('aria-expanded','false'))}
function pickMenu(btn,menuEl,items,cur,onPick){
  btn.addEventListener('click',e=>{e.stopPropagation();hideTip();const o=menuEl.hidden;closeMenus();if(!o)return;menuEl.innerHTML=items().map(([k,l])=>'<button type="button" role="menuitemradio" aria-checked="'+(k===cur())+'" data-k="'+esc(k)+'">'+esc(l)+'</button>').join('');menuEl.hidden=false;btn.setAttribute('aria-expanded','true')});
  menuEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;onPick(b.dataset.k,b.textContent);closeMenus()})}
pickMenu($('cb-per'),$('cb-menu'),()=>PERIODS,()=>period,(k,l)=>{period=k;$('cb-perl').textContent=l;render(false);grow()});
pickMenu($('cb-plat'),$('cb-pmenu'),()=>[['all','All platforms']].concat([...new Set(E.map(e=>e.platform))].sort().map(p=>[p,p])),()=>plat,(k,l)=>{plat=k;$('cb-platl').textContent=l;render(false);grow()});
$('cb-acct').addEventListener('click',e=>{e.stopPropagation();hideTip();const m=$('cb-amenu'),o=m.hidden;closeMenus();if(o){m.hidden=false;$('cb-acct').setAttribute('aria-expanded','true')}});
document.addEventListener('click',e=>{if(!e.target.closest('.perwrap')&&!e.target.closest('#wmenu'))closeMenus();if(!e.target.closest('#cb [data-tip]'))hideTip()});

// ---------- customize ----------
function setEditing(on){editing=on;$('cb-edit').textContent=on?'Done':'Customize';$('cb-edit').classList.toggle('on',on);$('cb-reset').hidden=!on;render(true)}
$('cb-edit').addEventListener('click',()=>setEditing(!editing));
$('cb-reset').addEventListener('click',()=>{layout=JSON.parse(JSON.stringify(DEFAULT));save();render(true)});
function removeWidget(id){const el=$('simple').querySelector('.w[data-id="'+id+'"]'),i=layout.findIndex(w=>w.id===id);if(i<0)return;layout.splice(i,1);save();
  if(!el||calm.matches){render(true);return}
  el.style.pointerEvents='none';el.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.9)'}],{duration:180,easing:'ease-in',fill:'forwards'}).onfinish=()=>render(true)}
function moveWidget(id,d){const i=layout.findIndex(w=>w.id===id),j=i+d;if(i<0||j<0||j>=layout.length)return;layout.splice(j,0,layout.splice(i,1)[0]);save();render(true)}
$('simple').addEventListener('click',e=>{
  if(justDragged){justDragged=false;e.stopPropagation();return}
  if(e.target.closest('#addw')){openAdd();return}
  const sec=e.target.closest('.w[data-id]');if(!sec)return;const w=byId(sec.dataset.id);if(!w)return;
  if(e.target.closest('.rm')){removeWidget(w.id);return}
  const more=e.target.closest('.wmore');if(more){e.stopPropagation();openWidgetMenu(more,w)}
});
// swap one widget's content for its layout at a new size, in place
function rebuild(id){const w=byId(id),el=$('simple').querySelector('.w[data-id="'+id+'"]');if(!w||!el)return null;const ctx=ctxNow(),tmp=document.createElement('div');tmp.innerHTML=widgetHTML(w,ctx);const nw=tmp.firstChild;el.replaceWith(nw);wire(nw,ctx);return nw}
function setSize(id,s){const w=byId(id);if(!w||w.size===s)return;const before=rects();w.size=s;save();const el=rebuild(id);flip(before);
  if(el&&!calm.matches)el.animate([{opacity:.4},{opacity:1}],{duration:260,easing:'ease-out'})}
// widget menu (⋯): size, move, remove
function openWidgetMenu(btn,w){closeMenus();hideTip();const m=$('wmenu'),cur=eff(w.size);
  m.innerHTML='<div class="mh">Size</div><div class="msz">'+sizesNow().map(s=>'<button type="button" data-msize="'+s+'" aria-pressed="'+(cur===s)+'">'+SIZE_NAMES[s]+'</button>').join('')+'</div><button type="button" data-act="up">Move earlier</button><button type="button" data-act="down">Move later</button><button type="button" data-act="rm" class="danger">Remove from board</button>';
  const r=btn.getBoundingClientRect(),host=$('cb').getBoundingClientRect();m.hidden=false;m.style.top=(r.bottom-host.top+6)+'px';m.style.left=Math.max(8,Math.min(r.right-host.left-256,host.width-264))+'px';
  m.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;m.hidden=true;if(b.dataset.msize){setSize(w.id,b.dataset.msize);return}
    if(b.dataset.act==='up')moveWidget(w.id,-1);else if(b.dataset.act==='down')moveWidget(w.id,1);else removeWidget(w.id)}}

// ---------- corner resize: width and height together ----------
// Grab anywhere near the corner. The widget's content steps aside and a clean card follows your finger or cursor over
// a faint grid of cells, with a dashed outline showing exactly which size it will land on. Nothing else moves while
// you drag. On release the card glides into place, the board settles once, and the new layout fades in.
let rz=null,drag=null,justDragged=false;
function gridSpec(){const g=$('simple'),r=g.getBoundingClientRect(),cs=getComputedStyle(g),gap=parseFloat(cs.columnGap)||14,rgap=parseFloat(cs.rowGap)||gap,u=units(),col=(r.width-(u-1)*gap)/u,row=parseFloat(cs.gridAutoRows)||184;return {r,gap,rgap,u,col,row}}
const pxW=(g,c)=>c*g.col+(c-1)*g.gap,pxH=(g,n)=>n*g.row+(n-1)*g.rgap;
function box(g,s){let [c,r]=DIM[s];c=Math.min(c,g.u);return [pxW(g,c),pxH(g,r)]}
// nearest size to the dragged corner, measured in cells; the current pick gets a small head start so it never flickers
function snap(g,w,h,cur){let best=cur,bd=Infinity;sizesNow().forEach(s=>{const [W,H]=box(g,s),d=Math.hypot((w-W)/g.col,(h-H)/g.row)-(s===cur?.18:0);if(d<bd){bd=d;best=s}});return best}
function rzLayers(g,rowsNeeded){const sim=$('simple');let ov=$('rzgrid');if(!ov){ov=document.createElement('div');ov.id='rzgrid';ov.className='rzgrid';ov.setAttribute('aria-hidden','true');sim.appendChild(ov)}
  ov.style.gridTemplateColumns='repeat('+g.u+',minmax(0,1fr))';ov.style.gridAutoRows=g.row+'px';ov.style.gap=g.rgap+'px '+g.gap+'px';ov.innerHTML='<i></i>'.repeat(g.u*rowsNeeded);
  const o=document.createElement('div');o.className='rzo';o.setAttribute('aria-hidden','true');const c=document.createElement('div');c.className='rzg';c.setAttribute('aria-hidden','true');sim.appendChild(o);sim.appendChild(c);return {o,c}}
function placeRz(){if(!rz)return;rz.raf=0;const g=rz.g,W=g.r.width,x=rz.x,y=rz.y,s=snap(g,x,y,rz.s||rz.s0),[sw,sh]=box(g,s);
  rz.c.style.width=x+'px';rz.c.style.height=y+'px';rz.c.style.left=Math.max(0,Math.min(rz.left,W-x))+'px';
  rz.o.style.width=sw+'px';rz.o.style.height=sh+'px';rz.o.style.left=Math.max(0,Math.min(rz.left,W-sw))+'px';
  if(rz.s!==s){rz.s=s;rz.c.querySelector('.rzs').textContent=SIZE_NAMES[s]}}
// keep the page scrolling when a finger or cursor nears the top or bottom edge
function edgeScroll(clientY){const z=56,sp=clientY>innerHeight-z?Math.min(14,(clientY-(innerHeight-z))/3):clientY<z+60?-Math.min(14,(z+60-clientY)/3):0;return sp}
function scrollLoop(){const st=rz||drag;if(!st)return;if(st.vy){cbx.scrollTop+=st.vy;if(rz){rz.y=clampH(rz.h0+(rz.cy-rz.sy)+(cbx.scrollTop-rz.st0));if(!rz.raf)rz.raf=requestAnimationFrame(placeRz)}if(drag)moveDrag(drag.cx,drag.cy)}st.loop=requestAnimationFrame(scrollLoop)}
const clampH=v=>Math.max(pxH(rz.g,1)*.75,Math.min(pxH(rz.g,2)+rz.g.row*.4,v));
$('simple').addEventListener('pointerdown',e=>{
  if(!editing||e.button>0)return;
  const gr=e.target.closest('.grip');
  if(gr){const sec=gr.closest('.w[data-id]'),g=gridSpec(),r=sec.getBoundingClientRect();e.preventDefault();$('simple').setPointerCapture(e.pointerId);hideTip();
    const left=r.left-g.r.left,top=r.top-g.r.top,room=Math.max(60,(e.pointerType==='touch'?innerWidth-8:innerWidth-16)-e.clientX),rowsNeeded=Math.ceil((g.r.height+g.rgap)/(g.row+g.rgap))+2;
    const {o,c}=rzLayers(g,rowsNeeded);c.innerHTML='<span class="ttl">'+CATALOG[sec.dataset.k].t+'</span><span class="rzs"></span>';[o,c].forEach(el=>{el.style.top=top+'px'});
    const w=byId(sec.dataset.id);
    rz={id:sec.dataset.id,el:sec,g,o,c,left,top,sx:e.clientX,sy:e.clientY,cy:e.clientY,st0:cbx.scrollTop,w0:r.width,h0:r.height,x:r.width,y:r.height,s:null,s0:eff(w.size),raf:0,vy:0,f:Math.max(1,(g.r.width-r.width)/room)};
    placeRz();sec.classList.add('rz-src');$('cb').classList.add('rzing');rz.loop=requestAnimationFrame(scrollLoop);return}
  // move: drag the widget itself. Mouse: start after a few pixels. Touch: press and hold, so the page still scrolls.
  const sec=e.target.closest('.w[data-id]');if(!sec||e.target.closest('.rm,.grip'))return;
  const pend={id:sec.dataset.id,el:sec,x:e.clientX,y:e.clientY,cx:e.clientX,cy:e.clientY,pid:e.pointerId,touch:e.pointerType!=='mouse',t:0};
  if(pend.touch)pend.t=setTimeout(()=>{if(pending===pend)startDrag(pend)},280);
  pending=pend});
let pending=null;
function startDrag(pd){pending=null;try{$('simple').setPointerCapture(pd.pid)}catch(e){}hideTip();const r=pd.el.getBoundingClientRect();
  drag={id:pd.id,el:pd.el,x:pd.x,y:pd.y,cx:pd.cx,cy:pd.cy,st0:cbx.scrollTop,vy:0,over:null};pd.el.classList.add('lifted');$('cb').classList.add('dragging');moveDrag(pd.cx,pd.cy);drag.loop=requestAnimationFrame(scrollLoop)}
function moveDrag(cx,cy){if(!drag)return;drag.cx=cx;drag.cy=cy;const dy=cy-drag.y+(cbx.scrollTop-drag.st0);drag.el.style.transform='translate('+(cx-drag.x)+'px,'+dy+'px) scale(1.03)';
  const over=[...$('simple').querySelectorAll('.w[data-id]')].find(el=>{if(el===drag.el)return false;const r=el.getBoundingClientRect();return cx>r.left&&cx<r.right&&cy>r.top&&cy<r.bottom});
  const id=over?over.dataset.id:null;if(id!==drag.over){$('simple').querySelectorAll('.drop').forEach(el=>el.classList.remove('drop'));if(over)over.classList.add('drop');drag.over=id}}
// stop the page from scrolling under a finger once a widget is lifted
document.addEventListener('touchmove',e=>{if(drag||rz)e.preventDefault()},{passive:false});
$('simple').addEventListener('pointermove',e=>{
  if(rz){const g=rz.g;rz.cy=e.clientY;rz.vy=edgeScroll(e.clientY);rz.x=Math.max(pxW(g,1)*.75,Math.min(g.r.width,rz.w0+(e.clientX-rz.sx)*rz.f));rz.y=clampH(rz.h0+(e.clientY-rz.sy)+(cbx.scrollTop-rz.st0));if(!rz.raf)rz.raf=requestAnimationFrame(placeRz);return}
  if(pending&&e.pointerId===pending.pid){const d=Math.hypot(e.clientX-pending.x,e.clientY-pending.y);pending.cx=e.clientX;pending.cy=e.clientY;
    if(pending.touch){if(d>9){clearTimeout(pending.t);pending=null}}else if(d>5){e.preventDefault();startDrag(pending)}return}
  if(drag){drag.vy=edgeScroll(e.clientY);moveDrag(e.clientX,e.clientY)}});
function endPointer(){
  if(pending){clearTimeout(pending.t);pending=null}
  if(rz){const r=rz;rz=null;if(r.raf)cancelAnimationFrame(r.raf);cancelAnimationFrame(r.loop);placeRzFinal(r);return}
  if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(d.loop);justDragged=true;setTimeout(()=>{justDragged=false},0);
  $('cb').classList.remove('dragging');$('simple').querySelectorAll('.drop').forEach(el=>el.classList.remove('drop'));
  if(d.over){const before=rects();const from=layout.findIndex(w=>w.id===d.id),to=layout.findIndex(w=>w.id===d.over);const [w]=layout.splice(from,1);layout.splice(to,0,w);save();
    const at=d.el.getBoundingClientRect();before[d.id]=at;d.el.classList.remove('lifted');d.el.style.transform='';render(false);flip(before)}
  else{d.el.style.transition='transform .3s cubic-bezier(.2,.7,.2,1)';d.el.style.transform='';d.el.classList.remove('lifted');setTimeout(()=>{d.el.style.transition=''},320)}}
function placeRzFinal(r){
  const g=r.g,size=r.s||r.s0,w=byId(r.id),before=rects();$('cb').classList.remove('rzing');
  if(eff(w.size)!==size)w.size=size;save();
  const el=rebuild(r.id);if(!el){r.c.remove();r.o.remove();return}el.classList.add('rz-src');
  const gr=$('simple').getBoundingClientRect(),f=el.getBoundingClientRect();flip(before,r.id);
  const finish=()=>{r.c.remove();r.o.remove();el.classList.remove('rz-src');if(!calm.matches){el.classList.add('rz-in');setTimeout(()=>el.classList.remove('rz-in'),320)}};
  r.o.style.opacity='0';
  if(calm.matches){finish();return}
  r.c.classList.add('settle');void r.c.offsetWidth;r.c.style.left=(f.left-gr.left)+'px';r.c.style.top=(f.top-gr.top)+'px';r.c.style.width=f.width+'px';r.c.style.height=f.height+'px';
  setTimeout(finish,340)}
$('simple').addEventListener('pointerup',endPointer);$('simple').addEventListener('pointercancel',endPointer);
$('simple').addEventListener('contextmenu',e=>{if(editing)e.preventDefault()});
// keyboard: arrow keys on the grip step through the sizes
$('simple').addEventListener('keydown',e=>{const gp=e.target.closest('.grip');if(!gp)return;const id=gp.closest('.w[data-id]').dataset.id,w=byId(id),L=sizesNow(),i=L.indexOf(eff(w.size));
  let j=-1;if((e.key==='ArrowRight'||e.key==='ArrowDown')&&i<L.length-1)j=i+1;if((e.key==='ArrowLeft'||e.key==='ArrowUp')&&i>0)j=i-1;
  if(j>-1){e.preventDefault();setSize(id,L[j]);const ng=$('simple').querySelector('.w[data-id="'+id+'"] .grip');if(ng)ng.focus()}});

// ---------- add a widget: any of the ten, at any size, with a live preview ----------
const aw=$('aw');let draft=null;
function openAdd(){draft={k:'profit',size:'S'};drawAdd();aw.showModal();drawPreview()}
function drawAdd(){
  $('aw-list').innerHTML=Object.keys(CATALOG).map(k=>'<button type="button" class="opt" data-pick="'+k+'" aria-pressed="'+(draft.k===k)+'"><b>'+CATALOG[k].t+'</b><span>'+CATALOG[k].d+'</span></button>').join('');
  $('aw-sizes').innerHTML=sizesNow().map(s=>'<button type="button" data-s="'+s+'" aria-pressed="'+(draft.size===s)+'">'+SIZE_NAMES[s]+'</button>').join('');
  $('aw-go').textContent='Add '+CATALOG[draft.k].t}
// the preview is the real widget at its real size on this screen, scaled down only if the panel is narrower
function drawPreview(){const g=gridSpec(),[W,H]=box(g,draft.size),host=$('aw-prev'),ctx=ctxNow();host.innerHTML='<div class="pvbox"><div class="pvin">'+widgetHTML({id:'pv',k:draft.k,size:draft.size},ctx,'pv')+'</div></div>';
  const avail=host.clientWidth||W,sc=Math.min(1,avail/W),inn=host.querySelector('.pvin'),el=inn.firstChild;el.style.width=W+'px';el.style.height=H+'px';inn.style.transform='scale('+sc+')';inn.style.left=Math.max(0,(avail-W*sc)/2)+'px';host.querySelector('.pvbox').style.height=(H*sc)+'px';wire(inn,ctx)}
aw.addEventListener('click',e=>{if(e.target===aw){aw.close();return}const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pick){draft.k=b.dataset.pick;drawAdd();drawPreview()}else if(b.dataset.s){draft.size=b.dataset.s;drawAdd();drawPreview()}
  else if(b.id==='aw-go'){const w={id:newId(),k:draft.k,size:draft.size};layout.push(w);save();aw.close();render(true);const el=$('simple').querySelector('.w[data-id="'+w.id+'"]');if(el)setTimeout(()=>el.scrollIntoView({behavior:calm.matches?'auto':'smooth',block:'nearest'}),60)}
  else if(b.hasAttribute('data-close'))aw.close()});

// ---------- the morph: Insights panel grows into the full page, and shrinks back into it ----------
const cbx=$('cbx'),ins=$('ins'),xb=$('expand'),EASE='cubic-bezier(.2,.7,.2,1)';
let busy=false;
function clipFor(r){return 'inset('+r.top+'px '+(innerWidth-r.right)+'px '+(innerHeight-r.bottom)+'px '+r.left+'px round 11px)'}
function open(){
  if(busy||!cbx.hidden)return;busy=true;xb.classList.remove('hint');$('note').hidden=true;
  cbx.hidden=false;cbx.classList.add('enter');cbx.scrollTop=0;document.documentElement.style.overflow='hidden';xb.setAttribute('aria-expanded','true');
  $('cb').classList.add('grow');render(false);
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
  const finish=()=>{cbx.hidden=true;cbx.style.transition='';cbx.style.clipPath='';document.documentElement.style.overflow='';busy=false;if(editing){editing=false;$('cb-edit').textContent='Customize';$('cb-edit').classList.remove('on');$('cb-reset').hidden=true;$('cb').classList.remove('editing')}xb.focus({preventScroll:true})};
  if(calm.matches){finish();return}
  cbx.classList.add('enter');cbx.style.transition='none';cbx.style.clipPath='inset(0px 0px 0px 0px round 0px)';void cbx.offsetWidth;
  setTimeout(()=>{cbx.style.transition='clip-path .44s '+EASE;cbx.style.clipPath=clipFor(ins.getBoundingClientRect())},90);
  setTimeout(finish,560);
}
xb.addEventListener('click',open);$('close').addEventListener('click',close);
document.addEventListener('click',e=>{const wm=$('wmenu');if(!wm.hidden&&!e.target.closest('#wmenu')&&!e.target.closest('.wmore'))wm.hidden=true});
cbx.addEventListener('scroll',hideTip,{passive:true});
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||cbx.hidden||aw.open)return;if(!$('wmenu').hidden){$('wmenu').hidden=true;return}if(!$('cb-menu').hidden||!$('cb-pmenu').hidden||!$('cb-amenu').hidden){closeMenus();return}if(editing){setEditing(false);return}close()});
