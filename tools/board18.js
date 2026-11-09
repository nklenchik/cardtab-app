// ---- v43.2: every widget fits whatever size it's given ----
// Widgets are drawn for their size, but a size is a different number of pixels on every screen. After each draw (and when
// the screen changes size) each widget is checked: if anything would be cut off, it gives up the least important things first
// (the "Also up" rows, then the last rows of its list, then captions and repeated details) until everything left shows whole.
// Nothing is shrunk or squashed: the rows that show, show in full. Hidden rows come back as soon as there's room.
NEWW.best=function(ctx,s,w){
  if(s!=='M'&&s!=='B')return bestBody(ctx,s,w);
  // Wide: the top sellers as a short ranked list (a row of tall cards doesn't fit one row high)
  const L=cardWins(cardStats(ctx)).filter(c=>c.g>0).sort((a,b)=>b.g-a.g).slice(0,s==='B'?4:3);
  if(!L.length)return '<p class="eg">No card bought and sold in this period yet.</p>';
  return '<div class="xalso bestl'+(s==='B'?' wide':'')+'">'+L.map((c,i)=>'<div class="xar drill"'+dd({t:c.e.name,sub:'Every entry for this card',card:c.k})+' role="button" tabindex="0"><small class="brk">#'+(i+1)+'</small>'+cardImg(c,'xai','thumb')+'<span>'+esc(nameOf(c))+'</span><b class="num">'+ksigned(c.g)+'</b></div>').join('')+'</div>'};
// phones: a card widget can be Wide (2×1); it uses the compact card-and-number layout, stretched across
['win','pricey'].forEach(k=>{const f=NEWW[k];NEWW[k]=(ctx,s,w)=>f(ctx,phone.matches&&s==='M'?'S':s,w)});
const FIT_ROWS=[['.xalso:not(.bestl) .xar','.xalso:not(.bestl)'],['.alsoup .mr','.alsoup'],['.bestl .xar',null,1],['.lr>.r',null,1],['.gl>.glr',null,1],['.st>.pr',null,1],['.pod>.pc.r3'],['.pod>.pc.r2']];
// in order: repeated details first; a number widget gives up its little trend line before anything else; the big number stays
const FIT_DROP=['.k-pricey .xl','.cap','.kspk','.k-budget .cv','.k-feat .fpc','.k-feat .fl','.k-feat>.wh .ttl','.k-month .msum','.k-month svg text','.xm','.k-tied .skey','.chips','.msum','.facts','.xpc','.shb'];
// something is cut off when it reaches past the widget's edge, is squeezed shorter than its own text, or (on the full-art
// widgets, where the words sit on the picture) runs up under the widget's title
function spills(wb){const R=wb.getBoundingClientRect();if(!R.height)return false;if(wb.scrollHeight>wb.clientHeight+4)return true;// (long names that run wide are shortened with … by their own styles, so only height counts)
  const wh=wb.parentElement.querySelector(':scope>.wh .ttl:not(.fh)'),H=wh&&wh.getBoundingClientRect(),over=H&&H.height&&H.bottom>R.top+2;
  for(const el of wb.querySelectorAll('*')){if(el.closest('.fh,.d,.ph'))continue;if(el.closest('.cv,.iok'))continue;/* v50.12: charts redraw to fit their box, so a chart still drawn for the old size never counts as cut off *//* .d = a row's details, folded away until tapped */const r=el.getBoundingClientRect();if(!r.width)continue;
    const txt=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(txt&&el.scrollHeight>el.clientHeight+6){const cs=getComputedStyle(el);/* v50.3: text clamped to a line or two ends in … on purpose — that isn't cut off */if(cs.overflowY!=='visible'&&(cs.webkitLineClamp||'none')==='none')return true}
    if(!r.height)continue;/* v50.5: only words can be cut off — a zoomed card picture or a bar running past the edge is clipped on purpose */if((r.top<R.top-4||r.bottom>R.bottom+3)&&el.tagName!=='IMG'&&(el.textContent||'').trim())return true;
    if(over&&txt&&r.top<H.bottom-1&&r.bottom>H.top&&r.left<H.right&&r.right>H.left)return true}return false}
