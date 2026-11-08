// ---------- free plan (stage 2): 4 widgets, last 3 months, a lock on everything else ----------
const cbFree=()=>!!(window.CTBoardPlan&&window.CTBoardPlan()==='free');
const FREE_K=['profit','sales','after','spent','month'],FREE_P=['d7','d30','l3'];
let PM_OPEN=null;function cbPremium(c){if(PM_OPEN)PM_OPEN(c)}
const LOCK_I='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

// ---------- v26: card-art widgets (Featured card, Best sellers, Priciest card) and the redesigned Biggest win ----------
// Every card's numbers come from the same matching: purchases up to the end of the period are its cost, sales inside
// the period are what came back (after fees and shipping), all in cents.
const cardKey=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+(e.no||'');
function cardStats(ctx){
  const by={},get=e=>by[cardKey(e)]||(by[cardKey(e)]={k:cardKey(e),e,art:null,b:0,bq:0,s:0,sq:0,sold:0,firstBuy:null,lastSale:null,buys:[],sells:[]});
  ctx.p.filter(e=>e.date<=ctx.b).forEach(e=>{const c=get(e);if(e.art&&!c.art)c.art=e.art;
    if(e.type==='purchase'){c.b+=e.amount;c.bq+=e.qty;c.buys.push(e);if(!c.firstBuy||e.date<c.firstBuy)c.firstBuy=e.date}
    else if(e.type==='sale'){c.sq+=e.qty;if(e.date>=ctx.a){c.s+=e.net==null?e.amount:e.net;c.sold+=e.qty;c.sells.push(e);if(!c.lastSale||e.date>c.lastSale)c.lastSale=e.date}}});
  return Object.values(by).map(c=>Object.assign(c,{g:c.s-c.b,roi:c.b>0?(c.s-c.b)/c.b:null,left:c.bq-c.sq,meta:[c.e.no,c.e.set].filter(Boolean).join(' · ')}));
}
const pctTxt=v=>(v>=0?'▲ ':'▼ ')+Math.abs(Math.round(v*100))+'%';
const shareOf=(v,t)=>t>0?Math.round(v/t*100)+'%':'';
const shortD=d=>dFmt(d,{month:'short',day:'numeric'});
// ---- the eight things a Featured card can feature ----
const FEAT={
  win:{t:'Your biggest win',pick:L=>L.filter(c=>c.sold&&c.b>0&&c.g>0).sort((a,b)=>b.g-a.g)[0],
    num:c=>ksigned(c.g),pc:c=>pctTxt(c.roi)+' return',line:c=>'Bought '+kshort(c.b)+' · Sold '+kshort(c.s),good:1,none:'No card bought and sold in this period yet'},
  roi:{t:'Best return',pick:L=>L.filter(c=>c.sold&&c.b>=100&&c.g>0).sort((a,b)=>b.roi-a.roi)[0],
    num:c=>ksigned(c.g),pc:c=>pctTxt(c.roi),line:c=>'Bought '+kshort(c.b)+' · Sold '+kshort(c.s),good:1,none:'No card bought and sold in this period yet'},
  pricey:{t:'Priciest card',pick:(L,ctx)=>{let best=null;ctx.inP.filter(e=>e.type==='purchase').forEach(e=>{const u=Math.round(e.amount/e.qty);if(!best||u>best.u)best={u,e}});if(!best)return null;const c=L.find(x=>x.k===cardKey(best.e));return c&&Object.assign({},c,{unit:best.u,buy:best.e})},
    num:c=>money(c.unit),pc:(c,ctx)=>shareOf(c.unit,totals(ctx.inP).spent)+' of your spending',line:c=>(c.left>0?'Still yours':'Sold')+' · '+c.buy.platform+' · '+shortD(c.buy.date),none:'No purchases in this period yet'},
  seller:{t:'Best seller',pick:L=>L.filter(c=>c.sold).sort((a,b)=>b.sold-a.sold||b.s-a.s)[0],
    num:c=>money(c.s),pc:(c,ctx)=>shareOf(c.s,totals(ctx.inP).after)+' of your sales',line:c=>'Sold '+cnt(c.sold,'copy','copies')+(c.meta?' · '+c.meta:''),none:'No sales in this period yet'},
  loss:{t:'Biggest loss',pick:L=>L.filter(c=>c.sold&&c.b>0&&c.g<0).sort((a,b)=>a.g-b.g)[0],
    num:c=>ksigned(c.g),pc:c=>pctTxt(c.roi),line:c=>'Bought '+kshort(c.b)+' · Sold '+kshort(c.s),bad:1,none:'No losses in this period. Nice.'},
  flip:{t:'Fastest flip',pick:L=>L.filter(c=>c.sold&&c.b>0&&c.g>0&&c.firstBuy&&c.lastSale).map(c=>Object.assign({},c,{d:Math.max(0,days(c.firstBuy,c.lastSale)-1)})).sort((a,b)=>a.d-b.d||b.g-a.g)[0],
    num:c=>ksigned(c.g),pc:c=>pctTxt(c.roi)+' in '+cnt(c.d,'day','days'),line:c=>'Bought '+shortD(c.firstBuy)+' · Sold '+shortD(c.lastSale),good:1,none:'No quick flips in this period yet'},
  held:{t:'Held the longest',pick:L=>L.filter(c=>c.left>0&&c.firstBuy).sort((a,b)=>a.firstBuy.localeCompare(b.firstBuy))[0],
    num:c=>money(c.b),pc:c=>cnt(days(c.firstBuy,TODAY)-1,'day','days'),line:c=>'Bought '+dFmt(c.firstBuy,{month:'short',day:'numeric',year:'numeric'})+' · Still unsold',none:'Nothing waiting to sell'},
  money:{t:'Most money in',pick:L=>L.filter(c=>c.left>0).sort((a,b)=>b.b-a.b)[0],
    num:c=>money(c.b),pc:(c,ctx,L)=>shareOf(c.b,L.filter(x=>x.left>0).reduce((a,x)=>a+x.b,0))+' of what you hold',line:c=>'You own '+c.left,none:'Nothing waiting to sell'}};
