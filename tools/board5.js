// ---------- Card Board v5: every widget at every size, on a grid of squares (preview) ----------
// The board is a grid of square-ish cells: 4 across on desktop and tablets, 2 across on phones.
// Small = 1 cell, Wide = 2 across, Large = 2 across x 2 tall, Extra large = the full width x 2 tall (desktop/tablet).
// Each metric has its own hand-made layout for each size. Charts are drawn at the exact pixel size of their box.
const PERIODS=[['d7','Last 7 days'],['d30','Last 30 days'],['l3','Last 3 months'],['ytd','This year'],['l12','Last 12 months'],['ly','Last year'],['all','All time'],['custom','Custom dates…']];
const SIZES=['S','M','B','L','X'],SIZE_NAMES={S:'Small',M:'Wide',B:'Banner',L:'Large',X:'Extra large'},DIM={S:[1,1],M:[2,1],B:[6,1],L:[2,2],X:[6,2]};
const CATALOG={
  profit:{t:'Profit',s:'Profit',d:'What you kept after fees, minus what you spent'},
  sales:{t:'Sales',s:'Sales',d:'Everything you sold, before fees'},
  spent:{t:'Spent',s:'Spent',d:'Everything you bought'},
  fees:{t:'Fees and shipping',s:'Fees',d:'What platforms and postage took from your sales'},
  after:{t:'After fees',s:'After fees',d:'What your sales brought in after fees and shipping'},
  month:{t:'Profit by month',s:'Best month',d:'Your best and worst months at a glance'},
  sell:{t:'How much of it sold',s:'Sold',d:'How many of the cards you bought have sold'},
  where:{t:'Where you buy',s:'Buy from',d:'Which platforms get most of your spending'},
  kept:{t:'What each platform kept',s:'Top fees',d:'Fees and shipping as a share of each sale'},
  win:{t:'Your biggest win',s:'Biggest win',d:'The card that made you the most'},
  budget:{t:'Spend vs budget',s:'Budget',d:'How many months you stayed under budget'},
  feat:{t:'Featured card',s:'Featured',d:'One of your cards in full art, with the number that matters'},
  best:{t:'Best sellers',s:'Best sellers',d:'Your top three cards by profit'},
  pricey:{t:'Priciest card',s:'Priciest',d:'The most you paid for a single card'},
  glance:{t:'At a glance',s:'At a glance',d:'Your quick numbers from Entries, the same ones you picked there'}};
const DEFAULT=[['profit','S'],['sales','S'],['after','S'],['spent','S'],['budget','S'],['fees','S'],['glance','L'],['win','L'],['where','L'],['month','X']].map(([k,size],i)=>({id:'d'+i,k,size}));
// Free keeps its own arrangement of its 4 widgets, so going Premium (or back) never scrambles either board
const DEFAULT_FREE=[['profit','S'],['sales','S'],['after','S'],['spent','S'],['month','X']].map(([k,size],i)=>({id:'f'+i,k,size}));
let FREEMODE=cbFree();const defL=()=>FREEMODE?DEFAULT_FREE:DEFAULT;
// v43: widget families, and the two sizes each can use (like single-number widgets on marketing dashboards)
const FAMILY={profit:'num',sales:'num',spent:'num',fees:'num',after:'num',budget:'num',win:'card',feat:'card',pricey:'card',glance:'list',where:'list',kept:'list',best:'list',sell:'list',month:'chart'};
const FAM_SIZES={num:['S','M'],card:['S','L'],list:['M','L'],chart:['B','X']};
// phones (v43.1): one grid row is one short number tile, so lists and charts need two rows (Large) to be readable
const PH_SIZES={num:['S','M'],card:['S','M','L'],list:['L'],chart:['L']};
// v51: six more widgets (their layouts are in board19)
const NEWK={
  bd:{t:'Breakdown',s:'Breakdown',d:'Pick what to measure and how to split it: spending by game, profit by set, sales by platform…',fam:'list',cat:'list'},
  tied:{t:'Money tied up in cards',s:'Tied up',d:'What you paid for cards you still hold, and how long you’ve held them',fam:'tied',cat:'num'},
  hit:{t:'Hit rate',s:'Hit rate',d:'The share of your sales that made money, with your best and worst',fam:'num',cat:'num'},
  tts:{t:'Time to sell',s:'Time to sell',d:'How many days cards usually take to sell, overall and by game',fam:'num',cat:'num'},
  inout:{t:'In vs out',s:'In vs out',d:'What you spent next to what came back from sales, each month',fam:'pair',cat:'chart'},
  ppc:{t:'What you pay per card',s:'Price range',d:'How many cards you buy in each price range, and what each range costs',fam:'list',cat:'list'}};
Object.keys(NEWK).forEach(k=>{CATALOG[k]={t:NEWK[k].t,s:NEWK[k].s,d:NEWK[k].d};FAMILY[k]=NEWK[k].fam});
FAM_SIZES.tied=['S','M','L'];PH_SIZES.tied=['S','M','L'];FAM_SIZES.pair=['L','B','X'];PH_SIZES.pair=['L'];
window.cbCatOf=k=>(NEWK[k]&&NEWK[k].cat)||FAMILY[k];
const sizesFor=k=>phone.matches?(PH_SIZES[FAMILY[k]]||['S','L']):(FAM_SIZES[FAMILY[k]]||['S','M','L']);
const phFit=(k,s)=>{const ok=PH_SIZES[FAMILY[k]]||['S','L'];if(ok.includes(s))return s;const near={S:['S','M','L'],M:['M','L','S'],L:['L','M','S'],B:['M','L','S'],X:['L','M','S']}[s]||[];return near.find(x=>ok.includes(x))||ok[0]};
const phoneL=l=>l&&l.map(w=>Object.assign({},w,{size:phFit(w.k,w.size)}));
// the nearest size a widget is allowed (for boards arranged before families)
const fitSize=(k,s)=>{const ok=FAM_SIZES[FAMILY[k]];if(!ok||ok.includes(s))return s;const near={S:['S','M','L','B','X'],M:['M','S','L','B','X'],L:['L','X','M','S','B'],B:['B','X','M','L','S'],X:['X','B','L','M','S']}[s]||[];return near.find(x=>ok.includes(x))||ok[0]};
// phone and desktop each keep their own arrangement (order and sizes). The phone starts as a copy of desktop.
// Widgets you add land on both boards; removing, moving, resizing and Reset only touch the screen you're on.
const LKEY0='cb.layout.v4',LKEYP0='cb.layout.phone.v2',clone=x=>JSON.parse(JSON.stringify(x));let LKEY=LKEY0+(FREEMODE?'.free':''),LKEYP=LKEYP0+(FREEMODE?'.free':'');
const loadL=k=>{try{let raw=localStorage.getItem(k);if(raw==null){const old=k.replace('cb.layout.v4','cb.layout.v3').replace('cb.layout.phone.v2','cb.layout.phone.v1');raw=localStorage.getItem(old);if(raw){const o=JSON.parse(raw);if(Array.isArray(o)){o.forEach(w=>{if(w&&w.k)w.size=fitSize(w.k,w.size)});raw=JSON.stringify(o)}}}const s=JSON.parse(raw);if(Array.isArray(s)&&s.every(w=>w.id&&CATALOG[w.k]&&DIM[w.size]&&(!FREEMODE||FREE_K.includes(w.k))))return s}catch(e){}return null};
const phoneQ=matchMedia('(max-width:600px)');let onPhone=phoneQ.matches,layoutD=loadL(LKEY)||clone(defL()),layoutP=loadL(LKEYP);
let layout=onPhone?(layoutP=phoneL(layoutP||clone(layoutD))):layoutD;
const save=()=>{try{if(onPhone)layoutP=layout;else layoutD=layout;localStorage.setItem(onPhone?LKEYP:LKEY,JSON.stringify(layout));localStorage.setItem('cb.custom','1')}catch(e){}};
const otherLayout=()=>onPhone?layoutD:layoutP;
const saveOther=()=>{try{const o=otherLayout();if(o)localStorage.setItem(onPhone?LKEY:LKEYP,JSON.stringify(o))}catch(e){}};
function swapLayout(){const p=phoneQ.matches;if(p===onPhone)return;if(onPhone)layoutP=layout;else layoutD=layout;onPhone=p;layout=p?(layoutP=phoneL(layoutP||clone(layoutD))):layoutD}
const customized=()=>{try{return localStorage.getItem('cb.custom')==='1'}catch(e){return true}};
const newId=()=>'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
let period='l12',plat='all',editing=false;
function applyPlan(){const f=cbFree();if(f===FREEMODE)return false;FREEMODE=f;LKEY=LKEY0+(f?'.free':'');LKEYP=LKEYP0+(f?'.free':'');
  layoutD=loadL(LKEY)||clone(defL());layoutP=loadL(LKEYP);layout=onPhone?(layoutP=phoneL(layoutP||clone(layoutD))):layoutD;if(editing)setEditing(false);fitFreePeriod();return true}
function fitFreePeriod(){if(window.cbLinked)return;if(cbFree()&&!FREE_P.includes(period)){period='l3';const l=$('cb-perl');if(l)l.textContent='Last 3 months'}}
const VKEY='cb.view',saveView=()=>{try{localStorage.setItem(VKEY,JSON.stringify({period,plat,custom}))}catch(e){}};
let BUDGET=15000; // your monthly budget in cents; inside the app it comes from the budget setting (see fitBudget)
const fitBudget=()=>{try{const c=window.CTBudgetCents&&window.CTBudgetCents();if(c>0)BUDGET=c}catch(e){}};
const phone=matchMedia('(max-width:600px)');
// v43: six columns on desktop, four on mid-size screens, two on phones
const midQ=matchMedia('(min-width:601px) and (max-width:1099px)');
const units=()=>phone.matches?2:midQ.matches?4:6;
const sizesNow=()=>phone.matches?['S','M','L']:SIZES;
const eff=s=>phone.matches?(s==='X'?'L':s==='B'?'M':s):s; // on phones Extra large shows as Large and Banner as Wide
const byId=id=>layout.find(w=>w.id===id);

// ---------- haptics ----------
// Rare and meaningful: a tiny tick when something snaps, a tap when you pick a widget up, a firm tap when it lands,
// a double pulse when you remove one. Nothing while scrolling or between snaps. Android vibrates; iPhone Safari has no
// vibration for web pages, so it uses the system switch's own light tick (iOS 18+). The native app will get full haptics.
const HAP={tick:[6],tap:[12],firm:[20],warn:[14,70,14]};
let hapOn=false,/* v43.3: haptics removed (they didn't reach most phones); buzz() stays as a no-op */hapLast=0,iosSw=null;
const canVibrate=typeof navigator.vibrate==='function',touchDev=matchMedia('(pointer:coarse)').matches;
function iosTick(){if(!iosSw){iosSw=document.createElement('label');iosSw.className='hapsw';iosSw.setAttribute('aria-hidden','true');iosSw.innerHTML='<input type="checkbox" switch tabindex="-1">';iosSw.addEventListener('click',e=>e.stopPropagation());document.body.appendChild(iosSw)}iosSw.click()}
function buzz(kind){if(!hapOn||!touchDev)return;const now=performance.now();if(kind==='tick'&&now-hapLast<45)return;hapLast=now;
  try{if(canVibrate){navigator.vibrate(HAP[kind]);return}iosTick();if(kind==='warn')setTimeout(iosTick,90)}catch(e){}}

// ---------- data ----------
// time ranges work in days: short ranges chart by day, a few months by week, longer ones by month
let custom={from:null,to:null},compare=(()=>{try{return localStorage.getItem('cb.compare')||'prev'}catch(e){return 'prev'}})();
const yBack=d=>(+d.slice(0,4)-1)+d.slice(4,10).replace('-02-29','-02-28');
const iso=x=>x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate());
const dPlus=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return iso(x)};
const days=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5)+1;
const nextMonth=m=>{const x=new Date(m+'-15T12:00:00');x.setMonth(x.getMonth()+1);return iso(x).slice(0,7)};
const lastDay=m=>iso(new Date(+m.slice(0,4),+m.slice(5,7),0,12));
// the earliest date you can pick: when the account started, or the first entry if older ones were imported
const startDate=()=>E.reduce((a,e)=>e.date<a?e.date:a,TODAY);
function rangeFor(p){const t=TODAY,y=+t.slice(0,4);
  if(p==='d7')return [dPlus(t,-6),t];if(p==='d30')return [dPlus(t,-29),t];if(p==='ytd')return [y+'-01-01',t];
  if(p==='l12')return [monthsBack(12)[0]+'-01',t];if(p==='l3')return [monthsBack(3)[0]+'-01',t];if(p==='ly')return [(y-1)+'-01-01',(y-1)+'-12-31'];
  if(p==='custom'&&custom.from)return [custom.from,custom.to];return [startDate(),t]}
const dFmt=(d,o)=>new Date(d+'T12:00:00').toLocaleDateString('en-US',o);
function buckets(a,b){const n=days(a,b),unit=n<=31?'day':n<=124?'week':'month',out=[];
  if(unit==='day')for(let d=a;d<=b;d=dPlus(d,1))out.push({k:d,from:d,to:d,n:n<=7?dFmt(d,{weekday:'narrow'}):String(+d.slice(8)),s:n<=7?dFmt(d,{weekday:'short'}):dFmt(d,{month:'short',day:'numeric'}),m:dFmt(d,{month:'short',day:'numeric'}),l:dFmt(d,{weekday:'long',month:'short',day:'numeric',year:'numeric'})});
  else if(unit==='week')for(let d=a;d<=b;d=dPlus(d,7)){const e=dPlus(d,6)<b?dPlus(d,6):b;out.push({k:d,from:d,to:e,n:String(+d.slice(8)),s:dFmt(d,{month:'short',day:'numeric'}),m:'Week of '+dFmt(d,{month:'short',day:'numeric'}),l:'Week of '+dFmt(d,{month:'long',day:'numeric',year:'numeric'})})}
  else for(let m=a.slice(0,7);m<=b.slice(0,7);m=nextMonth(m)){const f=m+'-01'<a?a:m+'-01',l=lastDay(m)>b?b:lastDay(m);out.push({k:m,from:f,to:l,n:mLabel(m,{month:'narrow'}),s:mLabel(m,{month:'short'}),m:mLabel(m,{month:'short',year:'numeric'}),l:mLabel(m,{month:'long',year:'numeric'})})}
  return {unit,list:out}}
const inR=(list,a,b)=>list.filter(e=>e.date>=a&&e.date<=b);
const pool=()=>plat==='all'?E:E.filter(e=>e.platform===plat);
const kshort=v=>(v<0?'−':'')+'$'+NFR.format(Math.round(Math.abs(v)/100));
const ksigned=v=>(v>=0?'+':'−')+'$'+NF2.format(Math.abs(v)/100);
const KPI={profit:t=>t.profit,sales:t=>t.sales,spent:t=>t.spent,fees:t=>t.fees,after:t=>t.sales-t.fees};
const GOOD={profit:'up',sales:'up',spent:'down',fees:'down',after:'up'};
const KCOL={sales:'var(--cb-pos)',spent:'var(--cb-bl)',fees:'var(--cb-gry)',after:'var(--cb-pos)'};
function ctxNow(){const [a,b]=rangeFor(period),p=pool(),bk=buckets(a,b),n=days(a,b);
  return {a,b,unit:bk.unit,p,inP:inR(p,a,b),prevP:(compare==='off'||cbFree())?null:compare==='year'?inR(p,yBack(a),yBack(b)):inR(p,dPlus(a,-n),dPlus(a,-1)),mt:bk.list.map(x=>Object.assign({},x,{list:inR(p,x.from,x.to)})),cv:[]}}
const mShort=k=>mLabel(k,{month:'short',year:'numeric'});
const mLong=k=>mLabel(k,{month:'long',year:'numeric'});
// a big number that always fits its box: the font size comes from the box width and the number of characters
const bn=(txt,cls,mx)=>'<div class="bn num '+(cls||'')+'" style="--len:'+Math.max(4,String(txt).length)+(mx?';--mx:'+mx+'px':'')+'">'+txt+'</div>';
const cnt=(n,one,many)=>n+' '+(n===1?one:many);

// ---------- sharing: a viewer's copy can hide amounts, card names and details ----------
let share=(()=>{try{return Object.assign({on:false,amt:true,names:true,tips:true,live:true,exp:'never',id:Math.random().toString(36).slice(2,10),emails:[]},JSON.parse(localStorage.getItem('cb.share'))||{})}catch(e){return {on:false,amt:true,names:true,tips:true,live:true,exp:'never',id:'k3f9x2qa',emails:[]}}})();
let viewing=false;const saveShare=()=>{try{localStorage.setItem('cb.share',JSON.stringify(share))}catch(e){}};
const maskAmt=()=>viewing&&!share.amt,maskNames=()=>viewing&&!share.names,noTips=()=>viewing&&!share.tips;
// dollar amounts become dots for people who shouldn't see them; percentages and counts stay
const hideMoney=h=>maskAmt()?h.replace(/[−+-]?\$[\d,]+(?:\.\d\d)?/g,'$•••'):h;
// ---------- see the entries behind a number ----------
const canDrill=()=>!editing&&!viewing&&!rz&&!drag;
const dd=o=>' data-drill="'+esc(JSON.stringify(o))+'"';
const KTYPES={profit:null,sales:['sale'],spent:['purchase'],fees:['sale'],after:['sale'],month:null};
// ---------- the site's tooltip ----------
let tipEl=null;
function tip(){if(!tipEl){tipEl=document.createElement('div');tipEl.className='cb-tip';tipEl.setAttribute('role','status');$('cb').appendChild(tipEl)}return tipEl}
function showTip(anchor,html){if(noTips())return;html=hideMoney(html);const t=tip(),host=$('cb').getBoundingClientRect(),r=anchor.getBoundingClientRect();t.innerHTML=html;const w=t.offsetWidth,h=t.offsetHeight;
  let x=Math.max(8,Math.min(host.width-w-8,r.left-host.left+r.width/2-w/2)),y=r.top-host.top-h-10;if(r.top-h-10<70)y=r.bottom-host.top+10;t.style.left=x+'px';t.style.top=y+'px';t.classList.add('show')}
function hideTip(){if(tipEl)tipEl.classList.remove('show')}
function bindTip(ev,anchor,fn){ev.setAttribute('data-tip','');
  ev.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!rz&&!drag)showTip(anchor,fn())});ev.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hideTip()});
  ev.addEventListener('focus',()=>{if(!rz&&!drag)showTip(anchor,fn())});ev.addEventListener('blur',hideTip);
  ev.addEventListener('click',e=>{if(rz||drag||editing)return;if(TOUCH.matches&&ev.hasAttribute('data-drill'))return;e.stopPropagation();showTip(anchor,fn())})}

// ---------- back gesture (iOS edge swipe, Android back, the browser's Back button) closes the top layer ----------
// Each layer that opens (the board, Stories, a sheet, a menu) adds one step to history; going back closes the newest one.
// Closing a layer with its own button removes its step, so history never fills up with stale entries.
// a layer opened while a back step is still settling (menu -> Export) waits for it, so back never skips a layer or leaves the page
const NAV=[];let navSkip=0,navPopping=false,navWait=0;const navStep=k=>{try{history.pushState({cbn:k},'')}catch(e){}};
function navPush(k,fn){if(NAV.some(n=>n.k===k))return;NAV.push({k,fn});if(navSkip>0)navWait++;else navStep(k)}
function navDone(k){if(navPopping)return;const i=NAV.findIndex(n=>n.k===k);if(i<0)return;NAV.splice(i,1);if(navWait>0){navWait--;return}navSkip++;try{history.back()}catch(e){navSkip--}}
addEventListener('popstate',()=>{if(navSkip>0){navSkip--;if(!navSkip)while(navWait>0){navWait--;navStep('w')}return}const t=NAV.pop();if(!t)return;navPopping=true;try{t.fn()}catch(e){}navPopping=false});