// v50.70: when something would be cut off, it shortens instead: a label with a short form (data-short, "Average month" →
// "Avg month"), and an amount drops its cents ($2,298.23 → $2,298), then shortens to thousands or millions ($2.3K, $123K, $1.2M)
const MONEY=/^([+−-]?)\$([\d,]+)(\.\d\d)?$/;
const kmb=(sg,d)=>{const v=Number(d.replace(/,/g,''));return v<1000?null:sg+'$'+(v>=1e6?(v/1e6).toFixed(v<1e7?1:0).replace(/\.0$/,'')+'M':(v/1e3).toFixed(v<1e4?1:0).replace(/\.0$/,'')+'K')};
const cut=n=>n.scrollWidth>n.clientWidth+1;
function fitShort(root){root.querySelectorAll('[data-short]').forEach(n=>{if(n.dataset.full==null)n.dataset.full=n.innerHTML;n.innerHTML=n.dataset.full;if(cut(n))n.innerHTML=n.dataset.short});
  root.querySelectorAll('.num,.bn,b,strong').forEach(n=>{if(n.children.length)return;if(n.dataset.amt==null){if(!MONEY.test(n.textContent.trim()))return;n.dataset.amt=n.textContent.trim()}
    const full=n.dataset.amt,m=full.match(MONEY),isBn=n.classList.contains('bn'),mx=isBn?parseFloat(getComputedStyle(n).getPropertyValue('--mx'))||34:0;
    // a big number shrinks its type to fit; past about a tenth smaller it shortens instead, so big numbers stay big
    const set=t=>{n.textContent=t;if(isBn)n.style.setProperty('--len',Math.max(4,t.length))},bad=()=>isBn?parseFloat(getComputedStyle(n).fontSize)<mx*.9:cut(n);
    set(full);n.removeAttribute('title');if(!bad())return;
    if(m[3]){set(m[1]+'$'+m[2]);n.title=full;if(!bad())return}const k=kmb(m[1],m[2]);if(k){set(k);n.title=full}})}
function fitW(w){const wb=w.querySelector(':scope>.wb');if(!wb)return;fitShort(wb);
  /* v50.4: never measure while the widget or its rows are still sliding or growing in — a row caught mid-animation looks
     cut off, and the widget would hide it for good. Measure again once those animations end. */
  if(w.getAnimations){const run=w.getAnimations({subtree:true}).filter(a=>a.playState==='running'&&a.effect&&a.effect.getTiming().iterations!==Infinity);
    if(run.length){Promise.all(run.map(a=>a.finished.catch(()=>{}))).then(fitSoon);return}}
  wb.querySelectorAll('.fh').forEach(x=>x.classList.remove('fh'));w.classList.remove('fsq');
  if(!spills(wb))return;
  for(const [sel,box,keep] of FIT_ROWS){const els=[...wb.querySelectorAll(sel)];const min=keep||0;
    const boxOff=()=>{if(box&&els.length&&els.every(e=>e.classList.contains('fh'))){const b=wb.querySelector(box);if(b)b.classList.add('fh')}};// no "Also up" heading over nothing
    for(let i=els.length-1;i>=min;i--){els[i].classList.add('fh');boxOff();if(!spills(wb))return}}
  for(const sel of FIT_DROP){const els=[...w.querySelectorAll(sel)].filter(e=>wb.contains(e)||sel.includes('.wh'));if(!els.length)continue;els.forEach(e=>e.classList.add('fh'));if(!spills(wb))return}
  w.classList.add('fsq')}
let fitQ=0;
function fitAll(){fitQ=0;const sim=$('simple');if(!sim||$('cb').classList.contains('dragging')||rz)return;sim.querySelectorAll(':scope>.w[data-id]').forEach(fitW)}
const fitSoon=()=>{if(!fitQ)fitQ=requestAnimationFrame(()=>requestAnimationFrame(fitAll))};
(function(){const sim=$('simple');if(!sim)return;new MutationObserver(m=>{if(m.some(x=>x.type==='childList'&&!(x.target.closest&&x.target.closest('.floating'))))fitSoon()}).observe(sim,{childList:true,subtree:true});
  if(window.ResizeObserver){const ro=new ResizeObserver(fitSoon);ro.observe(sim);
    /* v50.4: also watch each widget's own box, so a widget that settles to a new height after Done, a resize or a range
       change is measured again (the board's outer size often doesn't change) */
    const watch=()=>sim.querySelectorAll(':scope>.w[data-id]>.wb').forEach(b=>{if(!b._ro){b._ro=1;ro.observe(b)}});watch();new MutationObserver(watch).observe(sim,{childList:true})}
  /* v50.4: one more look shortly after anything changes, and whenever the Board comes back on screen */
  {let late=0;new MutationObserver(()=>{clearTimeout(late);late=setTimeout(fitSoon,700)}).observe(sim,{childList:true});const cbx=sim.closest('.cbx');if(cbx)new MutationObserver(()=>{if(!cbx.classList.contains('off'))fitSoon()}).observe(cbx,{attributes:true,attributeFilter:['class']})}
  sim.addEventListener('transitionend',e=>{if(e.target.closest&&e.target.closest('.w'))fitSoon()});addEventListener('resize',fitSoon);
  sim.addEventListener('load',e=>{if(e.target.tagName==='IMG')fitSoon()},true);document.fonts&&document.fonts.ready.then(fitSoon);fitSoon()})();
// Settings → Display → Reset Card Board layout (v44): back to the starting widgets for this plan, on this screen and the other
window.cbResetLayout=function(){layoutD=clone(defL());layoutP=phoneL(clone(layoutD));layout=onPhone?layoutP:layoutD;if(editing)setEditing(false);render(false)};

