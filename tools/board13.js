
// ---------- v15 phone layouts. A: big title, actions in a thumb bar. B: range row, ••• menu, thumb bar. Desktop is unchanged. ----------
;(()=>{const V=document.documentElement.dataset.cbv;if(!V)return;
const PH=matchMedia('(max-width:760px)'),tb=document.querySelector('#cb .topbar'),acctw=$('cb-acct').closest('.acctw'),cbEl=$('cb'),csx=$('csx');
// the thumb bar: Stories, Ask and Share move into it on phones
const dock=document.createElement('div');dock.className='cbdock';dock.id='cbdock';document.body.appendChild(dock);
const acts=['cb-stories','cb-ask','cb-share'].map(id=>$(id));
// B: the range row (7D 30D 12M YTD All + calendar for everything else) and the ••• button
let seg=null,more=null,perw=$('cb-per').closest('.perwrap'),perHome=perw.parentNode,perNext=perw.nextSibling;
const SEG=[['d7','7D'],['d30','30D'],['l12','12M'],['ytd','YTD'],['all','All']];
if(V==='B'){
  seg=document.createElement('div');seg.className='cbseg';seg.setAttribute('role','radiogroup');seg.setAttribute('aria-label','Time range');
  seg.innerHTML=SEG.map(s=>'<button type="button" role="radio" data-k="'+s[0]+'">'+s[1]+'</button>').join('');
  $('cb-per').insertAdjacentHTML('beforeend','<svg class="calic" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>');
  seg.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;if(k===period)return;buzz('tap');period=k;$('cb-perl').textContent=PERIODS.find(p=>p[0]===k)[1];saveView();render(false);grow();paintSeg()});
  more=document.createElement('button');more.type='button';more.className='cbmore';more.setAttribute('aria-label','More');
  more.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>';
  tb.insertBefore(more,acctw);
  const md=document.createElement('dialog');md.className='sheet';md.id='mored';md.setAttribute('aria-labelledby','mo-h');
  md.innerHTML='<div class="awp mop"><div class="awh"><h2 id="mo-h">Board</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div><button type="button" class="morow" id="mo-edit"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>Edit board</button><p class="molab">Platform</p><div class="moplats" id="mo-plats"></div></div>';
  $('cb').appendChild(md);
  const plats=()=>[['all','All platforms']].concat([...new Set(E.map(e=>e.platform))].sort().map(p=>[p,p]));
  const paintPlats=()=>{$('mo-plats').innerHTML=plats().map(p=>'<button type="button" class="morow" data-p="'+esc(p[0])+'" aria-pressed="'+(p[0]===plat)+'">'+esc(p[1])+'<span class="mock" aria-hidden="true">✓</span></button>').join('')};
  more.addEventListener('click',()=>{buzz('tap');closeMenus();paintPlats();md.showModal()});
  md.addEventListener('click',e=>{if(e.target===md){md.close();return}const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-close'))md.close();
    else if(b.id==='mo-edit'){md.close();setTimeout(()=>{if(!editing)setEditing(true)},200)}
    else if(b.dataset.p!=null){plat=b.dataset.p;$('cb-platl').textContent=plats().find(p=>p[0]===plat)[1];saveView();render(false);grow();paintPlats();setTimeout(()=>md.close(),180)}});
}
function paintSeg(){if(!seg)return;let hit=false;seg.querySelectorAll('button').forEach(b=>{const on=b.dataset.k===period;hit=hit||on;b.setAttribute('aria-checked',on);b.classList.toggle('on',on)});$('cb-per').classList.toggle('segon',!hit)}
if(seg)new MutationObserver(paintSeg).observe($('cb-perl'),{childList:true,characterData:true,subtree:true});
// A: a slim bar takes over once the big title scrolls away
let slim=null;
if(V==='A'){
  slim=document.createElement('div');slim.className='cbslim';slim.setAttribute('aria-hidden','true');
  slim.innerHTML='<button type="button" class="sback" aria-label="Back to dashboard" tabindex="-1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><b>Card Board</b><button type="button" class="spill" tabindex="-1"><span></span> <i>▾</i></button>';
  document.body.appendChild(slim);
  slim.querySelector('.sback').addEventListener('click',()=>$('close').click());
  slim.querySelector('.spill').addEventListener('click',()=>{cbx.scrollTo({top:0,behavior:calm.matches?'auto':'smooth'});setTimeout(()=>$('cb-per').click(),calm.matches?0:380)});
}
function place(){const ph=PH.matches;
  if(ph){acts.forEach(b=>dock.appendChild(b))}else{acts.forEach(b=>tb.insertBefore(b,more||acctw))}
  if(seg){if(ph){tb.appendChild(seg);seg.appendChild(perw)}else{perHome.insertBefore(perw,perNext);seg.remove()}paintSeg()}
  sync()}
// show the thumb bar only when it makes sense: board open, not editing, not the shared view, Stories closed
let lastY=0,tuckT=0;
function sync(){const open=!cbx.classList.contains('off')&&!cbx.inert,ok=PH.matches&&open&&!cbEl.classList.contains('editing')&&!cbEl.classList.contains('viewing')&&!csx.classList.contains('in');
  dock.classList.toggle('on',ok);if(!ok)dock.classList.remove('tuck');
  if(slim){const t=$('cbtn').getBoundingClientRect();const show=PH.matches&&open&&!csx.classList.contains('in')&&t.bottom<8;slim.classList.toggle('on',show);slim.querySelector('.spill span').textContent=$('cb-perl').textContent;
    const s=cbEl.classList.contains('editing');slim.classList.toggle('ed',s)}}
cbx.addEventListener('scroll',()=>{const y=cbx.scrollTop,dy=y-lastY;lastY=y;
  if(dock.classList.contains('on')){if(dy>6&&y>60)dock.classList.add('tuck');else if(dy<-6)dock.classList.remove('tuck');clearTimeout(tuckT);tuckT=setTimeout(()=>dock.classList.remove('tuck'),700)}
  if(slim)sync()},{passive:true});
const mo=new MutationObserver(sync);[cbx,cbEl,csx].forEach(el=>mo.observe(el,{attributes:true,attributeFilter:['class','inert']}));
PH.addEventListener?PH.addEventListener('change',place):PH.addListener(place);
place();
})();