const FEAT_ORDER=['win','roi','pricey','seller','loss','flip','held','money'];
// ---- art: the wallpaper copy when there is one, else the full card; a letter tile when there is no art at all ----
// mode: 'wall' (artwork-only copy for Featured), 'card' (whole card, larger), 'thumb' (small)
let PVMODE=false; // Add widgets previews are tiny: they always use the small thumbnail
const artSrc=(c,mode)=>!c||!c.art?'':PVMODE?(c.art.list||c.art.detail):mode==='wall'?(c.art.wall||c.art.detail||c.art.list):mode==='card'?(c.art.detail||c.art.list):(c.art.list||c.art.detail);
const letter=c=>esc(((c&&c.e.name)||'?').match(/[A-Za-z0-9]/)?(c.e.name.match(/[A-Za-z0-9]/)[0].toUpperCase()):'?');
// v50.37: a graded card shows in its slab (the same one Entries draws); full-art widgets (Featured) keep just the art
function cardImg(c,cls,mode){const src=maskNames()?'':artSrc(c,mode),G=window.CTGrade;
  if(G&&c&&c.e&&cls!=='pimg'&&!maskNames()&&G.of(c.e))return '<span class="'+cls+' xslab">'+G.slab(c.e,src?'<img src="'+esc(src)+'" alt="" decoding="async" loading="lazy" draggable="false">':'<i class="sl-ph"></i>')+'</span>';
  return src?'<img class="'+cls+'" src="'+esc(src)+'" alt="" decoding="async" loading="lazy" draggable="false">':'<span class="'+cls+' ph" aria-hidden="true"><i>'+(maskNames()?'':letter(c))+'</i></span>'}
const nameOf=c=>maskNames()?'A card from your collection':c.e.name;
// the card-and-details layout: big card, name as a heading, labeled numbers, one hero number
function cardHero(c,F,ctx,L,w,s){const show=(w&&w.show)||'both',nm=nameOf(c);
  const two=F===FEAT.win||F===FEAT.roi||F===FEAT.loss?'<div class="x2"><div><small class="lab">Bought</small><b class="num">'+kshort(c.b)+'</b></div><div><small class="lab">Sold</small><b class="num">'+kshort(c.s)+'</b></div></div>':'<p class="xl">'+esc(F.line(c,ctx,L))+'</p>';
  const big=show==='%'?'':'<div class="xbig num'+(F.good?' g':F.bad?' r':'')+'">'+F.num(c,ctx,L)+'</div>',p=show==='$'?'':'<div class="xpc">'+esc(F.pc(c,ctx,L))+'</div>';
  return '<div class="xhero drill"'+dd({t:c.e.name,sub:'Every entry for this card',card:c.k})+' role="button" tabindex="0">'+cardImg(c,'xart','card')+'<div class="xtx"><h4 class="xn">'+esc(nm)+'</h4>'+(c.meta&&!maskNames()?'<p class="xm">'+esc(c.meta)+'</p>':'')+(s==='S'?'':two)+big+p+'</div></div>'}