// ---- v46: saved Board layouts (Premium) ----
// Up to 9 saves for phones and 9 for desktop (each screen keeps its own arrangement, as the board always has). A save is
// the exact widgets, sizes, order and settings. The pictures are drawn from the save itself (no numbers), so they're light
// and appear instantly. Saves follow the account; which save is in use is remembered on each device.
const LY_MAX=6,lyd=$('lyd');
const lyKind=()=>onPhone?'phone':'desk',lyMetaK=()=>'boardSaves'+(onPhone?'Phone':'Desk');
const lyGet=()=>{const S=window.CTStore;let v=null;if(S&&S.meta)v=S.meta(lyMetaK());else try{v=JSON.parse(localStorage.getItem('cb.'+lyMetaK()))}catch(e){}
  return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string'&&Array.isArray(x.layout)):[]};
const lySet=l=>{const S=window.CTStore;if(S&&S.setMeta)return S.setMeta(lyMetaK(),l);try{localStorage.setItem('cb.'+lyMetaK(),JSON.stringify(l))}catch(e){}return Promise.resolve()};
const lyCur=()=>{try{return localStorage.getItem('cb.ly.cur.'+lyKind())||''}catch(e){return ''}};
const lyCurSet=id=>{try{if(id)localStorage.setItem('cb.ly.cur.'+lyKind(),id);else localStorage.removeItem('cb.ly.cur.'+lyKind())}catch(e){}};
const lyClean=l=>(l||[]).filter(w=>w&&CATALOG[w.k]&&DIM[w.size]&&(!FREEMODE||FREE_K.includes(w.k))).map(w=>clone(w));
const lySig=l=>JSON.stringify((l||[]).map(w=>{const o=Object.assign({},w);delete o.id;return o}));
const lyFam=k=>({num:'fn',card:'fc',list:'fl',chart:'fg'})[FAMILY[k]]||'fn';
const lyTitle=w=>w.name||(w.k==='feat'?FEAT[FEAT[w.metric]?w.metric:'win'].t:w.k==='bd'?cbBdTitle(w):w.size==='S'?CATALOG[w.k].s||CATALOG[w.k].t:CATALOG[w.k].t);
function lyName(list){let first='';try{const s=window.CTSession&&CTSession.current&&CTSession.current();first=String((s&&s.name)||'').trim().split(/\s+/)[0]}catch(e){}
  const d=new Date(),p=n=>String(n).padStart(2,'0'),base=(first?first+'’s Board ':'My Board ')+p(d.getMonth()+1)+p(d.getDate())+String(d.getFullYear()).slice(2);
  let n=base,i=2;while(list.some(x=>x.name===n))n=base+' ('+(i++)+')';return n}
function lyWhen(t){const d=new Date(t),now=new Date();if(d.toDateString()===now.toDateString())return 'Saved today';const y=new Date(now);y.setDate(now.getDate()-1);if(d.toDateString()===y.toDateString())return 'Saved yesterday';
  return 'Saved '+d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:d.getFullYear()===now.getFullYear()?undefined:'numeric'})}
// the picture: each widget where the grid would put it, at its size, shaded by kind
function lyPic(l,big){const u=units(),items=lyClean(l);if(!items.length)return '<div class="lym'+(big?' big':'')+'"></div>';
  const P=packGrid(items,u);let R=0;items.forEach(w=>{const p=P[w.id];if(p)R=Math.max(R,p.r+p.h)});const RS=Math.max(R,Math.ceil(u*(big?.9:.75)));
  return '<div class="lym'+(big?' big':'')+'">'+items.map(w=>{const p=P[w.id];if(!p)return '';
    return '<i class="'+lyFam(w.k)+'" style="left:'+(p.c/u*100).toFixed(2)+'%;top:'+(p.r/RS*100).toFixed(2)+'%;width:'+(p.w/u*100).toFixed(2)+'%;height:'+(p.h/RS*100).toFixed(2)+'%">'+(big?'<em>'+esc(lyTitle(w))+'</em>':'')+'</i>'}).join('')+'</div>'}