// ---------- charts, drawn at the exact size of their box ----------
// cv() leaves a placeholder; fillCharts() measures it after layout and draws the SVG to fit.
function cv(ctx,spec){ctx.cv.push(spec);return '<div class="cv" data-cv="'+(ctx.cv.length-1)+'"></div>'}
function barsSVG(sp,W,H){
  const d=sp.data,n=d.length;if(!n||W<30||H<(sp.labels?24:14))return '';/* v50.10: small bar charts with no month letters still draw in short boxes */
  const slot=W/n,labs=sp.labels&&H>=70,every=slot<15?3:slot<22?2:1,fs=slot>40?11.5:10.5;
  const top=sp.best&&H>=110?40:4,bottom=H-(labs?20:0)-1;
  const vals=d.map(x=>x.v),lim=sp.limit||0,pos=Math.max(0,lim,...vals),neg=Math.max(0,...vals.map(v=>-v));
  const avail=bottom-top,sc=avail/((pos+neg)||1),base=top+pos*sc,bw=Math.max(2,Math.min(sp.maxW||44,slot*.62));
  let best=-1,bv=-Infinity;vals.forEach((v,i)=>{if(d[i].on!==false&&v>bv){bv=v;best=i}});
  let s='<svg class="pc" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(sp.aria||'Chart')+'"><line x1="0" x2="'+W+'" y1="'+base.toFixed(1)+'" y2="'+base.toFixed(1)+'" stroke="var(--line)" stroke-width="1.5"/>',hit='';
  d.forEach((m,i)=>{const p=m.v,h=Math.abs(p)*sc,c=i*slot+slot/2,x=c-bw/2,r=Math.min(sp.r||8,bw/3,h*.9),R=r.toFixed(1),X=x.toFixed(1),X2=(x+bw).toFixed(1),B=base.toFixed(1);
    if(h>0.5){let f=sp.color||(p>=0?'var(--cb-pos)':'var(--cb-neg)');if(lim)f=p>lim?'var(--cb-neg)':'var(--cb-gry)';
      if(p>=0){const y=base-h;s+='<path data-i="'+i+'" class="bar" style="transition-delay:'+(i*18)+'ms" d="M'+X+' '+B+'V'+(y+r).toFixed(1)+'A'+R+' '+R+' 0 0 1 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+R+' '+R+' 0 0 1 '+X2+' '+(y+r).toFixed(1)+'V'+B+'Z" fill="'+f+'"/>'}
      else{const y=base+h;s+='<path data-i="'+i+'" class="bar n" style="transition-delay:'+(i*18)+'ms" d="M'+X+' '+B+'V'+(y-r).toFixed(1)+'A'+R+' '+R+' 0 0 0 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'H'+(x+bw-r).toFixed(1)+'A'+R+' '+R+' 0 0 0 '+X2+' '+(y-r).toFixed(1)+'V'+B+'Z" fill="'+f+'"/>'}}
    if(labs&&i%every===0)s+='<text x="'+c.toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle" class="mt" style="font-size:'+fs+'px">'+esc(slot>46?m.s:m.n)+'</text>';
    hit+='<rect data-i="'+i+'" x="'+(i*slot).toFixed(1)+'" y="0" width="'+slot.toFixed(1)+'" height="'+H+'" tabindex="0" role="img" aria-label="'+esc(m.l+': '+(sp.unit||'')+' '+money(p))+'"/>'});
  if(lim){const y=(base-lim*sc).toFixed(1);s+='<line x1="0" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="var(--text)" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="4 4"/>'}
  if(sp.best&&top>4&&best>-1&&bv>0){const c=Math.max(28,Math.min(W-28,best*slot+slot/2)),y=base-bv*sc;s+='<text x="'+c.toFixed(1)+'" y="'+Math.max(15,y-25).toFixed(1)+'" text-anchor="middle" fill="var(--green)" style="font:800 15px Manrope,-apple-system,Segoe UI,sans-serif">+'+kshort(bv)+'</text><text x="'+c.toFixed(1)+'" y="'+Math.max(28,y-12).toFixed(1)+'" text-anchor="middle" fill="var(--muted)" style="font:700 9.5px Manrope,-apple-system,Segoe UI,sans-serif;letter-spacing:.02em">'+(sp.bestLabel||'best month')+'</text>'}
  return s+hit+'</svg>'}
// v50.10: a chart is drawn for the size its box has at that moment; if the box settles to another size afterwards (a
// widget that was just added, flown in or resized), it's drawn again, so bars never sit in a box of the wrong size
const CVRO=window.ResizeObserver?new ResizeObserver(es=>{es.forEach(en=>{const el=en.target;if(!el.isConnected||!el._sp){CVRO.unobserve(el);return}const W=Math.floor(el.clientWidth),H=Math.floor(el.clientHeight);if(W>4&&H>4&&(Math.abs(W-el._wh[0])>2||Math.abs(H-el._wh[1])>2)){drawCv(el,el._sp);if(typeof fitSoon==='function'&&el.closest('#simple'))fitSoon()}})}):null;
function fillCharts(root,ctx){root.querySelectorAll('.cv[data-cv]').forEach(el=>{const sp=ctx.cv[+el.dataset.cv];if(!sp)return;drawCv(el,sp);if(CVRO&&!el._ro){el._ro=1;CVRO.observe(el)}})}
function drawCv(el,sp){{const W=Math.floor(el.clientWidth),H=Math.floor(el.clientHeight);el._sp=sp;el._wh=[W,H];el.innerHTML=hideMoney((sp.pair?cbPairSVG:barsSVG)(sp,W,H));
  const svg=el.querySelector('svg');if(!svg||!sp.tip)return;if(TOUCH.matches){scrubChart(el,svg,sp);return}
  svg.querySelectorAll('rect[data-i]').forEach(rc=>{const i=+rc.dataset.i,bars=svg.querySelectorAll('path[data-i="'+i+'"]'),bar=bars[0];
    ['pointerenter','focus'].forEach(ev=>rc.addEventListener(ev,e=>{if(bar&&!rz&&(ev==='focus'||e.pointerType==='mouse'))bars.forEach(b=>b.classList.add('hv'))}));
    ['pointerleave','blur'].forEach(ev=>rc.addEventListener(ev,()=>{bars.forEach(b=>b.classList.remove('hv'))}));
    bindTip(rc,bar||rc,()=>sp.tip(i));if(sp.ent)rc.addEventListener('click',e=>{if(!canDrill())return;e.stopPropagation();openEntries(sp.ent(i))})})}}
function spark(vals){const n=vals.length;if(n<2)return '';const mx=Math.max(...vals),mn=Math.min(0,...vals),r=(mx-mn)||1;const pts=vals.map((v,i)=>[(i/(n-1)*100).toFixed(1),(28-((v-mn)/r)*26).toFixed(1)]);
  return '<svg class="spk" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="M'+pts.map(p=>p.join(' ')).join('L')+'" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
const CHIP={eBay:['--cb-crbg','--cb-cr'],TCGplayer:['--cb-blbg','--cb-bl']};
const chip=p=>{const c=CHIP[p]||['--cb-inkbg','--cb-ink'];return '<span class="ch" style="background:var('+c[0]+');color:var('+c[1]+')">'+esc(p[0])+'</span>'};
const segCol=p=>CHIP[p]?'var('+CHIP[p][1]+')':'var(--cb-gry)';
// one bar split by share: the top two platforms, then everything else as "Other"
function shareBar(rows,total){if(!rows.length||!total)return '';const top=rows.slice(0,2),rest=total-top.reduce((a,x)=>a+x.v,0),segs=top.map(x=>({k:x.k,v:x.v}));if(rest>0)segs.push({k:'Other',v:rest});
  return '<div class="shb" role="img" aria-label="'+esc(segs.map(x=>x.k+' '+Math.round(x.v/total*100)+'%').join(', '))+'">'+segs.map(x=>'<i style="flex:'+x.v+';background:'+segCol(x.k)+'" title="'+esc(x.k)+'"></i>').join('')+'</div>'}
// list rows: big sizes open in place like the site's FAQs; small sizes show the same detail in a tooltip
/* v50.14: rows never open inside the widget any more (that changed the widget's height and pushed other rows out); the
   detail shows in a hover card on computers, and a tap opens the entries behind the row */
const row=(inner,detail,_open,drill,open=false)=>'<div class="r" '+(open?'data-row':'data-tipd="'+esc(detail)+'"'+(drill?dd(drill):''))+'>'+inner+'<div class="d">'+esc(detail)+(open&&drill?' <button type="button" class="seeent"'+dd(drill)+'>See entries ›</button>':'')+'</div></div>';

// v37: At a glance, the same quick numbers as Entries (and the same picks), for the board's period and platform
NEWW.glance=function(ctx,s){const rows=window.CTMetrics&&CTMetrics.rows?CTMetrics.rows(ctx.inP):[];if(!rows.length)return '<p class="eg">Nothing in this period yet.</p>';
  const n={S:2,M:2,B:3,L:5,X:6}[s]||3,cls=s==='B'?' gl3':s==='X'?' gl2':'';
  return '<div class="gl'+cls+'">'+rows.slice(0,n).map(r=>'<div class="glr'+(r.art?' gla':'')+'">'+(r.art&&!maskNames()?'<div class="glbg" data-meta="'+esc(r.meta||'')+'" style="background-image:url(\''+esc(r.art)+'\')"></div>':(r.icon?'<span class="glic">'+r.icon+'</span>':'<span class="glic ct-cardph" aria-hidden="true"></span>'))+
    '<div class="gltx"><small>'+esc(r.label)+'</small><em>'+esc(maskNames()&&r.art?'A card from your collection':r.title)+'</em></div><div class="glv"><b class="num'+(r.green?' g':'')+'">'+hideMoney(esc(r.value))+'</b>'+(r.sub?'<span>'+hideMoney(esc(r.sub))+'</span>':'')+'</div></div>').join('')+'</div>'};
// ---------- widget bodies: one layout per metric per size ----------
function body(k,ctx,s,w){
  if(NEWW[k])return NEWW[k](ctx,s,w);
  const {p,inP,mt,unit}=ctx,t=totals(inP);
  if(KPI[k])return kpiBody(k,ctx,s,t,w);
  if(k==='month'){const data=mt.map(x=>Object.assign({},x,{v:totals(x.list).profit,on:x.list.length>0})),tot=data.reduce((a,d)=>a+d.v,0),act=data.filter(d=>d.on),bestM=act.length?act.reduce((a,d)=>d.v>a.v?d:a):null;
    const tipf=i=>{const tt=totals(mt[i].list);return '<b>'+mt[i].l+'</b>Profit <span class="'+(tt.profit>=0?'p':'l')+'">'+kshort(tt.profit)+'</span><br>Sales '+kshort(tt.sales)+'<br>Spent '+kshort(tt.spent)};
    const ch=o=>cv(ctx,Object.assign({data,tip:tipf,aria:'Profit by '+unit,unit:'profit',bestLabel:'best '+unit,ent:i=>({t:'Profit',sub:mt[i].l,a:mt[i].from,b:mt[i].to})},o));
    if(!act.length)return '<p class="eg">No entries in this period.</p>';
    if(s==='S')return '<div class="mS"><div class="cq">'+bn((bestM.v>=0?'+':'')+kshort(bestM.v),bestM.v>=0?'g':'r',30)+'</div><small class="cap">'+bestM.m+'</small>'+ch({labels:false,maxW:14,r:3})+'</div>';
    const sum='<div class="msum"><span><small>Total</small><b class="num">'+money(tot)+'</b></span><span><small>Average '+unit+'</small><b class="num">'+money(Math.round(tot/Math.max(1,data.length)))+'</b></span><span><small>Best '+unit+'</small><b class="num">'+bestM.m+'</b></span></div>';
    if(s==='M')return '<div class="fill">'+ch({labels:true,best:true,maxW:30,r:6})+'</div>';
    if(s==='B')return '<div class="split banner">'+ch({labels:true,best:false,maxW:38,r:7})+sum.replace('class="msum"','class="msum v"')+'</div>';
    return '<div class="fill">'+ch({labels:true,best:true,maxW:s==='X'?46:34,r:8})+sum+'</div>'}
  if(k==='sell'){const upTo=p.filter(e=>e.date<=ctx.b),q=ty=>upTo.filter(e=>e.type===ty),qs=ty=>q(ty).reduce((a,e)=>a+e.qty,0),b=qs('purchase'),sd=qs('sale'),r=qs('refund'),pct=b?Math.min(100,Math.round(sd/b*100)):0;
    const spent=q('purchase').reduce((a,e)=>a+e.amount,0),made=q('sale').reduce((a,e)=>a+e.net,0);
    if(!b)return '<p class="eg">No purchases yet.</p>';
    const rows=[['Bought',b,100,'var(--cb-gry)','Spent '+kshort(spent)+' · about '+kshort(spent/b)+' each'],['Sold',sd,Math.min(100,sd/b*100),'var(--cb-pos)','Made back '+kshort(made)+(sd?' · about '+kshort(made/sd)+' each':'')],['Refunded',r,Math.max(r?2:0,r/b*100),'var(--cb-neg)',r+' returned · '+(r/b*100).toFixed(1)+'% of cards bought']];
    const TY={Bought:'purchase',Sold:'sale',Refunded:'refund'};const prs=open=>rows.map(([l,n,wd,c,d])=>'<div class="pr" '+(open?'data-row':'data-tipd="'+esc(d)+'"'+dd({t:l,a:'0000-01-01',b:ctx.b,types:[TY[l]]}))+'><div class="t"><span>'+l+'</span><span>'+cnt(n,'card','cards')+'</span></div><div class="bar"><i style="width:'+wd.toFixed(1)+'%;background:'+c+'"></i></div><div class="d">'+esc(d)+(open?' <button type="button" class="seeent"'+dd({t:l,sub:'Up to '+dLong(ctx.b),a:'0000-01-01',b:ctx.b,types:[TY[l]]})+'>See entries ›</button>':'')+'</div></div>').join('');
    const hero='<div class="cq">'+bn(pct+'%','g',s==='S'?44:64)+'</div><small class="cap">of the cards you’ve bought have sold</small>';
    if(s==='S')return '<div class="sS"><div class="cq">'+bn(pct+'%','g',44)+'</div><small class="cap">of cards sold</small><div class="prog"><div class="bar"><i style="width:'+pct+'%"></i></div><small>'+sd+' of '+b+'</small></div></div>';
    /* v50.14: wide-short sizes show one bar split into sold, refunded and not sold yet, with the three counts under it (each
       with its detail on hover and its entries on tap), so nothing has to be hidden to fit */
    if(s==='M'||s==='B'){const un=Math.max(0,b-sd-r),seg=(n,c)=>n?'<i style="width:'+(n/b*100).toFixed(2)+'%;background:'+c+'"></i>':'';
      const key=rows.map(([l,n,wd,c,d])=>'<span class="sk" data-tipd="'+esc(d)+'"'+dd({t:l,a:'0000-01-01',b:ctx.b,types:[TY[l]]})+'><i style="background:'+c+'"></i>'+n+' '+l.toLowerCase()+'</span>').join('');
      return '<div class="split'+(s==='B'?' wide':'')+'"><div class="hz">'+hero+'</div><div class="sstack"><div class="sbar">'+seg(sd,'var(--cb-pos)')+seg(r,'var(--cb-neg)')+seg(un,'var(--cb-gry)')+'</div><div class="skey">'+key+'</div></div></div>'}
    if(s==='L')return '<div class="col"><div class="hz">'+hero+'</div><div class="st">'+prs(false)+'</div></div>';
    return '<div class="split wide"><div class="hz">'+hero+'<div class="facts"><span><small>Spent</small><b class="num">'+money(spent)+'</b></span><span><small>Made back</small><b class="num">'+money(made)+'</b></span></div></div><div class="st">'+prs(false)+'</div></div>'}
  if(k==='where'){const sp={},n={};inP.filter(e=>e.type==='purchase').forEach(e=>{sp[e.platform]=(sp[e.platform]||0)+e.amount;n[e.platform]=(n[e.platform]||0)+e.qty});const rows=Object.keys(sp).map(x=>({k:x,v:sp[x],n:n[x]})).sort((a,b)=>b.v-a.v);
    if(!rows.length)return '<p class="eg">No purchases in this period.</p>';
    const pc=x=>Math.round(x.v/Math.max(1,t.spent)*100)+'% of spend',det=x=>cnt(x.n,'card','cards')+' · about '+kshort(x.v/x.n)+' each';
    const list=(m,open)=>'<div class="lr">'+rows.slice(0,m).map(x=>row(chip(x.k)+'<span class="n">'+esc(x.k)+'<small>'+pc(x)+'</small></span><span class="v">'+kshort(x.v)+'</span>',det(x),open,{t:'Bought on '+x.k,a:ctx.a,b:ctx.b,types:['purchase'],plat:x.k})).join('')+'</div>';
    if(s==='S'){const x=rows[0];return '<div class="wS"><div class="who">'+chip(x.k)+'<b>'+esc(x.k)+'</b></div><div class="cq">'+bn(kshort(x.v),'',30)+'</div><small class="cap">'+pc(x)+'</small>'+shareBar(rows,t.spent)+'</div>'}
    if(s==='M')return list(3,false);
    if(s==='B')return '<div class="split wide"><div class="hz"><small class="cap">Spent across '+cnt(rows.length,'platform','platforms')+'</small><div class="cq">'+bn(money(t.spent),'',36)+'</div>'+shareBar(rows,t.spent)+'</div>'+list(3,false)+'</div>';
    if(s==='L')return '<div class="col">'+shareBar(rows,t.spent)+list(5,true)+'</div>';
    return '<div class="split wide"><div class="hz"><small class="cap">Spent across '+cnt(rows.length,'platform','platforms')+'</small><div class="cq">'+bn(money(t.spent),'',44)+'</div>'+shareBar(rows,t.spent)+'</div>'+list(6,true)+'</div>'}
  if(k==='kept'){const g={};inP.filter(e=>e.type==='sale').forEach(e=>{const o=g[e.platform]||(g[e.platform]={s:0,f:0,n:0});o.s+=e.amount;o.f+=e.amount-e.net;o.n++});
    const rows=Object.keys(g).filter(x=>g[x].s>0).map(x=>({k:x,pct:g[x].f/g[x].s*100,f:g[x].f,n:g[x].n})).sort((a,b)=>b.pct-a.pct),mx=Math.max(1,...rows.map(r=>r.pct));
    if(!rows.length)return '<p class="eg">No sales in this period.</p>';
    const det=x=>kshort(x.f)+' in fees and shipping on '+cnt(x.n,'sale','sales');
    const list=(m,open,cls)=>'<div class="lr kl '+(cls||'')+'">'+rows.slice(0,m).map(x=>row(chip(x.k)+'<span class="n">'+esc(x.k)+'<small><i class="kb2"><b style="width:'+(x.pct/mx*100).toFixed(1)+'%;background:'+segCol(x.k)+'"></b></i></small></span><span class="v">'+x.pct.toFixed(1)+'%</span>',det(x),open,{t:'Sold on '+x.k,a:ctx.a,b:ctx.b,types:['sale'],plat:x.k,fees:true})).join('')+'</div>';
    if(s==='S'){const x=rows[0];return '<div class="wS"><div class="who">'+chip(x.k)+'<b>'+esc(x.k)+'</b></div><div class="cq">'+bn(x.pct.toFixed(1)+'%','',34)+'</div><small class="cap">of each '+esc(x.k)+' sale</small></div>'}
    if(s==='M')return list(3,false);
    // Banner and Extra large match "Where you buy": the overall number on the left, the platforms listed on the right
    const allS=rows.reduce((a2,x)=>a2+g[x.k].s,0),allF=rows.reduce((a2,x)=>a2+x.f,0),sum=fz=>'<div class="hz"><small class="cap">Platforms kept, on average</small><div class="cq">'+bn((allS?allF/allS*100:0).toFixed(1)+'%','',fz)+'</div><small class="cap">'+kshort(allF)+' of '+kshort(allS)+' in sales</small></div>';
    if(s==='B')return '<div class="split wide">'+sum(36)+list(3,false)+'</div>';
    if(s==='L')return list(5,true);
    return '<div class="split wide">'+sum(44)+list(6,true)+'</div>'}
  if(k==='win'){const key=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+e.no,buys={},sells={};p.filter(e=>e.type==='purchase').forEach(e=>{(buys[key(e)]=buys[key(e)]||[]).push(e)});inP.filter(e=>e.type==='sale').forEach(e=>{(sells[key(e)]=sells[key(e)]||[]).push(e)});
    const wins=Object.keys(sells).filter(x=>buys[x]).map(x=>{const b=buys[x].reduce((a,e)=>a+e.amount,0),sv=sells[x].reduce((a,e)=>a+e.net,0);return {g:sv-b,b,s:sv,e:sells[x][0]}}).filter(w=>w.g>0).sort((a,b)=>b.g-a.g);
    if(!wins.length)return '<p class="eg">No card bought and sold in this period yet.</p>';const w=wins[0];
    const nmOf=x=>maskNames()?'A card from your collection':x.e.name;const art='<span class="art" aria-hidden="true">'+(maskNames()?'':esc(w.e.name[0]))+'</span>',meta=maskNames()?esc(w.e.platform):esc([w.e.no,w.e.set].filter(Boolean).join(' · ')||w.e.platform);
    const also=m=>wins.length>1?'<div class="alsoup"><p class="mh2">Also up</p>'+wins.slice(1,m+1).map(x=>'<div class="mr"><span>'+esc(nmOf(x))+'</span><b class="num">'+ksigned(x.g)+'</b></div>').join('')+'</div>':'';
    if(s==='S')return '<div class="winS drill"'+dd({t:w.e.name,sub:'Every entry for this card',card:key(w.e)})+' role="button" tabindex="0" title="See the entries">'+art+'<div class="wtx"><div class="cq">'+bn(ksigned(w.g),'g',28)+'</div><b class="nm">'+esc(nmOf(w))+'</b><small>Bought '+kshort(w.b)+' · Sold '+kshort(w.s)+'</small></div></div>';
    const hero='<div class="bestc drill"'+dd({t:w.e.name,sub:'Every entry for this card',card:key(w.e)})+' role="button" tabindex="0" title="See the entries">'+art+'<div class="wtx"><b class="nm">'+esc(nmOf(w))+'</b><em class="no">'+meta+'</em><small>Bought '+kshort(w.b)+' · Sold '+kshort(w.s)+'</small><span class="amt num">'+ksigned(w.g)+'</span></div></div>';
    if(s==='M')return hero;
    if(s==='B')return '<div class="split wide">'+hero+also(3)+'</div>';
    if(s==='L')return '<div class="col">'+hero+also(3)+'</div>';
    return '<div class="split wide">'+hero+also(5)+'</div>'}
  if(k==='budget'){const _m=[];for(let m=ctx.a.slice(0,7);m<=ctx.b.slice(0,7);m=nextMonth(m))_m.push(m);const bk=_m.slice(-12),bt=bk.map(x=>totals(p.filter(e=>ym(e.date)===x)).spent),under=bt.filter(v=>v<=BUDGET).length,now=bt[bt.length-1]||0;
    const data=bk.map((x,i)=>({k:x,v:bt[i],n:mLabel(x,{month:'narrow'}),s:mLabel(x,{month:'short'}),l:mLong(x)})),tipf=i=>{const d=BUDGET-bt[i];return '<b>'+mLong(bk[i])+'</b>Spent '+kshort(bt[i])+' of '+kshort(BUDGET)+'<br><span class="'+(d>=0?'p':'l')+'">'+kshort(Math.abs(d))+(d>=0?' under':' over')+'</span>'};
    const ch=o=>cv(ctx,Object.assign({data,limit:BUDGET,tip:tipf,aria:'Spending by month against a $150 budget',unit:'spent',ent:i=>({t:'Spent',sub:mLong(bk[i]),a:bk[i]+'-01',b:lastDay(bk[i]),types:['purchase']})},o));
    const hero='<div class="bh"><b class="num">'+under+'<i> of '+bk.length+'</i></b><small class="cap">'+(bk.length===1?'month':'months')+' under budget</small></div>';
    const note='<span class="eg">Example budget of $150 a month</span>';
    if(s==='S')return '<div class="bS">'+hero.replace(/months? under budget/,'under budget')+ch({labels:false,maxW:12,r:3})+'</div>';
    if(s==='M')return '<div class="split"><div class="hz">'+hero+'</div>'+ch({labels:true,maxW:18,r:4})+'</div>';
    const thisM='<div class="facts"><span><small>This month</small><b class="num">'+kshort(now)+' of '+kshort(BUDGET)+'</b></span></div>';
    if(s==='B')return '<div class="split wide"><div class="hz">'+hero+thisM+'</div>'+ch({labels:true,maxW:30,r:6})+'</div>';
    if(s==='L')return '<div class="col">'+hero+ch({labels:true,maxW:24,r:5})+note+'</div>';
    return '<div class="split wide"><div class="hz">'+hero+thisM+note+'</div>'+ch({labels:true,maxW:36,r:7})+'</div>'}
  return ''}
function kpiBody(k,ctx,s,t,w){const T=!(w&&w.trend===false);
  const {inP,mt,unit}=ctx,v=KPI[k](t),pv=ctx.prevP?KPI[k](totals(ctx.prevP)):0,chg=pv?((v-pv)/Math.abs(pv))*100:null,up=chg!=null&&chg>=0,good=chg==null?null:(GOOD[k]==='up'?up:!up);
  const series=mt.map(x=>KPI[k](totals(x.list))),bi=series.reduce((a,x,i)=>x>series[a]?i:a,0);
  const sub=k==='profit'?cnt(t.n,'entry','entries'):k==='sales'?cnt(inP.filter(e=>e.type==='sale').length,'sale','sales'):k==='spent'?cnt(inP.filter(e=>e.type==='purchase').length,'purchase','purchases'):k==='after'?kshort(t.fees)+' in fees':(t.sales?(t.fees/t.sales*100).toFixed(1):'0.0')+'% of sales';
  // the change now sits beside the widget's name; under the number only the count shows, and only when there's nothing to compare
  const cls=k==='profit'?(v>=0?'g':'r'):'',dl=chg==null?'<span class="sm">'+sub+'</span>':'',kdv=dl?'<div class="kd">'+dl+'</div>':'';
  const spk='<div class="kspk'+(k==='profit'?(v<0?' r':''):' mu')+'">'+spark(series)+'</div>';
  const nm=CATALOG[k].t.toLowerCase(),tipf=i=>{const tt=totals(mt[i].list);return '<b>'+mt[i].l+'</b>'+CATALOG[k].t+' <span class="'+(k==='profit'?(tt.profit>=0?'p':'l'):'')+'">'+kshort(KPI[k](tt))+'</span>'};
  const bars=o=>cv(ctx,Object.assign({data:mt.map((x,i)=>Object.assign({},x,{v:series[i],on:x.list.length>0})),color:KCOL[k],tip:tipf,aria:CATALOG[k].t+' by '+unit,unit:nm,ent:i=>({t:CATALOG[k].t,sub:mt[i].l,a:mt[i].from,b:mt[i].to,types:KTYPES[k]})},o));
  const drill=dd({t:CATALOG[k].t,a:ctx.a,b:ctx.b,types:KTYPES[k],fees:k==='fees'});
  const avg=money(Math.round(series.reduce((a,x)=>a+x,0)/Math.max(1,series.length)));
  // with the trend hidden, the number gets the room and the count takes the chart's place
  if(s==='S')return '<div class="kS'+(T?'':' notr')+'"><div class="cq drill"'+drill+' role="button" tabindex="0" title="See the entries">'+bn(money(v),cls,T?34:40)+'</div>'+kdv+''+(T?spk:'<small class="cap kfoot">'+sub+'</small>')+'</div>';
  if(s==='M'){const hz='<div class="hz"><div class="cq drill"'+drill+' role="button" tabindex="0" title="See the entries">'+bn(money(v),cls,T?40:48)+'</div>'+'<small class="cap">'+sub+'</small></div>';return T?'<div class="split">'+hz+spk+'</div>':hz}
  if(s==='B'){const hz='<div class="hz"><div class="cq drill"'+drill+' role="button" tabindex="0" title="See the entries">'+bn(money(v),cls,44)+'</div>'+'<small class="cap">'+sub+'</small></div>';return T?'<div class="split wide">'+hz+bars({labels:true,maxW:30,r:6})+'</div>':hz}
  const facts='<div class="facts"><span><small>Average '+unit+'</small><b class="num">'+avg+'</b></span><span><small>Best '+unit+'</small><b class="num">'+mt[bi].m+'</b></span>'+(s==='X'?'<span><small>'+(k==='fees'?'Share of sales':'Count')+'</small><b class="num">'+(k==='fees'?sub.replace(' of sales',''):sub)+'</b></span>':'')+'</div>';
  if(s==='L')return '<div class="col'+(T?'':' notrend')+'"><div class="cq drill"'+drill+' role="button" tabindex="0" title="See the entries">'+bn(money(v),cls,T?48:60)+'</div>'+kdv+''+(T?bars({labels:true,maxW:26,r:6}):'')+facts+'</div>';
  const hz='<div class="hz"><div class="cq drill"'+drill+' role="button" tabindex="0" title="See the entries">'+bn(money(v),cls,56)+'</div>'+kdv+''+facts+'</div>';return T?'<div class="split wide">'+hz+bars({labels:true,maxW:40,r:8})+'</div>':hz}

function kpiDelta(k,ctx){if(!KPI[k]||!ctx.prevP)return '';const v=KPI[k](totals(ctx.inP)),pv=KPI[k](totals(ctx.prevP));if(!pv)return '';
  const chg=(v-pv)/Math.abs(pv)*100,up=chg>=0,good=GOOD[k]==='up'?up:!up,vs=compare==='year'?'vs last year':'vs previous period';
  return '<span class="dl hd '+(good?'up':'dn')+'" title="'+vs+'" aria-label="'+(up?'Up ':'Down ')+Math.abs(chg).toFixed(0)+'% '+vs+'">'+(up?'▲':'▼')+'\u2009'+Math.abs(chg).toFixed(0)+'%</span>'}
const GRIP='<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M13 5L5 13M13 9.5L9.5 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
function widgetHTML(w,ctx,extra){const s=eff(w.size),t=w.name||(w.k==='month'?'Profit by '+ctx.unit:w.k==='feat'?FEAT[FEAT[w.metric]?w.metric:'win'].t:w.k==='bd'?cbBdTitle(w):w.k==='inout'?'In vs out by '+ctx.unit:CATALOG[w.k].t),tt=w.name||(s==='S'&&w.k!=='feat'?(w.k==='month'?'Best '+ctx.unit:CATALOG[w.k].s):t);
  return '<section class="w wq sz'+w.size+' e'+s+(s==='B'?' eM':'')+' k-'+w.k+(extra?' '+extra:'')+'" data-id="'+w.id+'" data-k="'+w.k+'" aria-label="'+esc(t)+', '+SIZE_NAMES[s]+'"><div class="wh"><div class="wtl"><h3 class="ttl" title="'+esc(t)+'">'+esc(tt)+'</h3>'+kpiDelta(w.k,ctx)+'</div><button type="button" class="wmore" aria-label="Options for '+t+'" aria-haspopup="true">⋯</button></div><div class="wb">'+hideMoney(body(w.k,ctx,s,w))+'</div>'+
    '<button type="button" class="rm" aria-label="Remove '+t+'"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>'+
    '<button type="button" class="grip" aria-label="Resize '+t+'. Now '+SIZE_NAMES[s]+'. Arrow keys change the size." title="Drag to resize">'+GRIP+'</button></section>'}

// ---------- interactions inside widgets, matching the site ----------
function wire(root,ctx){settleWalls(root);
  fillCharts(root,ctx);
  root.querySelectorAll('[data-tipd]').forEach(el=>{el.tabIndex=0;bindTip(el,el,()=>esc(el.dataset.tipd))});
  // tap-to-open rows, one open at a time per widget, like the site's FAQs
  (root.matches&&root.matches('.w')?[root]:[...root.querySelectorAll('.w')]).forEach(sec=>{const list=[...sec.querySelectorAll('[data-row]')];list.forEach(el=>{el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-expanded','false');
    const tog=e=>{if(e&&e.target&&e.target.closest('.seeent'))return;if(rz||drag||editing||noTips())return;const o=el.getAttribute('aria-expanded')==='true';list.forEach(x=>x.setAttribute('aria-expanded','false'));el.setAttribute('aria-expanded',!o)};
    el.addEventListener('click',e=>tog(e));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog()}})})});
}

// ---------- render, with smooth reflow ----------
function rects(){const m={};$('simple').querySelectorAll('.w[data-id]').forEach(el=>m[el.dataset.id]=el.getBoundingClientRect());return m}
// widgets touching the right edge put their resize grip on the bottom-left, so there's always room to drag outward
function markEdges(){const sim=$('simple'),W=sim.clientWidth;sim.querySelectorAll('.w[data-id]').forEach(el=>{const L=el.offsetLeft,R=L+el.offsetWidth;el.classList.toggle('edgeR',R>=W-2&&L>2)})}
function flip(before,skip){markEdges();if(calm.matches)return;const els=[...$('simple').querySelectorAll('.w[data-id]')].filter(el=>el.dataset.id!==skip);
  els.forEach(el=>el.getAnimations().forEach(a=>{if(a.id==='fl')a.cancel()}));
  els.forEach(el=>{const a=before[el.dataset.id],b=el.getBoundingClientRect();
  if(!a){el.animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.7,.2,1)',id:'fl'});return}
  const dx=a.left-b.left,dy=a.top-b.top;if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
  el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{duration:340,easing:'cubic-bezier(.2,.7,.2,1)',id:'fl'})})}