// ---- Featured card: the wallpaper ----
const LOWRES=new Set();
function featBody(ctx,s,w){const m=FEAT[w.metric]?w.metric:'win',F=FEAT[m],L=cardStats(ctx),c=F.pick(L,ctx);
  if(!c)return '<div class="fwnone"><p>'+F.none+'</p></div>';
  const show=w.show||'both',src=maskNames()?'':artSrc(c,'wall'),lk=w.id+'|'+c.k+'|'+s;
  // no art yet: the same full-art layout on a Card Tab cranberry card, until the art fills in (v42.2)
  if(!src&&!maskNames()){const big0=show==='%'?'':'<div class="fbig num'+(F.good?' g':F.bad?' r':'')+'">'+F.num(c,ctx,L)+(show==='both'&&s!=='S'?'<span class="fpc">'+esc(F.pc(c,ctx,L))+'</span>':'')+'</div>',only0=show==='%'?'<div class="fbig num'+(F.good?' g':F.bad?' r':'')+'">'+esc(F.pc(c,ctx,L))+'</div>':'';
    return '<div class="fw fwph in drill"'+dd({t:c.e.name,sub:'Every entry for this card',card:c.k})+' role="button" tabindex="0"><div class="fwi ct-cardph" aria-hidden="true"></div><div class="fwt"><h4 class="fn">'+esc(nameOf(c))+'</h4>'+(s==='S'?'':'<p class="fl">'+esc(F.line(c,ctx,L))+'</p>')+big0+only0+'</div></div>'}
  if(!src||LOWRES.has(lk))return '<div class="fwcard">'+cardHero(c,F,ctx,L,w,s)+'</div>';
  const f=c.art.focus||[50,c.art.wall?50:28],z=c.art.wall?1:(s==='S'?1.9:s==='L'?1.35:1.2);
  const big=show==='%'?'':'<div class="fbig num'+(F.good?' g':F.bad?' r':'')+'">'+F.num(c,ctx,L)+(show==='both'&&s!=='S'?'<span class="fpc">'+esc(F.pc(c,ctx,L))+'</span>':'')+'</div>';
  const onlyPc=show==='%'?'<div class="fbig num'+(F.good?' g':F.bad?' r':'')+'">'+esc(F.pc(c,ctx,L))+'</div>':'';
  return '<div class="fw drill'+(PVMODE?' in':'')+'"'+dd({t:c.e.name,sub:'Every entry for this card',card:c.k})+' role="button" tabindex="0" data-fw data-lk="'+esc(lk)+'">'+
    '<img class="fwi" src="'+esc(src)+'" alt="" decoding="async" draggable="false" style="--fx:'+f[0]+'%;--fy:'+f[1]+'%;--fz:'+z+'" data-wall="'+(c.art.wall?1:0)+'" data-focus="'+(c.art.focus?1:0)+'" data-meta="'+esc([c.e.cardId,c.e.cardName,c.e.name].filter(Boolean).join(' '))+'">'+
    '<div class="fwt"><h4 class="fn">'+esc(nameOf(c))+'</h4>'+(s==='S'?'':'<p class="fl">'+esc(F.line(c,ctx,L))+'</p>')+big+onlyPc+'</div></div>'}
// ---- Best sellers: a podium of the top three, shown as the top halves of the cards ----
function bestBody(ctx,s,w){const L=cardStats(ctx).filter(c=>c.sold&&c.b>0&&c.g>0).sort((a,b)=>b.g-a.g),n=s==='S'?1:s==='M'||s==='B'?2:3,top=L.slice(0,n);
  if(!top.length)return '<p class="eg">No card bought and sold in this period yet.</p>';
  const order=top.length===3?[top[1],top[0],top[2]]:top;
  return '<div class="pod n'+top.length+'">'+order.map(c=>{const r=top.indexOf(c)+1;return '<div class="pc r'+r+' drill"'+dd({t:c.e.name,sub:'Every entry for this card',card:c.k})+' role="button" tabindex="0"><div class="pcrop">'+cardImg(c,'pimg','card')+'</div><small class="prk">#'+r+'</small><b class="pnm">'+esc(nameOf(c))+'</b><span class="pv num">'+ksigned(c.g)+'</span></div>'}).join('')+'</div>'}
// ---- Priciest card: the card and its details ----
function priceyBody(ctx,s,w){const L=cardStats(ctx),c=FEAT.pricey.pick(L,ctx);if(!c)return '<p class="eg">No purchases in this period yet.</p>';
  if(s==='S')return '<div class="xs">'+cardImg(c,'xsart','thumb')+'<div><div class="cq">'+bn(money(c.unit),'',26)+'</div><b class="nm">'+esc(nameOf(c))+'</b></div></div>';
  return cardHero(c,FEAT.pricey,ctx,L,Object.assign({},w,{show:'$'}),s).replace('<div class="xbig','<div class="chips"><span>'+esc(c.buy.platform)+'</span><span>'+esc(shortD(c.buy.date))+'</span>'+(c.left>0?'<span class="g">Still yours</span>':'')+'</div><div class="xbig')}