let lyPending=null,lyMenuFor=null,lyHoverT=0;
const lyFine=matchMedia('(hover:hover) and (pointer:fine)');
function lyState(){const list=lyGet(),cur=list.find(x=>x.id===lyCur())||null,changed=!!cur&&lySig(layout)!==lySig(cur.layout),known=list.some(x=>lySig(x.layout)===lySig(layout));return {list,cur,changed,known}}
function lyPaint(){if(!lyd)return;const {list,cur,changed}=lyState(),full=list.length>=LY_MAX;
  $('ly-h').textContent=onPhone?'Phone layouts':'Desktop layouts';$('ly-n').textContent=list.length>LY_MAX?list.length+' saved (new limit is '+LY_MAX+')':list.length+' of '+LY_MAX+' saved';
  $('ly-save').disabled=full;$('ly-full').hidden=!full;$('ly-full').textContent='All '+LY_MAX+' are used. Delete one, or '+(lyFine.matches?'use ⋯ → Update':'press and hold one and choose Update')+' to save over it.';
  $('ly-tiles').innerHTML=list.slice().sort((a,b)=>b.at-a.at).map(s=>{const on=cur&&s.id===cur.id;
    return '<div class="lyt'+(on?' on':'')+(on&&changed?' chg':'')+'" role="listitem" data-id="'+esc(s.id)+'"><button type="button" class="lyb" data-ly="'+esc(s.id)+'" aria-label="'+esc(s.name)+(on?', in use':'')+'">'+lyPic(s.layout)+
      (on?'<span class="lyuse">In use</span>':'')+'<span class="lynm">'+esc(s.name)+'</span><span class="lydt">'+(on&&changed?'<b>Changed</b> · ':'')+lyWhen(s.at)+'</span></button>'+
      (on&&changed?'<button type="button" class="lyupd" data-lyup="'+esc(s.id)+'">Update</button>':'')+
      '<button type="button" class="lymore" data-lymore="'+esc(s.id)+'" aria-label="More for '+esc(s.name)+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg></button></div>'}).join('');
  lyHint(list)}
function lyHint(list){list=list||lyGet();const h=$('ly-hint');if(h.classList.contains('flash'))return;h.textContent=!list.length?'Save this board to come back to it anytime. You can keep up to '+LY_MAX+'.':lyFine.matches?'Click a layout to switch to it. Hover to see it larger.':'Tap a layout to switch to it. Press and hold one to rename, update or delete it.'}
function lyFlash(msg){const h=$('ly-hint');h.textContent=msg;h.classList.add('flash');clearTimeout(lyFlash.t);lyFlash.t=setTimeout(()=>{h.classList.remove('flash');lyHint()},2600)}
function placeLy(btn){if(matchMedia('(max-width:760px)').matches){lyd.classList.remove('pop');return}
  const r=(btn&&btn.getBoundingClientRect().width?btn:$('cb-edit')).getBoundingClientRect(),W=Math.min(600,innerWidth-32),right=Math.max(16,Math.min(innerWidth-W-16,innerWidth-r.right-80)),top=r.bottom+10,left=innerWidth-right-W;
  lyd.classList.add('pop');lyd.style.setProperty('--at',top+'px');lyd.style.setProperty('--ar',right+'px');lyd.style.setProperty('--aw',W+'px');lyd.style.setProperty('--ox',Math.max(20,Math.min(W-20,r.left+r.width/2-left)).toFixed(0)+'px')}
window.cbLayoutsOpen=function(btn){if(!lyd)return;if(cbFree()){if(window.CTPremiumOpen)window.CTPremiumOpen('layouts');return}
  lyPending=null;$('ly-ask').hidden=true;lyMenuClose();lyPaint();placeLy(btn);lyd.showModal();buzz('tap')};
function lyApply(s){const l=lyClean(s.layout);if(!l.length)return;if(editing)setEditing(false);
  if(onPhone){layoutP=phoneL(l);layout=layoutP}else{layoutD=l;layout=l}save();lyCurSet(s.id);render(false);
  const sim=$('simple');if(sim&&!calm.matches){sim.classList.remove('lyswap');void sim.offsetWidth;sim.classList.add('lyswap')}
  lyPaint();if(onPhone)setTimeout(()=>{if(lyd.open)lyd.close()},160);else lyFlash('Switched to “'+s.name+'”')}
async function lySave(){const list=lyGet();if(list.length>=LY_MAX)return;const s={id:'ly'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:lyName(list),at:Date.now(),layout:clone(layout)};
  window.CTTrack&&CTTrack.ev('layout_save',String(list.length+1));await lySet([s].concat(list));lyCurSet(s.id);lyPaint();const t=$('ly-tiles').querySelector('.lyt[data-id="'+s.id+'"]');if(t&&!calm.matches)t.classList.add('new');lyFlash('Saved as “'+s.name+'”');buzz('firm')}
async function lyUpdate(id){const list=lyGet(),s=list.find(x=>x.id===id);if(!s)return;window.CTTrack&&CTTrack.ev('layout_update');s.layout=clone(layout);s.at=Date.now();await lySet(list);lyCurSet(id);lyPaint();lyFlash('Updated “'+s.name+'”')}
async function lyDelete(id){const list=lyGet().filter(x=>x.id!==id);await lySet(list);if(lyCur()===id)lyCurSet('');lyPaint();lyFlash('Deleted')}
function lyRename(id){const t=$('ly-tiles').querySelector('.lyt[data-id="'+id+'"]'),s=lyGet().find(x=>x.id===id);if(!t||!s)return;const nm=t.querySelector('.lynm');
  const inp=document.createElement('input');inp.className='lyin';inp.value=s.name;inp.maxLength=40;inp.setAttribute('aria-label','Layout name');nm.replaceWith(inp);inp.focus();inp.select();
  let done=false;const fin=async keep=>{if(done)return;done=true;const v=inp.value.trim();if(keep&&v&&v!==s.name){const list=lyGet(),x=list.find(y=>y.id===id);if(x){x.name=v;await lySet(list)}}lyPaint()};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();fin(true)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();fin(false)}});inp.addEventListener('blur',()=>fin(true));
  inp.addEventListener('click',e=>e.stopPropagation())}
