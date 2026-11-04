
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
// art: the user's own high-res card art first, then a few good-looking picks the app ships with
function artList(){const seen=new Set(),out=[];(E||[]).forEach(e=>{const w=e.art&&e.art.wall;if(w&&!seen.has(w)){seen.add(w);out.push({src:w,focus:e.art.focus})}});
  (window.CTPremiumArt||[]).forEach(a=>{if(!seen.has(a.src)){seen.add(a.src);out.push(a)}});return out}
let shownId=null;
function openPm(ctx){
  const c=CTX[ctx];let id,h;
  if(c){[id,h]=c}else{const x=HEADS[st.h%HEADS.length];st.h=(st.h+1)%HEADS.length;[id,h]=x}
  shownId=id;$('pm-h').textContent=h;bump(id,'v');
  const list=artList(),hero=$('pm-art');
  if(list.length){const a=list[st.a%list.length];st.a=(st.a+1)%Math.max(1,list.length*7);saveSt();
    const fy=a.focus&&a.focus.y!=null?Math.round(a.focus.y*100)+'%':'24%',fx=a.focus&&a.focus.x!=null?Math.round(a.focus.x*100)+'%':'50%';
    hero.style.backgroundImage='url("'+new URL(a.src,document.baseURI).href.replace(/"/g,'%22')+'")';hero.style.backgroundPosition=fx+' '+fy;hero.classList.add('pmart')}
  else{hero.classList.remove('pmart');hero.style.backgroundImage='';hero.style.backgroundPosition=''}
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
    if(first){first=false;b.insertAdjacentHTML('beforebegin','<div class="msep">With Premium</div>')}});});
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