// ---- Biggest win, redesigned: the same numbers in the card-and-details layout ----
function winBody(ctx,s,w){const L=cardStats(ctx),F=FEAT.win,c=F.pick(L,ctx);if(!c)return '<p class="eg">No card bought and sold in this period yet.</p>';
  const others=L.filter(x=>x.sold&&x.b>0&&x.g>0&&x!==c).sort((a,b)=>b.g-a.g),also=m=>others.length?'<div class="xalso"><p class="lab">Also up</p>'+others.slice(0,m).map(x=>'<div class="xar">'+cardImg(x,'xai','thumb')+'<span>'+esc(nameOf(x))+'</span><b class="num">'+ksigned(x.g)+'</b></div>').join('')+'</div>':'';
  if(s==='S')return '<div class="xs drill"'+dd({t:c.e.name,sub:'Every entry for this card',card:c.k})+' role="button" tabindex="0">'+cardImg(c,'xsart','thumb')+'<div><div class="cq">'+bn(ksigned(c.g),'g',26)+'</div><b class="nm">'+esc(nameOf(c))+'</b></div></div>';
  const hero=cardHero(c,F,ctx,L,Object.assign({},w,{show:'$'}),s);
  if(s==='M')return hero;if(s==='B')return '<div class="xsplit">'+hero+also(2)+'</div>';
  return '<div class="xcol">'+hero+also(s==='X'?3:2)+'</div>'}
const NEWW={feat:featBody,best:bestBody,pricey:priceyBody,win:winBody};
// Wallpapers: when a picture arrives, check it has enough pixels for its tile (else show the card-and-details layout for that
// card), and measure how bright the art is behind the words to set how deep the shade goes (so the words always read).
const SHADE=new Map(); // each picture's brightness is measured once, then remembered
function settleWalls(root){root=root||$('simple');if(root.closest&&root.closest('#aw'))return; // gallery previews keep the default shade
  root.querySelectorAll('img.fwi:not([data-ok])').forEach(img=>{img.dataset.ok=1;
    const ready=()=>{const fw=img.closest('.fw');if(!fw||!fw.isConnected)return;
      /* v50.15: use the widget's laid-out width (a widget gliding into place is drawn scaled, which used to read as much
         wider, call the picture too small, and switch the widget to the plain card for good); never judge mid-move */
      const r={width:fw.offsetWidth},dpr=1/* v50.16: judged at normal (not Retina) sharpness, so a slightly soft picture still shows in full; only tiny thumbnails fall back to the plain card */,z=parseFloat(img.style.getPropertyValue('--fz'))||1,useW=img.naturalWidth/(img.dataset.wall==='1'?1:z),moving=rz||drag||(fw.closest('.w')&&fw.closest('.w').matches('.floating,.rz-src,.rz-in'))||(fw.closest('.w')&&fw.closest('.w').getAnimations&&fw.closest('.w').getAnimations().some(a=>a.playState==='running'));
      /* v50.44: full art is kept unless the picture is truly tiny for its tile (under ~a fifth of its width); a wide widget with ordinary card art used to fall back to the card-on-the-left layout */if(img.naturalWidth&&r.width&&!moving&&useW<r.width*dpr*.2){const sec=fw.closest('.w[data-id]');if(sec&&!LOWRES.has(fw.dataset.lk)){LOWRES.add(fw.dataset.lk);rebuild(sec.dataset.id);return}}
      let sh=SHADE.get(img.src);
      if(sh==null){sh=.86;try{const cv=document.createElement('canvas');cv.width=24;cv.height=24;const g=cv.getContext('2d');g.drawImage(img,0,0,24,24);const d=g.getImageData(0,12,24,12).data;let t=0;for(let i=0;i<d.length;i+=4)t+=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];sh=+(.72+Math.max(0,t/(d.length/4)/255-.35)*.45).toFixed(2)}catch(e){}SHADE.set(img.src,sh)}
      fw.style.setProperty('--shade',sh);fw.classList.add('in')};
    // decode off the main thread first, so measuring never stalls a frame
    (img.decode?img.decode():Promise.reject()).then(ready,()=>{if(img.complete&&img.naturalWidth)ready();else img.addEventListener('load',ready,{once:true})})})}