// switching away from changes that aren't saved asks first, right in the panel (no pop-up)
function lySwitch(id){const {list,cur,changed,known}=lyState(),s=list.find(x=>x.id===id);if(!s)return;if(cur&&cur.id===id&&!changed){if(onPhone)lyd.close();return}
  const loses=cur?changed:!known;if(!loses){lyApply(s);return}
  lyPending=s;const a=$('ly-ask');a.innerHTML='<p>'+(cur?'Save your changes to “'+esc(cur.name)+'” first?':'This board isn’t saved. Save it first?')+'</p><div><button type="button" class="lyk p" data-lyk="save">'+(cur?'Update':'Save it')+'</button><button type="button" class="lyk" data-lyk="skip">Don’t save</button><button type="button" class="lyk q" data-lyk="cancel">Cancel</button></div>';
  a.hidden=false;if(!calm.matches){a.classList.remove('in');void a.offsetWidth;a.classList.add('in')}const f=a.querySelector('.lyk.p');if(f&&!lyFine.matches)f.blur()}
// the ⋯ menu (and press-and-hold on phones)
function lyMenuClose(){const m=lyd&&lyd.querySelector('.lymenu');if(m)m.remove();lyMenuFor=null}
function lyMenu(id,anchor){lyMenuClose();lyHoverHide();const s=lyGet().find(x=>x.id===id);if(!s)return;lyMenuFor=id;
  const m=document.createElement('div');m.className='lymenu';m.setAttribute('role','menu');
  m.innerHTML='<button type="button" role="menuitem" data-lyact="rename">Rename</button><button type="button" role="menuitem" data-lyact="update">Update with this layout</button><button type="button" role="menuitem" class="del" data-lyact="delete">Delete</button>';
  lyd.appendChild(m);const r=anchor.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight;
  m.style.left=Math.max(8,Math.min(innerWidth-mw-8,r.right-mw))+'px';m.style.top=(r.bottom+6+mh>innerHeight-8?Math.max(8,r.top-mh-6):r.bottom+6)+'px';
  if(lyFine.matches)m.querySelector('button').focus({preventScroll:true})}
// desktop: hover a layout to see it larger, with each widget's name in its spot
function lyHoverHide(){clearTimeout(lyHoverT);const h=lyd&&lyd.querySelector('.lyhov');if(h){h.classList.remove('in');setTimeout(()=>{if(!h.classList.contains('in'))h.remove()},180)}}
function lyHoverShow(tile){const s=lyGet().find(x=>x.id===tile.dataset.id);if(!s||lyMenuFor)return;let h=lyd.querySelector('.lyhov');if(!h){h=document.createElement('div');h.className='lyhov';h.setAttribute('aria-hidden','true');lyd.appendChild(h)}
  const n=lyClean(s.layout).length;h.innerHTML='<b>'+esc(s.name)+'</b><small>'+lyWhen(s.at)+' · '+cnt(n,'widget','widgets')+'</small>'+lyPic(s.layout,true);
  const pr=lyd.querySelector('.lyp').getBoundingClientRect(),tr=tile.getBoundingClientRect(),W=320,hh=h.offsetHeight||260;
  const left=pr.left-W-14>=8?pr.left-W-14:Math.min(innerWidth-W-8,pr.right+14);h.style.left=left+'px';h.style.top=Math.max(8,Math.min(innerHeight-hh-8,tr.top+tr.height/2-hh/2))+'px';
  h.classList.toggle('r',left>pr.left);requestAnimationFrame(()=>h.classList.add('in'))}
