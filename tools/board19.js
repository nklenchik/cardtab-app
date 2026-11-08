
// ================= v51: six new widgets =================
// Breakdown (one widget, many questions: what it measures × how it splits), Money tied up in cards, Hit rate, Time to
// sell, In vs out by month and What you pay per card. All worked out from the entries already on the device, in cents,
// with the same period and platform the board shows. Each has its own layout per size, like the others.
(function(){

const dayN=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5);
const median=a=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const PAL=[['--cb-crbg','--cb-cr'],['--cb-blbg','--cb-bl'],['--cb-ybg','--cb-y'],['--cb-pubg','--cb-pu'],['--cb-inkbg','--cb-ink'],['--cb-trk','--cb-mut2']];
// a thing keeps its color wherever it shows up: platforms as elsewhere on the board, games and price ranges fixed here
const GAMEC={'Pokémon':PAL[2],'Dragon Ball Super':PAL[0],'One Piece':PAL[1],'Magic: The Gathering':PAL[3],'Yu-Gi-Oh!':PAL[4],'Lorcana':PAL[3],'Other':PAL[5],'Not set':PAL[5]};
const BANDC={'Under $10':['--cb-trk','--cb-gry'],'$10–50':PAL[1],'$50–100':PAL[2],'$100 and up':PAL[0]};
const palOf=(name,i)=>CHIP[name]||GAMEC[name]||BANDC[name]||PAL[i%PAL.length];
const chipN=(name,i,key)=>{const c=palOf(key||name,i);return '<span class="ch" style="background:var('+c[0]+');color:var('+c[1]+')">'+esc((String(name).match(/[A-Za-z0-9$★]/)||['?'])[0].toUpperCase())+'</span>'};
const colN=(name,i)=>'var('+palOf(name,i)[1]+')';
const ksh=v=>(v>=0?'+':'−')+kshort(Math.abs(v));
// which game a card is from: what the entry says, else the card search, else its name (same as Stories)
const GC={};
const gameOf=e=>{if(e.game)return e.game;const key=e.name+'|'+(e.no||'')+'|'+(e.set||'');if(key in GC)return GC[key];let g=null;
  try{if(window.CardLookup){const r=CardLookup.search({name:e.name,number:e.no});const c=r&&r.list&&r.list[0];if(c&&c.g&&r.list.every(x=>x.g===c.g))g=c.g}}catch(x){}
  if(!g){const n=(e.name+' '+(e.set||'')).toLowerCase();
    if(/goku|gohan|vegeta|broly|frieza|cooler|trunks|dragon ball|\bss\b/.test(n))g='Dragon Ball Super';
    else if(/pok[eé]mon|\bex\b|vmax|vstar|\bgx\b|\bv\b|pikachu|charizard|gengar|umbreon|mewtwo|eevee|scarlet|violet|sword|shield|evolving|151|base set|obsidian|paldea|surging sparks|booster/.test(n))g='Pokémon';
    else if(/yu-?gi-?oh|blue-eyes|dark magician|exodia/.test(n))g='Yu-Gi-Oh!';else if(/one piece|luffy|zoro|nami\b/.test(n))g='One Piece';else if(/lorcana/.test(n))g='Lorcana';else if(/magic|mtg|planeswalker/.test(n))g='Magic: The Gathering'}
  return GC[key]=g||'Other'};
const unitOf=e=>Math.round(e.amount/Math.max(1,e.qty||1));
const BANDS=[['Under $10',0,1000],['$10–50',1000,5000],['$50–100',5000,10000],['$100 and up',10000,Infinity]];
const bandOf=c=>(BANDS.find(b=>c>=b[1]&&c<b[2])||BANDS[0])[0];
// each card's average cost, from every purchase up to the end of the period
function costs(ctx){const m={};ctx.p.forEach(e=>{if(e.type!=='purchase'||e.date>ctx.b)return;const k=cardKey(e),o=m[k]||(m[k]={c:0,q:0,first:e.date,dates:[]});o.c+=e.amount;o.q+=e.qty||1;if(e.date<o.first)o.first=e.date;o.dates.push(e.date)});return m}
// each sale in the period with what it made, when the card's cost is known
function saleResults(ctx){const C=costs(ctx);return ctx.inP.filter(e=>e.type==='sale').map(e=>{const o=C[cardKey(e)];if(!o||!o.q)return null;const cost=Math.round(o.c/o.q)*(e.qty||1),got=e.net==null?e.amount:e.net;
  const before=o.dates.filter(d=>d<=e.date).sort();const bought=before.length?before[before.length-1]:o.first;return {e,cost,got,made:got-cost,days:Math.max(0,dayN(bought,e.date))}}).filter(Boolean)}

// ---------- Breakdown ----------
const BD_M=[['spent','Spending'],['sales','Sales'],['profit','Profit'],['nb','Cards bought'],['ns','Cards sold']];
const BD_BY=[['game','Game'],['set','Set'],['platform','Platform'],['condition','Condition'],['price','Price range'],['month','Month']];
const bdM=w=>BD_M.find(x=>x[0]===w.m)?w.m:'spent',bdBy=w=>BD_BY.find(x=>x[0]===w.by)?w.by:'game';
window.cbBdTitle=w=>{const m=BD_M.find(x=>x[0]===bdM(w))[1],b=BD_BY.find(x=>x[0]===bdBy(w))[1].toLowerCase();return m+' by '+b};
function bdGroups(ctx,w){const m=bdM(w),by=bdBy(w),G={};
  const keyOf=e=>{if(by==='game')return gameOf(e);if(by==='set')return e.set||'Not set';if(by==='platform')return e.platform||'Other';if(by==='condition')return e.condition||'Not set';
    if(by==='price')return bandOf(unitOf(e));return e.date.slice(0,7)};
  ctx.inP.forEach(e=>{const want=m==='spent'||m==='nb'?e.type==='purchase':m==='sales'||m==='ns'?e.type==='sale':e.type==='purchase'||e.type==='sale'||e.type==='refund';if(!want)return;
    const k=keyOf(e),g=G[k]||(G[k]={k,v:0,n:0});const q=e.qty||1;
    if(m==='spent')g.v+=e.amount;else if(m==='sales')g.v+=e.amount;else if(m==='nb'||m==='ns')g.v+=q;
    else g.v+=e.type==='sale'?(e.net==null?e.amount:e.net):-e.amount;
    if(e.type!=='refund')g.n+=q});
  let L=Object.values(G);
  if(by==='month')L.sort((a,b)=>a.k<b.k?-1:1).forEach(g=>g.label=mLabel(g.k,{month:'short',year:'numeric'}));
  else if(by==='price')L.sort((a,b)=>BANDS.findIndex(x=>x[0]===a.k)-BANDS.findIndex(x=>x[0]===b.k));
  else L.sort((a,b)=>b.v-a.v);
  L.forEach(g=>{if(!g.label)g.label=g.k});return {L,m,by}}
window.cbBdMenu=w=>'<div class="mh">Measure</div><div class="mfeat">'+BD_M.map(x=>'<button type="button" data-bdm="'+x[0]+'" aria-pressed="'+(bdM(w)===x[0])+'">'+x[1]+'</button>').join('')+'</div><div class="mh">Split by</div><div class="mfeat">'+BD_BY.map(x=>'<button type="button" data-bdby="'+x[0]+'" aria-pressed="'+(bdBy(w)===x[0])+'">'+x[1]+'</button>').join('')+'</div>';
const bdVal=(m,v)=>m==='nb'||m==='ns'?NFR.format(v):m==='profit'?(v>=0?'+':'')+kshort(v):kshort(v);
function bdBody(ctx,s,w){const {L,m,by}=bdGroups(ctx,w),cnt0=m==='nb'||m==='ns';
  if(!L.length)return '<p class="eg">Nothing to show for these dates yet.</p>';
  const tot=L.reduce((a,g)=>a+Math.max(0,g.v),0)||1,unitW=m==='nb'?'bought':m==='ns'?'sold':'';
  const sub=g=>(m==='profit'?cnt(g.n,'entry','entries'):(Math.round(Math.max(0,g.v)/tot*100)+'%'+(cnt0?'':' · '+cnt(g.n,'card','cards'))));
  const tip=g=>g.label+': '+bdVal(m,g.v)+(cnt0?' '+unitW:'')+(m!=='profit'?' · '+Math.round(Math.max(0,g.v)/tot*100)+'% of the total':'');
  const drillOf=g=>by==='platform'?dd({t:g.label,a:ctx.a,b:ctx.b,types:m==='spent'||m==='nb'?['purchase']:m==='profit'?null:['sale'],plat:g.k}):'';
  L.forEach((g,i)=>g.i=i);const top=by==='month'?L.slice(-6):L.slice(0,s==='L'?5:3);
  if(s==='S'){const lead=by==='month'?L[L.length-1]:L[0];return '<div class="kS">'+bn(bdVal(m,lead.v),m==='profit'?(lead.v>=0?'g':'r'):'',30)+'<small class="cap">'+esc(lead.label)+'</small>'+(m!=='profit'?'<div class="shb">'+L.slice(0,6).filter(g=>g.v>0).map(g=>'<i style="flex:'+g.v+';background:'+colN(g.k,g.i)+'"></i>').join('')+'</div>':'')+'</div>'}
  if(s==='M'){const lead=by==='month'?L[L.length-1]:L[0],pos=top.filter(g=>g.v>0);
    return '<div class="split"><div class="hz"><div class="cq">'+bn(bdVal(m,lead.v),m==='profit'?(lead.v>=0?'g':'r'):'',40)+'</div><small class="cap bdlead">'+esc(lead.label)+(m!=='profit'&&by!=='month'?' · '+Math.round(Math.max(0,lead.v)/tot*100)+'%':'')+'</small></div>'+
      '<div class="sstack">'+(pos.length&&m!=='profit'?'<div class="sbar">'+pos.map((g,i)=>'<i style="width:'+(g.v/tot*100).toFixed(2)+'%;background:'+colN(g.k,g.i)+'"></i>').join('')+'</div>':'')+
      '<div class="skey">'+top.map((g,i)=>'<span class="sk" data-tipd="'+esc(tip(g))+'"'+drillOf(g)+'><i style="background:'+colN(g.k,g.i)+'"></i>'+esc(g.label.length>16?g.label.slice(0,15)+'…':g.label)+' '+bdVal(m,g.v)+'</span>').join('')+'</div></div></div>'}
  const bar=m!=='profit'&&by!=='month'&&!phone.matches?'<div class="shb" role="img" aria-label="'+esc(top.map(g=>g.label+' '+Math.round(g.v/tot*100)+'%').join(', '))+'">'+L.slice(0,6).filter(g=>g.v>0).map((g,i)=>'<i style="flex:'+g.v+';background:'+colN(g.k,g.i)+'" title="'+esc(g.label)+'"></i>').join('')+'</div>':'';
  const rows=top.map((g,i)=>'<div class="r" data-tipd="'+esc(tip(g))+'"'+drillOf(g)+'>'+chipN(g.label,g.i,g.k)+'<span class="n">'+esc(g.label)+'<small>'+esc(sub(g))+'</small></span><span class="v'+(m==='profit'?(g.v>=0?' up':' dn'):'')+'">'+bdVal(m,g.v)+'</span></div>').join('');
  return '<div class="col bd">'+(s!=='S'?'<div class="bdp"><button type="button" class="bdpick" data-bdp="m">'+esc(BD_M.find(x=>x[0]===m)[1])+' <i>▾</i></button><button type="button" class="bdpick" data-bdp="by">by '+esc(BD_BY.find(x=>x[0]===by)[1])+' <i>▾</i></button></div>':'')+bar+'<div class="lr">'+rows+'</div></div>'}

// ---------- Money tied up in cards ----------
function tiedBody(ctx,s){const C=costs(ctx),soldQ={};ctx.p.forEach(e=>{if(e.type==='sale'&&e.date<=ctx.b){const k=cardKey(e);soldQ[k]=(soldQ[k]||0)+(e.qty||1)}});
  const names={};ctx.p.forEach(e=>{if(e.type==='purchase')names[cardKey(e)]=e.name});
  const held=Object.keys(C).map(k=>{const o=C[k],left=o.q-(soldQ[k]||0);if(left<=0)return null;const unit=o.c/o.q,last=o.dates.sort()[o.dates.length-1];return {k,name:names[k]||'Card',left,cost:Math.round(unit*left),age:Math.max(0,dayN(last,ctx.b))}}).filter(Boolean);
  if(!held.length)return '<p class="eg">Every card you bought has sold.</p>';
  const tot=held.reduce((a,h)=>a+h.cost,0),nCards=held.reduce((a,h)=>a+h.left,0);
  const B=[['under 30 days',0,30,'var(--cb-pos)'],['30–90 days',30,90,'var(--cb-y)'],['over 90 days',90,Infinity,'var(--cb-neg)']].map(([l,lo,hi,c])=>{const L=held.filter(h=>h.age>=lo&&h.age<hi);return {l,c,v:L.reduce((a,h)=>a+h.cost,0),n:L.reduce((a,h)=>a+h.left,0)}});
  const hero='<div class="cq">'+bn(kshort(tot),'',s==='S'?30:s==='M'?40:48)+'</div><small class="cap">in '+cnt(nCards,'card','cards')+' still held</small>';
  if(s==='S')return '<div class="kS">'+hero+'</div>';
  const age='<div class="sstack"><div class="sbar">'+B.filter(b=>b.v>0).map(b=>'<i style="width:'+(b.v/tot*100).toFixed(2)+'%;background:'+b.c+'"></i>').join('')+'</div><div class="skey">'+B.map(b=>'<span class="sk" data-tipd="'+esc(cnt(b.n,'card','cards')+' held '+b.l+' · '+kshort(b.v))+'"><i style="background:'+b.c+'"></i>'+kshort(b.v)+' '+b.l+'</span>').join('')+'</div></div>';
  if(s==='M')return '<div class="split"><div class="hz">'+hero+'</div>'+age+'</div>';
  const old=held.slice().sort((a,b)=>b.age-a.age).slice(0,3);
  return '<div class="col tiedl">'+hero+age+'<div class="lr tied">'+old.map(h=>'<div class="r" data-tipd="'+esc(cnt(h.left,'copy','copies')+' · held '+h.age+' days · paid '+kshort(h.cost))+'"><span class="n">'+esc(h.name)+'<small>Held '+h.age+' days</small></span><span class="v">'+kshort(h.cost)+'</span></div>').join('')+'</div></div>'}

// ---------- Hit rate ----------
function hitBody(ctx,s){const R=saleResults(ctx);if(!R.length)return '<p class="eg">No sales with a known cost in these dates.</p>';
  const won=R.filter(r=>r.made>0).length,pc=Math.round(won/R.length*100),worst=R.reduce((a,r)=>r.made<a.made?r:a),best=R.reduce((a,r)=>r.made>a.made?r:a);
  const hero='<div class="cq">'+bn(pc+'%',pc>=50?'g':'r',s==='S'?30:s==='M'?40:48)+'</div>';
  if(s==='S')return '<div class="kS">'+hero+'<div class="cap tsl">'+won+' of '+R.length+' sales made money</div></div>';
  const line=(l,r)=>'<div class="r" data-tipd="'+esc(r.e.name+' · bought for '+kshort(r.cost)+', sold for '+kshort(r.got))+'"><span class="n">'+l+'<small>'+esc(r.e.name)+'</small></span><span class="v '+(r.made>=0?'up':'dn')+'">'+ksh(r.made)+'</span></div>';
  return '<div class="split"><div class="hz">'+hero+'<small class="cap">'+won+' of '+R.length+' sales made money</small></div><div class="lr hitl">'+line('Best',best)+(R.length>1?line('Worst',worst):'')+'</div></div>'}

// ---------- Time to sell ----------
function ttsBody(ctx,s){const R=saleResults(ctx);if(!R.length)return '<p class="eg">No sales with a known buy date in these dates.</p>';
  const md=Math.round(median(R.map(r=>r.days))),G={};R.forEach(r=>{const g=gameOf(r.e);(G[g]=G[g]||[]).push(r.days)});
  const games=Object.keys(G).map(g=>({g,d:Math.round(median(G[g])),n:G[g].length})).sort((a,b)=>b.n-a.n);
  const short=g=>({'Dragon Ball Super':'DBS','One Piece':'One Piece','Pokémon':'Pokémon','Pokemon':'Pokémon','Magic':'Magic','Yu-Gi-Oh!':'Yu-Gi-Oh'}[g]||g);
  const hero='<div class="cq">'+bn(cnt(md,'day','days'),'',s==='S'?30:s==='M'?40:48)+'</div>';
  if(s==='S')return '<div class="kS">'+hero+'<div class="cap tsl">'+(games.length>1?games.slice(0,3).map(x=>esc(short(x.g))+' <b>'+x.d+'</b>').join(' · '):'typical time from buying to selling')+'</div></div>';
  const mx=Math.max(...games.map(x=>x.d),1);
  return '<div class="split"><div class="hz">'+hero+'<small class="cap">typical time to sell · '+cnt(R.length,'sale','sales')+'</small></div><div class="lr kl tts">'+games.slice(0,3).map((x,i)=>'<div class="r" data-tipd="'+esc(x.g+': usually '+cnt(x.d,'day','days')+' · '+cnt(x.n,'sale','sales'))+'"><span class="n">'+esc(short(x.g))+'<small><i class="kb2"><b style="width:'+Math.max(4,x.d/mx*100).toFixed(1)+'%;background:'+colN(x.g,i)+'"></b></i></small></span><span class="v">'+x.d+'d</span></div>').join('')+'</div></div>'}

// ---------- In vs out ----------
function inoutBody(ctx,s){const data=ctx.mt.map(x=>{const t=totals(x.list);return {k:x.k,n:x.n,s:x.s,l:x.l,a:t.spent,b:t.after,on:x.list.length>0}});
  if(!data.some(d=>d.on))return '<p class="eg">No entries in this period.</p>';
  const A=data.reduce((t,d)=>t+d.a,0),Bk=data.reduce((t,d)=>t+d.b,0),net=Bk-A;
  if(s==='S'){const mx=Math.max(A,Bk,1);return '<div class="kS">'+bn(ksh(net),net>=0?'g':'r',30)+'<small class="cap">back from sales vs spent</small><div class="iobar"><i style="width:'+(A/mx*100).toFixed(1)+'%;background:var(--cb-bl)"></i><i style="width:'+(Bk/mx*100).toFixed(1)+'%;background:var(--cb-pos)"></i></div></div>'}
  const tipf=i=>{const d=data[i];return '<b>'+d.l+'</b>Spent '+kshort(d.a)+'<br>Back '+kshort(d.b)+'<br><span class="'+(d.b-d.a>=0?'p':'l')+'">'+ksh(d.b-d.a)+'</span>'};
  const ch=cv(ctx,{pair:true,data,tip:tipf,aria:'Spent and money back by '+ctx.unit,labels:true,ent:i=>({t:'Entries',sub:data[i].l,a:ctx.mt[i].from,b:ctx.mt[i].to})});
  return '<div class="fill"><div class="iok" aria-hidden="true"><span><i style="background:var(--cb-bl)"></i>Spent</span><span><i style="background:var(--cb-pos)"></i>Back from sales</span></div>'+ch+'<div class="msum"><span><small>Spent</small><b class="num">'+money(A)+'</b></span><span><small>Back from sales</small><b class="num">'+money(Bk)+'</b></span><span><small>Net</small><b class="num '+(net>=0?'g':'r')+'">'+ksh(net)+'</b></span></div></div>'}
// two bars per month: spent (gray) and back from sales (green)
window.cbPairSVG=function(sp,W,H){const d=sp.data,n=d.length;if(!n||W<40||H<30)return '';const slot=W/n,labs=sp.labels&&H>=70,bottom=H-(labs?20:0)-1,top=4,mx=Math.max(1,...d.map(x=>Math.max(x.a,x.b))),sc=(bottom-top)/mx;
  const bw=Math.max(2,Math.min(18,slot*.3)),gap=Math.max(1,Math.min(4,slot*.05)),every=slot<14?3:slot<22?2:1;
  const bar=(x,v,f,i)=>{const h=v*sc;if(h<.5)return '';const r=Math.min(4,bw/3,h*.9),y=bottom-h;return '<path data-i="'+i+'" class="bar" d="M'+x.toFixed(1)+' '+bottom+'V'+(y+r).toFixed(1)+'A'+r+' '+r+' 0 0 1 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+r+' '+r+' 0 0 1 '+(x+bw).toFixed(1)+' '+(y+r).toFixed(1)+'V'+bottom+'Z" fill="'+f+'"/>'};
  let s='<svg class="pc" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(sp.aria||'Chart')+'"><line x1="0" x2="'+W+'" y1="'+bottom+'" y2="'+bottom+'" stroke="var(--line)" stroke-width="1.5"/>',hit='';
  d.forEach((m,i)=>{const c=i*slot+slot/2;s+=bar(c-bw-gap/2,m.a,'var(--cb-bl)',i)+bar(c+gap/2,m.b,'var(--cb-pos)',i);
    if(labs&&i%every===0)s+='<text x="'+c.toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle" class="mt" style="font-size:'+(slot>40?11.5:10.5)+'px">'+esc(slot>46?m.s:m.n)+'</text>';
    hit+='<rect data-i="'+i+'" x="'+(i*slot).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'" tabindex="0" role="img" aria-label="'+esc(m.l+': spent '+money(m.a)+', back '+money(m.b))+'"/>'});
  return s+'<g class="hit" fill="transparent">'+hit+'</g></svg>'};

// ---------- What you pay per card ----------
function ppcBody(ctx,s){const P=ctx.inP.filter(e=>e.type==='purchase');if(!P.length)return '<p class="eg">No purchases in these dates.</p>';
  const R=BANDS.map(([l,lo,hi],i)=>{const L=P.filter(e=>{const u=unitOf(e);return u>=lo&&u<hi});return {l,i,n:L.reduce((a,e)=>a+(e.qty||1),0),v:L.reduce((a,e)=>a+e.amount,0)}});
  const tot=R.reduce((a,r)=>a+r.v,0)||1,mx=Math.max(...R.map(r=>r.v),1),C=['var(--cb-gry)','var(--cb-bl)','var(--cb-y)','var(--cb-cr)'],SYM=['$','$$','$$$','★'];
  const tip=r=>cnt(r.n,'card','cards')+' at '+r.l.replace('Under','under')+' · '+kshort(r.v)+' · '+Math.round(r.v/tot*100)+'% of spending';
  if(s==='S'){const lead=R.reduce((a,r)=>r.v>a.v?r:a);return '<div class="kS">'+bn(lead.l.replace(' and up','+'),'',30)+'<small class="cap">most of the spending</small><div class="shb">'+R.filter(r=>r.v>0).map(r=>'<i style="flex:'+r.v+';background:'+C[r.i]+'"></i>').join('')+'</div></div>'}
  if(s==='M'||phone.matches){const lead=R.reduce((a,r)=>r.v>a.v?r:a);return '<div class="split'+(s!=='M'?' ppcv':'')+'"><div class="hz"><div class="cq">'+bn(lead.l.replace(' and up','+'),'',30)+'</div><small class="cap">most of your spending · '+Math.round(lead.v/tot*100)+'%</small></div><div class="sstack"><div class="sbar">'+R.filter(r=>r.v>0).map(r=>'<i style="width:'+(r.v/tot*100).toFixed(2)+'%;background:'+C[r.i]+'"></i>').join('')+'</div><div class="skey">'+R.filter(r=>r.n).map(r=>'<span class="sk" data-tipd="'+esc(tip(r))+'"><i style="background:'+C[r.i]+'"></i>'+r.l.replace(' and up','+').replace('Under ','under ')+' · '+r.n+'</span>').join('')+'</div></div></div>'}
  return '<div class="lr kl ppc">'+R.map(r=>'<div class="r" data-tipd="'+esc(tip(r))+'"><span class="ch" style="background:var(--cb-trk);color:'+(r.i===3?'var(--cb-cr)':'var(--muted)')+'">'+SYM[r.i]+'</span><span class="n">'+r.l+'<small><i class="kb2"><b style="width:'+(r.v/mx*100).toFixed(1)+'%;background:'+C[r.i]+'"></b></i></small></span><span class="v">'+r.n+' · '+kshort(r.v)+'</span></div>').join('')+'</div>'}

Object.assign(NEWW,{bd:bdBody,tied:tiedBody,hit:hitBody,tts:ttsBody,inout:inoutBody,ppc:ppcBody});
})();
// v50.27: a board arranged on another device (synced by prefs.js) shows here without a reload
window.cbReloadLayout=function(){try{if(editing)return;layoutD=loadL(LKEY)||clone(defL());layoutP=loadL(LKEYP);layout=onPhone?(layoutP=phoneL(layoutP||clone(layoutD))):layoutD;if(window.CTBoard&&CTBoard.shown)render(true)}catch(e){}};