// desktop: size the rows so the first three always fit in the window under the top bar (between 150 and 206px tall)
// desktop: the first three rows always fit in the window. Rows grow up to 206px; on short windows the space under the
// top bar gives way first (60px down to 28px) so widgets stay at least 180px tall, then rows shrink no lower than 168px.
function fitRows(){const cb=$('cb'),sim=$('simple');if(units()<4){cb.style.removeProperty('--rowh');cb.style.removeProperty('--topgap');cb.classList.remove('rowtight');return}
  const tb=cb.querySelector('.topbar'),rg=parseFloat(getComputedStyle(sim).rowGap)||16;
  if(editing&&cb.style.getPropertyValue('--rowh'))return;// edit mode adds an "Add widget" bar above the widgets; keep the fit you had
  // measure from the top bar (plus the free plan's quiet line), never from edit-mode extras
  const q=cb.querySelector('.cbquiet'),qh=q&&!q.hidden?q.offsetHeight+(parseFloat(getComputedStyle(q).marginBottom)||0):0;
  // v50.13: the top bar sticks to the top while scrolling, so it only shows where it really sits when the board is
  // scrolled to the top. Measure it then, and reuse that while scrolled (leaving edit mode lower down used to measure the
  // stuck bar, think there was less room, and shrink every row so widgets dropped details)
  const tk=innerWidth+'x'+cbx.clientHeight;let tbB;
  if(cbx.scrollTop<2||!fitRows.k||fitRows.k!==tk){tbB=tb.getBoundingClientRect().bottom-cbx.getBoundingClientRect().top+(cbx.scrollTop<2?cbx.scrollTop:0);if(cbx.scrollTop<2){fitRows.k=tk;fitRows.b=tbB}else if(fitRows.b)tbB=Math.min(tbB,fitRows.b)}else tbB=fitRows.b;
  const top0=tbB+qh,room=cbx.clientHeight-top0-28-2*rg;
  let g=48;while(g>24&&(room-g)/4<140)g-=4;const h=Math.max(128,Math.min(168,Math.floor((room-g)/4)));// v43: the first four rows fit (one row of numbers and two-row widgets under it)
  cb.style.setProperty('--topgap',g+'px');cb.style.setProperty('--rowh',h+'px');cb.classList.toggle('rowtight',h<150)}
function render(animate){
  fitBudget();fitRows();const before=animate?rects():null,ctx=ctxNow();hideTip();
  $('simple').innerHTML=layout.map(w=>widgetHTML(w,ctx)).join('')+(!editing&&!customized()&&!viewing?'<button type="button" class="mkw szS" id="mkw"><span class="pl" aria-hidden="true">+</span><b>Make it yours</b><small>Add, resize and move widgets</small></button>':'');$('addw').hidden=!editing;
  $('cb').classList.toggle('editing',editing);wire($('simple'),ctx);markEdges();
  if(before)flip(before)}
function grow(){const cb=$('cb');if(calm.matches)return;cb.classList.add('grow');void cb.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>cb.classList.remove('grow')))}
phone.addEventListener('change',()=>{swapLayout();if(shown)render(false)});
let rsT=0,lastW=innerWidth,lastH=innerHeight;addEventListener('resize',()=>{if(!shown||rz||drag||(Math.abs(innerWidth-lastW)<2&&(units()<4||Math.abs(innerHeight-lastH)<2)))return;clearTimeout(rsT);rsT=setTimeout(()=>{lastW=innerWidth;lastH=innerHeight;render(false)},120)});

// ---------- period and platform pickers ----------
// menus inside the scrolling phone toolbar would be cut off, so there they float above everything, under their button
function placeMenu(btn,m){m.style.position='';m.style.top='';m.style.left='';m.style.right='';if(!btn.closest('.tctl')||getComputedStyle(btn.closest('.tctl')).overflowX==='visible')return;
  const r=btn.getBoundingClientRect(),w=m.offsetWidth;m.style.position='fixed';m.style.top=(r.bottom+6)+'px';m.style.right='auto';m.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+'px'}