if(lyd){
  lyd.addEventListener('click',async e=>{const t=e.target;
    if(t===lyd){lyd.close();return}if(t.closest('[data-close]')){lyd.close();return}
    if(lyPress.fired){lyPress.fired=false;if(Date.now()-lyPress.at<900&&t.closest('.lyb'))return}// the click that ends a press-and-hold
    const act=t.closest('[data-lyact]');if(act){const id=lyMenuFor,a=act.dataset.lyact;
      if(a==='delete'&&!act.classList.contains('confirm')){act.classList.add('confirm');act.textContent='Tap again to delete';return}
      lyMenuClose();if(a==='rename')lyRename(id);else if(a==='update')await lyUpdate(id);else await lyDelete(id);return}
    if(!t.closest('.lymenu'))lyMenuClose();
    const k=t.closest('[data-lyk]');if(k){const s=lyPending,{cur}=lyState();$('ly-ask').hidden=true;lyPending=null;if(k.dataset.lyk==='cancel'||!s)return;
      if(k.dataset.lyk==='save'){if(cur)await lyUpdate(cur.id);else{if(lyGet().length>=LY_MAX){lyFlash('All 9 are used. Delete one first.');return}await lySave()}}lyApply(s);return}
    if(t.closest('#ly-save')){await lySave();return}
    const up=t.closest('[data-lyup]');if(up){await lyUpdate(up.dataset.lyup);return}
    const mo=t.closest('[data-lymore]');if(mo){if(lyMenuFor===mo.dataset.lymore){lyMenuClose();return}lyMenu(mo.dataset.lymore,mo);return}
    const b=t.closest('[data-ly]');if(b){lyHoverHide();lySwitch(b.dataset.ly)}});
  lyd.addEventListener('pointerover',e=>{if(!lyFine.matches)return;const tile=e.target.closest('.lyt');if(!tile||tile.contains(e.relatedTarget))return;clearTimeout(lyHoverT);lyHoverT=setTimeout(()=>lyHoverShow(tile),lyd.querySelector('.lyhov.in')?60:260)});
  lyd.addEventListener('pointerout',e=>{if(!lyFine.matches)return;const tile=e.target.closest('.lyt');if(!tile||tile.contains(e.relatedTarget))return;lyHoverHide()});
  lyd.addEventListener('keydown',e=>{if(e.key==='Escape'&&(lyMenuFor||!$('ly-ask').hidden)){e.preventDefault();e.stopPropagation();lyMenuClose();$('ly-ask').hidden=true;lyPending=null}},true);
  lyd.addEventListener('close',()=>{lyMenuClose();lyHoverHide()});
  addEventListener('resize',()=>{if(lyd.open){placeLy(document.querySelector('.ct-shell .sh-lay'));lyMenuClose();lyHoverHide()}});
  if(window.CTStore)CTStore.on(r=>{if(lyd.open&&(r==='meta'||r==='remote')&&!lyd.querySelector('.lyin'))lyPaint()})}
// phones: press and hold a layout for Rename, Update and Delete
const lyPress={t:0,fired:false,xy:null};
if(lyd){lyd.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;const b=e.target.closest('.lyb');if(!b)return;lyPress.fired=false;lyPress.xy=[e.clientX,e.clientY];clearTimeout(lyPress.t);
  lyPress.t=setTimeout(()=>{lyPress.fired=true;lyPress.at=Date.now();buzz('firm');lyMenu(b.dataset.ly,b)},450)});
  lyd.addEventListener('pointermove',e=>{if(lyPress.xy&&Math.hypot(e.clientX-lyPress.xy[0],e.clientY-lyPress.xy[1])>9)clearTimeout(lyPress.t)});
  ['pointerup','pointercancel'].forEach(k=>lyd.addEventListener(k,()=>{clearTimeout(lyPress.t);lyPress.xy=null}));
  lyd.addEventListener('contextmenu',e=>{if(e.target.closest('.lyb'))e.preventDefault()})}
// a reset (Settings → Display) starts fresh: no save is in use
{const r0=window.cbResetLayout;window.cbResetLayout=function(){try{localStorage.removeItem('cb.ly.cur.desk');localStorage.removeItem('cb.ly.cur.phone')}catch(e){}r0&&r0()}}

// ---- v50.5: live mini boards in Layouts ----
// Each saved layout shows as a real, shrunken copy of the board: its widgets drawn with today's numbers, like a screenshot,
// but nothing is stored or synced (a save is still just its widget list). The gray outline shows at once; the real copies
// are drawn one at a time while the browser is idle, kept in memory until the numbers change, and never take taps.
const lyLive=new Map();
function lyLiveKey(l){const c=ctxNow();return lySig(lyClean(l))+'|'+($('simple').clientWidth||0)+'|'+c.a+'|'+c.b+'|'+plat+'|'+E.length}
function lyLiveInto(box,l){const W=$('simple').clientWidth;if(!box||!W||units()<1)return;const k=lyLiveKey(l),hit=lyLive.get(k);
  const wrap=document.createElement('div');wrap.className='lylive';wrap.setAttribute('aria-hidden','true');wrap.inert=true;wrap.style.width=W+'px';
  if(hit!=null){if(!hit)return;wrap.innerHTML=hit;box.appendChild(wrap)}
  else{const items=lyClean(l),ctx=ctxNow();let h='';try{h='<div class="simple lyls">'+items.map(w=>widgetHTML(w,ctx)).join('')+'</div>'}catch(e){}
    h=h.replace(/\s(id|data-id|data-drill|tabindex)="[^"]*"/g,'').replace(/\sloading="lazy"/g,'');/* no ids: the app's own lookups (#cb .simple>.w[data-id]) must only ever find the real board */
    if(!h){lyLive.set(k,'');return}wrap.innerHTML=h;const sim=wrap.firstChild,cs=$('simple').getAttribute('style');if(cs)sim.setAttribute('style',cs);box.appendChild(wrap);
    try{fillCharts(sim,ctx)}catch(e){}wrap.querySelectorAll('.fw').forEach(f=>f.classList.add('in'));fwToBg(wrap);/* card pictures show at once (the board fades them in as they load) */
    if(lyLive.size>40)lyLive.clear();lyLive.set(k,wrap.innerHTML)}
  const sc=()=>{wrap.style.transform='scale('+(box.clientWidth/W)+')'};sc();requestAnimationFrame(()=>{sc();box.classList.add('live')})}
