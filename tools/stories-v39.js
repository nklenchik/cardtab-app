// ================= v39 Stories: a shelf of covers, and stories that play full screen =================
// The old row of cards becomes a shelf (one big cover + one small cover per story). Tapping plays the stories one at a
// time: progress bars, tap right for next, left for back, hold to pause. Each story says one thing. Backgrounds (Clean,
// Blobs, Stickers) come from the theme's own colors. Movement is light (transform and opacity only), runs only on the
// story on screen, and stops with Reduce Motion. Text colors are checked for contrast against their backgrounds.
const BGS=['Clean','Blobs','Stickers'];let bgStyle='Blobs';try{const b=localStorage.getItem('cs.bg');if(BGS.includes(b))bgStyle=b}catch(e){}
const calmM=matchMedia('(prefers-reduced-motion: reduce)');
// ---------- readable colors ----------
const hexs=c=>(String(c).match(/#[0-9a-f]{6}/gi)||['#777777']);
const L2=h=>{const v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*v[0]+.7152*v[1]+.0722*v[2]};
const CR=(a,b)=>{const x=L2(a),y=L2(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const worst=(fg,bg)=>Math.min(...hexs(bg).map(b=>CR(fg,b)));
const bestOn=bg=>worst('#111111',bg)>=worst('#ffffff',bg)?'#111111':'#ffffff';
function fixP(p){const grad=/gradient/.test(p.bg),dim=h=>'#'+[1,3,5].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*.68).toString(16).padStart(2,'0')).join('');
  const scrim=grad&&worst(p.ink,p.bg)<4.5&&Math.max(worst('#111111',p.bg),worst('#ffffff',p.bg))<4.5,bgT=scrim?hexs(p.bg).map(dim).join(' '):p.bg;
  const ink=worst(p.ink,bgT)>=4.5?p.ink:bestOn(bgT),acc=worst(p.acc,bgT)>=3?p.acc:ink;return {bg:p.bg,ink,acc,on:bestOn(acc),scrim}}
const palN=n=>fixP(TH[th][1][n%TH[th][1].length]);
// ---------- backgrounds ----------
function rnd(seed){let s=seed*9301+49297;return()=>(s=(s*9301+49297)%233280)/233280}
function bgSvg(style,p,seed,W,H){W=W||300;H=H||540;const r=rnd(seed+7),a=p.acc,k=p.ink;let s='';
  if(style==='Blobs'){let cls='';const blob=(cx,cy,R,col,op)=>{const n=7,pts=[];for(let i=0;i<n;i++){const t=i/n*6.283,rr=R*(.78+r()*.4);pts.push([cx+Math.cos(t)*rr,cy+Math.sin(t)*rr])}
      let d='M'+((pts[0][0]+pts[n-1][0])/2).toFixed(1)+' '+((pts[0][1]+pts[n-1][1])/2).toFixed(1);for(let i=0;i<n;i++){const p0=pts[i],p1=pts[(i+1)%n];d+=' Q'+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+' '+((p0[0]+p1[0])/2).toFixed(1)+' '+((p0[1]+p1[1])/2).toFixed(1)}
      s+='<g class="dr'+cls+'"><path d="'+d+'Z" fill="'+col+'" opacity="'+op+'"/></g>'};
    blob(W*1.06,H*.02,125,a,.24);cls=' d2';blob(W*-.08,H*1.0,140,a,.2);cls=' d3';blob(W*.92,H*.93,40,k,.08)}
  else if(style==='Stickers'){const tape=(x,y,w,rot)=>{s+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="26" rx="3" fill="'+a+'" opacity=".38" transform="rotate('+rot+' '+(x+w/2)+' '+(y+13)+')"/>'};tape(W*.62,H*.05,120,14);tape(-20,H*.9,130,-10);
    const star=(cx,cy,R,col,op)=>{let d='';for(let i=0;i<8;i++){const t=i/8*6.283-1.571,rr=i%2?R*.38:R;d+=(i?'L':'M')+(cx+Math.cos(t)*rr).toFixed(1)+' '+(cy+Math.sin(t)*rr).toFixed(1)}s+='<path d="'+d+'Z" fill="'+col+'" opacity="'+op+'"/>'};
    s+='<g class="fl">';star(W*.9,H*.2,14,k,.18);s+='</g><g class="fl d2">';star(W*.82,H*.87,20,a,.4);s+='</g>'}
  return s?'<svg class="bgl" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="background:'+p.bg+'">'+s+'</svg>':'<div class="bgl" style="background:'+p.bg+'"></div>'}
// ---------- card art ----------
const AG=['linear-gradient(155deg,#d9577a,#7d0b2b)','linear-gradient(155deg,#5fa0d6,#174b78)','linear-gradient(155deg,#8cc96a,#2e5c12)','linear-gradient(155deg,#8a8983,#3a3936)','linear-gradient(155deg,#f0a35c,#a5551a)'];
const agOf=n=>AG[[...String(n)].reduce((a,c)=>a+c.charCodeAt(0),0)%AG.length];
const artOf=n=>ART.get(String(n).toLowerCase());
const cardEl=n=>{const a=artOf(n);return a?'<img class="cd" src="'+esc(a)+'" alt="">':'<span class="cd ph" style="background:'+agOf(n)+'">'+esc(String(n).replace(/^(SS|SSB)\s+/,'')[0]||'?')+'</span>'};
// ---------- which game a card is from (the card search knows; names are the fallback) ----------
function gameOf(e){try{if(parent.CardLookup){const r=parent.CardLookup.search({name:e.name,number:e.no});const c=r&&r.list&&r.list[0];if(c&&c.g&&r.list.every(x=>x.g===c.g))return c.g}}catch(x){}
  const n=(e.name+' '+(e.set||'')).toLowerCase();
  if(/goku|gohan|vegeta|broly|frieza|cooler|trunks|dragon ball|\bss\b/.test(n))return 'Dragon Ball Super';
  if(/pok[eé]mon|\bex\b|vmax|vstar|\bgx\b|\bv\b|pikachu|charizard|gengar|umbreon|mewtwo|eevee|scarlet|violet|sword|shield|evolving|151|base set|obsidian|paldea/.test(n))return 'Pokémon';
  if(/yu-?gi-?oh|blue-eyes|dark magician|exodia/.test(n))return 'Yu-Gi-Oh!';if(/one piece|luffy|zoro|nami\b/.test(n))return 'One Piece';if(/lorcana/.test(n))return 'Lorcana';if(/magic|mtg|planeswalker/.test(n))return 'Magic: The Gathering';return null}
// ---------- the six stories, from your numbers ----------
const cntSpan=(n,pre,suf,dur)=>'<span data-count="'+n+'" data-pre="'+esc(pre||'')+'" data-suf="'+esc(suf||'')+'" data-d="150"'+(dur?' data-dur="'+dur+'"':'')+'>'+esc((pre||'')+NFR.format(n)+(suf||''))+'</span>';
let SS=[];
function buildStories(){const b=D,x=b.x,t=x.t,M=x.M,S=[];const lab=b.lab;
  // 1 · the money: the line draws itself
  const cum=x.cum.length>1?x.cum:[0].concat(x.cum),mn=Math.min(0,...cum),mx=Math.max(1,...cum),pts=cum.map((v,i)=>[(i/Math.max(1,cum.length-1))*260,108-((v-mn)/(mx-mn||1))*96]);
  const line='M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L'),pm=Math.round(t.profit/Math.max(1,M.length));
  S.push({k:'The money',cover:signedS(t.profit),h:'You spent '+short(t.spent)+' and made back '+short(t.kept)+'.',big:cntSpan(Math.round(Math.abs(t.profit)/100),(t.profit<0?'−':'+')+'$',''),
    line:t.spent?'That’s a '+x.roi+'% return'+(x.one?' in '+mName(x.mo1)+'.':', about '+short(Math.abs(pm))+' a month'+(pm<0?' in the red.':'.')):'Log a purchase and your money story starts here.',
    vis:p=>'<svg class="spark" viewBox="0 0 260 120" preserveAspectRatio="none"><path class="ar" d="'+line+' L260 120 L0 120Z" fill="'+p.acc+'" opacity=".18"/><path class="ln" d="'+line+'" fill="none" stroke="'+p.acc+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>'});
  // 2 · biggest win: the whole card slowly zooms; the price tag slides up and to the right
  const f0=x.f0,bs=x.bigSale;
  if(f0){const r=f0.cost?f0.kept/f0.cost:0;S.push({k:'Your biggest win',cover:'Biggest win',h:esc(sn(f0.name))+(r>=3?' tripled your money.':r>=2?' doubled your money.':' was your best flip.'),line:'Bought for '+short(f0.cost)+'. Sold for '+short(f0.gross)+'.',vis:p=>'<div class="artw"><div class="kb">'+cardEl(f0.name)+'<span class="stick" style="background:'+p.acc+';color:'+p.on+'">'+signed(f0.gain)+'</span></div></div>'})}
  else if(bs)S.push({k:'Your biggest sale',cover:'Biggest sale',h:esc(sn(bs.name))+' sold for '+short(bs.amount)+'.',line:'On '+esc(bs.platform)+', '+dShort(bs.date)+'.',vis:p=>'<div class="artw"><div class="kb">'+cardEl(bs.name)+'<span class="stick" style="background:'+p.acc+';color:'+p.on+'">'+short(bs.amount)+'</span></div></div>'});
  else S.push({k:'Your biggest win',cover:'Biggest win',h:'Your first win shows up here.',line:'Sell a card you logged buying, and it lands on this story.',vis:()=>''});
  // 3 · where you buy: amounts count up, bars fill in
  const pl=x.plats;
  if(pl.length){const pct=Math.round(pl[0].v/Math.max(1,t.spent)*100);S.push({k:'Where you buy',cover:pl[0].k,h:pct>=40?'Most of your money goes to '+esc(pl[0].k)+'.':esc(pl[0].k)+' is where you buy most.',line:cntSpan(pct,'','%')+' of everything you spent.',
    vis:p=>'<div class="plat">'+pl.slice(0,4).map((q,i)=>'<div><span>'+esc(q.k)+'<em data-count="'+Math.round(q.v/100)+'" data-pre="$" data-d="'+(350+i*120)+'">'+short(q.v)+'</em></span><i style="width:'+(q.v/pl[0].v*100).toFixed(1)+'%;background:'+(i?p.ink:p.acc)+';opacity:'+(i?.4:1)+';--d:'+(.35+i*.12)+'s"></i></div>').join('')+'</div>'})}
  else S.push({k:'Where you buy',cover:'Platforms',h:'No purchases in this range.',line:'Your platforms show up once you log a purchase.',vis:()=>''});
  // 4 · staying accountable: each checked month pulses as the count reaches it
  const unit=x.one?x.wk.map(w=>({ok:w.spent<=x.WB,l:String(w.d)})):x.by.slice(-12).map((m,i)=>({ok:m.spent<=BUDGET,l:mName(M.slice(-12)[i],{month:'narrow'})}));
  const okN=unit.filter(u=>u.ok).length;let run=0,bestRun=0;unit.forEach(u=>{run=u.ok?run+1:0;bestRun=Math.max(bestRun,run)});
  S.push({k:'Staying accountable',cover:okN+' of '+unit.length,h:okN/Math.max(1,unit.length)>=.5?'Your budget held up.':'Budget, still a work in progress.',big:cntSpan(okN,'',' of '+unit.length,2600),
    line:(x.one?'weeks under budget in '+mName(x.mo1):'months under your '+short(BUDGET)+' budget')+(bestRun>1&&bestRun<unit.length?', with a best run of '+bestRun+' in a row.':'.'),
    vis:p=>{let j=0;const cols=Math.min(6,unit.length);return '<div class="mo" style="grid-template-columns:repeat('+cols+',minmax(0,1fr))">'+unit.map(u=>{const tt=u.ok?(150+(1-Math.sqrt(1-((++j)-.5)/Math.max(1,okN))))*2600/1000:0;
      return '<div><i class="'+(u.ok?'ok':'no')+'" style="background:'+(u.ok?p.acc:'transparent')+';border:2px solid '+p.acc+';color:'+p.on+(u.ok?';--d:'+(.15+(1-Math.sqrt(1-(j-.5)/Math.max(1,okN)))*2.6).toFixed(2)+'s':'')+'">'+(u.ok?'✓':'')+'</i>'+esc(u.l)+'</div>'}).join('')+'</div>'}});
  // 5 · your collection
  const pct5=x.nbE?Math.round(x.soldE/x.nbE*100):0,keep=x.hold.length,soldArt=[...new Set(x.L.filter(e=>e.type==='sale').map(e=>e.name))],fan=(soldArt.filter(artOf).concat(soldArt.filter(n=>!artOf(n)))).slice(0,3);
  S.push({k:'Your collection',cover:pct5+'% sold',h:pct5>=50?'Most cards moved on.':'Your collection is growing.',big:cntSpan(pct5,'','%'),line:'of the cards you bought have sold. '+keep+' '+(keep===1?'is':'are')+' still in your collection.',
    vis:()=>fan.length?'<div class="sfan">'+fan.map(cardEl).join('')+'</div>':''});
  // 6 · your game: card art drifts past in a slow wall
  const buys=x.L.filter(e=>e.type==='purchase'),g={};let all=0;buys.forEach(e=>{const q=e.qty||1;all+=q;const k=gameOf(e)||'other';g[k]=(g[k]||0)+q});
  const top=Object.keys(g).filter(k=>k!=='other').sort((a,b)=>g[b]-g[a])[0],gp=top?Math.round(g[top]/Math.max(1,all)*100):0;
  const arts=[...new Set(x.L.map(e=>e.name).filter(artOf))].slice(0,9);
  const col=(list,cls)=>'<div class="col'+(cls||'')+'">'+list.concat(list).map(cardEl).join('')+'</div>';
  if(all&&top)S.push({k:'Your game',cover:top,h:gp>=60?'You collected a <u style="text-decoration-color:{acc}">lot</u> of '+esc(top)+'!':'Mostly '+esc(top)+', with a little of everything.',big:cntSpan(gp,'','%'),line:'of your purchases were '+esc(top)+'. '+cnt(all,'card','cards')+' in all.',
    vis:()=>arts.length>=3?'<div class="wall">'+col(arts.filter((_,i)=>i%3===0))+col(arts.filter((_,i)=>i%3===1),' dn')+col(arts.filter((_,i)=>i%3===2))+'</div>':'<div class="sfan">'+[...new Set(buys.map(e=>e.name))].slice(0,3).map(cardEl).join('')+'</div>'});
  else S.push({k:'Your cards',cover:all?cnt(all,'card','cards'):'Your cards',h:all?'You collected '+cnt(all,'card','cards')+'.':'Your cards show up here.',line:all?'Across every game you play.':'Log a purchase to start your collection story.',vis:()=>arts.length?'<div class="sfan">'+arts.slice(0,3).map(cardEl).join('')+'</div>':''});
  return S}
function stHTML(s,i,on){const p=palN(i);return '<div class="st'+(on?' on':'')+(p.scrim?' scrim':'')+'" style="color:'+p.ink+'">'+bgSvg(bgStyle,p,i+1)+'<div class="sin">'+
  '<div class="brand"><mark style="--hl:'+p.acc+';color:'+p.on+'">cardtab.app</mark></div><small>'+s.k+'</small><h4 class="pop">'+s.h.replace('{acc}',p.acc)+'</h4>'+(s.big?'<div class="sbig pop" style="color:'+p.acc+'">'+s.big+'</div>':'')+(s.line?'<p class="line pop">'+s.line+'</p>':'')+
  '<div class="svis rise">'+s.vis(p)+'</div></div></div>'}
function cvHTML(s,i,cls){const p=palN(i),long=String(s.cover).length>9;return '<button type="button" class="scv '+(cls||'')+'" data-play="'+i+'" style="color:'+p.ink+'" aria-label="Play '+esc(s.k)+'">'+bgSvg(bgStyle,p,i+1,300,420)+'<span class="sin"><small>'+esc(s.k)+'</small><b style="'+(long?'font-size:clamp(11px,3.6cqw,14px);':'')+'color:'+(s.big||String(s.cover).startsWith('+')?p.acc:p.ink)+'">'+esc(s.cover)+'</b></span></button>'}
// ---------- the shelf ----------
const shelf=document.createElement('div');shelf.className='shelf';shelf.id='shelf';$('track').after(shelf);
function paintShelf(){SS=buildStories();const p=palN(0),t=D.x.t;
  shelf.innerHTML='<button type="button" class="hero" data-play="0" style="color:'+p.ink+'" aria-label="Play all '+SS.length+' stories">'+bgSvg(bgStyle,p,11,300,345)+'<span class="sin"><small>'+esc(D.lab)+'</small><span class="h4">Your cards, in '+SS.length+' stories</span><span class="sbig" style="color:'+p.acc+'">'+signedS(t.profit)+'</span><span class="sub">'+(t.spent?D.x.roi+'% return · ':'')+cnt(t.n,'entry','entries')+'</span></span>'+
    '<span class="play" style="background:'+p.acc+';color:'+p.on+'"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg></span></button>'+
    '<div class="covw"><div class="mh"><b>Stories</b><span>'+(matchMedia('(hover:none)').matches?'Tap':'Click')+' one to play</span></div><div class="covers">'+SS.map((s,i)=>cvHTML(s,i)).join('')+'</div></div>';
  if($('svall'))$('svall').lastChild.textContent='Save all '+SS.length;
  if(pl.open){const i=pl.i;pl.build();pl.set(i)}}
shelf.addEventListener('click',e=>{const b=e.target.closest('[data-play]');if(b)pl.show(+b.dataset.play,b)});
// ---------- the player ----------
const PAUSE='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',PLAY='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const SHARE='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5"/></svg>';
const plEl=document.createElement('div');plEl.className='pl';plEl.hidden=true;plEl.setAttribute('role','dialog');plEl.setAttribute('aria-modal','true');plEl.setAttribute('aria-label','Card Stories');document.body.appendChild(plEl);
const DUR=8200;
const pl={open:false,i:0,t0:0,el:0,paused:false,raf:0,held:false,holdT:0,was:false,
  build(){plEl.innerHTML='<div class="wash"></div><div class="stage"><div class="pcard">'+SS.map((s,k)=>stHTML(s,k,k===this.i)).join('')+
      '<div class="pbars">'+SS.map(()=>'<i><b></b></i>').join('')+'</div><div class="ptop"><span>'+esc(NAME?NAME+' · ':'')+esc(D.lab)+'</span><button type="button" class="x" data-x aria-label="Close">✕</button></div>'+
      '<div class="tapz l" data-go="-1"></div><div class="tapz r" data-go="1"></div>'+
      '<div class="pbot"><button type="button" data-share>'+SHARE+'Share</button><button type="button" class="ghost sp" data-pause aria-label="Pause">'+PAUSE+'</button></div>'+
      '<div class="pshs" hidden><b>Share this story</b>'+(VMIME?'<button type="button" data-shx="vshare">Share video…</button><button type="button" data-shx="vsave">Save video</button>':'')+'<button type="button" data-shx="share">Share image…</button><button type="button" data-shx="save">Save image</button><button type="button" class="ghost" data-shx="">Cancel</button><small class="shn">'+(VMIME?'8-second videos and images':'Images')+' at 1080 × 1920, the size for Stories and Reels</small></div><div class="ptoast" hidden></div></div>'+
      '<button type="button" class="arr l" data-go="-1" aria-label="Previous story">‹</button><button type="button" class="arr r" data-go="1" aria-label="Next story">›</button></div>'+
      '<div class="strip">'+SS.map((s,k)=>cvHTML(s,k,k===this.i?'cur':'')).join('')+'</div>';this.paint()},
  paint(){const i=this.i,p=palN(i);plEl.querySelectorAll('.st').forEach((s,k)=>s.classList.toggle('on',k===i));plEl.style.setProperty('--pink',p.ink);
    plEl.querySelector('.wash').style.background=p.bg.startsWith('#')?'radial-gradient(circle at 50% 40%,'+p.bg+','+p.acc+')':p.bg;
    plEl.querySelectorAll('.strip .scv').forEach((c,k)=>c.classList.toggle('cur',k===i));
    plEl.querySelectorAll('.pbars i').forEach((b,k)=>{b.firstElementChild.style.transform=k<i?'scaleX(1)':'scaleX(0)'});
    const cur=plEl.querySelectorAll('.st')[i];cur.querySelectorAll('.pop,.rise,.plat i,.mo i,.stick,.ln,.ar').forEach(n=>{n.style.animation='none';void n.offsetWidth;n.style.animation=''});
    cur.querySelectorAll('[data-count]').forEach(n=>{const to=+n.dataset.count,pre=n.dataset.pre||'',suf=n.dataset.suf||'',d=+(n.dataset.d||0),dur=+(n.dataset.dur||1300),fmt=v=>pre+NFR.format(Math.round(v))+suf;
      if(calmM.matches){n.textContent=fmt(to);return}n.textContent=fmt(0);const t0=performance.now()+d,tok=(n._tok=(n._tok||0)+1);
      (function f(now){if(n._tok!==tok)return;const k=Math.max(0,Math.min(1,(now-t0)/dur));n.textContent=fmt(to*(1-Math.pow(1-k,2)));if(k<1)requestAnimationFrame(f)})(performance.now())})},
  go(d){if(this.paused)this.pause(false);const n=this.i+d;if(n<0)this.i=0;else if(n>=SS.length){this.hide();return}else this.i=n;this.el=0;this.t0=performance.now();this.paint()},
  set(n){this.i=Math.max(0,Math.min(SS.length-1,n));this.el=0;this.t0=performance.now();this.paint()},
  pause(v){if(v===this.paused)return;if(v)this.el+=performance.now()-this.t0;else this.t0=performance.now();this.paused=v;plEl.classList.toggle('paused',v);const b=plEl.querySelector('[data-pause]');if(b){b.innerHTML=v?PLAY:PAUSE;b.setAttribute('aria-label',v?'Play':'Pause')}},
  tick(now){if(!this.open)return;if(!this.paused){const k=Math.min(1,(this.el+now-this.t0)/DUR),bar=plEl.querySelectorAll('.pbars i b')[this.i];if(bar)bar.style.transform='scaleX('+k+')';if(k>=1)this.go(1)}this.raf=requestAnimationFrame(t=>this.tick(t))},
  show(n,from){this.i=n;this.paused=false;plEl.classList.remove('paused');this.build();plEl.hidden=false;this.open=true;modalSync();navPush('pl',()=>this.hide(true));
    if(!calmM.matches)plEl.animate([{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'none'}],{duration:340,easing:'cubic-bezier(.2,.8,.2,1)'});
    this.t0=performance.now();this.el=0;cancelAnimationFrame(this.raf);this.raf=requestAnimationFrame(t=>this.tick(t));const x=plEl.querySelector('[data-x]');if(x)x.focus({preventScroll:true})},
  hide(fromPop){if(!this.open)return;this.open=false;cancelAnimationFrame(this.raf);if(!fromPop)navDone('pl');
    const done=()=>{plEl.hidden=true;plEl.innerHTML='';modalSync()};if(calmM.matches){done();return}
    const a=plEl.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(30px) scale(.97)'}],{duration:220,easing:'ease-in'});a.onfinish=done},
  toast(t){const n=plEl.querySelector('.ptoast');if(!n)return;n.textContent=t;n.hidden=false;clearTimeout(n._t);n._t=setTimeout(()=>{n.hidden=true},2200)}};
plEl.addEventListener('click',async e=>{
  if(pl.held){pl.held=false;return}// letting go after a hold only resumes
  const sx=e.target.closest('[data-shx]');if(sx){plEl.querySelector('.pshs').hidden=true;const a=sx.dataset.shx,n=pl.i;if(!a){if(!pl.was)pl.pause(false);return}
    if(!EMB){pl.toast(/share/.test(a)?'In the app this opens your phone’s share sheet.':'In the app this saves the story.');if(!pl.was)pl.pause(false);return}
    if(a==='vshare'||a==='vsave'){await shareVideo(n,a==='vshare');if(!pl.was)pl.pause(false);return}
    pl.toast('Making your image…');await saveStories([n],a==='share');if(!pl.was)pl.pause(false);return}
  if(e.target.closest('[data-share]')){pl.was=pl.paused;pl.pause(true);const sh=plEl.querySelector('.pshs');sh.hidden=false;if(!calmM.matches)sh.animate([{transform:'translateY(100%)'},{transform:'none'}],{duration:300,easing:'cubic-bezier(.2,.8,.2,1)'});return}
  if(e.target.closest('[data-pause]')){pl.pause(!pl.paused);return}
  const g=e.target.closest('[data-go]');if(g){pl.go(+g.dataset.go);return}
  const c=e.target.closest('.strip [data-play]');if(c){pl.set(+c.dataset.play);return}
  if(e.target.closest('[data-x]')||e.target.classList.contains('wash')||e.target.classList.contains('stage'))pl.hide()});
plEl.addEventListener('pointerdown',e=>{if(!e.target.closest('.tapz'))return;pl.held=false;clearTimeout(pl.holdT);pl.holdT=setTimeout(()=>{pl.held=true;pl.was=pl.paused;pl.pause(true)},280)});
const plUp=()=>{clearTimeout(pl.holdT);if(pl.held&&!pl.was)pl.pause(false)};plEl.addEventListener('pointerup',plUp);plEl.addEventListener('pointercancel',()=>{plUp();pl.held=false});
// swipe down closes it on phones
(()=>{let y0=null,dy=0;plEl.addEventListener('touchstart',e=>{if(e.touches.length===1&&!e.target.closest('.pshs'))y0=e.touches[0].clientY;dy=0},{passive:true});
  plEl.addEventListener('touchmove',e=>{if(y0==null)return;dy=e.touches[0].clientY-y0;if(dy>0){clearTimeout(pl.holdT);plEl.querySelector('.pcard').style.transform='translateY('+dy+'px) scale('+(1-Math.min(.08,dy/2400))+')'}},{passive:true});
  plEl.addEventListener('touchend',()=>{if(y0==null)return;const c=plEl.querySelector('.pcard');if(dy>120){pl.held=true;pl.hide()}else if(c){c.style.transition='transform .25s';c.style.transform='';setTimeout(()=>{c.style.transition=''},260)}y0=null})})();
addEventListener('keydown',e=>{if(!pl.open)return;if(e.key==='ArrowRight'){pl.go(1);e.preventDefault()}else if(e.key==='ArrowLeft'){pl.go(-1);e.preventDefault()}else if(e.key==='Escape'){pl.hide();e.preventDefault()}else if(e.key===' '){pl.pause(!pl.paused);e.preventDefault()}});
// ---------- wiring into the rest of the page ----------
const _modalSync=modalSync;modalSync=function(){const any=pl.open||!$('lb').hidden||[...document.querySelectorAll('.sheetw')].some(w=>!w.hidden&&!w.classList.contains('out'));try{parent.csModal&&parent.csModal(any)}catch(e){}};
const _render=render;render=function(){_render();paintShelf()};
const _setTheme=setTheme;setTheme=function(i){_setTheme(i);paintShelf()};
// the theme sheet also picks the background
(()=>{const g=$('tgrid');if(!g)return;const w=document.createElement('div');w.className='bgw';w.innerHTML='<p class="bgl2">Background</p><div class="bgrow" id="bgrow" role="radiogroup" aria-label="Background"></div>';g.after(w);
  const paint=()=>{const p=palN(0);$('bgrow').innerHTML=BGS.map(b=>'<button type="button" class="bgo" role="radio" aria-checked="'+(b===bgStyle)+'" data-bg="'+b+'"><span class="bgp">'+bgSvg(b,p,3,120,90)+'</span>'+b+'</button>').join('')};
  const _open=openSheet;openSheet=function(id,pre){_open(id,pre);if(id==='ths')paint()};
  $('bgrow').addEventListener('click',e=>{const b=e.target.closest('[data-bg]');if(!b)return;bgStyle=b.dataset.bg;try{localStorage.setItem('cs.bg',bgStyle)}catch(er){}paint();paintShelf()});
  const _pg=paintGrid;paintGrid=function(){_pg();paint()}})();
// saved images use the new story design (1080 × 1920), shown as it ends: numbers counted, tag in place
storyBlob=async function(n){const h=await lib(),host=$('xhost');host.innerHTML='';const el=document.createElement('div');el.className='xst';el.innerHTML=stHTML(SS[n],n,true);host.appendChild(el);
  const imgs=[...el.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));try{await document.fonts.ready}catch(e){}
  const opt={pixelRatio:3,width:360,height:640,cacheBust:false,backgroundColor:'#000',fontEmbedCSS:await fontCSS()};let b=await h.toBlob(el,opt);if(isSafari)b=await h.toBlob(el,opt);host.innerHTML='';return b};
window.csEnter=function(){if(calmM.matches)return;const parts=[document.querySelector('.top'),document.querySelector('.controls'),shelf.querySelector('.hero')].filter(Boolean);
  parts.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:420,delay:80+i*60,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
  shelf.querySelectorAll('.scv').forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(18px) scale(.96)'},{opacity:1,transform:'none'}],{duration:480,delay:220+i*50,easing:'cubic-bezier(.2,.9,.25,1)',fill:'backwards'}))};
window.csPlay=n=>pl.show(n||0);
paintShelf();
// ---------- an 8-second video of one story (1080 × 1920), for Stories, Reels and TikTok ----------
// The story is drawn once as separate layers (background, words, picture, price tag); a canvas then plays them for 8.2s
// (words rise in, the number counts up, the picture rises and slowly zooms, the tag slides in, the background drifts)
// while the phone records it. Nothing is uploaded.
const VMIME=(()=>{try{if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)return '';return ['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||''}catch(e){return ''}})();
let FONTF=null;function canvasFont(){if(FONTF)return FONTF;FONTF=(async()=>{try{const u=new URL('fonts/manrope-latin.woff2',parent.document.baseURI).href,f=new FontFace('CTManrope','url('+u+')',{weight:'500 800'});await f.load();document.fonts.add(f);return 'CTManrope'}catch(e){return 'Manrope'}})();return FONTF}
async function storyVideo(n,onTick){const h=await lib(),host=$('xhost');host.innerHTML='';const el=document.createElement('div');el.className='xst';el.innerHTML=stHTML(SS[n],n,true);host.appendChild(el);
  const imgs=[...el.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));try{await document.fonts.ready}catch(e){}
  const fam=await canvasFont(),fc=await fontCSS(),R=3,W=1080,H=1920,box=el.getBoundingClientRect(),rel=q=>{const r=q.getBoundingClientRect();return {x:(r.left-box.left)*R,y:(r.top-box.top)*R,w:r.width*R,h:r.height*R}};
  const big=el.querySelector('.sbig [data-count]'),bigBox=big&&rel(big.parentElement),bigCS=big&&(()=>{const cs=getComputedStyle(big.parentElement);return {color:cs.color,fontSize:cs.fontSize}})(),vis=el.querySelector('.svis'),visBox=vis&&rel(vis),stk=el.querySelector('.stick'),stkBox=stk&&rel(stk);
  const layer=async cls=>{el.className='xst '+cls;return h.toCanvas(el,{pixelRatio:R,width:360,height:640,cacheBust:false,fontEmbedCSS:fc})};
  const L={bg:await layer('only-bg'),text:await layer('only-text'),vis:vis?await layer('only-vis'):null,stick:stk?await layer('only-stick'):null};
  if(isSafari){L.bg=await layer('only-bg');if(vis)L.vis=await layer('only-vis')}// Safari can leave images out of the first pass
  host.innerHTML='';
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  const ease=k=>1-Math.pow(1-Math.max(0,Math.min(1,k)),3),T=8.2,to=big?+big.dataset.count:0,pre=big?big.dataset.pre||'':'',suf=big?big.dataset.suf||'':'',cd=big?(+(big.dataset.dur||1300))/1000:1.3;
  function frame(t){c.clearRect(0,0,W,H);
    const z=1+.05*Math.min(1,t/T);c.save();c.translate(W/2,H/2);c.scale(z,z);c.drawImage(L.bg,-W/2,-H/2,W,H);c.restore();
    if(L.vis){const a=ease((t-.3)/.7),zz=1+.08*Math.max(0,Math.min(1,(t-1)/(T-1))),cx=visBox.x+visBox.w/2,cy=visBox.y+visBox.h/2;c.save();c.globalAlpha=a;c.translate(cx,cy+(1-a)*70);c.scale(zz,zz);c.drawImage(L.vis,-cx,-cy,W,H);c.restore()}
    if(L.stick){const a=ease((t-.75)/.9),s=.7+.3*a,cx=stkBox.x+stkBox.w/2,cy=stkBox.y+stkBox.h/2,zz=1+.08*Math.max(0,Math.min(1,(t-1)/(T-1)));c.save();c.globalAlpha=a;c.translate(cx-(1-a)*46*R,cy+(1-a)*56*R);c.scale(s*zz,s*zz);c.drawImage(L.stick,-cx,-cy,W,H);c.restore()}
    const ta=ease((t-.15)/.7);c.save();c.globalAlpha=ta;c.drawImage(L.text,0,(1-ta)*40,W,H);c.restore();
    if(big){const k=Math.max(0,Math.min(1,(t-.15)/cd)),v=Math.round(to*(1-Math.pow(1-k,2)));c.save();c.globalAlpha=ta;c.fillStyle=bigCS.color;c.font='800 '+parseFloat(bigCS.fontSize)*R+'px '+fam+',Manrope,sans-serif';c.textBaseline='alphabetic';
      try{c.letterSpacing=(-.055*parseFloat(bigCS.fontSize)*R)+'px'}catch(e){}c.fillText(pre+NFR.format(v)+suf,bigBox.x,bigBox.y+bigBox.h*.84+(1-ta)*40);c.restore()}}
  frame(0);const stream=cv.captureStream(30),rec=new MediaRecorder(stream,{mimeType:VMIME,videoBitsPerSecond:6e6}),chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  const done=new Promise(r=>{rec.onstop=r});rec.start(250);const t0=performance.now();
  await new Promise(res=>{(function step(){const t=(performance.now()-t0)/1000;frame(Math.min(T,t));onTick&&onTick(t/T);if(t<T+.15)requestAnimationFrame(step);else res()})()});
  rec.stop();await done;stream.getTracks().forEach(tr=>tr.stop());return new Blob(chunks,{type:VMIME.split(';')[0]})}
async function shareVideo(n,share){if(!VMIME){pl.toast('This browser can’t make videos. Try Save image.');return}
  try{const b=await storyVideo(n,k=>pl.toast('Making your video… '+Math.max(1,Math.ceil(8.2*(1-Math.min(1,k))))+'s'));const ext=/mp4/.test(b.type)?'mp4':'webm',name='Card Stories '+(n+1)+' - '+SS[n].k+'.'+ext,f=new File([b],name,{type:b.type});
    if((share||phoneUI())&&navigator.canShare&&navigator.canShare({files:[f]})){pl.toast('Your video is ready.');try{await navigator.share({files:[f]})}catch(e){}}
    else{download(b,name);pl.toast('Saved “'+SS[n].k+'” as a video.')}}catch(e){console.error(e);pl.toast('Couldn’t make the video. Try again.')}finally{$('xhost').innerHTML=''}}
window.csVideo=storyVideo;
// ================= v39.1 Free users: a taste of Stories =================
// Free: Last month only (longer ranges show a Premium note), two themes (Jewel + a theme of the month matched to the color
// of your profile picture, or random with the default color), Clean and Blobs backgrounds, one video a month (resets with
// your 20 free entries), images any time, and the cardtab.app highlight up top. Premium: everything, with cardtab.app as
// plain text in the lower right.
const isFree=()=>{try{return !!(EMB&&parent.CTBoardPlan&&parent.CTBoardPlan()!=='premium')}catch(e){return false}};
const ym=()=>TODAY.slice(0,7);
function tomIdx(){let a={},em='';try{a=JSON.parse(localStorage.getItem('cb.avatar'))||{}}catch(e){}try{const s=parent.CTSession&&parent.CTSession.current();em=(s&&s.email)||''}catch(e){}
  const mi=(+TODAY.slice(0,4))*12+(+TODAY.slice(5,7)),seed=[...em].reduce((x,c)=>(x*31+c.charCodeAt(0))>>>0,7)+mi;
  const pool=TH.map((_,i)=>i).filter(i=>i!==0),col=!a.photo&&/^#[0-9a-f]{6}$/i.test(a.color||'')&&a.color.toLowerCase()!=='#a50e37'?a.color:null;
  if(!col)return pool[seed%pool.length];
  // the three themes whose main color is closest to your profile color, taking turns month by month
  const near=pool.map(i=>({i,d:cdist(swCols(TH[i])[0],col)})).sort((x,y)=>x.d-y.d).slice(0,3);return near[mi%near.length].i}
const freeThemes=()=>[0,tomIdx()];
const themeOK=i=>!isFree()||freeThemes().includes(i),bgOK=b=>!isFree()||b!=='Stickers';
// themes: free users see their two in the chips; the sheet shows the rest with a lock
const _paintChips=paintChips;paintChips=function(){_paintChips();if(!isFree())return;const f=freeThemes(),el=$('thm');if(!themeOK(th))th=f[1];
  el.innerHTML=f.map(i=>'<button class="tchip" aria-pressed="'+(i===th)+'" data-i="'+i+'"><span class="tsw">'+sw(TH[i])+'</span>'+TH[i][0]+'</button>').join('')+'<button class="tchip more" data-all><span class="rbw" aria-hidden="true"></span>All themes</button>'};
const _pg2=paintGrid;paintGrid=function(){_pg2();if(!isFree())return;$('tgrid').querySelectorAll('[data-i]').forEach(b=>{if(!themeOK(+b.dataset.i)){b.classList.add('lockd');b.setAttribute('aria-disabled','true');b.insertAdjacentHTML('beforeend','<em class="lk" title="Premium"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg></em>')}else if(+b.dataset.i===freeThemes()[1])b.insertAdjacentHTML('beforeend','<em class="tm">This month</em>')})};
$('tgrid').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b||themeOK(+b.dataset.i))return;e.stopImmediatePropagation();$('ths-s').textContent='All 24 themes come with Premium. Free includes Jewel and a theme of the month picked from your profile color.';$('ths-s').classList.add('msg')},true);
const _setTheme2=setTheme;setTheme=function(i){if(!themeOK(i)){try{parent.CTPremiumOpen&&parent.CTPremiumOpen('stories')}catch(e){}return}_setTheme2(i)};
const _list=window.csThemes.list;window.csThemes.list=()=>isFree()?freeThemes().map(i=>({i,name:TH[i][0],sw:swCols(TH[i])})):_list();
// backgrounds: Stickers is Premium
$('bgrow').addEventListener('click',e=>{const b=e.target.closest('[data-bg]');if(!b||bgOK(b.dataset.bg))return;e.stopImmediatePropagation();$('ths-s').textContent='Stickers comes with Premium. Clean and Blobs are free.';$('ths-s').classList.add('msg')},true);
const bgPaintLock=()=>{if(!isFree())return;const s=$('bgrow').querySelector('[data-bg="Stickers"]');if(s&&!s.querySelector('.lk')){s.classList.add('lockd');s.insertAdjacentHTML('beforeend','<em class="lk" title="Premium"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg></em>')}};
new MutationObserver(bgPaintLock).observe($('bgrow'),{childList:true});
// ranges: free users start on Last month; anything longer shows a Premium note instead of the stories
let freeStart=false;
const _paintShelf=paintShelf;paintShelf=function(){if(isFree()){if(!freeStart){freeStart=true;if(per!=='lm'){setPer('lm');return}}if(!bgOK(bgStyle))bgStyle='Blobs';if(!themeOK(th))th=freeThemes()[1];
    if(per!=='lm'){const p=palN(0);SS=[];shelf.innerHTML='<div class="plock" style="color:'+p.ink+'">'+bgSvg('Blobs',p,5,400,300)+'<div class="sin"><small>'+esc(D.lab)+'</small><span class="h4">Longer recaps come with Premium.</span><p>Free Stories cover last month. Premium adds your year, the last 12 months and any dates you pick.</p><div class="pla"><button type="button" class="b1" data-lm>Show last month</button><button type="button" class="b2" data-prem>See Premium</button></div></div></div>';return}}
  else freeStart=false;_paintShelf()};
shelf.addEventListener('click',e=>{if(e.target.closest('[data-lm]'))setPer('lm');else if(e.target.closest('[data-prem]')){try{parent.CTPremiumOpen&&parent.CTPremiumOpen('stories')}catch(er){}}});
// videos: one a month for free users (counted in the account, reset with the 20 free entries)
const vUsed=()=>{try{const m=parent.CTStore.meta('storiesVideo');return m&&m.month===ym()?m.n:0}catch(e){return 0}};
const vLeft=()=>isFree()?Math.max(0,1-vUsed()):Infinity;
const _shareVideo=shareVideo;shareVideo=async function(n,share){if(isFree()&&vLeft()<1){let on='next month';try{on=parent.CTStore.usage().resetsOn}catch(e){}pl.toast('Your free video for '+mName(ym())+' is used. More on '+on+', or go Premium.');return}
  await _shareVideo(n,share);if(isFree()){try{await parent.CTStore.setMeta('storiesVideo',{month:ym(),n:vUsed()+1})}catch(e){}}};
// the share sheet says how many free videos are left
const _build=pl.build.bind(pl);pl.build=function(){_build();if(isFree()&&VMIME){const n=plEl.querySelector('.pshs .shn');if(n)n.textContent=vLeft()?'1 free video this month · images any time':'Free video used this month · images any time'}};
// the cardtab.app mark: Premium gets plain text in the lower right; free keeps the highlight up top
const _stHTML=stHTML;stHTML=function(s,i,on){let h=_stHTML(s,i,on);if(!isFree()){const p=palN(i);h=h.replace(/<div class="brand">[\s\S]*?<\/div>/,'').replace('<div class="sin">','<div class="sin"><span class="pmark" style="color:'+p.ink+'">cardtab.app</span>')}return h};
// keep the plan in step when it changes (Premium turned on or off)
const _cs2=window.csSync;window.csSync=function(){_cs2();paintChips();paintShelf();tellParent()};
paintChips();paintShelf();
// ================= v39.2 Free downloads: Clean background, one video and one image a month =================
// Free users can look at their stories with Blobs in the app; anything they save or share is drawn on Clean.
// They get one video and one image each month, counted in the account and reset with their 20 free entries.
const fUse=()=>{try{const m=parent.CTStore.meta('storiesFree');return m&&m.month===ym()?m:{month:ym(),video:0,image:0}}catch(e){return {month:ym(),video:0,image:0}}};
const fLeft=k=>isFree()?Math.max(0,1-(fUse()[k]||0)):Infinity;
async function fBump(k){if(!isFree())return;try{const m=fUse();m[k]=(m[k]||0)+1;await parent.CTStore.setMeta('storiesFree',m)}catch(e){}}
const resetOn=()=>{try{return parent.CTStore.usage().resetsOn}catch(e){return 'next month'}};
const withClean=async fn=>{const b=bgStyle;if(isFree())bgStyle='Clean';try{return await fn()}finally{bgStyle=b}};
// videos (replaces the v39.1 one-video rule with the shared count)
shareVideo=async function(n,share){if(isFree()&&fLeft('video')<1){pl.toast('Your free video for '+mName(ym())+' is used. More on '+resetOn()+', or go Premium.');return}
  await withClean(()=>_shareVideo(n,share));await fBump('video')};
// images
const _saveStories=saveStories;saveStories=async function(list,share){
  if(isFree()){if(list.length>1){(pl.open?pl.toast.bind(pl):say)('Free includes one image a month. Open a story and tap Share to save it.');return}
    if(fLeft('image')<1){(pl.open?pl.toast.bind(pl):say)('Your free image for '+mName(ym())+' is used. More on '+resetOn()+', or go Premium.');return}}
  await withClean(()=>_saveStories(list,share));if(isFree())await fBump('image')};
// the share sheet says what's left; the background picker says downloads use Clean
pl.build=(b=>function(){b();if(!isFree())return;const n=plEl.querySelector('.pshs .shn');if(n){const v=fLeft('video'),i=fLeft('image');
  n.textContent=(v&&i?'1 free video and 1 free image this month':v?'1 free video left this month':i?'1 free image left this month':'Free video and image used this month')+' · saved on the Clean background'}})(pl.build.bind(pl));
new MutationObserver(()=>{if(!isFree())return;const r=$('bgrow');if(r&&!r.parentElement.querySelector('.bgnote')){r.insertAdjacentHTML('afterend','<p class="bgnote">On Free, saved images and videos use Clean.</p>')}}).observe($('bgrow'),{childList:true});
// ================= v39.3 Video saving is Premium =================
// Free users watch their stories on Clean or Blobs and save one image a month on Clean; saving or sharing video is Premium.
const openPrem=()=>{try{parent.CTPremiumOpen&&parent.CTPremiumOpen('stories')}catch(e){}};
shareVideo=(orig=>async function(n,share){if(isFree()){pl.toast('Saving video comes with Premium.');openPrem();return}return orig(n,share)})(shareVideo);
pl.build=(b=>function(){b();if(!isFree()||!VMIME)return;const sh=plEl.querySelector('.pshs');if(!sh)return;
  sh.querySelectorAll('[data-shx="vshare"],[data-shx="vsave"]').forEach(x=>x.remove());
  const img=sh.querySelector('[data-shx="share"]');if(img)img.insertAdjacentHTML('beforebegin','<button type="button" class="vlock" data-vprem>Save video <span>Premium</span></button>');
  const n=sh.querySelector('.shn');if(n)n.textContent=(fLeft('image')?'1 free image this month':'Free image used this month')+', saved on Clean · video with Premium'})(pl.build.bind(pl));
plEl.addEventListener('click',e=>{if(!e.target.closest('[data-vprem]'))return;e.stopPropagation();plEl.querySelector('.pshs').hidden=true;openPrem()},true);
