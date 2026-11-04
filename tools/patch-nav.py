def edit(p,pairs):
  s=open(p).read()
  for a,b in pairs:
    assert s.count(a)==1,(p,a[:80]);s=s.replace(a,b,1)
  open(p,'w').write(s)
edit('board5.js',[
("function close(){\n  if(busy||!shown)return;busy=true;","function close(){\n  if(busy||!shown)return;navDone('board');busy=true;"),
("  d.showModal=function(){if(this.open)return;fitDialog(this);","  d.showModal=function(){if(this.open)return;fitDialog(this);navPush('dlg:'+this.id,()=>this.close());"),
("  d.close=function(v){if(!this.open||this.classList.contains('closing'))return;","  d.close=function(v){if(!this.open||this.classList.contains('closing'))return;navDone('dlg:'+this.id);"),
("function openStories(){if(open)return;open=true;","function openStories(){if(open)return;open=true;navPush('stories',()=>window.cbStoriesBack());"),
("window.cbStoriesBack=function(){if(!open)return;open=false;","window.cbStoriesBack=function(){if(!open)return;open=false;navDone('stories');"),
("function open(){\n  if(busy||shown)return;busy=true;","function open(){\n  if(busy||shown)return;navPush('board',()=>close());busy=true;"),
("// ---------- charts, drawn at the exact size of their box ----------","""// ---------- back gesture (iOS edge swipe, Android back, the browser's Back button) closes the top layer ----------
// Each layer that opens (the board, Stories, a sheet, a menu) adds one step to history; going back closes the newest one.
// Closing a layer with its own button removes its step, so history never fills up with stale entries.
const NAV=[];let navSkip=0,navPopping=false;
function navPush(k,fn){if(NAV.some(n=>n.k===k))return;NAV.push({k,fn});try{history.pushState({cbn:k},'')}catch(e){}}
function navDone(k){if(navPopping)return;const i=NAV.findIndex(n=>n.k===k);if(i<0)return;NAV.splice(i,1);navSkip++;try{history.back()}catch(e){navSkip--}}
addEventListener('popstate',()=>{if(navSkip>0){navSkip--;return}const t=NAV.pop();if(!t)return;navPopping=true;try{t.fn()}catch(e){}navPopping=false});

// ---------- charts, drawn at the exact size of their box ----------"""),
("// ---------- long-press a widget to start editing","""// ---------- menus: on phones they open centered over a dimmed screen (the bottom bar steps aside); back closes them ----------
;(()=>{const bd=document.createElement('div');bd.className='mbd';bd.id='mbd';$('cb').appendChild(bd);
  bd.addEventListener('click',e=>{e.stopPropagation();closeMenus();$('wmenu').hidden=true});
  const menus=[...document.querySelectorAll('#cb .cb-menu')];
  const sync=()=>{const open=menus.filter(m=>!m.hidden);bd.classList.toggle('on',open.length>0&&matchMedia('(max-width:760px)').matches);
    menus.forEach(m=>{if(!m.hidden)navPush('menu:'+m.id,()=>{m.hidden=true;closeMenus()});else navDone('menu:'+m.id)})};
  const mo=new MutationObserver(sync);menus.forEach(m=>mo.observe(m,{attributes:true,attributeFilter:['hidden']}))})();

// ---------- long-press a widget to start editing"""),
])
edit('board13.js',[
("ok=PH.matches&&open&&!document.querySelector('#cb dialog[open]')&&","ok=PH.matches&&open&&!document.querySelector('#cb dialog[open]')&&!document.querySelector('#cb .cb-menu:not([hidden])')&&"),
("document.querySelectorAll('#cb dialog').forEach(d=>mo.observe(d,{attributes:true,attributeFilter:['open']}));","document.querySelectorAll('#cb dialog').forEach(d=>mo.observe(d,{attributes:true,attributeFilter:['open']}));\ndocument.querySelectorAll('#cb .cb-menu').forEach(m=>mo.observe(m,{attributes:true,attributeFilter:['hidden']}));"),
])
c=open('board12.css').read()
c+="""
/* phones: menus (profile, platforms, widget ⋯) open centered over a dimmed screen, never under the bottom bar */
.mbd{display:none}
@keyframes menuPop{from{opacity:0;transform:translate(-50%,-50%) scale(.95)}to{opacity:1;transform:translate(-50%,-50%)}}
@media(max-width:760px){
  .cbx #cb .mbd{display:block;position:fixed;inset:0;z-index:59;background:rgba(10,10,10,.32);opacity:0;pointer-events:none;transition:opacity .22s ease}
  .cbx #cb .mbd.on{opacity:1;pointer-events:auto}
  .cbx #cb .cb-menu:not([hidden]){position:fixed!important;left:50%!important;right:auto!important;top:50%!important;bottom:auto!important;transform:translate(-50%,-50%);width:min(360px,calc(100vw - 32px))!important;max-height:calc(100dvh - 48px);overflow:auto;overscroll-behavior:contain;z-index:60!important;animation:menuPop .26s cubic-bezier(.2,.8,.2,1) both!important;transform-origin:50% 50%}
}
/* Add widgets keeps one size whatever kind you filter by; only the tiles inside change */
.awg .awp{height:min(860px,calc(var(--vvh,100dvh) - 40px))}
@media(max-width:760px){.awg .awp{height:calc(var(--vvh,100dvh) - 12px)}}
"""
open('board12.css','w').write(c)
t=open('stories2.tpl.html').read()
for a,b in [("lb.addEventListener('click',e=>{if(e.target===lb){shut();return}","lb.addEventListener('click',e=>{if(e.target===lb||e.target.classList.contains('box')||e.target.id==='lbc'||e.target.classList.contains('note')){shut();return}"),
("const lb=$('lb');function enlarge(n){","""// back gesture / back button closes the top layer here too (the enlarged story, then sheets)
const NAV=[];let navSkip=0,navPopping=false;
function navPush(k,fn){if(NAV.some(n=>n.k===k))return;NAV.push({k,fn});try{history.pushState({csn:k},'')}catch(e){}}
function navDone(k){if(navPopping)return;const i=NAV.findIndex(n=>n.k===k);if(i<0)return;NAV.splice(i,1);navSkip++;try{history.back()}catch(e){navSkip--}}
addEventListener('popstate',()=>{if(navSkip>0){navSkip--;return}const t=NAV.pop();if(!t)return;navPopping=true;try{t.fn()}catch(e){}navPopping=false});
const lb=$('lb');function enlarge(n){navPush('lb',()=>shut());"""),
("function shut(){lb.classList.add('out');","function shut(){if(lb.hidden)return;navDone('lb');lb.classList.add('out');"),
("function openSheet(id,pre){const w=$(id);","function openSheet(id,pre){const w=$(id);navPush('sh:'+id,()=>closeSheet(id));"),
("function closeSheet(id){const w=$(id);","function closeSheet(id){const w=$(id);if(w.hidden)return;navDone('sh:'+id);")]:
  assert t.count(a)==1,a[:60];t=t.replace(a,b,1)
open('stories2.tpl.html','w').write(t)
print('patched')