let lyLiveQ=[],lyLiveT=0;
function lyLiveRun(){lyLiveT=0;const job=lyLiveQ.shift();if(!job)return;if(job.box.isConnected)lyLiveInto(job.box,job.l);if(lyLiveQ.length)lyLiveT=(window.requestIdleCallback||(f=>setTimeout(f,30)))(lyLiveRun,{timeout:300})}
{const p0=lyPaint;lyPaint=function(){p0.apply(this,arguments);if(!lyd||!lyd.open&&!lyd.hasAttribute('open'))return;const list=lyGet();lyLiveQ=[];
  lyd.querySelectorAll('#ly-tiles .lyt').forEach(t=>{const s=list.find(x=>x.id===t.dataset.id),box=t.querySelector('.lym');if(s&&box)lyLiveQ.push({box,l:s.layout})});
  if(!lyLiveT&&lyLiveQ.length)lyLiveT=(window.requestIdleCallback||(f=>setTimeout(f,30)))(lyLiveRun,{timeout:300})}}
{const h0=lyHoverShow;lyHoverShow=function(tile){h0(tile);const s=lyGet().find(x=>x.id===tile.dataset.id),h=lyd&&lyd.querySelector('.lyhov .lym');if(s&&h)lyLiveInto(h,s.layout)}}
if(lyd)new MutationObserver(()=>{if(lyd.open)lyPaint()}).observe(lyd,{attributes:true,attributeFilter:['open']});

// ---- v50.5: share links that work ----
// Turning on "Share with a link" sends the board, drawn exactly as "See what they'll see" shows it (dollar amounts and card
// names already hidden if those are off), to the server. Anyone with the link sees that page; no account needed. "Live"
// sends it again whenever the numbers on this board change (at most every few seconds, only when something changed);
// "Today's snapshot" stays as it was sent. Turning the link off, or making a new one, stops the old link at once.
// link ids: 10 random letters and digits (older ones could come out shorter than the server accepts)
const shNewId=()=>{const A='abcdefghijkmnpqrstuvwxyz23456789',b=crypto.getRandomValues(new Uint8Array(10));return [...b].map(x=>A[x%A.length]).join('')};
if(!/^[a-z0-9]{8,16}$/.test(share.id||'')){share.id=shNewId();saveShare()}
const SHS=()=>window.CTSession,shOnline=()=>{const s=SHS();return !!(s&&s.REAL&&s.API)};
let shLast='',shT=0,shBusy=false;try{shLast=localStorage.getItem('cb.share.sent')||''}catch(e){}
const shHash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))>>>0;return h.toString(36)+':'+s.length};
function shareSnap(){const sim=$('simple'),W=sim.clientWidth||1200,was=viewing;viewing=true;
  const box=document.createElement('div');box.className='simple shsnap';box.setAttribute('style',(sim.getAttribute('style')||'')+';position:fixed;left:-99999px;top:0;width:'+W+'px;visibility:hidden;pointer-events:none');
  let ctx;try{ctx=ctxNow();box.innerHTML=layout.map(w=>widgetHTML(w,ctx)).join('');sim.parentNode.appendChild(box);try{fillCharts(box,ctx)}catch(e){}box.querySelectorAll(':scope>.w').forEach(w=>{try{fitW(w)}catch(e){}})}finally{viewing=was}
  box.querySelectorAll('.rm,.grip,.wmore,.kback').forEach(x=>x.remove());box.querySelectorAll('.fw').forEach(f=>f.classList.add('in'));fwToBg(box);/* v50.12: each chart also carries a phone-width drawing, which the shared page shows on small screens */{const v0=viewing;viewing=true;try{box.querySelectorAll('.cv').forEach(c=>{if(!c._sp||!c._wh)return;try{const h=hideMoney(barsSVG(c._sp,320,96));if(h)c.insertAdjacentHTML('beforeend','<div class="cvph">'+h+'</div>')}catch(e){}});}finally{viewing=v0}}
  box.querySelectorAll('[data-drill],[tabindex],[role=button],[data-id],[aria-haspopup]').forEach(x=>{['data-drill','tabindex','role','data-id','aria-haspopup','aria-expanded'].forEach(a=>x.removeAttribute(a))});
  box.querySelectorAll('img').forEach(i=>{const s=i.getAttribute('src');if(s&&!/^(https?:|data:)/.test(s))i.setAttribute('src',new URL(s,location.href).href);i.removeAttribute('loading')});
  const html=box.innerHTML;box.remove();const f=(profile.first||'').trim();
  let th='auto';try{th=localStorage.getItem('cb.theme')||'auto'}catch(e){}
  return {html,meta:{title:f?f+'’s Card Board':'Card Board',label:$('cb-perl').textContent,plat:$('cb-platl').textContent,theme:th,cbStyle:$('cb').getAttribute('style')||'',simStyle:sim.getAttribute('style')||'',cbClass:$('cb').className.replace(/\b(editing|dragging|grow)\b/g,'').trim(),w:W,amt:!!share.amt,names:!!share.names}}}