function closeMenus(){document.querySelectorAll('.cbx .cb-menu,#cb-amenu').forEach(m=>{m.hidden=true});document.querySelectorAll('.cbx [aria-haspopup]').forEach(b=>b.setAttribute('aria-expanded','false'))}
function pickMenu(btn,menuEl,items,cur,onPick,foot){
  btn.addEventListener('click',e=>{e.stopPropagation();hideTip();const o=menuEl.hidden;closeMenus();if(!o)return;menuEl.innerHTML=items().map(([k,l])=>'<button type="button" role="menuitemradio" aria-checked="'+(k===cur())+'" data-k="'+esc(k)+'">'+esc(l)+'</button>').join('')+(foot?foot():'');menuEl.hidden=false;btn.setAttribute('aria-expanded','true');placeMenu(btn,menuEl)});
  menuEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.cmp){setCompare(b.dataset.cmp);b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',x===b));return}onPick(b.dataset.k,b.textContent);closeMenus()})}
pickMenu($('cb-per'),$('cb-menu'),()=>PERIODS,()=>period,(k,l)=>{if(cbFree()&&!FREE_P.includes(k)){cbPremium('range');return}if(k==='custom'){openCustom();return}period=k;$('cb-perl').textContent=l;saveView();render(false);grow()},()=>cbFree()?'':'<div class="mcmp"><span>Compare to</span><div class="seg">'+COMPARE.map(([c,l])=>'<button type="button" data-cmp="'+c+'" aria-checked="'+(compare===c)+'">'+l.replace('Previous period','Previous')+'</button>').join('')+'</div></div>');
// custom dates: a range calendar. First tap sets the start, second tap the end; tap From or To to change just that one.
const cr=$('cr'),COMPARE=[['prev','Previous period'],['year','Last year'],['off','Off']];let cal=null;
function setCompare(c){compare=c;try{localStorage.setItem('cb.compare',c)}catch(e){}render(false)}
const dLong=d=>dFmt(d,{month:'short',day:'numeric',year:'numeric'});
const customLabel=()=>{const sameY=custom.from.slice(0,4)===custom.to.slice(0,4);return dFmt(custom.from,sameY?{month:'short',day:'numeric'}:{month:'short',day:'numeric',year:'numeric'})+' – '+dLong(custom.to)};
(function restoreView(){try{const v=JSON.parse(localStorage.getItem(VKEY));if(!v)return;if(v.custom&&v.custom.from)custom=v.custom;if(PERIODS.some(p=>p[0]===v.period)&&(v.period!=='custom'||custom.from)){period=v.period;$('cb-perl').textContent=period==='custom'?customLabel():PERIODS.find(p=>p[0]===period)[1]}
  if(v.plat&&(v.plat==='all'||E.some(e=>e.platform===v.plat))){plat=v.plat;$('cb-platl').textContent=plat==='all'?'All platforms':plat}}catch(e){}})();
fitFreePeriod();
// v37: the board follows the date you pick on Entries (one date for both pages); the app calls this whenever it changes
window.cbLinkRange=function(from,to,label){window.cbLinked=true;
/* v39.7: Free keeps the Board to the last 3 months, even when it follows the Entries date */
if(cbFree()){const min=rangeFor('l3')[0];if(!from||to<min||from<min){if(from&&to>=min&&from<min){from=min}else{from=null;to=null}if(!from){period='l3';const l=$('cb-perl');if(l)l.textContent='Last 3 months';if(!cbLinkRange.told){cbLinkRange.told=1;toast('Free shows the last 3 months here')}render(false);if(window.CTPage&&CTPage.cur==='board')grow();return}custom={from,to};period='custom';const l=$('cb-perl');if(l)l.textContent=customLabel();render(false);if(window.CTPage&&CTPage.cur==='board')grow();return}}
if(from){custom={from,to};period='custom'}else period='all';const l=$('cb-perl');if(l)l.textContent=label;render(false);if(window.CTPage&&CTPage.cur==='board')grow()};
window.cbPlat={list:()=>[['all','All platforms']].concat([...new Set(E.map(e=>e.platform))].sort().map(p=>[p,p])),get:()=>plat,set:(k,l)=>{plat=k;$('cb-platl').textContent=l;saveView();render(false);grow()}};
function openCustom(){cr.classList.remove('pre','cust');$('cr-h').textContent='Custom dates';const [a,b]=rangeFor(period);cal={from:custom.from||a,to:custom.to||b,pick:'from',cmp:compare};cal.view=cal.to.slice(0,7);drawCal();cr.showModal()}
function drawCal(){const mn=startDate(),mx=TODAY,v=cal.view,dow=new Date(v+'-01T12:00:00').getDay(),nd=+lastDay(v).slice(8);
  $('cr-title').textContent=mLabel(v,{month:'long',year:'numeric'});$('cr-prev').disabled=v<=mn.slice(0,7);$('cr-next').disabled=v>=mx.slice(0,7);
  let h='';for(let i=0;i<dow;i++)h+='<span class="pad"></span>';
  for(let d=1;d<=nd;d++){const ds=v+'-'+pad(d),dis=ds<mn||ds>mx,f=ds===cal.from,t=ds===cal.to,span=cal.from&&cal.to&&cal.from!==cal.to,inr=span&&ds>cal.from&&ds<cal.to;
    h+='<button type="button" class="cd'+(f?' sel':'')+(t?' sel':'')+(inr?' in':'')+(f&&span?' rs':'')+(t&&span?' re':'')+(ds===TODAY?' today':'')+'" data-d="'+ds+'"'+(dis?' disabled':'')+' aria-pressed="'+(f||t)+'" aria-label="'+dFmt(ds,{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'"><span>'+d+'</span></button>'}
  $('cr-days').innerHTML=h;
  $('cr-f').textContent=cal.from?dLong(cal.from):'Pick a date';$('cr-t').textContent=cal.to?dLong(cal.to):'Pick a date';
  $('cr-fb').classList.toggle('on',cal.pick==='from');$('cr-tb').classList.toggle('on',cal.pick==='to');
  $('cr-cmp').querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',b.dataset.cmp===cal.cmp));
  const ok=cal.from&&cal.to;$('cr-go').disabled=!ok;
  $('cr-n').textContent=!ok?'Tap the last day of the range.':cnt(days(cal.from,cal.to),'day','days')+(cal.cmp==='off'?'':cal.cmp==='year'?' · compared with the same dates last year':' · compared with the '+cnt(days(cal.from,cal.to),'day','days')+' before')}
cr.addEventListener('click',e=>{if(e.target===cr){cr.close();return}const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.d){const ds=b.dataset.d;
    if(cal.pick==='to'&&cal.from){if(ds<cal.from){cal.to=cal.from;cal.from=ds}else cal.to=ds;cal.pick='from'}
    else{cal.from=ds;if(cal.to&&cal.to<ds||cal.pick==='from')cal.to=null;cal.pick='to'}
    buzz('tick');drawCal();return}
  if(b.id==='cr-prev'||b.id==='cr-next'){const x=new Date(cal.view+'-15T12:00:00');x.setMonth(x.getMonth()+(b.id==='cr-next'?1:-1));cal.view=iso(x).slice(0,7);drawCal();return}
  if(b.id==='cr-fb'){cal.pick='from';if(cal.from)cal.view=cal.from.slice(0,7);drawCal();return}
  if(b.id==='cr-tb'){cal.pick='to';if(cal.to)cal.view=cal.to.slice(0,7);drawCal();return}
  if(b.dataset.cmp){cal.cmp=b.dataset.cmp;drawCal();return}
  if(b.id==='cr-go'){custom={from:cal.from,to:cal.to};period='custom';compare=cal.cmp;try{localStorage.setItem('cb.compare',compare)}catch(e){}const sameY=custom.from.slice(0,4)===custom.to.slice(0,4);
    $('cb-perl').textContent=customLabel();saveView();buzz('firm');cr.close();render(false);grow();return}
  if(b.hasAttribute('data-close'))cr.close()});
pickMenu($('cb-plat'),$('cb-pmenu'),()=>[['all','All platforms']].concat([...new Set(E.map(e=>e.platform))].sort().map(p=>[p,p])),()=>plat,(k,l)=>{plat=k;$('cb-platl').textContent=l;saveView();render(false);grow()});
// One profile menu for the board and Stories: same rows everywhere, only the middle group changes with where you are
function menuCtx(ctx){const m=$('cb-amenu');m.dataset.ctx=ctx;m.querySelectorAll('.amctx').forEach(g=>g.hidden=g.dataset.ctx!==ctx);
  m.querySelectorAll('[data-here]').forEach(b=>{const on=b.dataset.here===ctx;b.classList.toggle('here',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
$('cb-acct').addEventListener('click',e=>{e.stopPropagation();hideTip();const m=$('cb-amenu'),o=m.hidden;closeMenus();if(o){menuCtx('board');m.hidden=false;$('cb-acct').setAttribute('aria-expanded','true')}});
// Opened from Stories: the same menu, moved into a top-level holder above the Stories layer (the board sits in its own layer)
const mhost=document.createElement('div');mhost.className='mhost';mhost.innerHTML='<div class="mhbd"></div>';document.body.appendChild(mhost);
;(()=>{const re=/\.cbx(\.[\w-]+)?\s+#cb\b/g,hit=t=>/(\.cb-menu|#cb-amenu|\.am\b|\.amg|\.amr|\.amh|\.av\b|\.prem2|\.swt|\.seg\b)/.test(t);const add=[];
  const walk=(rules,wrap)=>{for(const r of rules){try{if(r.cssRules&&r.media){walk(r.cssRules,'@media '+r.media.mediaText);continue}if(!r.selectorText)continue;
    const sel=r.selectorText.split(',').map(x=>x.trim()).filter(x=>(hit(x)||x==='#cb *')&&/^(\.cbx|#cb\b)/.test(x)&&!/\.cbx\.(lock|mover)/.test(x)).map(x=>x.replace(re,'.mhost').replace(/^\.cbx\s+/,'.mhost ').replace(/^#cb\b/,'.mhost'));
    if(sel.length)add.push((wrap?wrap+'{':'')+sel.join(',')+'{'+r.style.cssText+'}'+(wrap?'}':''))}catch(e){}}};
  for(const sh of document.styleSheets){try{walk(sh.cssRules,'')}catch(e){}}
  const st=document.createElement('style');st.textContent=add.join('\n')+'\n.mhost{position:fixed;inset:0;z-index:96;pointer-events:none}.mhost:empty,.mhost:not(.on){display:none}.mhost .mhbd{position:absolute;inset:0;background:rgba(10,10,10,.32);pointer-events:auto;animation:mhfade .22s ease both}@media(min-width:761px){.mhost .mhbd{background:transparent}}.mhost #cb-amenu{pointer-events:auto}@keyframes mhfade{from{opacity:0}}';document.head.appendChild(st)})();
const MVARS=['--cb-hl','--bg','--card','--text','--muted','--line','--brand','--err','--hl','--cb-pos','--cb-alt','--hair','--whisper','--surface','--raised','--s-card','--s-hair'];
function mhVars(){const cs=getComputedStyle($('cb'));MVARS.forEach(v=>{const x=cs.getPropertyValue(v);if(x)mhost.style.setProperty(v,x)});mhost.style.fontFamily=cs.fontFamily;mhost.style.color=cs.color;mhost.style.colorScheme=cs.colorScheme}
const mhome=()=>$('cb-acct').closest('.acctw');
window.cbMenu=function(r){const m=$('cb-amenu');if(!m.hidden){closeMenus();return}closeMenus();menuCtx('stories');mhVars();mhost.appendChild(m);mhost.classList.add('on');
  if(r&&!matchMedia('(max-width:760px)').matches){m.style.position='fixed';m.style.top=(r.bottom+8)+'px';m.style.right=Math.max(12,innerWidth-r.right)+'px';m.style.left='auto'}
  m.hidden=false};
window.cbMenuClose=function(){if(!$('cb-amenu').hidden)closeMenus()};
mhost.querySelector('.mhbd').addEventListener('click',()=>closeMenus());
new MutationObserver(()=>{const m=$('cb-amenu');if(m.hidden&&m.parentNode===mhost){mhost.classList.remove('on');m.style.position=m.style.top=m.style.right=m.style.left='';mhome().appendChild(m)}}).observe($('cb-amenu'),{attributes:true,attributeFilter:['hidden']});
document.addEventListener('click',e=>{if(!e.target.closest('.perwrap')&&!e.target.closest('#wmenu'))closeMenus();if(!e.target.closest('#cb [data-tip]'))hideTip()});

// ---------- customize ----------
const DONE_UNUSED=0;const EDIT_I='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',DONE_I='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.8l4 3.9L18.5 7.8"/></svg>';
function setEditing(on){if(on){buzz('tap');(window.requestIdleCallback||(f=>setTimeout(f,120)))(prebuildAdd,{timeout:600})}editing=on;$('cb-edit').innerHTML=(on?DONE_I:EDIT_I)+'<span>'+(on?'Done':'Edit')+'</span>';$('cb-edit').classList.toggle('on',on);$('editfoot').hidden=!on;render(true)}
$('cb-edit').addEventListener('click',()=>setEditing(!editing));
// reset asks first, and sits far from Done
const rs=$('rs');$('cb-reset').addEventListener('click',()=>{buzz('tap');rs.showModal()});
rs.addEventListener('click',e=>{if(e.target===rs){rs.close();return}const b=e.target.closest('button');if(!b)return;
  if(b.id==='rs-yes'){rs.close();layout=JSON.parse(JSON.stringify(defL()));save();try{localStorage.removeItem('cb.custom')}catch(err){}buzz('warn');render(true)}else rs.close()});
$('addw').addEventListener('click',()=>openAdd());
let undoT=0;function showUndo(msg,fn){const u=$('undo');$('undo-t').textContent=msg;u.hidden=false;u.classList.remove('out');$('undo-b').onclick=()=>{clearTimeout(undoT);hideUndo();fn()};clearTimeout(undoT);undoT=setTimeout(hideUndo,5000)}
function hideUndo(){const u=$('undo');if(u.hidden)return;u.classList.add('out');setTimeout(()=>{u.hidden=true;u.classList.remove('out')},200)}
function removeWidget(id){buzz('warn');const el=$('simple').querySelector('.w[data-id="'+id+'"]'),i=layout.findIndex(w=>w.id===id);if(i<0)return;const gone=layout[i];window.CTTrack&&CTTrack.ev('widget_remove',CATALOG[gone.k].t);layout.splice(i,1);save();
  showUndo((gone.name||CATALOG[gone.k].t)+' removed',()=>{layout.splice(Math.min(i,layout.length),0,gone);save();buzz('tick');render(true)});
  if(!el||calm.matches){render(true);return}
  el.style.pointerEvents='none';el.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.9)'}],{duration:180,easing:'ease-in',fill:'forwards'}).onfinish=()=>render(true)}
function moveWidget(id,d){const i=layout.findIndex(w=>w.id===id),j=i+d;if(i<0||j<0||j>=layout.length)return;layout.splice(j,0,layout.splice(i,1)[0]);save();render(true)}
$('simple').addEventListener('click',e=>{
  if(justDragged){justDragged=false;e.stopPropagation();return}
  if(e.target.closest('#mkw')){setEditing(true);setTimeout(openAdd,220);return}
  if(TOUCH.matches&&canDrill()){const kb=e.target.closest('.kback');if(kb){e.stopPropagation();if(e.target.closest('.kgo'))openEntries(JSON.parse(kb.dataset.o));flipTile(kb.closest('.w'),null);return}const cq=e.target.closest('.cq.drill');if(cq){const ww=cq.closest('.w'),kk=ww&&byId(ww.dataset.id);if(kk&&FLIP[kk.k]){e.stopPropagation();flipTile(ww,kk.k,JSON.parse(cq.dataset.drill));return}}}
  const dr=e.target.closest('[data-drill]');if(dr&&canDrill()){e.stopPropagation();openEntries(JSON.parse(dr.dataset.drill));return}
  const sec=e.target.closest('.w[data-id]');if(!sec)return;const w=byId(sec.dataset.id);if(!w)return;
  if(e.target.closest('.rm')){removeWidget(w.id);return}
  const more=e.target.closest('.wmore,.bdpick');if(more){e.stopPropagation();openWidgetMenu(more,w)}
});
// swap one widget's content for its layout at a new size, in place
function rebuild(id){const w=byId(id),el=$('simple').querySelector('.w[data-id="'+id+'"]');if(!w||!el)return null;const ctx=ctxNow(),tmp=document.createElement('div');tmp.innerHTML=widgetHTML(w,ctx);const nw=tmp.firstChild;el.replaceWith(nw);wire(nw,ctx);return nw}
function setSize(id,s){const w=byId(id);if(!w||w.size===s)return;window.CTTrack&&CTTrack.ev('widget_size',s);buzz('tick');const before=rects();w.size=s;save();const el=rebuild(id);flip(before);
  if(el&&!calm.matches)el.animate([{opacity:.4},{opacity:1}],{duration:260,easing:'ease-out'})}
// widget menu (⋯): size, move, remove
const SZL={S:'Small',M:'Wide',B:'Banner',L:'Large',X:'X-Large'};
function openWidgetMenu(btn,w){closeMenus();hideTip();const m=$('wmenu'),cur=eff(w.size);
  m.innerHTML='<div class="mh">Size</div><div class="msz2" style="--n:'+sizesFor(w.k).length+'">'+sizesFor(w.k).map(s=>'<button type="button" data-msize="'+s+'" aria-pressed="'+(cur===s)+'" aria-label="'+SIZE_NAMES[s]+'"><i class="sg sg'+s+'"></i><span>'+SZL[s]+'</span></button>').join('')+'</div>'+
    (w.k==='feat'?'<div class="mh">Featuring</div><div class="mfeat">'+FEAT_ORDER.map(m=>'<button type="button" data-fm="'+m+'" aria-pressed="'+((w.metric||'win')===m)+'">'+FEAT[m].t.replace('Your biggest win','Biggest win')+'</button>').join('')+'</div><div class="mrow"><span>Show</span><div class="seg fshow" role="radiogroup" aria-label="Show">'+[['both','Both'],['$','$'],['%','%']].map(o=>'<button type="button" role="radio" data-fs="'+o[0]+'" aria-checked="'+((w.show||'both')===o[0])+'">'+o[1]+'</button>').join('')+'</div></div>':'')+
    (w.k==='bd'?cbBdMenu(w):'')+
    (KPI[w.k]?'<div class="mrow"><span>Show trend</span><button type="button" class="swt" data-act="trend" role="switch" aria-checked="'+(w.trend!==false)+'" aria-label="Show trend"><i></i></button></div>':'')+
    '<div class="msep"></div><button type="button" data-act="rename">Rename</button><button type="button" data-act="up">Move up</button><button type="button" data-act="down">Move down</button><button type="button" data-act="rm" class="danger">Remove</button>';
  const r=btn.getBoundingClientRect(),host=$('cb').getBoundingClientRect();m.hidden=false;const mw=m.offsetWidth;m.style.top=(r.bottom-host.top+6)+'px';m.style.left=Math.max(8,Math.min(r.right-host.left-mw,host.width-mw-8))+'px';
  m.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;
    if(b.dataset.fm){w.metric=b.dataset.fm;save();buzz('tick');m.querySelectorAll('[data-fm]').forEach(x=>x.setAttribute('aria-pressed',x===b));rebuild(w.id);return}
    if(b.dataset.fs){w.show=b.dataset.fs;save();buzz('tick');m.querySelectorAll('[data-fs]').forEach(x=>x.setAttribute('aria-checked',x===b));rebuild(w.id);return}
    if(b.dataset.bdm||b.dataset.bdby){if(b.dataset.bdm)w.m=b.dataset.bdm;else w.by=b.dataset.bdby;save();buzz('tick');m.querySelectorAll(b.dataset.bdm?'[data-bdm]':'[data-bdby]').forEach(x=>x.setAttribute('aria-pressed',x===b));rebuild(w.id);return}
    if(b.dataset.act==='trend'){w.trend=w.trend===false;save();b.setAttribute('aria-checked',w.trend!==false);buzz('tick');rebuild(w.id);return}
    m.hidden=true;if(b.dataset.msize){setSize(w.id,b.dataset.msize);return}
    if(b.dataset.act==='rename'){startRename(w.id);return}if(b.dataset.act==='up')moveWidget(w.id,-1);else if(b.dataset.act==='down')moveWidget(w.id,1);else removeWidget(w.id)}}

// rename: the title becomes a text field; an empty name goes back to the suggested one
function startRename(id){const w=byId(id),el=$('simple').querySelector('.w[data-id="'+id+'"]');if(!w||!el)return;const h=el.querySelector('.ttl'),def=w.k==='month'?'Profit by '+ctxNow().unit:w.k==='bd'?cbBdTitle(w):CATALOG[w.k].t;
  const inp=document.createElement('input');inp.className='ttlin';inp.value=w.name||def;inp.maxLength=40;inp.setAttribute('aria-label','Widget name');h.replaceWith(inp);inp.focus();inp.select();let done=false;
  const fin=ok=>{if(done)return;done=true;const v=inp.value.trim();if(ok){w.name=v&&v!==def?v:undefined;save();buzz('tick')}rebuild(id)};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();fin(true)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();fin(false)}});inp.addEventListener('blur',()=>fin(true))}
// ---------- corner resize: width and height together ----------
// Grab anywhere near the corner. The widget's content steps aside and a clean card follows your finger or cursor over
// a faint grid of cells, with a dashed outline showing exactly which size it will land on. Nothing else moves while
// you drag. On release the card glides into place, the board settles once, and the new layout fades in.
let rz=null,drag=null,justDragged=false;
function gridSpec(){const g=$('simple'),r=g.getBoundingClientRect(),cs=getComputedStyle(g),gap=parseFloat(cs.columnGap)||14,rgap=parseFloat(cs.rowGap)||gap,u=units(),col=(r.width-(u-1)*gap)/u,row=parseFloat(cs.gridAutoRows)||184;return {r,gap,rgap,u,col,row}}
const pxW=(g,c)=>c*g.col+(c-1)*g.gap,pxH=(g,n)=>n*g.row+(n-1)*g.rgap;
function box(g,s){let [c,r]=DIM[s];c=Math.min(c,g.u);return [pxW(g,c),pxH(g,r)]}
// nearest size to the dragged corner, measured in cells; the current pick gets a small head start so it never flickers
function snap(g,w,h,cur){let best=cur,bd=Infinity;(rz?sizesFor(byId(rz.id).k):sizesNow()).forEach(s=>{const [W,H]=box(g,s),d=Math.hypot((w-W)/g.col,(h-H)/g.row)-(s===cur?.3:0);if(d<bd){bd=d;best=s}});return best}
function rzLayers(g,rowsNeeded){const sim=$('simple');let ov=$('rzgrid');if(!ov){ov=document.createElement('div');ov.id='rzgrid';ov.className='rzgrid';ov.setAttribute('aria-hidden','true');sim.appendChild(ov)}
  ov.style.gridTemplateColumns='repeat('+g.u+',minmax(0,1fr))';ov.style.gridAutoRows=g.row+'px';ov.style.gap=g.rgap+'px '+g.gap+'px';ov.innerHTML='<i></i>'.repeat(g.u*rowsNeeded);
  const c=document.createElement('div');c.className='rzg';c.setAttribute('aria-hidden','true');sim.appendChild(c);return {c}}
const SZC=['szS','szM','szL','szX','szB'];
function setSlotSize(el,s){el.classList.remove(...SZC);el.classList.add('sz'+s)}
function placeRz(){if(!rz)return;rz.raf=0;const g=rz.g,W=g.r.width,x=rz.x,y=rz.y,s=snap(g,x,y,rz.s||rz.s0);
  rz.c.style.width=x+'px';rz.c.style.height=y+'px';rz.c.style.transform='translate('+(rz.ar?Math.max(0,rz.right-x):Math.max(0,Math.min(rz.left,W-x)))+'px,'+rz.top+'px)';
  if(rz.s!==s){const first=!rz.s;rz.s=s;rz.c.querySelector('.rzs').textContent=SIZE_NAMES[s];
    if(!first){buzz('tick');const before=rects();setSlotSize(rz.el,s);flip(before)}}}
// keep the page scrolling when a finger or cursor nears the top or bottom edge
function edgeScroll(clientY){const z=56,sp=clientY>innerHeight-z?Math.min(14,(clientY-(innerHeight-z))/3):clientY<z+60?-Math.min(14,(z+60-clientY)/3):0;return sp}
// desktop: scroll only after holding near the top or bottom edge for a moment, and slowly
function calmEdge(cy){const r=cbx.getBoundingClientRect(),top=r.top+110,bot=r.bottom-60,now=performance.now();
  const depth=cy>bot?cy-bot:cy<top?cy-top:0;if(!depth){drag.edgeT=0;return 0}if(!drag.edgeT)drag.edgeT=now;if(now-drag.edgeT<380)return 0;
  const v=Math.min(8,Math.abs(depth)/5+1.5);return depth>0?v:-v}
function scrollLoop(){const st=rz||drag;if(!st)return;if(drag&&drag.desk)drag.vy=calmEdge(drag.cy);if(st.vy){cbx.scrollTop+=st.vy;if(rz){rz.y=clampH(rz.h0+(rz.cy-rz.sy)+(cbx.scrollTop-rz.st0));if(!rz.raf)rz.raf=requestAnimationFrame(placeRz)}if(drag)moveDrag(drag.cx,drag.cy)}st.loop=requestAnimationFrame(scrollLoop)}
const clampH=v=>Math.max(pxH(rz.g,1)*.75,Math.min(pxH(rz.g,2)+rz.g.row*.4,v));
$('simple').addEventListener('pointerdown',e=>{
  if(!editing||e.button>0||e.target.closest('input'))return;
  const gr=e.target.closest('.grip');
  if(gr){const sec=gr.closest('.w[data-id]'),g=gridSpec(),r=sec.getBoundingClientRect();e.preventDefault();$('simple').setPointerCapture(e.pointerId);hideTip();
    const left=r.left-g.r.left,top=r.top-g.r.top,room=Math.max(60,(e.pointerType==='touch'?innerWidth-8:innerWidth-16)-e.clientX),rowsNeeded=Math.ceil((g.r.height+g.rgap)/(g.row+g.rgap))+2;
    const {c}=rzLayers(g,rowsNeeded);c.innerHTML='<span class="ttl">'+CATALOG[sec.dataset.k].t+'</span><span class="rzs"></span>';
    const w=byId(sec.dataset.id);
    rz={id:sec.dataset.id,el:sec,g,c,left,top,right:left+r.width,ar:sec.classList.contains('edgeR'),sx:e.clientX,sy:e.clientY,cy:e.clientY,st0:cbx.scrollTop,w0:r.width,h0:r.height,x:r.width,y:r.height,s:null,s0:eff(w.size),raf:0,vy:0};
    placeRz();buzz('tick');sec.classList.add('slot');$('cb').classList.add('rzing');rz.loop=requestAnimationFrame(scrollLoop);return}
  // move: drag the widget itself. Mouse: start after a few pixels. Touch: press and hold, so the page still scrolls.
  const sec=e.target.closest('.w[data-id]');if(!sec||e.target.closest('.rm,.grip'))return;
  const pend={id:sec.dataset.id,el:sec,x:e.clientX,y:e.clientY,cx:e.clientX,cy:e.clientY,pid:e.pointerId,touch:e.pointerType!=='mouse',t:0};
  if(pend.touch)pend.t=setTimeout(()=>{if(pending===pend)startDrag(pend)},280);
  pending=pend});
let pending=null;
function startDrag(pd){pending=null;try{$('simple').setPointerCapture(pd.pid)}catch(e){}hideTip();const sim=$('simple'),g=sim.getBoundingClientRect(),r=pd.el.getBoundingClientRect();
  const fl=pd.el.cloneNode(true);fl.removeAttribute('data-id');fl.classList.add('floating');fl.setAttribute('aria-hidden','true');
  fl.style.cssText='position:absolute;left:0;top:0;width:'+r.width+'px;height:'+r.height+'px;margin:0';sim.appendChild(fl);
  drag={id:pd.id,el:pd.el,fl,x:pd.x,y:pd.y,cx:pd.cx,cy:pd.cy,ox:r.left-g.left,oy:r.top-g.top,w:r.width,h:r.height,st0:cbx.scrollTop,vy:0,moved:false,skip:null,desk:units()>2,cand:null,candT:0,edgeT:0};
  pd.el.classList.add('slot');$('cb').classList.add('dragging');buzz('tap');moveDrag(pd.cx,pd.cy);drag.loop=requestAnimationFrame(scrollLoop)}
// Lay widgets out the way the grid does (each one in the first spot from the top where it fits), so we can try every
// position for the one you're holding and pick the one whose landing spot is closest to it, before anything moves.
function packGrid(order,u){const occ=[],out={};const free=(r,c,w,h)=>{for(let y=r;y<r+h;y++)for(let x=c;x<c+w;x++)if(occ[y]&&occ[y][x])return false;return true};
  order.forEach(w=>{const d=DIM[eff(w.size)],ww=Math.min(d[0],u),hh=d[1];for(let r=0;;r++){let done=false;for(let c=0;c<=u-ww;c++)if(free(r,c,ww,hh)){for(let y=r;y<r+hh;y++){occ[y]=occ[y]||[];for(let x=c;x<c+ww;x++)occ[y][x]=1}out[w.id]={c,r,w:ww,h:hh};done=true;break}if(done)break}});return out}
function deskDrag(fx,fy){const g=gridSpec(),cw=g.col+g.gap,rh=g.row+g.rgap,u=g.u;
  const mx=(fx+drag.w/2)/cw,my=(fy+drag.h/2)/rh;// the held widget's center, in grid squares
  const me=layout.find(w=>w.id===drag.id),others=layout.filter(w=>w.id!==drag.id),now0=packGrid(layout,u);
  let best=null;for(let i=0;i<=others.length;i++){const ord=others.slice(0,i).concat([me]).concat(others.slice(i)),P=packGrid(ord,u),p=P[me.id];
    const d=Math.hypot(p.c+p.w/2-mx,(p.r+p.h/2-my)*1.15);let shove=0;others.forEach(w=>{const a=now0[w.id],b=P[w.id];shove+=Math.abs(a.c-b.c)+Math.abs(a.r-b.r)});
    const score=d+shove*.06;if(!best||score<best.score)best={score,d,ord,i}}
  const cur=packGrid(layout,u)[me.id],curD=Math.hypot(cur.c+cur.w/2-mx,(cur.r+cur.h/2-my)*1.15);
  const same=best.ord.every((w,k)=>w===layout[k]);if(same){drag.cand=null;return}
  if(best.d>curD-.3){drag.cand=null;return}// only move when the new spot is clearly closer than where it sits now
  const key=best.ord.map(w=>w.id).join(','),now=performance.now();if(drag.cand!==key){drag.cand=key;drag.candT=now;return}if(now-drag.candT<90)return;// a short pause, so passing over things doesn't shuffle them
  const before=rects();layout=best.ord;const sim=$('simple');layout.forEach(w=>{const el=sim.querySelector('.w[data-id="'+w.id+'"]');if(el)sim.insertBefore(el,drag.fl)});
  drag.moved=true;drag.cand=null;buzz('tick');flip(before)}
function moveDrag(cx,cy){if(!drag)return;drag.cx=cx;drag.cy=cy;const dy=cy-drag.y+(cbx.scrollTop-drag.st0);
  drag.fl.style.transform='translate('+(drag.ox+cx-drag.x)+'px,'+(drag.oy+dy)+'px) scale(1.03)';
  if(drag.desk){deskDrag(drag.ox+cx-drag.x,drag.oy+dy);return}
  const inside=el=>{const r=el.getBoundingClientRect();return cx>r.left&&cx<r.right&&cy>r.top&&cy<r.bottom};
  // phones (v49.1): the widget under your finger is marked; the two trade places when you let go. Nothing moves while
  // you're still dragging, so passing over other widgets on the way doesn't shuffle them.
  const over=[...$('simple').querySelectorAll('.w[data-id]')].find(el=>el!==drag.el&&inside(el)),id=over?over.dataset.id:null;
  if(id!==drag.tgt){if(drag.tgtEl)drag.tgtEl.classList.remove('swapto');drag.tgt=id;drag.tgtEl=over||null;if(over){over.classList.add('swapto');buzz('tick')}}}
// stop the page from scrolling under a finger once a widget is lifted
document.addEventListener('touchmove',e=>{if(drag||rz)e.preventDefault()},{passive:false});
$('simple').addEventListener('pointermove',e=>{
  if(rz){const g=rz.g;rz.cy=e.clientY;rz.vy=edgeScroll(e.clientY);const dx=e.clientX-rz.sx;rz.x=Math.max(pxW(g,1)*.75,Math.min(g.r.width,rz.w0+(rz.ar?-dx:dx)));rz.y=clampH(rz.h0+(e.clientY-rz.sy)+(cbx.scrollTop-rz.st0));if(!rz.raf)rz.raf=requestAnimationFrame(placeRz);return}
  if(pending&&e.pointerId===pending.pid){const d=Math.hypot(e.clientX-pending.x,e.clientY-pending.y);pending.cx=e.clientX;pending.cy=e.clientY;
    if(pending.touch){if(d>9){clearTimeout(pending.t);pending=null}}else if(d>5){e.preventDefault();startDrag(pending)}return}
  if(drag){if(!drag.desk)drag.vy=edgeScroll(e.clientY);moveDrag(e.clientX,e.clientY)}});
function endPointer(){
  if(pending){clearTimeout(pending.t);pending=null}
  if(rz){const r=rz;rz=null;if(r.raf)cancelAnimationFrame(r.raf);cancelAnimationFrame(r.loop);placeRzFinal(r);return}
  if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(d.loop);justDragged=true;setTimeout(()=>{justDragged=false},0);
  if(!d.desk&&d.tgtEl){d.tgtEl.classList.remove('swapto');const from=layout.findIndex(w=>w.id===d.id),to=layout.findIndex(w=>w.id===d.tgt);
    if(from>=0&&to>=0&&from!==to){const before=rects(),t=layout[from];layout[from]=layout[to];layout[to]=t;const over=d.tgtEl,mk=document.createComment('');d.el.replaceWith(mk);over.replaceWith(d.el);mk.replaceWith(over);d.moved=true;flip(before)}}
  $('cb').classList.remove('dragging');if(d.moved){save();buzz('firm')}
  // the floating copy glides into the slot, then the real widget takes its place
  const g=$('simple').getBoundingClientRect(),t=d.el.getBoundingClientRect(),tx=t.left-g.left,ty=t.top-g.top;
  markEdges();const done=()=>{d.fl.remove();d.el.classList.remove('slot')};
  if(calm.matches){done();return}
  const a=d.fl.animate([{transform:d.fl.style.transform},{transform:'translate('+tx+'px,'+ty+'px) scale(1)'}],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});a.onfinish=done}
function placeRzFinal(r){
  const size=r.s||r.s0,w=byId(r.id);$('cb').classList.remove('rzing');
  buzz(size!==r.s0?'firm':'tick');if(size!==r.s0)window.CTTrack&&CTTrack.ev('widget_size',size);if(eff(w.size)!==size)w.size=size;
  const before=rects();
  let el=rebuild(r.id);if(!el){r.c.remove();save();return}
  // widened from the left corner of a right-hand widget: it takes the row and its left neighbour moves down, instead of the
  // widget dropping to the next row. Everything that moves glides there (FLIP).
  if(r.ar&&el.getBoundingClientRect().width>r.w0+12){const i=layout.findIndex(x=>x.id===r.id),prev=el.previousElementSibling;
    if(i>0&&prev&&prev.matches('.w[data-id]')){const [it]=layout.splice(i,1);layout.splice(i-1,0,it);prev.before(el)}}
  save();el.classList.add('slot');flip(before,r.id);markEdges();
  const gr=$('simple').getBoundingClientRect(),f=el.getBoundingClientRect();
  const finish=()=>{r.c.remove();el.classList.remove('slot');if(!calm.matches){el.classList.add('rz-in');setTimeout(()=>el.classList.remove('rz-in'),320)}};
  if(calm.matches){finish();return}
  r.c.classList.add('settle');void r.c.offsetWidth;r.c.style.transform='translate('+(f.left-gr.left)+'px,'+(f.top-gr.top)+'px)';r.c.style.width=f.width+'px';r.c.style.height=f.height+'px';
  setTimeout(finish,300)}
$('simple').addEventListener('pointerup',endPointer);$('simple').addEventListener('pointercancel',endPointer);
$('simple').addEventListener('contextmenu',e=>{if(editing)e.preventDefault()});
// keyboard: arrow keys on the grip step through the sizes
$('simple').addEventListener('keydown',e=>{const gp=e.target.closest('.grip');if(!gp)return;const id=gp.closest('.w[data-id]').dataset.id,w=byId(id),L=sizesFor(w.k),i=L.indexOf(eff(w.size));
  let j=-1;if((e.key==='ArrowRight'||e.key==='ArrowDown')&&i<L.length-1)j=i+1;if((e.key==='ArrowLeft'||e.key==='ArrowUp')&&i>0)j=i-1;
  if(j>-1){e.preventDefault();setSize(id,L[j]);const ng=$('simple').querySelector('.w[data-id="'+id+'"] .grip');if(ng)ng.focus()}});

// ---------- add widgets: a gallery of small widgets; tap to add to the top of the board, tap again to take it back ----------
const aw=$('aw'),DEF_SIZE={profit:'S',sales:'S',spent:'S',fees:'S',after:'S',month:'X',sell:'M',where:'L',kept:'M',win:'L',budget:'S',feat:'L',best:'L',pricey:'S',glance:'L',bd:'L',tied:'M',hit:'M',tts:'M',inout:'X',ppc:'L'};
const CATS=FAMILY; // v43: the gallery's kinds are the widget families
const PLUS_I='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const CHECK_I='<svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.4l2.6 2.5L11 4.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let added={},awCat='all';
// The gallery is built ahead of time (when you start editing) and reused, so tapping Add widgets only has to show it
let awSig='';const awSigNow=()=>{const g=gridSpec();return [cbFree()?'f':'p',period,plat,compare,E.length,g.col,g.row,maskAmt()?1:0,JSON.stringify(typeof custom!=='undefined'?custom:'')].join('|')};
function prebuildAdd(){if(aw.open||awSig===awSigNow())return;const st=aw.style.cssText;aw.style.cssText='display:block;position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none';added={};awCat='all';$('aw-q').value='';try{drawThumbs()}finally{aw.style.cssText=st}awSig=awSigNow()}
function openAdd(){$('aw-hint').textContent=AW_TIP;$('aw-hint').classList.remove('msg');const fresh=awCat==='all'&&!$('aw-q').value&&!Object.keys(added).length&&awSig===awSigNow();
  added={};awCat='all';$('aw-q').value='';$('aw-cats').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c==='all'));aw.showModal();if(!fresh){drawThumbs();awSig=awSigNow()}}
function drawThumbs(){const g=gridSpec(),W=g.col,H=g.row,ctx=ctxNow(),q=$('aw-q').value.trim().toLowerCase(),host=$('aw-list');
  const keys=Object.keys(CATALOG).filter(k=>(awCat==='all'||cbCatOf(k)===awCat)&&(!q||(CATALOG[k].t+' '+CATALOG[k].d).toLowerCase().includes(q)));
  PVMODE=true;try{host.innerHTML=keys.length?keys.map(k=>{const lk=cbFree()&&!FREE_K.includes(k);return '<div role="button" tabindex="0" class="thumb'+(added[k]?' added':'')+(lk?' lockd':'')+'" data-k="'+k+'" aria-pressed="'+!!added[k]+'" aria-label="'+(lk?CATALOG[k].t+', Premium':(added[k]?'Remove ':'Add ')+CATALOG[k].t)+'"><span class="tbox"><span class="tin">'+widgetHTML({id:'pv'+k,k,size:'S'},ctx,'pv')+'</span></span><span class="badge">'+(lk?LOCK_I:added[k]?CHECK_I:PLUS_I)+'</span></div>'}).join(''):'<p class="awnone">No widgets match “'+esc(q)+'”.</p>'}finally{PVMODE=false}
  const bxs=[...host.querySelectorAll('.tbox')],ws=bxs.map(bx=>bx.clientWidth);bxs.forEach((bx,i)=>{const sc=ws[i]/W,inn=bx.firstChild,el=inn.firstChild;el.style.width=W+'px';el.style.height=H+'px';inn.style.transform='scale('+sc+')';bx.style.height=(H*sc)+'px'});
  wire(host,ctx)}
// the tip line under the gallery briefly becomes the confirmation, then goes back; nothing floats over anything
const AW_TIP='Tap to add · tap again to remove · resize from the corner on your board';
function awToast(m){const t=$('aw-hint');clearTimeout(awToast.h);t.classList.remove('msg');void t.offsetWidth;t.textContent=m;t.classList.add('msg');awToast.h=setTimeout(()=>{t.classList.remove('msg');t.textContent=AW_TIP},1800)}
$('aw-q').addEventListener('input',drawThumbs);
$('aw-list').addEventListener('keydown',e=>{const th=e.target.closest('.thumb');if(th&&(e.key==='Enter'||e.key===' ')){e.preventDefault();th.click()}});
$('aw-cats').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;awCat=b.dataset.c;$('aw-cats').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));drawThumbs()});
aw.addEventListener('click',e=>{if(e.target===aw){aw.close();return}const th=e.target.closest('.thumb');
  if(th){const k=th.dataset.k;
    window.CTTrack&&CTTrack.ev(added[k]?'widget_remove':'widget_add',CATALOG[k].t);
    if(added[k]){const i=layout.findIndex(w=>w.id===added[k]);if(i>-1)layout.splice(i,1);const o=otherLayout();if(o){const j=o.findIndex(w=>w.id===added[k]);if(j>-1){o.splice(j,1);saveOther()}}delete added[k];save();buzz('warn');render(true);awToast(CATALOG[k].t+' removed')}
    else{const id=newId();layout.push({id,k,size:DEF_SIZE[k]});const o=otherLayout();if(o){o.push({id,k,size:DEF_SIZE[k]});saveOther()}added[k]=id;save();buzz('firm');render(true);awToast(CATALOG[k].t+' added to your board')}
    th.classList.toggle('added',!!added[k]);th.setAttribute('aria-pressed',!!added[k]);th.setAttribute('aria-label',(added[k]?'Remove ':'Add ')+CATALOG[k].t);th.querySelector('.badge').innerHTML=added[k]?CHECK_I:PLUS_I;
    const bd=th.querySelector('.badge');if(!calm.matches)bd.animate([{transform:'scale(.6)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});return}
  const b=e.target.closest('button');if(b&&b.hasAttribute('data-close'))aw.close()});
aw.addEventListener('close',()=>{const first=Object.values(added)[0];if(first){const el=$('simple').querySelector('.w[data-id="'+first+'"]');if(el)el.scrollIntoView({behavior:calm.matches?'auto':'smooth',block:'nearest'})}});

// ---------- the morph: Insights panel grows into the full page, and shrinks back into it ----------
const cbx=$('cbx'),ins=$('ins'),xb=$('expand'),EASE='cubic-bezier(.2,.7,.2,1)';
let busy=false;
let shown=false,ready=false;const bgl=$('cbxbg');
const fromRect=r=>'translate('+r.left+'px,'+r.top+'px) scale('+(r.width/innerWidth).toFixed(4)+','+(r.height/innerHeight).toFixed(4)+')';
// build the board while you're still on the dashboard, so opening never has to stop and build it
function prepare(){if(ready||shown)return;render(false);ready=true}
// draws the (hidden) board for a few frames at near-zero opacity, so its pictures and widgets are already painted the first time it slides in
function warm(){if(shown)return;const st=cbx.style;st.visibility='visible';st.opacity='0.001';let n=0;const f=()=>{if(++n<4&&!shown)requestAnimationFrame(f);else if(!shown){st.visibility='';st.opacity=''}else{st.visibility='';st.opacity=''}};requestAnimationFrame(f)}
(window.requestIdleCallback||(f=>setTimeout(f,400)))(prepare,{timeout:1500});
// the board grows out of whatever opened it (the Board tab, the profile menu), and shrinks back into it; Insights when that's what's on screen
// the page slide: dir 1 = moving right (new page from the right), -1 = moving left. Transform only, so it stays smooth.
// slower and even (eases in and out) so the eye can follow it; a bit longer on desktop, where the page travels further
const pageMs=()=>matchMedia('(max-width:760px)').matches?460:620,PAGE_EASE='cubic-bezier(.4,0,.2,1)';
const navHold=(a,b)=>{try{window.CTNavHold&&window.CTNavHold(a,b,pageMs())}catch(e){}};
function pageSlide(els,dir,kind,hold){let last=null;els.forEach(el=>{if(!el)return;const off='translate3d('+(kind==='in'?dir*100:-dir*100)+'%,0,0)';
  last=el.animate(kind==='in'?[{transform:off},{transform:'none'}]:[{transform:'none'},{transform:off}],{duration:pageMs(),easing:PAGE_EASE,fill:hold?'forwards':'none'})});return last||{set onfinish(f){f()}}}
const entriesEls=()=>(window.CTPageEls&&window.CTPageEls())||[];
window.cbPageSlide=pageSlide;
// v35.3: one function moves between pages. Phones: the pages slide side by side, in lockstep (both move the full screen width).
// Desktop: a short fade with a small drift in the direction you're going; the header doesn't move at all, so the logo,
// tabs and avatar stay put and only what's different changes. (Admin can switch desktop to the slide to compare.)
const PZ={entries:0,board:1,stories:2};
const fxMode=()=>{if(matchMedia('(max-width:760px)').matches)return 'slide';try{const v=localStorage.getItem('ct.pagefx');return v==='slide'||v==='fade'?v:'glide'}catch(e){return 'glide'}};
const frameDoc=()=>{try{return $('csx').querySelector('iframe').contentDocument}catch(e){return null}};
// the shared header parts of a page (tabs, avatar): the page you're leaving hides its own copy while you move, so only one shows
function sharedOf(k){const d=k==='stories'?frameDoc():document;if(!d)return [];return (k==='entries'?[d.querySelector('.ct-demo-top .ct-tabs'),d.getElementById('app-avatar')]:k==='board'?[cbx.querySelector('.cb-tabs'),$('cb-acct')]:[d.querySelector('.cstabs'),d.getElementById('csacct')]).filter(Boolean)}
// a page sits at the top of its own scroll, so its header lines up with the one it's switching with
const atTop=k=>k==='entries'?scrollY<40:k==='board'?cbx.scrollTop<40:true;
const layerOf=k=>k==='entries'?entriesEls():k==='board'?[cbx]:[$('csx')];
function contentOf(k){if(k==='entries')return [document.getElementById('app-grid')].filter(Boolean);if(k==='board')return [$('simple')];
  try{const d=$('csx').querySelector('iframe').contentDocument;return [...d.querySelectorAll('.wrap > *:not(.top)')]}catch(e){return []}}
// the parts of each header that differ between pages: the page name and the buttons on the right (logo, tabs and avatar are shared)
const vis=el=>el&&el.getClientRects().length;
function headOf(k){try{if(k==='entries')return [document.querySelector('.ct-demo-top .ct-bname'),...document.querySelectorAll('.ct-demo-top .ct-top-actions > :not(#app-avatar)')].filter(vis);
  if(k==='board')return [$('cbtn'),...cbx.querySelectorAll('.topbar > .tctl, .topbar > .iconb')].filter(vis);
  const d=$('csx').querySelector('iframe').contentDocument;return [d.querySelector('.top .ttl .tname'),...d.querySelectorAll('.top .tr > :not(.acct)')].filter(vis)}catch(e){return []}}
function pageGo(from,to,dir,done){
  // v36: the app shell keeps all three pages drawn side by side and does the slide (see js/shell.js)
  if(window.CTPage){window.CTPage.move(from,to,done);return}
  const held=[];let ms;
  // while pages move, live blurs (the frosted labels on card art) are paused: a blur repaints everything behind it on every
  // frame, which is what dropped the slide below 60fps. They come back the moment the pages land.
  const H=document.documentElement,fdm=frameDoc();H.classList.add('pg-moving');if(fdm&&fdm.documentElement)fdm.documentElement.classList.add('pg-moving');
  const doneIn=done;done=()=>{if(doneIn)doneIn();H.classList.remove('pg-moving');if(fdm&&fdm.documentElement)fdm.documentElement.classList.remove('pg-moving')};
  if(fxMode()==='slide'){ms=pageMs();const W=innerWidth,EZ={duration:ms,easing:PAGE_EASE};
    layerOf(to).forEach(el=>el&&el.animate([{transform:'translate3d('+dir*W+'px,0,0)'},{transform:'none'}],EZ));
    layerOf(from).forEach(el=>el&&held.push(el.animate([{transform:'none'},{transform:'translate3d('+(-dir*W)+'px,0,0)'}],Object.assign({fill:'forwards'},EZ))));
  }else if(fxMode()==='glide'&&atTop(from)&&atTop(to)){
    // desktop default: the header stays still and the pages' content glides across like a slider, the old content
    // sliding out and fading as the new slides in. The page on top goes see-through while it moves (all three pages
    // share one background color), so both contents are in view.
    ms=520;const D=Math.round(Math.min(440,innerWidth*.3)),top=PZ[to]>PZ[from]?to:from,EZ={duration:ms,easing:'cubic-bezier(.25,.8,.25,1)'};
    const clear=top==='board'?[cbx]:[$('csx')],fd=frameDoc();clear.forEach(el=>el.classList.add('pg-clear'));if(top==='stories'&&fd&&fd.documentElement)fd.documentElement.classList.add('pg-clear');
    const hide=sharedOf(from);hide.forEach(el=>el.style.visibility='hidden');
    contentOf(to).forEach(el=>{el.animate([{transform:'translate3d('+dir*D+'px,0,0)'},{transform:'none'}],Object.assign({fill:'backwards'},EZ));el.animate([{opacity:0},{opacity:0,offset:.18},{opacity:1}],{duration:ms,easing:'ease-out',fill:'backwards'})});
    contentOf(from).forEach(el=>{held.push(el.animate([{transform:'none'},{transform:'translate3d('+(-dir*D)+'px,0,0)'}],Object.assign({fill:'forwards'},EZ)));held.push(el.animate([{opacity:1},{opacity:0,offset:.6},{opacity:0}],{duration:ms,easing:'ease-in',fill:'forwards'}))});
    headOf(from).forEach(el=>held.push(el.animate([{opacity:1},{opacity:0}],{duration:130,easing:'ease-in',fill:'forwards'})));
    headOf(to).forEach(el=>el.animate([{opacity:0,transform:'translate3d(0,8px,0)'},{opacity:1,transform:'none'}],{duration:300,delay:120,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
    const end=done;done=()=>{if(end)end();clear.forEach(el=>el.classList.remove('pg-clear'));if(fd&&fd.documentElement)fd.documentElement.classList.remove('pg-clear');hide.forEach(el=>el.style.visibility='')};
  }else{ms=300;const D=24,EZ={duration:ms,easing:'cubic-bezier(.2,.8,.2,1)'},drift=(els,a,b)=>els.forEach(el=>el.animate([{transform:'translate3d('+a+'px,0,0)'},{transform:'translate3d('+b+'px,0,0)'}],EZ));
    if(PZ[to]>PZ[from]){layerOf(to).forEach(el=>el&&el.animate([{opacity:0},{opacity:1}],{duration:ms*.85,easing:'ease-out'}))}
    else{layerOf(from).forEach(el=>el&&held.push(el.animate([{opacity:1},{opacity:0}],{duration:ms*.85,easing:'ease-in',fill:'forwards'})))}
    drift(contentOf(to),dir*D,0);drift(contentOf(from),0,-dir*D);
    // the old page name and buttons fade out first; then the new ones rise in, so two names never sit on top of each other
    headOf(from).forEach(el=>held.push(el.animate([{opacity:1},{opacity:0}],{duration:110,easing:'ease-in',fill:'forwards'})));
    headOf(to).forEach(el=>el.animate([{opacity:0,transform:'translate3d(0,8px,0)'},{opacity:1,transform:'none'}],{duration:280,delay:100,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
  }
  setTimeout(()=>{if(done)done();held.forEach(a=>a.cancel())},ms);
}
function fromEl(){const o=(window.CTBoardFrom&&window.CTBoardFrom())||ins;const r=o&&o.getBoundingClientRect();return r&&r.width?r:{left:innerWidth/2-60,top:innerHeight/2-60,width:120,height:120}}
function open(){
  if(busy||shown)return;navPush('board',()=>close());busy=true;xb.classList.remove('hint');$('note').hidden=true;
  // v42.25: when the board hasn't been drawn yet, draw it first and start the slide two frames later, so the drawing
  // never lands in the middle of the motion (it's usually drawn ahead of time, while you're on Entries)
  const cold=!ready;if(cold){render(false);ready=true}
  const r=fromEl();shown=true;cbx.scrollTop=0;document.documentElement.style.overflow='hidden';document.documentElement.classList.add('cbopen');xb.setAttribute('aria-expanded','true');
  cbx.inert=false;cbx.removeAttribute('aria-hidden');
  if(calm.matches&&!window.CTPage){cbx.classList.remove('off','enter');busy=false;$('close').focus({preventScroll:true});return}
  // v35: Entries, Board and Stories are pages side by side (phones and desktop). Going right, the new page pushes in
  // from the right while the one you're leaving moves out to the left, in step, like turning a page.
  {const inst=window.cbInstant;window.cbInstant=false;cbx.classList.remove('off','enter');
    if(inst){busy=false;return}
    const go=()=>pageGo('entries','board',1,()=>{busy=false;$('close').focus({preventScroll:true})});if(cold)requestAnimationFrame(()=>requestAnimationFrame(go));else go();return}
  cbx.classList.add('anim','enter');cbx.classList.remove('off');bgl.classList.add('on');
  bgl.animate([{transform:fromRect(r)},{transform:'none'}],{duration:460,easing:EASE});
  $('cb').animate([{opacity:0},{opacity:1}],{duration:240,delay:170,easing:'ease-out',fill:'backwards'});
  const parts=[cbx.querySelector('.topbar'),...cbx.querySelectorAll('.simple > .w')];
  parts.forEach((p,i)=>{p.style.transitionDelay=(170+Math.min(i,10)*22)+'ms'});
  requestAnimationFrame(()=>requestAnimationFrame(()=>cbx.classList.remove('enter')));
  setTimeout(()=>{cbx.classList.remove('anim');bgl.classList.remove('on');parts.forEach(p=>p.style.transitionDelay='');busy=false;$('close').focus({preventScroll:true})},520+Math.min(parts.length,10)*22);
}
function close(){
  if(busy||!shown)return;navDone('board');busy=true;hideTip();closeMenus();$('wmenu').hidden=true;xb.setAttribute('aria-expanded','false');
  const finish=()=>{shown=false;cbx.classList.add('off');cbx.classList.remove('anim');bgl.classList.remove('on');cbx.inert=true;cbx.setAttribute('aria-hidden','true');document.documentElement.style.overflow='';document.documentElement.classList.remove('cbopen');busy=false;
    if(editing){editing=false;$('cb-edit').innerHTML=EDIT_I+'<span>Edit</span>';$('cb-edit').classList.remove('on');$('editfoot').hidden=true;$('cb').classList.remove('editing');render(false)}xb.focus({preventScroll:true})};
  if(calm.matches&&!window.CTPage){finish();return}
  {const inst=window.cbInstant;window.cbInstant=false;if(inst){finish();return}
    pageGo('board','entries',-1,finish);return}
  const r=fromEl();cbx.classList.add('anim');bgl.classList.add('on');
  $('cb').animate([{opacity:1},{opacity:0}],{duration:150,easing:'ease-in',fill:'forwards'}).onfinish=function(){
    this.cancel();$('cb').style.opacity='0';
    bgl.animate([{transform:'none'},{transform:fromRect(r)}],{duration:360,easing:EASE,fill:'forwards'}).onfinish=function(){finish();$('cb').style.opacity='';this.cancel()}};
}
xb.addEventListener('click',open);$('close').addEventListener('click',close);
document.addEventListener('click',e=>{const wm=$('wmenu');if(!wm.hidden&&!e.target.closest('#wmenu')&&!e.target.closest('.wmore,.bdpick'))wm.hidden=true});
cbx.addEventListener('scroll',hideTip,{passive:true});
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!shown||document.querySelector('dialog[open]'))return;if(!$('wmenu').hidden){$('wmenu').hidden=true;return}if(!$('cb-menu').hidden||!$('cb-pmenu').hidden||!$('cb-amenu').hidden){closeMenus();return}if(editing){setEditing(false);return}close()});

// ---------- account menu: profile, plan, import/export, settings, sign out ----------
let profile=(()=>{try{return Object.assign({first:'Nick',last:'',show:'first'},JSON.parse(localStorage.getItem('cb.profile'))||{})}catch(e){return {first:'Nick',last:'',show:'first'}}})();
const shownName=()=>profile.show==='full'&&profile.last?profile.first+' '+profile.last:profile.first,initial=()=>(profile.first||'?')[0].toUpperCase();
// letters stay readable on any color: dark ink on light colors, white on dark ones
function inkFor(hex){const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return '#fff';const n=parseInt(m[1],16),c=[n>>16,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}),L=.2126*c[0]+.7152*c[1]+.0722*c[2];return L>.45?'#1d1d1b':'#fff'}
const NAME='Nick',SWATCH=['#a50e37','#c2410c','#b45309','#15803d','#0f766e','#1d4ed8','#6d28d9','#3f3f46'];
let avatar=(()=>{try{return JSON.parse(localStorage.getItem('cb.avatar'))||{}}catch(e){return {}}})();
function paintAvatar(){const c=avatar.color||SWATCH[0];['cb-av','cb-av2'].forEach(id=>{const el=$(id);if(!el)return;el.style.background=avatar.photo?'url('+avatar.photo+') center/cover':c;el.style.color=inkFor(c);el.textContent=avatar.photo?'':initial();el.classList.add('set')});$('am-name').textContent=shownName();paintTitle()}
// the board carries your first name: "Nick's Card Board" (usernames can take its place later)
function paintTitle(){const f=(profile.first||'').trim(),t=viewing&&f?f+'’s Card Board':'Card Board';$('cbtn').textContent=t;document.title=t}
function toast(msg){const t=$('cbtoast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2200)}
// appearance
function applyTheme(th){if($('cb-amenu').parentNode===mhost)setTimeout(mhVars,30);if(th==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=th;try{localStorage.setItem('cb.theme',th)}catch(e){}
  $('am-theme').querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',b.dataset.th===th))}
applyTheme((()=>{try{return localStorage.getItem('cb.theme')||'auto'}catch(e){return 'auto'}})());
$('am-theme').addEventListener('click',e=>{const b=e.target.closest('button');if(b){applyTheme(b.dataset.th);buzz('tick');setTimeout(()=>render(false),30)}});
// haptics switch; hidden on computers, where there is nothing to feel
if($('am-hapr'))$('am-hapr').remove();
$('cb-amenu').addEventListener('click',e=>{const b=e.target.closest('[data-am]');if(!b)return;closeMenus();const a=b.dataset.am;
  const inSt=()=>{try{return $('csx').querySelector('iframe').contentWindow}catch(e){return null}};
  if(a==='go-board'){if($('cb-amenu').dataset.ctx==='stories')window.cbStoriesBack();return}
  if(a==='go-stories'){if($('cb-amenu').dataset.ctx!=='stories')$('cb-stories').click();return}
  if(a==='go-app'){toast('Opens your entries in the app');return}
  if(a==='st-save'||a==='st-colors'){const w=inSt();try{w.csMenu(a)}catch(e){}return}
  // Account rows open on the board, so from Stories slide back first, then open them
  if($('cb-amenu').dataset.ctx==='stories'){menuCtx('board');window.cbStoriesBack();setTimeout(()=>run(a),calm.matches?0:340);return}
  run(a)});
function run(a){
  if(a==='profile')openAvatar();else if(a==='export')openExport();
  else toast({plan:'Plan and billing opens here in the app',import:'Import opens from the dashboard in the app',plat:'Platforms and fees open here in the app',goal:'Budget and goals open here in the app',help:'Help and feedback open here in the app',out:'Sign out works in the app'}[a])}
// avatar editor: your initial on a color, or a photo you upload or take, positioned in a circle
const av=$('av');let ad=null;const AVC=135;
function openAvatar(){ad={color:avatar.color||SWATCH[0],photo:null,src:avatar.src||null,x:avatar.x||0,y:avatar.y||0,z:avatar.z||1,img:null,first:profile.first,last:profile.last,show:profile.show};
  $('av-sw').innerHTML=SWATCH.map(c=>'<button type="button" role="radio" data-c="'+c+'" style="--c:'+c+'" aria-label="Color '+c+'" aria-checked="'+(c===ad.color)+'"></button>').join('')+'<button type="button" class="cust" id="av-pick" aria-label="Pick any color" aria-expanded="false"></button>';$('av-cpk').hidden=true;
  $('pf-first').value=ad.first;$('pf-last').value=ad.last;paintShow();
  $('av-camw').hidden=!touchDev;$('av-l').textContent=initial();
  if(ad.src)loadImg(ad.src,true);else drawAv();av.showModal()}
function paintShow(){$('pf-show').querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',b.dataset.sh===ad.show))}
function drawAv(){const c=$('av-c'),img=$('av-img'),has=!!ad.img;c.style.background=has?'#111':ad.color;c.style.color=inkFor(ad.color);$('av-l').textContent=(($('pf-first').value||'?')[0]).toUpperCase();
  const custom=!SWATCH.includes(ad.color);if(document.activeElement!==$('av-hex'))$('av-hex').value=ad.color.toUpperCase();const pk=$('av-pick');if(pk){pk.classList.toggle('on',custom);pk.style.setProperty('--c',ad.color)}paintPicker();$('av-l').hidden=has;img.hidden=!has;$('av-zw').hidden=!has;$('av-hint').hidden=!has;$('av-rm').hidden=!has;$('av-colw').hidden=has;
  $('av-sw').querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',b.dataset.c===ad.color));
  if(has){const s0=Math.max(AVC/ad.img.naturalWidth,AVC/ad.img.naturalHeight),s=s0*ad.z,w=ad.img.naturalWidth*s,h=ad.img.naturalHeight*s;
    ad.x=Math.min(0,Math.max(AVC-w,ad.x));ad.y=Math.min(0,Math.max(AVC-h,ad.y));img.style.width=w+'px';img.style.height=h+'px';img.style.transform='translate('+ad.x+'px,'+ad.y+'px)'}}
function loadImg(src,keep){const im=new Image();im.onload=()=>{ad.img=im;ad.src=src;$('av-img').src=src;if(!keep){const s0=Math.max(AVC/im.naturalWidth,AVC/im.naturalHeight);ad.z=1;ad.x=(AVC-im.naturalWidth*s0)/2;ad.y=(AVC-im.naturalHeight*s0)/2;$('av-zoom').value=1}else $('av-zoom').value=ad.z;drawAv()};im.src=src}
// big photos are shrunk on the way in, so nothing huge is kept
function readPhoto(file){if(!file||!/^image\//.test(file.type))return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const m=1024,k=Math.min(1,m/Math.max(im.naturalWidth,im.naturalHeight)),cv=document.createElement('canvas');cv.width=Math.round(im.naturalWidth*k);cv.height=Math.round(im.naturalHeight*k);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);loadImg(cv.toDataURL('image/jpeg',.88),false)};im.src=r.result};r.readAsDataURL(file)}
['av-up','av-cam'].forEach(id=>$(id).addEventListener('change',e=>{readPhoto(e.target.files[0]);e.target.value=''}));
$('av-zoom').addEventListener('input',e=>{if(!ad.img)return;const z=+e.target.value,c=AVC/2,s0=Math.max(AVC/ad.img.naturalWidth,AVC/ad.img.naturalHeight),k=z/ad.z;ad.x=c-(c-ad.x)*k;ad.y=c-(c-ad.y)*k;ad.z=z;drawAv()});
$('av-c').addEventListener('wheel',e=>{if(!ad.img)return;e.preventDefault();const z=Math.min(3,Math.max(1,ad.z-e.deltaY*.002));$('av-zoom').value=z;$('av-zoom').dispatchEvent(new Event('input'))},{passive:false});
let pan=null;$('av-c').addEventListener('pointerdown',e=>{if(!ad.img)return;e.preventDefault();$('av-c').setPointerCapture(e.pointerId);pan={x:e.clientX,y:e.clientY,ox:ad.x,oy:ad.y}});
$('av-c').addEventListener('pointermove',e=>{if(!pan)return;ad.x=pan.ox+(e.clientX-pan.x);ad.y=pan.oy+(e.clientY-pan.y);drawAv()});
['pointerup','pointercancel'].forEach(t=>$('av-c').addEventListener(t,()=>{pan=null}));
av.addEventListener('click',e=>{if(e.target===av){av.close();return}const b=e.target.closest('button');if(!b)return;
  if(b.id==='av-pick'){const o=$('av-cpk').hidden;$('av-cpk').hidden=!o;b.setAttribute('aria-expanded',o);if(o){hsv=hexToHsv(ad.color);paintPicker()}return}
  if(b.dataset.c){ad.color=b.dataset.c;buzz('tick');drawAv()}
  else if(b.dataset.sh){ad.show=b.dataset.sh;paintShow()}
  else if(b.id==='av-rm'){ad.img=null;ad.src=null;drawAv()}
  else if(b.id==='av-save'){if(ad.img){const out=256,k=out/AVC,cv=document.createElement('canvas');cv.width=cv.height=out;const s=Math.max(AVC/ad.img.naturalWidth,AVC/ad.img.naturalHeight)*ad.z;
      cv.getContext('2d').drawImage(ad.img,ad.x*k,ad.y*k,ad.img.naturalWidth*s*k,ad.img.naturalHeight*s*k);let url=cv.toDataURL('image/webp',.9);if(!url.startsWith('data:image/webp'))url=cv.toDataURL('image/jpeg',.9);
      avatar={color:ad.color,photo:url,src:ad.src,x:ad.x,y:ad.y,z:ad.z}}else avatar={color:ad.color};
    try{localStorage.setItem('cb.avatar',JSON.stringify(avatar))}catch(e){try{localStorage.setItem('cb.avatar',JSON.stringify({color:avatar.color,photo:avatar.photo}))}catch(e2){}}
    profile={first:$('pf-first').value.trim()||profile.first,last:$('pf-last').value.trim(),show:ad.show};try{localStorage.setItem('cb.profile',JSON.stringify(profile))}catch(e){}
    window.CTMeSave&&CTMeSave();paintAvatar();buzz('firm');av.close();toast('Profile saved')}
  else if(b.hasAttribute('data-close'))av.close()});
// a color square (saturation and brightness) and a hue slider, drawn with CSS gradients
let hsv={h:345,s:.9,v:.65};
function hexToHsv(hex){const n=parseInt(hex.slice(1),16),r=(n>>16)/255,g=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return {h,s:mx?d/mx:0,v:mx}}
function hsvToHex({h,s,v}){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return '#'+[f(5),f(3),f(1)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}
function paintPicker(){const sv=$('cp-sv');if(!sv)return;sv.style.setProperty('--hue','hsl('+hsv.h+',100%,50%)');$('cp-dot').style.left=(hsv.s*100)+'%';$('cp-dot').style.top=((1-hsv.v)*100)+'%';$('cp-dot').style.background=ad?ad.color:'#fff';$('cp-hue').value=hsv.h;$('cp-hue').style.setProperty('--hc','hsl('+hsv.h+',100%,50%)')}
function pickFromSV(e){const r=$('cp-sv').getBoundingClientRect();hsv.s=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));hsv.v=Math.min(1,Math.max(0,1-(e.clientY-r.top)/r.height));ad.color=hsvToHex(hsv);drawAv()}
let svDrag=false;$('cp-sv').addEventListener('pointerdown',e=>{svDrag=true;$('cp-sv').setPointerCapture(e.pointerId);pickFromSV(e)});$('cp-sv').addEventListener('pointermove',e=>{if(svDrag)pickFromSV(e)});['pointerup','pointercancel'].forEach(t=>$('cp-sv').addEventListener(t,()=>{svDrag=false}));
$('cp-sv').addEventListener('keydown',e=>{const st=.04,m={ArrowLeft:['s',-st],ArrowRight:['s',st],ArrowUp:['v',st],ArrowDown:['v',-st]}[e.key];if(!m)return;e.preventDefault();hsv[m[0]]=Math.min(1,Math.max(0,hsv[m[0]]+m[1]));ad.color=hsvToHex(hsv);drawAv()});
$('cp-hue').addEventListener('input',e=>{hsv.h=+e.target.value;ad.color=hsvToHex(hsv);drawAv()});
$('av-hex').addEventListener('input',e=>{let v=e.target.value.trim();if(v[0]!=='#')v='#'+v;if(/^#[0-9a-f]{6}$/i.test(v)){ad.color=v.toLowerCase();hsv=hexToHsv(ad.color);drawAv()}});
$('pf-first').addEventListener('input',()=>drawAv());
paintAvatar();
// export: entries as CSV or Excel, the board as a PDF or an image
const ex=$('ex');
function openExport(){$('ex-s').textContent='';ex.showModal()}
// files go through the viewer's save prompt in claude.ai (the page can't download on its own there); a normal link elsewhere
const toBlob=async d=>typeof d==='string'?await (await fetch(d)).blob():d;
let dlNS;const dlCap=()=>dlNS!==undefined?Promise.resolve(dlNS):(window.claude&&claude.use?claude.use('downloads').then(n=>dlNS=n,()=>dlNS=null):Promise.resolve(dlNS=null));
async function download(name,data){const blob=await toBlob(data),dl=await dlCap();
  if(dl){try{await dl.save({filename:name,data:blob});return 'saved'}catch(e){if(e&&e.code==='declined')return 'declined';if(e&&e.code==='rate_limited')return 'busy';throw e}}
  const a=document.createElement('a');a.download=name;a.href=URL.createObjectURL(blob);document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);return 'saved'}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Could not load '+src));document.head.appendChild(s)})}
const stamp=()=>TODAY;
function rowsOut(){return E.slice().sort((a,b)=>a.date<b.date?-1:1).map(e=>{const fs=e.type==='sale'?e.amount-e.net:0;return {Date:e.date,Type:e.type[0].toUpperCase()+e.type.slice(1),Card:e.name,Number:e.no,Set:e.set,Platform:e.platform,Qty:e.qty,Amount:(e.amount/100).toFixed(2),'Fees and shipping':(fs/100).toFixed(2),'You kept':e.type==='sale'?(e.net/100).toFixed(2):''}})}
async function doExport(kind){const st=$('ex-s');st.textContent='Preparing…';let res='saved';
  try{
    if(kind==='csv'){const rows=rowsOut(),cols=Object.keys(rows[0]),q=v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v);
      res=await download('card-tab-entries-'+stamp()+'.csv',new Blob([cols.join(',')+'\n'+rows.map(r=>cols.map(c=>q(r[c])).join(',')).join('\n')],{type:'text/csv'}))}
    else if(kind==='xlsx'){if(!window.XLSX)await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
      const rows=rowsOut().map(r=>Object.assign({},r,{Amount:+r.Amount,'Fees and shipping':+r['Fees and shipping'],'You kept':r['You kept']===''?'':+r['You kept']})),ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Entries');res=await download('card-tab-entries-'+stamp()+'.xlsx',new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})]))}
    else{if(!window.htmlToImage)await loadScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js');
      if(editing)setEditing(false);hideTip();const node=$('cb').querySelector('.frame'),bg=getComputedStyle($('cb')).backgroundColor;
      const opt={pixelRatio:2,backgroundColor:bg,style:{padding:'24px'},width:node.offsetWidth+48,height:node.offsetHeight+48,filter:n=>!(n.classList&&(n.classList.contains('tctl')||n.classList.contains('back')||n.classList.contains('acctw')||n.classList.contains('wmore')))};
      const name='card-board-'+stamp()+'.'+kind;
      if(kind==='png')res=await download(name,await htmlToImage.toPng(node,opt));
      else if(kind==='jpg')res=await download(name,await htmlToImage.toJpeg(node,Object.assign({quality:.92},opt)));
      else if(kind==='webp'){const cv=await htmlToImage.toCanvas(node,opt);res=await download(name,cv.toDataURL('image/webp',.92))}
      else{if(!window.jspdf)await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
        const cv=await htmlToImage.toCanvas(node,opt),w=cv.width/2,h=cv.height/2,doc=new jspdf.jsPDF({orientation:w>h?'landscape':'portrait',unit:'px',format:[w,h],hotfixes:['px_scaling']});
        doc.addImage(cv.toDataURL('image/jpeg',.92),'JPEG',0,0,w,h);res=await download(name,doc.output('blob'))}}
    st.textContent=res==='declined'?'Not saved.':res==='busy'?'One moment, a save is already open.':'Saved.';if(res==='saved')buzz('firm')
  }catch(err){st.textContent='That didn’t work here. Try again in the app.';console.warn(err)}}
ex.addEventListener('click',e=>{if(e.target===ex){ex.close();return}const b=e.target.closest('button');if(!b)return;if(b.dataset.ex)doExport(b.dataset.ex);else if(b.hasAttribute('data-close'))ex.close()});

// ---------- share: a private link, privacy choices, email invites, and a look at what viewers see ----------
const shd=$('shd'),SH_URL=()=>'https://cardtab.app/b/'+share.id;
function openShare(){closeMenus();paintShare();shd.showModal()}
function paintShare(){$('sh-on').setAttribute('aria-checked',share.on);$('sh-state').textContent=share.on?'Anyone with the link can view':'Only you can see this board';
  $('sh-linkrow').classList.toggle('off',!share.on);$('sh-link').value=SH_URL().replace('https://','');
  [['sh-amt','amt'],['sh-names','names'],['sh-tips','tips']].forEach(([id,k])=>$(id).setAttribute('aria-checked',share[k]));
  $('sh-live').querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',(b.dataset.v==='live')===share.live));
  $('sh-exp').querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',b.dataset.v===share.exp));
  $('sh-emails').innerHTML=share.emails.map((m,i)=>'<span class="echip">'+esc(m)+'<button type="button" data-rm="'+i+'" aria-label="Remove '+esc(m)+'">✕</button></span>').join('');
  $('sh-acct').classList.toggle('on',share.on)}
shd.addEventListener('click',async e=>{if(e.target===shd){shd.close();return}const b=e.target.closest('button');if(!b)return;
  const sw={'sh-on':'on','sh-amt':'amt','sh-names':'names','sh-tips':'tips'}[b.id];
  if(sw){share[sw]=!share[sw];saveShare();paintShare();buzz('tick');if(viewing)render(false);return}
  if(b.dataset.v&&b.parentNode.id==='sh-live'){share.live=b.dataset.v==='live';saveShare();paintShare();return}
  if(b.dataset.v&&b.parentNode.id==='sh-exp'){share.exp=b.dataset.v;saveShare();paintShare();return}
  if(b.id==='sh-copy'){try{await navigator.clipboard.writeText(SH_URL());b.textContent='Copied ✓';b.classList.add('ok');setTimeout(()=>{b.textContent='Copy link';b.classList.remove('ok')},1500)}catch(err){const i=$('sh-link');i.focus();i.select();toast('Press ⌘C or Ctrl+C to copy')}buzz('tick');return}
  if(b.id==='sh-new'){share.id=(window.cbShNewId?cbShNewId():Math.random().toString(36).slice(2,12).padEnd(10,'x'));saveShare();paintShare();toast('New link made. The old one no longer works.');return}
  if(b.id==='sh-add'){addEmail();return}
  if(b.dataset.rm){share.emails.splice(+b.dataset.rm,1);saveShare();paintShare();return}
  if(b.id==='sh-view'){shd.close();setViewing(true);return}
  if(b.hasAttribute('data-close'))shd.close()});
function addEmail(){const i=$('sh-email'),v=i.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){$('sh-emsg').textContent='Enter an email address like name@example.com.';return}
  if(!share.emails.includes(v))share.emails.push(v);if(!share.on)share.on=true;i.value='';$('sh-emsg').textContent='Sending the link…';saveShare();paintShare();buzz('tick')}
$('sh-email').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addEmail()}});
function setViewing(on){viewing=on;paintTitle();if(on&&editing)setEditing(false);$('cb').classList.toggle('viewing',on);$('vbar').hidden=!on;hideTip();render(false);if(on)cbx.scrollTop=0}
$('vbar-x').addEventListener('click',()=>setViewing(false));
$('cb-share').addEventListener('click',openShare);

// ---------- Ask: questions about this board, answered by Claude from your numbers ----------
// v45 Ask: answered by Card Tab's server (Claude Haiku 5.5). The server works every number out from your entries, exactly;
// the questions left this month come from the server too (Free 5, Premium 50). sampleFn stays for the Claude preview.
const askd=$('askd');let sampleFn=null,askTurns=[],askCtl=null,askInfo=null;
const ASK_URL=()=>window.CT_ASK_URL||(window.CTSession&&CTSession.REAL?CTSession.API+'/auth/ask':'');
const askReady=()=>!!ASK_URL()||!!sampleFn;
const resetOn=()=>{const r=askInfo&&askInfo.resets;return r?dFmt(r,{month:'short',day:'numeric'}):''};
function paintAskLeft(){const el=$('ask-left');if(!askInfo||sampleFn){el.hidden=true;return}const {left,limit,plan}=askInfo,free=plan!=='premium';
  el.hidden=!(free||left<=5);el.classList.toggle('warn',left<=(free?1:5));
  el.innerHTML=left===0?(free?'You’ve used your '+limit+' free questions this month. They reset on '+resetOn()+'. <button type="button" class="askup" data-askup>Premium gets 50</button>':'You’ve used all '+limit+' questions this month. They reset on '+resetOn()+'.')
    :free?left+' of '+limit+' free questions left this month':'Only '+cnt(left,'question','questions')+' left this month. They reset on '+resetOn()+'.';
  const off=left===0;$('ask-in').disabled=off;$('ask-go').disabled=off;$('ask-starts').querySelectorAll('button').forEach(b=>b.disabled=off)}
if(window.claude&&claude.use)claude.use('sample').then(f=>{sampleFn=f;paintAskAvail()},()=>{});
async function askPost(body,signal){let r;try{r=await fetch(ASK_URL(),{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal})}catch(e){if(e&&e.name==='AbortError')throw e;throw Object.assign(new Error('offline'),{code:'offline'})}let j={};try{j=await r.json()}catch(e){}
  if(j&&j.limit!=null)askInfo={limit:j.limit,left:j.left,resets:j.resets,plan:j.plan};if(!r.ok)throw Object.assign(new Error(j.error||'failed'),{code:r.status===401?'signin':r.status===404?'nosrv':j.error||'failed',detail:j.detail});return j}
function askCheck(){if(!ASK_URL()||sampleFn)return;askPost({check:true}).then(()=>paintAskLeft(),()=>{})}
function paintAskAvail(){const ok=askReady(),asked=!!$('ask-log').children.length;$('ask-off').hidden=ok;$('ask-form').hidden=!ok;$('ask-starts').hidden=!ok||askTurns.length>0||asked;paintAskLeft()}
const STARTS=['Which platform costs me the most in fees?','Why was profit down the last few months?','What was my best sale, and why did it work?','Am I buying more than I’m selling?'];
window.CTAskOpen=function(){
  // v45: Free asks too (5 questions a month); the window says how many are left
  if(cbx.classList.contains('off')){cbx.inert=false;cbx.removeAttribute('aria-hidden');cbx.classList.add('pmonly');const d=$('askd');if(d)d.addEventListener('close',function back(){d.removeEventListener('close',back);if(cbx.classList.contains('off')){cbx.inert=true;cbx.setAttribute('aria-hidden','true')}cbx.classList.remove('pmonly')})}openAsk()};
function openAsk(){closeMenus();placeAsk();$('ask-starts').innerHTML=STARTS.map(q=>'<button type="button" data-q="'+esc(q)+'">'+esc(q)+'</button>').join('');$('ask-scope').textContent=$('cb-perl').textContent+' · '+$('cb-platl').textContent;paintAskAvail();askCheck();askd.showModal();if(matchMedia('(hover:hover) and (pointer:fine)').matches)setTimeout(()=>{if(askd.open)$('ask-in').focus({preventScroll:true})},420)}
// everything Claude sees: the period you picked, with exact cents
function askData(){const ctx=ctxNow(),t=totals(ctx.inP),d=c=>(c/100).toFixed(2),pt={};
  ctx.inP.forEach(e=>{const o=pt[e.platform]||(pt[e.platform]={bought:0,sold:0,fees:0,sales:0,n:0});if(e.type==='purchase')o.bought+=e.amount;if(e.type==='sale'){o.sales+=e.amount;o.fees+=e.amount-e.net;o.n++}});
  const pv=ctx.prevP?totals(ctx.prevP):null;
  return 'Period: '+$('cb-perl').textContent+' ('+ctx.a+' to '+ctx.b+'), platforms: '+$('cb-platl').textContent+'. Amounts in US dollars.\n'+
   'Totals: sales '+d(t.sales)+', fees and shipping '+d(t.fees)+', kept after fees '+d(t.after)+', spent '+d(t.spent)+', profit '+d(t.profit)+', entries '+t.n+'.\n'+
   (pv?'Comparison period ('+(compare==='year'?'same dates last year':'the same length just before')+'): sales '+d(pv.sales)+', spent '+d(pv.spent)+', fees '+d(pv.fees)+', profit '+d(pv.profit)+'.\n':'')+
   'By '+ctx.unit+' (label | sales | spent | fees | profit):\n'+ctx.mt.map(x=>{const y=totals(x.list);return x.m+' | '+d(y.sales)+' | '+d(y.spent)+' | '+d(y.fees)+' | '+d(y.profit)}).join('\n')+'\n'+
   'By platform (platform | bought | sales | fees and shipping | number of sales):\n'+Object.keys(pt).map(k=>k+' | '+d(pt[k].bought)+' | '+d(pt[k].sales)+' | '+d(pt[k].fees)+' | '+pt[k].n).join('\n')+'\n'+
   'Recent entries (date | type | card | platform | amount | kept):\n'+ctx.inP.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,40).map(e=>e.date+' | '+e.type+' | '+e.name+(e.no?' '+e.no:'')+' | '+e.platform+' | '+d(e.amount)+' | '+(e.type==='sale'?d(e.net):'')).join('\n')}
const ASK_RULES='You are the assistant inside Card Tab, an app where a trading card collector tracks what they buy and sell. Answer their question using only the data below. Keep it short: two to five plain sentences, or a short list. Quote exact dollar amounts to the cent from the data. If the data can\'t answer it, say what is missing. Talk to them as "you". No disclaimers. Format: plain text; you may use "- " bullets and **bold** for one or two key figures.\n\nDATA\n';
function fmtAns(t){const lines=esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').split('\n');let h='',inl=false;
  lines.forEach(l=>{if(/^\s*[-•]\s+/.test(l)){if(!inl){h+='<ul>';inl=true}h+='<li>'+l.replace(/^\s*[-•]\s+/,'')+'</li>'}else{if(inl){h+='</ul>';inl=false}if(l.trim())h+='<p>'+l+'</p>'}});return h+(inl?'</ul>':'')}
function addBubble(role,html){const el=document.createElement('div');el.className='bub '+role;el.innerHTML=html;$('ask-log').appendChild(el);$('ask-log').scrollTop=1e6;return el}
// the answer appears quickly, word by word, once it arrives (the server sends it whole)
function reveal(out,text,signal){return new Promise(res=>{const words=text.split(/(\s+)/),n=words.length,ms=Math.min(900,120+n*9),t0=performance.now();
  const step=now=>{if(signal&&signal.aborted){out.innerHTML=fmtAns(text);res();return}const k=Math.min(n,Math.ceil(n*(now-t0)/ms));out.innerHTML=fmtAns(words.slice(0,k).join(''));$('ask-log').scrollTop=1e6;if(k<n)requestAnimationFrame(step);else res()};requestAnimationFrame(step)})}
async function ask(q){q=(q||'').trim();if(!askReady()||askCtl||!q||(askInfo&&askInfo.left<=0&&!sampleFn))return;$('ask-starts').hidden=true;addBubble('me',esc(q));const out=addBubble('ai','<p class="think">Thinking…</p>');
  askCtl=new AbortController();$('ask-go').hidden=true;$('ask-stop').hidden=false;
  try{
    if(sampleFn){const input=askTurns.length?askTurns.concat([{role:'user',content:q}]):[{role:'user',content:ASK_RULES+askData()+'\n\nQUESTION\n'+q}];
      const {text}=await sampleFn(input,{signal:askCtl.signal,onText:({text})=>{out.innerHTML=fmtAns(text);$('ask-log').scrollTop=1e6}});out.innerHTML=fmtAns(text);
      askTurns=input.concat([{role:'assistant',content:text}]).slice(-9);if(askTurns[0].role!=='user')askTurns.shift()}
    else{window.CTTrack&&CTTrack.ev('ask',askTurns.length?'follow-up':'first');const c=ctxNow(),j=await askPost({q,turns:askTurns,view:{label:$('cb-perl').textContent,from:c.a,to:c.b,platform:plat}},askCtl.signal);
      paintAskLeft();await reveal(out,j.text,askCtl.signal);askTurns=askTurns.concat([{role:'user',content:q},{role:'assistant',content:j.text}]).slice(-8)}}
  catch(err){const c=err&&(err.code||err.name);out.innerHTML=(err&&err.text?fmtAns(err.text):'')+'<p class="err">'+(c==='aborted'||c==='AbortError'?'Stopped.':c==='limit'?'That’s all your questions for this month.':c==='signin'?'Sign in again to keep asking.':c==='busy'?'Ask is busy right now. Try again in a few minutes.':c==='nosrv'?'Ask isn’t on Card Tab’s server yet. It starts working once the server has its update.':c==='setup'?'Ask is on the server, but its AI key isn’t set yet.':c==='key'||c==='billing'||c==='model'?'Ask can’t reach its AI right now. Try again later.':c==='offline'?'Couldn’t reach Card Tab. Check your connection and try again.':c==='not_granted'?'Ask needs your OK to use Claude. Open Ask again to allow it.':c==='rate_limited'?'Too many questions at once. Try again in a moment.':'That didn’t go through. Try asking again.')+(err&&err.detail?' <small class="askdet">('+esc(err.detail)+')</small>':'')+'</p>';paintAskLeft()}
  finally{askCtl=null;$('ask-go').hidden=false;$('ask-stop').hidden=true}}
$('ask-form').addEventListener('submit',e=>{e.preventDefault();const v=$('ask-in').value;$('ask-in').value='';ask(v)});
askd.addEventListener('click',e=>{if(e.target===askd){askd.close();return}const b=e.target.closest('button');if(!b)return;if(b.dataset.q){ask(b.dataset.q);return}
  if(b.hasAttribute('data-askup')){askd.close();setTimeout(()=>window.CTPremiumOpen&&window.CTPremiumOpen('ask'),calm.matches?0:260);return}if(b.id==='ask-stop'&&askCtl){askCtl.abort();return}if(b.id==='ask-new'){askTurns=[];$('ask-log').innerHTML='';paintAskAvail();return}if(b.hasAttribute('data-close'))askd.close()});
$('cb-ask').addEventListener('click',openAsk);

// ---------- sheets: the title and the main button stay put; only the part between them scrolls, with its own scrollbar ----------
document.querySelectorAll('dialog.sheet .awp').forEach(p=>{if(p.closest('#askd')||p.closest('#pms'))return;const kids=[...p.children];let i=0;while(i<kids.length&&kids[i].matches('.awh,.awtop'))i++;
  let j=kids.length;while(j>i&&kids[j-1].matches('.go,.rsb,.awfoot,.shnote,.awt'))j--;if(j-i<1)return;
  const body=document.createElement('div');body.className='awbody';p.insertBefore(body,kids[i]);kids.slice(i,j).forEach(k=>body.appendChild(k))});

// the entries sheet: what makes up a number, newest first, grouped by month
const ent=$('ent');
function openEntries(o){hideTip();const key=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+e.no;
  let list=pool().filter(e=>e.date>=(o.a||'0000')&&e.date<=(o.b||'9999')&&(!o.types||o.types.includes(e.type))&&(!o.plat||e.platform===o.plat)&&(!o.card||(typeof CK!=='undefined'&&CK.get(e.id)||key(e))===o.card)&&(!o.fees||e.amount-e.net>0));
  if(o.card)list=E.filter(e=>(typeof CK!=='undefined'&&CK.get(e.id)||key(e))===o.card);
  list=list.slice().sort((a,b)=>a.date<b.date?1:-1);
  const sum=list.reduce((t,e)=>t+(e.type==='sale'?(o.fees?e.amount-e.net:e.net):-e.amount),0),scope=o.sub||(o.card?'':$('cb-perl').textContent+(plat==='all'?'':' · '+plat));
  $('ent-h').textContent=o.t;$('ent-sub').textContent=[scope,cnt(list.length,'entry','entries')+(list.length?' · '+(o.fees?'fees and shipping '+money(sum):(sum>=0?'net +':'net ')+money(sum)):'')].filter(Boolean).join(' · ');
  // long ranges load in batches of 50 as you scroll, so the sheet opens fast whatever the size; the summary above counts everything
  const el=$('ent-list');let m='',at=0;
  const row=e=>{const sale=e.type==='sale',amt=sale?'+'+money(e.amount):'−'+money(e.amount),sub=sale?(o.fees?'fees '+money(e.amount-e.net):'you kept '+money(e.net)):'';
    return '<div class="er"><span class="ety t-'+e.type+'">'+(sale?'Sale':e.type==='purchase'?'Buy':'Refund')+'</span><div class="en"><b>'+esc(e.name)+(e.qty>1?' ×'+e.qty:'')+'</b><small>'+dFmt(e.date,{month:'short',day:'numeric'})+' · '+esc(e.platform)+(e.no?' · '+esc(e.no):'')+'</small></div><div class="ea'+(sale?' p':'')+'">'+amt+(sub?'<small>'+sub+'</small>':'')+'</div></div>'};
  const more=()=>{if(at>=list.length)return;let h='';list.slice(at,at+50).forEach(e=>{const mm=e.date.slice(0,7);if(mm!==m){m=mm;h+='<p class="emh">'+mLong(mm)+'</p>'}h+=row(e)});at+=50;el.insertAdjacentHTML('beforeend',h)};
  el.innerHTML=list.length?'':'<p class="enone">No entries here.</p>';more();buzz('tap');ent.showModal();
  // find the part of the sheet that actually scrolls, and top up the list whenever you get within ~800px of its end
  let sc=el;while(sc&&sc!==ent){const ov=getComputedStyle(sc).overflowY;if((ov==='auto'||ov==='scroll')&&sc.scrollHeight>sc.clientHeight+1)break;sc=sc.parentElement}
  if(!sc||sc===ent)sc=el.closest('.awbody')||el;sc.scrollTop=0;
  if(entScroll)entScroll[0].removeEventListener('scroll',entScroll[1]);
  const top=()=>{if(at<list.length&&sc.scrollHeight-sc.scrollTop-sc.clientHeight<800)more()};entScroll=[sc,top];sc.addEventListener('scroll',top,{passive:true})}
let entScroll=null;
ent.addEventListener('click',e=>{if(e.target===ent){ent.close();return}const b=e.target.closest('button');if(b&&b.hasAttribute('data-close'))ent.close()});
$('simple').addEventListener('keydown',e=>{const d=e.target.closest('.drill[data-drill]');if(d&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(canDrill())openEntries(JSON.parse(d.dataset.drill))}});

// desktop: Ask opens as a panel under its button and grows out of it; phones keep the bottom sheet
function placeAsk(){const d=$('askd');if(matchMedia('(max-width:760px)').matches){d.classList.remove('pop');return}
  // v36: it opens under the header's Ask button when that's on screen
  const hb=document.querySelector('.ct-shell .sh-ask');const r=(hb&&hb.getBoundingClientRect().width?hb:$('cb-ask')).getBoundingClientRect(),W=Math.min(420,innerWidth-32),right=Math.max(16,innerWidth-r.right),top=r.bottom+10,left=innerWidth-right-W;
  d.classList.add('pop');d.style.setProperty('--at',top+'px');d.style.setProperty('--ar',right+'px');d.style.setProperty('--aw',W+'px');d.style.setProperty('--ox',(r.left+r.width/2-left).toFixed(0)+'px')}
addEventListener('resize',()=>{if($('askd').open)placeAsk()});

// ---------- touch: tap for a quick answer, not a full list ----------
// Charts: tap or slide across the bars. The bar you're on lights up, the others fade, the header shows that month,
// and "See entries" opens the list. Tap the same bar again, or anywhere else, to clear.
// Number tiles: tap to flip to how the number adds up; tap again to flip back.
const TOUCH=matchMedia('(hover:none)');
function scrubChart(el,svg,sp){const w=el.closest('.w');if(!w)return;let cur=-1,drag0=null,moved=false,startCur=-1;
  const n=svg.querySelectorAll('rect[data-i]').length,W=+svg.getAttribute('width');
  const ro=()=>{let r=w.querySelector('.scr');if(!r){r=document.createElement('div');r.className='scr';r.innerHTML='<span class="st"></span><button type="button" class="sgo">See entries ›</button>';w.appendChild(r);
    r.querySelector('.sgo').addEventListener('click',ev=>{ev.stopPropagation();const i=+r.dataset.i;if(sp.ent&&canDrill()&&i>-1)openEntries(sp.ent(i))});r.addEventListener('click',ev=>ev.stopPropagation())}return r};
  const pick=i=>{if(i===cur)return;cur=i;svg.querySelectorAll('path.bar').forEach(b=>b.classList.toggle('on',+b.dataset.i===i));svg.classList.toggle('sel',i>-1);const r=ro();
    if(i<0){r.classList.remove('on');w.classList.remove('scrubbing');return}
    buzz('tick');r.dataset.i=i;{const h=hideMoney(sp.tip(i)),m=h.match(/^<b>(.*?)<\/b>([\s\S]*)$/);r.querySelector('.st').innerHTML=m?'<b>'+m[1]+'</b><span class="sd">'+m[2].replace(/<br\s*\/?>/g,' · ')+'</span>':h}r.querySelector('.sgo').hidden=!(sp.ent&&canDrill());r.classList.add('on');w.classList.add('scrubbing')};
  const at=x=>{const b=svg.getBoundingClientRect();return Math.max(0,Math.min(n-1,Math.floor((x-b.left)/b.width*n)))};
  svg.style.touchAction='pan-y';
  svg.addEventListener('pointerdown',e=>{if(editing||viewing||rz||drag||noTips())return;drag0=[e.clientX,e.clientY];moved=false;startCur=cur;const i=at(e.clientX);if(i!==cur)pick(i)});
  svg.addEventListener('pointermove',e=>{if(!drag0)return;if(!moved&&Math.abs(e.clientX-drag0[0])>8&&Math.abs(e.clientX-drag0[0])>Math.abs(e.clientY-drag0[1])){moved=true;try{svg.setPointerCapture(e.pointerId)}catch(_){}}if(moved)pick(at(e.clientX))});
  svg.addEventListener('pointerup',e=>{if(drag0&&!moved&&startCur>-1&&startCur===at(e.clientX))pick(-1);drag0=null});
  svg.addEventListener('pointercancel',()=>{drag0=null});
  svg.addEventListener('click',e=>e.stopPropagation());
  svg._clear=()=>pick(-1)}
const FLIP={
  profit:t=>[['You kept',money(t.after)],['You spent','−'+money(t.spent)],['Profit',money(t.profit),t.profit>=0?'g':'r']],
  sales:t=>[['Sales',money(t.sales)],['Fees','−'+money(t.fees)],['You kept',money(t.sales-t.fees)]],
  spent:(t,l)=>{const nb=l.filter(e=>e.type==='purchase').reduce((a,e)=>a+(e.qty||1),0);return [['Cards bought',String(nb)],['Avg per card',money(Math.round(t.spent/Math.max(1,nb)))],['Spent',money(t.spent)]]},
  fees:t=>[['Sales',money(t.sales)],['Of sales',(t.sales?(t.fees/t.sales*100).toFixed(1):'0.0')+'%'],['Fees',money(t.fees)]]};
function flipTile(w,k,o){if(!w)return;const old=w.querySelector('.kback');
  if(old||!k){if(old){old.classList.remove('on');w.classList.remove('flipped');setTimeout(()=>old.remove(),220)}return}
  document.querySelectorAll('#simple .kback').forEach(x=>flipTile(x.closest('.w'),null));
  const list=pool().filter(e=>e.date>=(o.a||'0000')&&e.date<=(o.b||'9999')),rows=FLIP[k](totals(list),list);
  const b=document.createElement('div');b.className='kback';b.dataset.o=JSON.stringify(o);
  b.innerHTML='<div class="kis">'+rows.map((r,i)=>'<div class="ki'+(i===rows.length-1?' kt':'')+'"><span>'+esc(r[0])+'</span><b class="'+(r[2]||'')+'">'+hideMoney(esc(r[1]))+'</b></div>').join('')+'</div><button type="button" class="kgo">See entries ›</button>';
  w.appendChild(b);fitFlip(w,b,rows);void b.offsetWidth;b.classList.add('on');w.classList.add('flipped');buzz('tap')}
// lay the flip panel out for the tile it's in: stacked in squares and tall tiles, side by side in wide ones.
// Text sizes come from the tile's real width and height, so small tiles use their space and big ones don't look empty.
function fitFlip(w,b,rows){const W=w.clientWidth,H=w.clientHeight,wide=W/H>1.6,u=wide?H:Math.min(W,H),pad=Math.max(12,Math.min(26,u*.09)),iw=W-2*pad,cl=(x,a,z)=>Math.max(a,Math.min(z,x));
  const len=s=>String(s).length,vmax=Math.max(...rows.slice(0,-1).map(r=>len(r[1]))),tot=rows[rows.length-1];let fr,fv,ft,fl;
  if(wide){const colW=(iw-2*14)/rows.length;fv=cl(Math.min(H*.13,colW/(vmax*.6)),13,46);ft=cl(Math.min(H*.17,colW/(len(tot[1])*.6)),15,60);fl=cl(fv*.52,11,19);fr=fl}
  else{const rmax=Math.max(...rows.slice(0,-1).map(r=>len(r[0])+len(r[1])+2));fr=cl(Math.min(u*.08,iw/(rmax*.56)),11,18);ft=cl(Math.min(u*.155,iw/(len(tot[1])*.62)),18,48);fl=cl(fr*.92,11,16);fv=fr}
  const big=u>=230;b.classList.add(wide?'kh':'kv');b.classList.toggle('kbig',big);
  b.style.cssText='--pad:'+pad.toFixed(1)+'px;--fr:'+fr.toFixed(1)+'px;--fv:'+fv.toFixed(1)+'px;--ft:'+ft.toFixed(1)+'px;--fl:'+fl.toFixed(1)+'px;--gap:'+cl(u*.04,4,14).toFixed(1)+'px;--cols:'+rows.length}
document.addEventListener('pointerdown',e=>{if(!TOUCH.matches)return;if(!e.target.closest('#simple .w.scrubbing'))document.querySelectorAll('#simple svg.sel').forEach(s=>s._clear&&s._clear());
  if(!e.target.closest('#simple .w.flipped'))document.querySelectorAll('#simple .kback').forEach(x=>flipTile(x.closest('.w'),null))},{passive:true});

// ---------- while editing, tapping anywhere that isn't a widget or a control finishes, like tapping Done ----------
$('cbx').addEventListener('click',e=>{if(!editing||justDragged||rz||drag||!e.target.isConnected)return;
  if(e.composedPath().some(n=>n.matches&&n.matches('.w[data-id],button,a,input,select,textarea,label,dialog,.cb-menu,.addbar,.topbar,.rzg,.rzo,[role="button"],[role="menuitem"],.undo')))return;
  if(e.target.closest('.w[data-id],button,a,input,select,textarea,label,dialog,.cb-menu,.addbar,.topbar,.rzg,.rzo,[role="button"],[role="menuitem"],.undo'))return;
  setEditing(false)});

// the board underneath stays still while a phone menu or any sheet is open
function lockScroll(){const on=(matchMedia('(max-width:760px)').matches&&!!document.querySelector('#cb .cb-menu:not([hidden])'))||!!document.querySelector('#cb dialog[open]');cbx.classList.toggle('lock',on)}
new MutationObserver(lockScroll).observe($('cb'),{subtree:true,attributes:true,attributeFilter:['open']});

// ---------- menus: on phones they open centered over a dimmed screen (the bottom bar steps aside); back closes them ----------
;(()=>{const bd=document.createElement('div');bd.className='mbd';bd.id='mbd';$('cb').appendChild(bd);
  bd.addEventListener('click',e=>{e.stopPropagation();closeMenus();$('wmenu').hidden=true});
  const menus=[...document.querySelectorAll('#cb .cb-menu')];
  const sync=()=>{const open=menus.filter(m=>!m.hidden);bd.classList.toggle('on',open.length>0&&matchMedia('(max-width:760px)').matches);lockScroll();
    menus.forEach(m=>{if(!m.hidden)navPush('menu:'+m.id,()=>{m.hidden=true;closeMenus()});else navDone('menu:'+m.id)})};
  const mo=new MutationObserver(sync);menus.forEach(m=>mo.observe(m,{attributes:true,attributeFilter:['hidden']}))})();

// ---------- long-press a widget to start editing (phones and tablets) ----------
;(()=>{let t=0,xy=null,fired=false;const stop=()=>{clearTimeout(t);xy=null};
  $('simple').addEventListener('pointerdown',e=>{if(!TOUCH.matches||editing||viewing||e.pointerType==='mouse'||!e.target.closest('.w[data-id]'))return;xy=[e.clientX,e.clientY];fired=false;clearTimeout(t);
    t=setTimeout(()=>{if(!xy)return;fired=true;xy=null;document.querySelectorAll('#simple svg.sel').forEach(s=>s._clear&&s._clear());document.querySelectorAll('#simple .kback').forEach(x=>flipTile(x.closest('.w'),null));hideTip();buzz('firm');setEditing(true)},480)},{passive:true});
  $('simple').addEventListener('pointermove',e=>{if(xy&&Math.hypot(e.clientX-xy[0],e.clientY-xy[1])>10)stop()},{passive:true});
  ['pointerup','pointercancel','scroll'].forEach(ev=>$('simple').addEventListener(ev,stop,{passive:true}));cbx.addEventListener('scroll',stop,{passive:true});
  $('simple').addEventListener('click',e=>{if(fired){fired=false;e.stopPropagation();e.preventDefault()}},true);
  $('simple').addEventListener('contextmenu',e=>{if(TOUCH.matches&&e.target.closest('.w[data-id]'))e.preventDefault()});
  // no text selection starts from a widget on touch screens (iOS would take over the press and scroll the board away)
  $('simple').addEventListener('selectstart',e=>{if(TOUCH.matches)e.preventDefault()})})();

// ---------- motion for menus and sheets: GPU-only (transform and opacity), springy in, quick out ----------
document.querySelectorAll('dialog.sheet').forEach(d=>{const nat=HTMLDialogElement.prototype.close;
  d.close=function(v){if(!this.open||this.classList.contains('closing'))return;navDone('dlg:'+this.id);if(calm.matches){nat.call(this,v);return}this.classList.add('closing');setTimeout(()=>{this.classList.remove('closing');nat.call(this,v)},matchMedia('(max-width:760px)').matches?230:250)};
  d.addEventListener('cancel',e=>{e.preventDefault();d.close()})});
// opening: the sheet is laid out first while held on its first frame, then the motion starts on the next frame.
// The heavy first-layout work happens before anything moves, so the slide itself never stutters.
document.querySelectorAll('dialog.sheet').forEach(d=>{const nat=HTMLDialogElement.prototype.showModal;
  d.showModal=function(){if(this.open)return;fitDialog(this);navPush('dlg:'+this.id,()=>this.close());
    if(calm.matches){nat.call(this);settleDialog(this);return}this.classList.add('prep');nat.call(this);settleDialog(this);void this.offsetHeight;requestAnimationFrame(()=>requestAnimationFrame(()=>this.classList.remove('prep')))}});
// Pin every sheet to the part of the screen you can actually see. Inside the Claude app on iPhone the page's
// "100%" can be taller or shorter than the visible area, which put sheets mid-screen and cut off at the top.
function fitDialog(d){const vv=window.visualViewport,h=Math.round(vv?vv.height:innerHeight),t=Math.round(vv?vv.offsetTop:0),w=Math.round(vv?vv.width:innerWidth);
  d.style.position='fixed';d.style.inset='auto';d.style.left='0';d.style.top=t+'px';d.style.width=w+'px';d.style.height=h+'px';d.style.setProperty('--vvh',h+'px')}
// open at the top of the list: no jump to whatever got focus first, and no focus ring after a tap
function settleDialog(d){d.querySelectorAll('.awbody,.awp,.entlist,.asklog').forEach(x=>x.scrollTop=0);
  if(TOUCH.matches){const a=document.activeElement;if(a&&d.contains(a)&&a.blur)a.blur()}
  requestAnimationFrame(()=>d.querySelectorAll('.awbody,.awp,.entlist').forEach(x=>x.scrollTop=0))}
if(window.visualViewport)visualViewport.addEventListener('resize',()=>document.querySelectorAll('dialog.sheet[open]').forEach(fitDialog));
addEventListener('resize',()=>document.querySelectorAll('dialog.sheet[open]').forEach(fitDialog));

// ---------- Card Stories: its own page, slid in over the board. Back returns here. ----------
// The page loads quietly in the background once the board is open, so the first slide-in already has the stories on it.
;(()=>{const csx=$('csx');let csf=null,open=false;
function load(){if(csf)return;csf=document.createElement('iframe');csf.title='Card Stories';csf.srcdoc=STORIES_HTML;csx.appendChild(csf)}
function openStories(){if(open)return;open=true;navPush('stories',()=>window.cbStoriesBack());const fresh=!csf;load();let heavy=fresh;
  // only redraw Stories when the entries changed since it last drew (refresh() already keeps it current), so switching never repaints it
  try{if(csf.__ver!==window.cbDataVer){csf.contentWindow.csSync();csf.__ver=window.cbDataVer;heavy=true}}catch(e){}
  const fromE=window.cbFromEntries;window.cbFromEntries=false;csx.classList.remove('out');csx.classList.add('in');csx.removeAttribute('aria-hidden');csx.inert=false;
  // straight from Entries: Entries is the page you leave (the board opened underneath, out of sight until Stories covers it)
  // v42.25: after a redraw, start the slide two frames later so the drawing never lands mid-motion
  if(window.CTPage){const go=()=>pageGo(fromE?'entries':'board','stories',1,null);if(heavy)requestAnimationFrame(()=>requestAnimationFrame(go));else go()}
  else if(!calm.matches){if(fromE)cbx.style.visibility='hidden';pageGo(fromE?'entries':'board','stories',1,()=>{cbx.style.visibility=''})}
  setTimeout(()=>{try{csf.contentWindow.focus()}catch(e){}},calm.matches?0:420)}
window.cbStoriesBack=function(toEntries){if(!open)return;open=false;navDone('stories');csx.setAttribute('aria-hidden','true');csx.inert=true;
  const done=()=>{csx.classList.remove('in','out');if(!toEntries)try{$('cb-stories').focus({preventScroll:true})}catch(e){}};
  if(calm.matches&&!window.CTPage){done();return}
  // back one page: Stories moves out to the right and the page before it (the board, or Entries) comes in from the left
  csx.classList.add('out');pageGo('stories',toEntries?'entries':'board',-1,done)};
window.cbName=()=>(profile.first||'').trim();
$('cb-stories').addEventListener('click',openStories);
['pointerenter','touchstart','focus'].forEach(ev=>$('cb-stories').addEventListener(ev,load,{passive:true,once:true}));
const quiet=()=>{if(csf)return;if(document.querySelector('dialog[open]')||document.hidden){setTimeout(quiet,1500);return}(window.requestIdleCallback||(f=>setTimeout(f,1)))(()=>{if(document.querySelector('dialog[open]')){setTimeout(quiet,1500);return}load()},{timeout:4000})};
$('expand').addEventListener('click',()=>setTimeout(quiet,3000));
// Premium: Stories gets ready quietly in the background too, so the first switch to it is already drawn
setTimeout(()=>{try{if(!window.CTBoardPlan||window.CTBoardPlan()==='premium')quiet()}catch(e){}},5000)})();
