
// ---------- v16 free plan: the Premium sheet, locks, the quiet line ----------
;(()=>{const pms=$('pms');if(!pms)return;
// --- the Premium sheet: rotating headline and art, with a count of views and taps per headline ---
const HEADS=[['h1','Your whole collection, front and center.'],['h2','Unlock the rest of your board.'],['h3','See everything your collection is doing.']];
// a lock that says exactly what was tapped gets its own headline; everything else takes the next one in turn
const CTX={range:['range','Unlock all your history.'],stories:['stories','Turn your months into Card Stories.'],ask:['ask','Ask your board anything.'],share:['share','Share your board, your way.'],export:['share','Share your board, your way.'],import:['import','Bring your whole spreadsheet in.']};
const PKEY='cb.pm';
const st=(()=>{let s=null;try{s=JSON.parse(localStorage.getItem(PKEY))}catch(e){}if(!s||typeof s!=='object')s={};
  if(typeof s.h!=='number')s.h=Math.floor(Math.random()*HEADS.length);if(typeof s.a!=='number')s.a=Math.floor(Math.random()*6);if(!s.n)s.n={};return s})();
const saveSt=()=>{try{localStorage.setItem(PKEY,JSON.stringify(st))}catch(e){}};
const bump=(id,f)=>{const n=st.n[id]||(st.n[id]={v:0,t:0});n[f]++;saveSt()};
// read the results later from the console (and from the server once the app is online): views, taps and tap rate per headline
window.CTPremiumStats=()=>Object.entries(st.n).map(([id,n])=>({id,headline:(HEADS.find(h=>h[0]===id)||Object.values(CTX).find(c=>c[0]===id)||[0,id])[1],views:n.v,taps:n.t,rate:n.v?Math.round(n.t/n.v*1000)/10+'%':'—'}));
// art: the account's own cards. Their priciest purchases first (top 3, rotating), then cards they sold, then the app's picks.
// A card's artwork-only copy (art.wall) is used when it exists; otherwise the regular card image, zoomed to its artwork window.
// (After the Cloudflare move the art service makes artwork-only copies for every free user's top 3 purchases, so this fallback fades out.)
const cardKey=e=>(e.name||'')+'|'+(e.no||'')+'|'+(e.set||'');
function pick(rows){const best=new Map();rows.forEach(e=>{const a=e.art;if(!a||!(a.wall||a.detail))return;const k=cardKey(e),per=(e.amount||0)/Math.max(1,e.qty||1);const o=best.get(k);if(!o||per>o.per)best.set(k,{e,per})});
  return [...best.values()].sort((x,y)=>y.per-x.per).slice(0,3).map(({e})=>{const a=e.art,f=Array.isArray(a.focus)?{x:a.focus[0]/100,y:a.focus[1]/100}:a.focus;
    return a.wall?{src:a.wall,focus:f}:{src:a.detail,card:true}})}
function artList(){const rows=E||[];let out=pick(rows.filter(e=>e.type==='purchase'));if(!out.length)out=pick(rows.filter(e=>e.type==='sale'));
  return out.length?out:(window.CTPremiumArt||[]).slice()}
let shownId=null;
function openPm(ctx){
  const c=CTX[ctx];let id,h;
  if(c){[id,h]=c}else{const x=HEADS[st.h%HEADS.length];st.h=(st.h+1)%HEADS.length;[id,h]=x}
  shownId=id;$('pm-h').textContent=h;bump(id,'v');
  const list=artList(),hero=$('pm-art');
  if(list.length){const a=list[st.a%list.length];st.a=(st.a+1)%420;saveSt();
    const fy=a.focus&&a.focus.y!=null?Math.round(a.focus.y*100)+'%':'24%',fx=a.focus&&a.focus.x!=null?Math.round(a.focus.x*100)+'%':'50%';
    hero.style.backgroundImage='url("'+new URL(a.src,document.baseURI).href.replace(/"/g,'%22')+'")';
    // a whole card: zoom past the frame and name strip so only the artwork window fills the header
    hero.style.backgroundSize=a.card?'120% auto':'';hero.style.backgroundPosition=a.card?'50% 21%':fx+' '+fy;hero.classList.add('pmart')}
  else{hero.classList.remove('pmart');hero.style.backgroundImage='';hero.style.backgroundPosition='';hero.style.backgroundSize=''}
  closeMenus();hideTip();buzz('tap');pms.showModal();const pp=pms.querySelector('.pmp');pp.tabIndex=-1;pp.focus({preventScroll:true})}
PM_OPEN=openPm;
// warm the art up the first time a free user opens the board, so the sheet never shows a blank header
let warmed=false;function warmArt(){if(warmed||!cbFree())return;warmed=true;artList().slice(0,3).forEach(a=>{const i=new Image();i.decoding='async';i.src=a.src})}
pms.addEventListener('click',e=>{if(e.target===pms||e.target.closest('[data-close]')){pms.close();return}
  if(e.target.closest('#pm-go')){if(shownId)bump(shownId,'t');buzz('firm');
    if(window.CTBoardUpgrade){pms.close();setTimeout(()=>window.CTBoardUpgrade(),calm.matches?0:260)}else toast('Upgrading opens at launch')}});
// --- locks ---
const lockAct=(el,ctx)=>el&&el.addEventListener('click',e=>{if(!cbFree())return;e.preventDefault();e.stopImmediatePropagation();openPm(ctx)},true);
lockAct($('cb-stories'),'stories');lockAct($('cb-ask'),'ask');lockAct($('cb-share'),'share');
$('cb-amenu').addEventListener('click',e=>{if(!cbFree())return;const b=e.target.closest('[data-am]');if(!b)return;const a=b.dataset.am;
  if(a==='import'||a==='export'||a==='plan'||(a==='go-stories'&&$('cb-amenu').dataset.ctx!=='stories')){e.preventDefault();e.stopImmediatePropagation();closeMenus();setTimeout(()=>openPm(a==='plan'?null:a==='go-stories'?'stories':a),calm.matches?0:120)}},true);
$('aw-list').addEventListener('click',e=>{const th=e.target.closest('.thumb.lockd');if(!th)return;e.preventDefault();e.stopImmediatePropagation();
  aw.close();setTimeout(()=>openPm(null),calm.matches?0:260)},true);
// the time range menu: what Free covers first, then everything else under "With Premium", each with a lock
$('cb-per').addEventListener('click',()=>{if(!cbFree())return;const m=$('cb-menu');if(m.hidden)return;let first=true;
  m.querySelectorAll('button[data-k]').forEach(b=>{if(FREE_P.includes(b.dataset.k))return;b.classList.add('lockd');b.setAttribute('aria-label',b.textContent+', Premium');b.insertAdjacentHTML('beforeend','<span class="mlock">'+LOCK_I+'</span>');
    if(first){first=false;b.insertAdjacentHTML('beforebegin','<div class="mprem">With Premium</div>')}});});
// --- the quiet line: the first few times a free user opens the board ---
const QKEY='cb.quiet.n';const q=document.createElement('div');q.className='cbquiet';q.hidden=true;
q.innerHTML='<span><b>Free</b> shows your last 3 months.</span><button type="button">See Premium</button>';
q.querySelector('button').addEventListener('click',()=>openPm(null));$('simple').before(q);
let counted=false;
function paintQuiet(){let n=0;try{n=+localStorage.getItem(QKEY)||0}catch(e){}q.hidden=!(cbFree()&&shown&&!editing&&n<=3)}
function countOpen(){if(!cbFree()||counted)return;counted=true;try{localStorage.setItem(QKEY,String((+localStorage.getItem(QKEY)||0)+1))}catch(e){}}
// --- keep everything in step with the plan ---
window.cbSyncPlan=function(){const f=cbFree();document.documentElement.classList.toggle('cbfree',f);const changed=applyPlan();if(changed&&shown)render(false);if(!f&&pms.open)pms.close();paintQuiet();return changed};
new MutationObserver(()=>{if(cbx.classList.contains('off')){counted=false}else{countOpen();warmArt()}paintQuiet()}).observe(cbx,{attributes:true,attributeFilter:['class']});
new MutationObserver(paintQuiet).observe($('cb'),{attributes:true,attributeFilter:['class']});
window.cbSyncPlan();
})();
// v31.1: the profile menu's close button (phones)
;(()=>{const x=document.querySelector('#cb-amenu .am-x');if(x)x.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeMenus()})})();
// v33.1: phones: Ask and Share as two icons beside Edit (the floating bar is gone); desktop: the app's tabs beside the title
;(()=>{const ask=$('cb-ask'),share=$('cb-share'),edit=$('cb-edit');if(!ask||!share||!edit)return;
 const ic=(src,label)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);const s=src.querySelector('svg');if(s)b.appendChild(s.cloneNode(true));b.addEventListener('click',e=>{e.preventDefault();src.click()});return b};
 const wrap=document.createElement('div');wrap.className='cbic';wrap.append(ic(share,'Share'),ic(ask,'Ask your board'));cbx.appendChild(wrap);
 // sits just left of Edit, in line with it
 const place=()=>{if(!matchMedia('(max-width:760px)').matches)return;const e=edit.getBoundingClientRect(),c=cbx.getBoundingClientRect();if(!e.width)return;wrap.style.top=(e.top-c.top+cbx.scrollTop+e.height/2-20)+'px';wrap.style.right=(c.right-e.left+6)+'px'};
 new MutationObserver(()=>{if(!cbx.classList.contains('off'))requestAnimationFrame(place)}).observe(cbx,{attributes:true,attributeFilter:['class']});addEventListener('resize',place);setTimeout(place,300);
 // desktop tabs, the same ones as on the entries screen
 const src=document.querySelector('.ct-tabs'),h=document.querySelector('.cbx h1.cbt');
 if(src&&h){const t=src.cloneNode(true);t.className='cb-tabs';t.querySelectorAll('[aria-current]').forEach(x=>x.removeAttribute('aria-current'));const bt=t.querySelector('[data-tab="board"]');if(bt)bt.setAttribute('aria-current','page');h.after(t)}
})();

// v33.2: Premium can open right over the entries screen (Free tapping Stories), without opening the board underneath.
// The window lives inside the board, which is inert while closed, so it's made reachable just while the window is up.
;(()=>{const pms=$('pms');if(!pms)return;
 window.CTPremiumOpen=function(ctx){if(!PM_OPEN)return;const closed=cbx.classList.contains('off');
  if(closed){cbx.inert=false;cbx.removeAttribute('aria-hidden');cbx.classList.add('pmonly');
   pms.addEventListener('close',function back(){pms.removeEventListener('close',back);if(cbx.classList.contains('off')){cbx.inert=true;cbx.setAttribute('aria-hidden','true')}cbx.classList.remove('pmonly')})}
  PM_OPEN(ctx||null)};
})();