async function sharePush(force){clearTimeout(shT);if(!share.on||shBusy)return;if(!shOnline()){if(force)toast('Share links work when you’re signed in to Card Tab online.');return}
  const snap=shareSnap(),sig=shHash(share.id+'|'+snap.html+'|'+JSON.stringify(snap.meta)+'|'+share.exp+'|'+share.live);if(!force&&sig===shLast)return;shBusy=true;
  try{const r=await fetch(SHS().API+'/auth/share',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({id:share.id,html:snap.html,meta:snap.meta,live:!!share.live,exp:share.exp})});const j=await r.json().catch(()=>({}));
    if(r.status===409){share.id=shNewId();saveShare();paintShare();shBusy=false;return sharePush(true)}
    if(!r.ok){if(force)toast(j.error||'Couldn’t update the share link. Try again.');return}shLast=sig;try{localStorage.setItem('cb.share.sent',sig)}catch(e){}if(force&&shd.open)$('sh-state').textContent='Anyone with the link can view · up to date'}
  catch(e){if(force)toast('Couldn’t reach Card Tab. The link updates next time you’re online.')}finally{shBusy=false}}
async function shareOff(){shLast='';try{localStorage.removeItem('cb.share.sent')}catch(e){}if(!shOnline())return;try{await fetch(SHS().API+'/auth/share',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({off:true})})}catch(e){}}
const shareSoon=(ms)=>{clearTimeout(shT);if(share.on&&share.live)shT=setTimeout(()=>sharePush(false),ms||4000)};
// the share window's switches and buttons (these run after the window's own handler has updated the choices)
shd.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='sh-on'){if(share.on)setTimeout(()=>sharePush(true),50);else shareOff();return}
  if(['sh-amt','sh-names','sh-tips'].includes(b.id)||b.parentNode&&['sh-live','sh-exp'].includes(b.parentNode.id)){if(share.on)setTimeout(()=>sharePush(true),50);return}
  if(b.id==='sh-new'){if(share.on)setTimeout(()=>sharePush(true),50);return}
  if(b.id==='sh-add'){setTimeout(shareInvite,60)}});
$('sh-email').addEventListener('keydown',e=>{if(e.key==='Enter')setTimeout(shareInvite,60)});
let shInvited=new Set();
async function shareInvite(){const list=share.emails.filter(m=>!shInvited.has(m));if(!list.length||!shOnline())return;if(!share.on)return;
  await sharePush(false);try{const r=await fetch(SHS().API+'/auth/share/invite',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({emails:list})});const j=await r.json().catch(()=>({}));
    if(r.ok){list.forEach(m=>shInvited.add(m));$('sh-emsg').textContent=j.sent===1?'Sent the link to '+list[0]+'.':'Sent the link to '+j.sent+' people.'}else $('sh-emsg').textContent=j.error||'Couldn’t send it. Copy the link instead.'}catch(e){$('sh-emsg').textContent='Couldn’t reach Card Tab. Copy the link instead.'}}
// live links follow the board: whenever it's drawn again (new entries, a widget moved, a new range), send it shortly after
{const r0=render;render=function(){const out=r0.apply(this,arguments);if(!viewing&&!editing)shareSoon();return out}}
if(share.on&&share.live)setTimeout(()=>shareSoon(1500),3000);
window.cbShareSnap=()=>shareSnap();
window.cbShNewId=shNewId;

// v50.9: in previews and shared boards the full-art picture is drawn as a background, which fills the widget in every
// browser (Safari could show an <img> there at its own small size in the corner)
function fwToBg(root){root.querySelectorAll('img.fwi').forEach(img=>{const src=img.getAttribute('src');if(!src)return;const d=document.createElement('div');d.className='fwi fwbg';d.setAttribute('aria-hidden','true');
  d.setAttribute('style',(img.getAttribute('style')||'')+';background-image:url("'+new URL(src,location.href).href.replace(/"/g,'%22')+'")');img.replaceWith(d)})}
window.cbReloadMe=()=>{try{avatar=JSON.parse(localStorage.getItem('cb.avatar'))||avatar;profile=Object.assign({},profile,JSON.parse(localStorage.getItem('cb.profile'))||{})}catch(e){}try{paintAvatar();paintTitle()}catch(e){}};
