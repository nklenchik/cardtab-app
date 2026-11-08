// ================= v39 Stories: a shelf of covers, and stories that play full screen =================
// The old row of cards becomes a shelf (one big cover + one small cover per story). Tapping plays the stories one at a
// time: progress bars, tap right for next, left for back, hold to pause. Each story says one thing. Backgrounds (Clean,
// Blobs, Stickers) come from the theme's own colors. Movement is light (transform and opacity only), runs only on the
// story on screen, and stops with Reduce Motion. Text colors are checked for contrast against their backgrounds.
let GRAIN="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.55"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>');
// turn the noise into a real bitmap once, so nothing has to recompute it while stories play
(()=>{try{const img=new Image();img.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=180;c.getContext('2d').drawImage(img,0,0);GRAIN=c.toDataURL('image/png');}catch(e){}};img.src=GRAIN}catch(e){}})();
const BGS=['Clean','Blobs','Grain','Sunrise','Ripple','Stickers','Shapes','Dust','Halftone'],BG_FREE=['Clean','Blobs','Grain'];let bgStyle='Blobs';try{const b=localStorage.getItem('cs.bg');if(BGS.includes(b))bgStyle=b}catch(e){}
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
  // v49 backgrounds: calm, and easy to read text over. Motion is CSS on transform/opacity, only on the story on screen
  // Grain is a small noise tile drawn once as an image and repeated, not a live filter (a live filter made the story's
  // text stutter, because the browser re-ran it on every frame of the text's animation)
  else if(style==='Grain'){const id='gr'+seed;s+='<defs><pattern id="'+id+'" width="180" height="180" patternUnits="userSpaceOnUse"><image href="'+GRAIN+'" width="180" height="180"/></pattern></defs><rect width="'+W+'" height="'+H+'" fill="#fff" opacity=".16"/><rect width="'+W+'" height="'+H+'" fill="url(#'+id+')" opacity=".5"/>'}
  else if(style==='Sunrise'){const id='sr'+seed;s+='<defs><linearGradient id="'+id+'" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="'+a+'" stop-opacity=".8"/><stop offset=".4" stop-color="'+a+'" stop-opacity=".38"/><stop offset=".7" stop-color="'+a+'" stop-opacity=".12"/><stop offset="1" stop-color="'+a+'" stop-opacity="0"/></linearGradient></defs><rect class="sunr" x="0" y="0" width="'+W+'" height="'+H+'" fill="url(#'+id+')"/>'}
  else if(style==='Ripple'){for(let i=0;i<3;i++)s+='<circle class="rip r'+i+'" cx="'+(W*1.02)+'" cy="'+(H*.98)+'" r="'+(W*.62)+'" fill="none" stroke="'+k+'" stroke-width="1.6"/>'}
  else if(style==='Shapes'){s+='<g class="fl"><circle cx="'+(W*.08)+'" cy="'+(H*.8)+'" r="'+(W*.17)+'" fill="'+a+'" opacity=".26"/></g><g class="fl d2"><rect x="'+(W*.64)+'" y="'+(H*.6)+'" width="'+(W*.24)+'" height="'+(W*.24)+'" rx="'+(W*.055)+'" fill="none" stroke="'+k+'" stroke-width="3" opacity=".22"/></g><g class="fl d3"><circle cx="'+(W*.36)+'" cy="'+(H*.55)+'" r="'+(W*.06)+'" fill="none" stroke="'+a+'" stroke-width="3" opacity=".36"/></g>'}
  else if(style==='Dust'){for(let i=0;i<8;i++)s+='<circle class="dust" style="animation-delay:-'+(r()*12).toFixed(1)+'s;animation-duration:'+(10+r()*6).toFixed(1)+'s" cx="'+(W*(.06+i*.12+r()*.04)).toFixed(1)+'" cy="'+(H*(.55+r()*.4)).toFixed(1)+'" r="2.6" fill="'+a+'" opacity=".5"/>'}
  else if(style==='Halftone'){const id='ht'+seed,m='hm'+seed;s+='<defs><pattern id="'+id+'" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="1.5" fill="'+k+'"/></pattern><radialGradient id="'+m+'g" cx="1" cy="1" r="1"><stop offset="0" stop-color="#fff"/><stop offset=".75" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="'+m+'"><rect width="'+W+'" height="'+H+'" fill="url(#'+m+'g)"/></mask></defs><rect width="'+W+'" height="'+H+'" fill="url(#'+id+')" mask="url(#'+m+')" opacity=".26"/>'}
  return s?'<svg class="bgl" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="background:'+p.bg+'">'+s+'</svg>':'<div class="bgl" style="background:'+p.bg+'"></div>'}
// ---------- card art ----------
const AG=['linear-gradient(155deg,#d9577a,#7d0b2b)','linear-gradient(155deg,#5fa0d6,#174b78)','linear-gradient(155deg,#8cc96a,#2e5c12)','linear-gradient(155deg,#8a8983,#3a3936)','linear-gradient(155deg,#f0a35c,#a5551a)'];
const agOf=n=>AG[[...String(n)].reduce((a,c)=>a+c.charCodeAt(0),0)%AG.length];
const artOf=n=>ART.get(String(n).toLowerCase());
// v50.38: a graded card shows in its slab (drawn by the app's own CTGrade, so it matches Entries and the Board)
const GRD=()=>{const m=new Map();try{const G=parent.CTGrade;if(!G||typeof parent.cbEntries!=='function')return m;(parent.cbEntries()||[]).forEach(r=>{if(r&&r.grade&&r.name){const k=String(r.name).toLowerCase();if(!m.has(k)||r.type==='purchase')m.set(k,r)}})}catch(e){}return m};
let GRM=null;const gradedRow=n=>{if(!GRM)GRM=GRD();return GRM.get(String(n).toLowerCase())};
const cardEl=n=>{const a=artOf(n),gr=gradedRow(n);let G=null;try{G=parent.CTGrade}catch(e){}
  if(gr&&G){const s=G.slab(gr,a?'<img src="'+esc(a)+'" alt="">':'<i class="sl-ph"></i>');if(s)return '<span class="cd xslab">'+s+'</span>'}
  return a?'<img class="cd" src="'+esc(a)+'" alt="">':'<span class="cd ph" style="background:'+agOf(n)+'">'+esc(String(n).replace(/^(SS|SSB)\s+/,'')[0]||'?')+'</span>'};
// ---------- which game a card is from (the card search knows; names are the fallback) ----------
function gameOf(e){try{if(parent.CardLookup){const r=parent.CardLookup.search({name:e.name,number:e.no});const c=r&&r.list&&r.list[0];if(c&&c.g&&r.list.every(x=>x.g===c.g))return c.g}}catch(x){}
  const n=(e.name+' '+(e.set||'')).toLowerCase();
  if(/goku|gohan|vegeta|broly|frieza|cooler|trunks|dragon ball|\bss\b/.test(n))return 'Dragon Ball Super';
  if(/pok[eé]mon|\bex\b|vmax|vstar|\bgx\b|\bv\b|pikachu|charizard|gengar|umbreon|mewtwo|eevee|scarlet|violet|sword|shield|evolving|151|base set|obsidian|paldea/.test(n))return 'Pokémon';
  if(/yu-?gi-?oh|blue-eyes|dark magician|exodia/.test(n))return 'Yu-Gi-Oh!';if(/one piece|luffy|zoro|nami\b/.test(n))return 'One Piece';if(/lorcana/.test(n))return 'Lorcana';if(/magic|mtg|planeswalker/.test(n))return 'Magic: The Gathering';return null}
// ---------- the six stories, from your numbers ----------
const cntSpan=(n,pre,suf,dur)=>'<span data-count="'+n+'" data-pre="'+esc(pre||'')+'" data-suf="'+esc(suf||'')+'" data-d="150"'+(dur?' data-dur="'+dur+'"':'')+'>'+esc((pre||'')+NFR.format(n)+(suf||''))+'</span>';
let SS=[];
// v40: neutral copy (style A). The stories are made to be posted, so nothing says "you" or "your": a label names the
// topic, a big plain headline says what happened, and one short line gives the context. Hide amounts (a Stories
// setting) swaps dollar figures for percentages and words, on screen and in anything saved.
let hideAmt=false;try{hideAmt=localStorage.getItem('cs.hide')==='1'}catch(e){}
const pctS=n=>(n>=0?'+':'−')+NFR.format(Math.abs(n))+'%';
function buildStories(){const b=D,x=b.x,t=x.t,M=x.M,S=[];const H=hideAmt;
  const per=x.one?mName(x.mo1):String(b.lab).replace(/^Last /,''),perOf=x.one?'the month’s ':'';
  // 1 · the money: the line draws itself
  const cum=x.cum.length>1?x.cum:[0].concat(x.cum),mn=Math.min(0,...cum),mx=Math.max(1,...cum),pts=cum.map((v,i)=>[(i/Math.max(1,cum.length-1))*260,108-((v-mn)/(mx-mn||1))*96]);
  const line='M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L'),up=t.profit>=0,ratio=t.spent?t.kept/t.spent:0;
  const mh=!t.spent&&!t.kept?'Nothing logged yet.':H?(x.one?(x.roi>=100?'A strong month.':up?'A good month.':'A down month.'):(up?'Up overall.':'Down overall.')):(x.one?(up?'A '+short(t.profit)+' month.':'A down month.'):(up?'Up '+short(t.profit)+'.':'Down '+short(-t.profit)+'.'));
  const ml=!t.spent?(t.kept?(H?'Sales, with nothing bought.':short(t.kept)+' back, nothing spent.'):'Log a purchase and the money story starts here.'):H?(up?'Money back was '+(Math.round(ratio*10)/10)+'× the money spent.':'Money back was '+Math.round(ratio*100)+'% of the money spent.'):short(t.spent)+' spent, '+short(t.kept)+' back.'+(x.roi>0?' A '+x.roi+'% return.':'');
  S.push({k:per+' in cards',cover:H?pctS(x.roi):signedS(t.profit),h:mh,big:H?cntSpan(Math.abs(x.roi),up?'+':'−','%'):cntSpan(Math.round(Math.abs(t.profit)/100),(up?'+':'−')+'$',''),line:ml,
    vis:p=>'<svg class="spark" viewBox="0 0 260 120" preserveAspectRatio="none"><path class="ar" d="'+line+' L260 120 L0 120Z" fill="'+p.acc+'" opacity=".18"/><path class="ln" d="'+line+'" fill="none" stroke="'+p.acc+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>'});
  // 2 · top win: the whole card slowly zooms; the price tag slides up and to the right
  const f0=x.f0,bs=x.bigSale;
  if(f0){const r=f0.cost?f0.kept/f0.cost:0,word=r>=3?'tripled':r>=2?'doubled':'';
    S.push({k:'Top win',cover:'Top win',h:esc(sn(f0.name))+(word?' '+word+'.':' sold at a profit.'),line:H?(word?'Sold for more than '+(r>=3?'triple':'double')+' the price paid.':'Sold for more than the price paid.'):'Bought for '+short(f0.cost)+', sold for '+short(f0.gross)+'.',
      vis:p=>'<div class="artw"><div class="kb">'+cardEl(f0.name)+'<span class="stick" style="background:'+p.acc+';color:'+p.on+'">'+(H?(Math.round(r*10)/10)+'×':signed(f0.gain))+'</span></div></div>'})}
  else if(bs)S.push({k:'Top sale',cover:'Top sale',h:H?esc(sn(bs.name))+' was the top sale.':esc(sn(bs.name))+' sold for '+short(bs.amount)+'.',line:'Sold on '+esc(bs.platform)+'.',vis:p=>'<div class="artw"><div class="kb">'+cardEl(bs.name)+'<span class="stick" style="background:'+p.acc+';color:'+p.on+'">'+(H?'Sold':short(bs.amount))+'</span></div></div>'});
  else S.push({k:'Top win',cover:'Top win',h:'No sales yet.',line:'Sell a card that was logged as a purchase, and it shows up here.',vis:()=>''});
  // 3 · where the cards came from: amounts count up, bars fill in
  const pl=x.plats;
  if(pl.length){const pct=Math.round(pl[0].v/Math.max(1,t.spent)*100),tot=pl.reduce((a,q)=>a+q.v,0)||1;
    S.push({c:'s-plat',k:'Where the cards came from',cover:pl[0].k,h:pct>=40?'Mostly from '+esc(pl[0].k)+'.':esc(pl[0].k)+' led the way.',line:cntSpan(pct,'','%')+' of '+perOf+'purchases came from '+esc(pl[0].k)+'.',
    vis:p=>'<div class="plat">'+pl.slice(0,4).map((q,i)=>{const sh=Math.round(q.v/tot*100);return '<div><span>'+esc(q.k)+(H?'<em data-count="'+sh+'" data-suf="%" data-d="'+(350+i*120)+'">'+sh+'%</em>':'<em data-count="'+Math.round(q.v/100)+'" data-pre="$" data-d="'+(350+i*120)+'">'+short(q.v)+'</em>')+'</span><i style="width:'+(q.v/pl[0].v*100).toFixed(1)+'%;background:'+(i?p.ink:p.acc)+';opacity:'+(i?.4:1)+';--d:'+(.35+i*.12)+'s"></i></div>'}).join('')+'</div>'})}
  else S.push({c:'s-plat',k:'Where the cards came from',cover:'Platforms',h:'No purchases yet.',line:'Platforms show up once a purchase is logged.',vis:()=>''});
  // 4 · on budget: each checked month pulses as the count reaches it (never shows the budget amount)
  const unit=x.one?x.wk.map(w=>({ok:w.spent<=x.WB,l:String(w.d)})):x.by.slice(-12).map((m,i)=>({ok:m.spent<=BUDGET,l:mName(M.slice(-12)[i],{month:'narrow'})}));
  const okN=unit.filter(u=>u.ok).length,unitW=x.one?'weeks':'months';let run=0,bestRun=0;unit.forEach(u=>{run=u.ok?run+1:0;bestRun=Math.max(bestRun,run)});
  S.push({c:'s-bud',k:'On budget',cover:okN+' of '+unit.length,h:okN===unit.length&&unit.length?'Under budget every '+(x.one?'week':'month')+'.':okN/Math.max(1,unit.length)>=.5?'Under budget most '+unitW+'.':'Budget: a work in progress.',big:cntSpan(okN,'',' of '+unit.length,2600),
    line:'Spending stayed under the '+(x.one?'weekly':'monthly')+' budget in '+okN+' of '+(x.one?'the month’s ':'the last ')+unit.length+' '+unitW+(bestRun>1&&bestRun<unit.length?', with '+bestRun+' in a row.':'.'),
    vis:p=>{let j=0;const cols=Math.min(6,unit.length);return '<div class="mo" style="grid-template-columns:repeat('+cols+',minmax(0,1fr))">'+unit.map(u=>{if(u.ok)++j;
      return '<div><i class="'+(u.ok?'ok':'no')+'" style="background:'+(u.ok?p.acc:'transparent')+';border:2px solid '+p.acc+';color:'+p.on+(u.ok?';--d:'+(.15+(1-Math.sqrt(1-(j-.5)/Math.max(1,okN)))*2.6).toFixed(2)+'s':'')+'">'+(u.ok?'✓':'')+'</i>'+esc(u.l)+'</div>'}).join('')+'</div>'}});
  // 5 · in and out
  const pct5=x.nbE?Math.round(x.soldE/x.nbE*100):0,keep=x.hold.length,soldArt=[...new Set(x.L.filter(e=>e.type==='sale').map(e=>e.name))],fan=(soldArt.filter(artOf).concat(soldArt.filter(n=>!artOf(n)))).slice(0,3);
  S.push({c:'s-io',k:'In and out',cover:pct5+'% sold',h:pct5>=50?'Most cards moved on.':'The collection keeps growing.',big:cntSpan(pct5,'','%'),line:'of the cards bought have sold. '+keep+' '+(keep===1?'is':'are')+' still in the binder.',
    vis:()=>fan.length?'<div class="sfan">'+fan.map(cardEl).join('')+'</div>':''});
  // 6 · the game: card art drifts past in a slow wall
  const buys=x.L.filter(e=>e.type==='purchase'),g={};let all=0;buys.forEach(e=>{const q=e.qty||1;all+=q;const k=gameOf(e)||'other';g[k]=(g[k]||0)+q});
  const top=Object.keys(g).filter(k=>k!=='other').sort((a,b)=>g[b]-g[a])[0],gp=top?Math.round(g[top]/Math.max(1,all)*100):0;
  const arts=[...new Set(x.L.map(e=>e.name).filter(artOf))].slice(0,9);
  const col=(list,cls)=>'<div class="col'+(cls||'')+'">'+list.concat(list,list,list).map(cardEl).join('')+'</div>';
  if(all&&top)S.push({k:'The game',cover:top,h:gp>=60?'A <u style="text-decoration-color:{acc}">lot</u> of '+esc(top)+'.':gp>50?'Mostly '+esc(top)+'.':gp===50?'Half '+esc(top)+', half everything else.':'A bit of everything, led by '+esc(top)+'.',big:cntSpan(gp,'','%'),line:'of purchases were '+esc(top)+'. '+(g[top]===all?(all===1?'1 card.':'All '+all+' cards.'):g[top]+' of '+cnt(all,'card','cards')+'.'),
    vis:()=>arts.length>=3?'<div class="wall">'+col(arts.filter((_,i)=>i%3===0))+col(arts.filter((_,i)=>i%3===1),' dn')+col(arts.filter((_,i)=>i%3===2))+'</div>':'<div class="sfan">'+[...new Set(buys.map(e=>e.name))].slice(0,3).map(cardEl).join('')+'</div>'});
  else S.push({k:'The cards',cover:all?cnt(all,'card','cards'):'Cards',h:all?cnt(all,'card','cards')+' collected.':'No cards yet.',line:all?'Across every game.':'Log a purchase to start this story.',vis:()=>arts.length?'<div class="sfan">'+arts.slice(0,3).map(cardEl).join('')+'</div>':''});
  return S}
function stHTML(s,i,on){const p=palN(i);return '<div class="st'+(s.c?' '+s.c:'')+(on?' on':'')+(p.scrim?' scrim':'')+'" style="color:'+p.ink+'">'+bgSvg(bgStyle,p,i+1)+(s.full?s.full(p):'')+'<div class="sin">'+
  '<div class="brand"><mark style="--hl:'+p.acc+';color:'+p.on+'"><i>Made with</i><b>cardtab.app</b></mark></div><small>'+s.k+'</small><h4 class="pop">'+s.h.replace('{acc}',p.acc)+'</h4>'+(s.big?'<div class="sbig pop" style="color:'+p.acc+'">'+s.big+'</div>':'')+(s.line?'<p class="line pop">'+s.line+'</p>':'')+
  '<div class="svis rise"><div class="svw">'+s.vis(p)+'</div></div></div></div>'}
function cvHTML(s,i,cls){const p=palN(i),long=String(s.cover).length>9;return '<button type="button" class="scv '+(cls||'')+'" data-play="'+i+'" style="color:'+p.ink+'" aria-label="Play '+esc(s.k)+'">'+bgSvg(bgStyle,p,i+1,300,420)+'<span class="sin"><small>'+esc(s.k)+'</small>'+(s.h?'<span class="cvh">'+esc((()=>{const d=document.createElement('div');d.innerHTML=s.h;return d.textContent})())+'</span>':'')+'<b style="'+(long?'font-size:clamp(11px,3.6cqw,14px);':'')+'color:'+(s.big||String(s.cover).startsWith('+')?p.acc:p.ink)+'">'+esc(s.cover)+'</b></span></button>'}
// ---------- the shelf ----------
const shelf=document.createElement('div');shelf.className='shelf';shelf.id='shelf';$('track').after(shelf);
function paintShelf(){SS=buildStories();const p=palN(0),t=D.x.t;
  shelf.innerHTML='<button type="button" class="hero" data-play="0" style="color:'+p.ink+'" aria-label="Play all '+SS.length+' stories">'+bgSvg(bgStyle,p,11,300,345)+'<span class="sin"><small>'+esc(D.lab)+'</small><span class="h4">The cards, in '+SS.length+' stories</span><span class="sbig" style="color:'+p.acc+'">'+(hideAmt?pctS(D.x.roi):signedS(t.profit))+'</span><span class="sub">'+(t.spent&&!hideAmt?D.x.roi+'% return · ':'')+cnt(t.n,'entry','entries')+'</span></span>'+
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
  paint(){const i=this.i,p=palN(i);plEl.querySelectorAll('.st').forEach((s,k)=>s.classList.toggle('on',k===i));plEl.style.setProperty('--pink',SS[i]&&SS[i].dark?'#fff':p.ink);
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
// v50.7: the background is painted straight onto the picture (color or gradient, the pattern, the faded card art and its
// shading), instead of going through the page-to-picture step. Safari often leaves those out of that step; painting them
// directly works the same in every browser. Words, numbers and the card on top still come from the page.
function cssGrad(c,css,W,H){css=String(css||'').trim();if(!css||css==='none')return;
  const m=/^linear-gradient\((.*)\)$/s.exec(css);if(!m){c.fillStyle=css;c.fillRect(0,0,W,H);return}
  const parts=[];let d=0,cur='';for(const ch of m[1]){if(ch==='(')d++;if(ch===')')d--;if(ch===','&&!d){parts.push(cur.trim());cur=''}else cur+=ch}parts.push(cur.trim());
  let ang=180;if(/deg$/.test(parts[0])){ang=parseFloat(parts.shift())}else if(/^to /.test(parts[0])){const t=parts.shift();ang={'to top':0,'to right':90,'to bottom':180,'to left':270}[t]??180}
  const r=(ang-90)*Math.PI/180,len=Math.abs(W*Math.cos(r))+Math.abs(H*Math.sin(r)),cx=W/2,cy=H/2,dx=Math.cos(r)*len/2,dy=Math.sin(r)*len/2,g=c.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);
  const st=parts.map(x=>{const mm=/^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(x);return {col:mm[1].trim(),at:mm[2]!=null?+mm[2]/100:null}});
  st.forEach((x,i)=>{if(x.at==null)x.at=i===0?0:i===st.length-1?1:null});for(let i=1;i<st.length-1;i++)if(st[i].at==null){let j=i;while(st[j].at==null)j++;const a=st[i-1].at,b=st[j].at;for(let k=i;k<j;k++)st[k].at=a+(b-a)*(k-i+1)/(j-i+1)}
  st.forEach(x=>{try{g.addColorStop(Math.max(0,Math.min(1,x.at)),x.col)}catch(e){}});c.fillStyle=g;c.fillRect(0,0,W,H)}
const loadImg=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src});
async function paintBg(el,R){const W=360*R,H=640*R,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');c.scale(R,R);
  const bgl=el.querySelector('.bgl');
  if(bgl){cssGrad(c,bgl.style.background||getComputedStyle(bgl).backgroundColor,360,640);
    if(bgl.tagName.toLowerCase()==='svg'){const x=bgl.cloneNode(true);/* keep each shape's settled look (the page's styles don't travel with the picture) */{const A=[...bgl.querySelectorAll('*')],B=[...x.querySelectorAll('*')];A.forEach((e,i)=>{const cs=getComputedStyle(e),b=B[i];if(!b)return;let st='';if(cs.transform&&cs.transform!=='none')st+='transform-box:'+cs.transformBox+';transform-origin:'+cs.transformOrigin+';transform:'+cs.transform+';';if(cs.opacity!=='1')st+='opacity:'+cs.opacity+';';if(st)b.setAttribute('style',(b.getAttribute('style')||'')+';'+st)})}x.removeAttribute('style');x.removeAttribute('class');x.setAttribute('xmlns','http://www.w3.org/2000/svg');x.setAttribute('width','360');x.setAttribute('height','640');
      const im=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(x)));c.drawImage(im,0,0,360,640)}}
  const sf=el.querySelector('.sfull');
  if(sf){c.fillStyle=getComputedStyle(sf).backgroundColor||'#0d0c0b';c.fillRect(0,0,360,640);const img=sf.querySelector('img');
    if(img&&img.naturalWidth){const cs=getComputedStyle(img),iw=img.naturalWidth,ih=img.naturalHeight,k=Math.max(360/iw,640/ih),dw=iw*k,dh=ih*k;
      const op=(cs.objectPosition||'50% 20%').split(/\s+/).map(v=>parseFloat(v)/100),dx=(360-dw)*(isNaN(op[0])?.5:op[0]),dy=(640-dh)*(isNaN(op[1])?.2:op[1]);
      const mt=/matrix\(([^)]+)\)/.exec(cs.transform||''),sc=mt?parseFloat(mt[1].split(',')[0]):1,org=(cs.transformOrigin||'180px 140px').split(/\s+/).map(parseFloat);
      c.save();c.globalAlpha=+cs.opacity||1;c.translate(org[0],org[1]);c.scale(sc,sc);c.translate(-org[0],-org[1]);c.drawImage(img,dx,dy,dw,dh);c.restore()}
    cssGrad(c,getComputedStyle(sf,'::after').backgroundImage,360,640)}
  return cv}
const FGCSS='#xhost .xst.fg-only .bgl,#xhost .xst.fg-only .sfull{visibility:hidden!important}#xhost .xst.fg-only .st{background:transparent!important}#xhost .xst.only-text .sfull,#xhost .xst.only-vis .sfull{visibility:hidden!important}';
{const st=document.createElement('style');st.textContent=FGCSS;document.head.appendChild(st)}
// v50.6: card pictures are copied into the story before it's drawn, so saved images and videos always include them (some
// browsers, Safari above all, quietly leave out pictures from another address, like the card art server)
const IMGDATA=new Map();
async function inlineImgs(root){await Promise.all([...root.querySelectorAll('img')].map(async i=>{const s=i.getAttribute('src');if(!s||/^(data|blob):/.test(s))return;
  try{let d=IMGDATA.get(s);if(!d){const r=await fetch(s,{mode:'cors',credentials:'omit',cache:'reload'});if(!r.ok)throw 0;const b=await r.blob();d=await new Promise((ok,no)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=no;fr.readAsDataURL(b)});if(IMGDATA.size>60)IMGDATA.clear();IMGDATA.set(s,d)}
    i.src=d;if(i.decode)await i.decode().catch(()=>{})}catch(e){}}))}
storyBlob=async function(n){const h=await lib(),host=$('xhost');host.innerHTML='';const el=document.createElement('div');el.className='xst';el.innerHTML=stHTML(SS[n],n,true);host.appendChild(el);await inlineImgs(el);
  const imgs=[...el.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));try{await document.fonts.ready}catch(e){}
  const fc=await fontCSS();
  try{const bg=await paintBg(el,3);el.classList.add('fg-only');const o2={pixelRatio:3,width:360,height:640,cacheBust:false,fontEmbedCSS:fc};let fg=await h.toCanvas(el,o2);if(isSafari)fg=await h.toCanvas(el,o2);
    const c=bg.getContext('2d');c.setTransform(1,0,0,1,0,0);c.drawImage(fg,0,0,bg.width,bg.height);const b=await new Promise(r=>bg.toBlob(r,'image/png'));if(b){host.innerHTML='';return b}}catch(e){console.warn('story background',e)}
  el.classList.remove('fg-only');const opt={pixelRatio:3,width:360,height:640,cacheBust:false,backgroundColor:'#000',fontEmbedCSS:fc};let b=await h.toBlob(el,opt);if(isSafari)b=await h.toBlob(el,opt);host.innerHTML='';return b};
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
async function storyVideoSimple(n,onTick){const h=await lib(),host=$('xhost');host.innerHTML='';const el=document.createElement('div');el.className='xst';el.innerHTML=stHTML(SS[n],n,true);host.appendChild(el);await inlineImgs(el);
  const imgs=[...el.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));try{await document.fonts.ready}catch(e){}
  const fam=await canvasFont(),fc=await fontCSS(),R=3,W=1080,H=1920,box=el.getBoundingClientRect(),rel=q=>{const r=q.getBoundingClientRect();return {x:(r.left-box.left)*R,y:(r.top-box.top)*R,w:r.width*R,h:r.height*R}};
  const big=el.querySelector('.sbig [data-count]'),bigBox=big&&rel(big.parentElement),bigCS=big&&(()=>{const cs=getComputedStyle(big.parentElement);return {color:cs.color,fontSize:cs.fontSize}})(),vis=el.querySelector('.svis'),visBox=vis&&rel(vis),stk=el.querySelector('.stick'),stkBox=stk&&rel(stk);
  const layer=async cls=>{el.className='xst '+cls;return h.toCanvas(el,{pixelRatio:R,width:360,height:640,cacheBust:false,fontEmbedCSS:fc})};
  let bgP=null;try{bgP=await paintBg(el,R)}catch(e){}
  const L={bg:bgP||await layer('only-bg'),text:await layer('only-text'),vis:vis?await layer('only-vis'):null,stick:stk?await layer('only-stick'):null};
  if(isSafari){if(!bgP)L.bg=await layer('only-bg');if(vis)L.vis=await layer('only-vis')}// Safari can leave images out of the first pass
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
    saveReady([{name,blob:b}],share)}catch(e){console.error(e);pl.toast('Couldn’t make the video. Try again.')}finally{$('xhost').innerHTML=''}}
// ---------- v50.26 videos with each story's own motion ----------
// A web page can't screen-record itself, so the video is rebuilt on a canvas. Before, the whole picture moved as one
// piece with the same simple motion on every story. Now every part that moves in the app (each wall column, each card,
// dot, bar, page, background shape and the counting numbers) is cut out on its own, and the story's real animation is
// replayed on a hidden copy to read, frame by frame, where each part is, how it's turned and how faded. The canvas then
// redraws the parts in those places while the phone records, so the video moves the way the story does in the app.
const VPAD=24,VFPS=30;
const vM=(a,b,c,d,e,f)=>({a,b,c,d,e,f});
const vMul=(m,n)=>vM(m.a*n.a+m.c*n.b,m.b*n.a+m.d*n.b,m.a*n.c+m.c*n.d,m.b*n.c+m.d*n.d,m.a*n.e+m.c*n.f+m.e,m.b*n.e+m.d*n.f+m.f);
const vInv=m=>{const det=m.a*m.d-m.b*m.c||1e-9;return vM(m.d/det,-m.b/det,-m.c/det,m.a/det,(m.c*m.f-m.d*m.e)/det,(m.b*m.e-m.a*m.f)/det)};
const vDom=x=>vM(x.a,x.b,x.c,x.d,x.e,x.f);
// where an SVG shape's own CSS transform puts it, in the drawing's units
function vSvgU(S){const cs=getComputedStyle(S),tf=cs.transform,m=tf&&tf!=='none'?vDom(new DOMMatrix(tf)):vM(1,0,0,1,0,0);
  const o=String(cs.transformOrigin||'0 0').split(/\s+/).map(parseFloat);let ox=o[0]||0,oy=o[1]||0;if(cs.transformBox==='fill-box'){try{const b=S.getBBox();ox+=b.x;oy+=b.y}catch(e){}}
  return vMul(vMul(vM(1,0,0,1,ox,oy),m),vM(1,0,0,1,-ox,-oy))}
// how an SVG's drawing units map onto the story (its viewBox, fit and position), worked out from its attributes
function vViewM(svg,sr){const r=svg.getBoundingClientRect(),bx=r.left-sr.left,by=r.top-sr.top,bw=r.width,bh=r.height,vb=svg.viewBox&&svg.viewBox.baseVal;
  if(!vb||!vb.width||!vb.height)return vM(1,0,0,1,bx,by);const par=(svg.getAttribute('preserveAspectRatio')||'xMidYMid meet').trim().split(/\s+/),al=par[0],sl=par[1]==='slice';
  if(al==='none')return vM(bw/vb.width,0,0,bh/vb.height,bx-vb.x*bw/vb.width,by-vb.y*bh/vb.height);
  const sc=sl?Math.max(bw/vb.width,bh/vb.height):Math.min(bw/vb.width,bh/vb.height),ax=/xMin/.test(al)?0:/xMax/.test(al)?1:.5,ay=/YMin/.test(al)?0:/YMax/.test(al)?1:.5;
  return vM(sc,0,0,sc,bx+(bw-vb.width*sc)*ax-vb.x*sc,by+(bh-vb.height*sc)*ay-vb.y*sc)}
async function storyVideoLive(n,onTick){const h=await lib(),host=$('xhost');host.innerHTML='';
  const mk=live=>{const d=document.createElement('div');d.className='xst'+(live?' xlive':'');d.innerHTML=stHTML(SS[n],n,true);host.appendChild(d);return d};
  const el=mk(false),tw=mk(true);await inlineImgs(el);
  const imgs=[...el.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));try{await document.fonts.ready}catch(e){}
  // pictures can't hold the invisible corner points, so on the hidden copy each one becomes a plain box of the same size
  // (it keeps the picture's place, size, still styling and its animation)
  {const ei=[...el.querySelectorAll('img')];[...tw.querySelectorAll('img')].forEach((im,i)=>{const e=ei[i],d=document.createElement('div'),cs=getComputedStyle(im);[...im.attributes].forEach(at=>{if(at.name!=='src'&&at.name!=='srcset')d.setAttribute(at.name,at.value)});
    ['position','top','left','right','bottom','marginTop','marginLeft','marginRight','marginBottom','transform','transformOrigin','opacity','zIndex','display','boxSizing','backfaceVisibility','translate','rotate','scale'].forEach(k=>{try{d.style[k]=cs[k]}catch(x){}});
    if(e){d.style.width=e.offsetWidth+'px';d.style.height=e.offsetHeight+'px'}const an=im.getAnimations().map(a=>({k:a.effect.getKeyframes(),t:a.effect.getTiming()}));im.replaceWith(d);an.forEach(a=>{try{d.animate(a.k,a.t)}catch(x){}})})}
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));fitSt(el.querySelector('.st'));fitSt(tw.querySelector('.st'));
  const fam=await canvasFont(),fc=await fontCSS(),R=3,W=1080,H=1920,T=8.2;
  const stE=el.querySelector('.st'),stT=tw.querySelector('.st'),allE=[...el.querySelectorAll('*')],allT=[...tw.querySelectorAll('*')],ix=new Map();allT.forEach((x,i)=>ix.set(x,i));
  const E_=t=>allE[ix.get(t)];
  const anims=tw.getAnimations({subtree:true}).filter(a=>a.effect&&a.effect.target&&!a.effect.pseudoElement&&stT.contains(a.effect.target));
  anims.forEach(a=>{try{a.pause()}catch(e){}});const seek=t=>{for(const a of anims){try{a.currentTime=t*1000}catch(e){}}};seek(0);
  const targets=[...new Set(anims.map(a=>a.effect.target))].filter(x=>ix.has(x));
  const isSvgKid=x=>x instanceof SVGElement&&x.tagName.toLowerCase()!=='svg';
  const bgKids=targets.filter(x=>isSvgKid(x)&&x.closest('.bgl')),svgKids=targets.filter(x=>isSvgKid(x)&&!x.closest('.bgl'));
  const full=targets.find(x=>x.parentElement&&x.parentElement.classList.contains('sfull'));
  const htmlT=targets.filter(x=>!(x instanceof SVGElement)&&x!==full);
  // parts that sit over a moving part (a later sibling, or one placed above it) are cut out too, so they stay on top
  const statics=new Set();htmlT.forEach(t=>{if(!t.closest('.svis')||t.classList.contains('svis'))return;const z=x=>parseInt(getComputedStyle(x).zIndex)||0,zt=z(t);let after=false;
    for(const s of t.parentElement.children){if(s===t){after=true;continue}if(targets.includes(s)||s.tagName.startsWith('X-')||targets.some(x=>s.contains(x)))continue;if(after||z(s)>zt)statics.add(s)}});
  const pm=stT.querySelector('.pmark');
  const counts=[...stT.querySelectorAll('[data-count]')];
  // ---- probes: three invisible points inside a part tell where its corners are on the hidden copy, frame by frame
  const probed=new Map();
  function probe(t){if(probed.has(t))return probed.get(t);const cs=getComputedStyle(t);if(cs.display==='none'||!t.offsetParent&&cs.position!=='fixed'){probed.set(t,null);return null}
    if(cs.display==='inline'&&!(t.matches('[data-count]')))t.style.display='inline-block';
    let expl=cs.position!=='static';if(!expl&&![...t.querySelectorAll('*')].some(d=>/absolute|fixed/.test(getComputedStyle(d).position))){t.style.position='relative';expl=true}
    const w=t.offsetWidth,hh=t.offsetHeight,bl=t.clientLeft,bt=t.clientTop,pl=parseFloat(cs.paddingLeft)||0,pt=parseFloat(cs.paddingTop)||0;
    const mp=(x,y)=>{const i=document.createElement('x-pb');i.style.cssText='position:absolute;width:0;height:0;margin:0;padding:0;border:0;display:block;'+(expl?'left:'+(x-bl)+'px;top:'+(y-bt)+'px':'margin-left:'+(x-bl-pl)+'px;margin-top:'+(y-bt-pt)+'px');expl?t.appendChild(i):t.insertBefore(i,t.firstChild);return i};
    const o={w,h:hh,p:[mp(0,0),mp(w,0),mp(0,hh)]};probed.set(t,o);return o}
  const quad=o=>{const sr=stT.getBoundingClientRect(),q=o.p.map(p=>{const r=p.getBoundingClientRect();return [r.left-sr.left,r.top-sr.top]});return vM((q[1][0]-q[0][0])/o.w,(q[1][1]-q[0][1])/o.w,(q[2][0]-q[0][0])/o.h,(q[2][1]-q[0][1])/o.h,q[0][0],q[0][1])};
  const alphaOf=t=>{let a=1;for(let x=t;x&&x!==tw;x=x.parentElement){a*=parseFloat(getComputedStyle(x).opacity);if(!a)return 0}return a};
  const clipAncs=t=>{const L=[];for(let x=t.parentElement;x&&x!==stT;x=x.parentElement){const cs=getComputedStyle(x);if(cs.overflowX!=='visible'||cs.overflowY!=='visible')L.push(x)}return L};
  const maskAnc=t=>{for(let x=t.parentElement;x&&x!==stT;x=x.parentElement){const m=getComputedStyle(x).maskImage||getComputedStyle(x).webkitMaskImage;if(m&&m!=='none'&&/linear-gradient/.test(m))return x}return null};
  // ---- layers, in paint order
  const L=[];
  const order=x=>ix.get(x);
  [...htmlT.map(t=>({k:'html',t})),...[...statics].map(t=>({k:'html',t,st:1})),...counts.map(t=>({k:'count',t})),...svgKids.map(t=>({k:'svg',t}))].forEach(o=>L.push(o));
  L.sort((x,y)=>order(x.t)-order(y.t));
  // siblings: a higher z-index paints later
  const zi=x=>{const cs=getComputedStyle(x);return cs.position!=='static'?parseInt(cs.zIndex)||0:0};
  L.sort((x,y)=>{if(x.t.parentElement===y.t.parentElement){const d=zi(x.t)-zi(y.t);if(d)return d}return order(x.t)-order(y.t)});
  if(pm)L.push({k:'html',t:pm,st:1,top:1});
  // hide what each layer will draw from the base picture, and the numbers that count up
  const layerSet=new Set(L.map(o=>o.t));
  counts.forEach(t=>{const e=E_(t);e.style.color='transparent';e.style.webkitTextFillColor='transparent'});
  const hideE=new Set(L.filter(o=>o.k!=='count').map(o=>E_(o.t)));svgKids.forEach(t=>hideE.add(E_(t)));
  // ---- snapshots
  const visOff=(nodes,fn)=>{const keep=nodes.map(x=>[x,x.style.visibility]);nodes.forEach(x=>x.style.visibility='hidden');return Promise.resolve(fn()).finally(()=>keep.forEach(([x,v])=>x.style.visibility=v))};
  // background (still parts), then each moving background shape on its own
  const bgSvg=el.querySelector('svg.bgl'),bgUnder=document.createElement('canvas');bgUnder.width=W;bgUnder.height=H;{const c=bgUnder.getContext('2d');c.scale(R,R);const bgl=el.querySelector('.bgl');if(bgl)cssGrad(c,bgl.style.background||getComputedStyle(bgl).backgroundColor,360,640);}
  const svgImg=async(svg,keep)=>{const x=svg.cloneNode(true),A=[...svg.querySelectorAll('*')],B=[...x.querySelectorAll('*')];
    A.forEach((e,i)=>{const b=B[i];if(!b)return;if(keep&&!keep(e)&&!e.closest('defs')&&!A.some(k=>keep(k)&&(k.contains(e)||e.contains(k)))){b.remove();return}const cs=getComputedStyle(e);let st='';if(cs.transform&&cs.transform!=='none')st+='transform-box:'+cs.transformBox+';transform-origin:'+cs.transformOrigin+';transform:'+cs.transform+';';if(cs.opacity!=='1'&&!(keep&&keep(e)))st+='opacity:'+cs.opacity+';';if(st)b.setAttribute('style',(b.getAttribute('style')||'')+';'+st)});
    x.removeAttribute('style');x.removeAttribute('class');x.setAttribute('xmlns','http://www.w3.org/2000/svg');const r=svg.getBoundingClientRect();x.setAttribute('width',r.width);x.setAttribute('height',r.height);
    const im=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(x)));const cv=document.createElement('canvas');cv.width=Math.round(r.width*R);cv.height=Math.round(r.height*R);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);return cv};
  const bgL=[];
  if(bgSvg){const animE=new Set(bgKids.map(E_));const still=await svgImg(bgSvg,e=>!animE.has(e)&&![...animE].some(a=>a.contains(e)||e.contains(a)));bgUnder.getContext('2d').drawImage(still,0,0,W,H);
    for(const t of bgKids){const e=E_(t);bgL.push({t,cv:await svgImg(bgSvg,x=>x===e),U0:vSvgU(e)})}}
  const sfE=el.querySelector('.sfull');let fullL=null,fullAfter=null,sfColor=null;
  if(sfE){sfColor=getComputedStyle(sfE).backgroundColor||'#0d0c0b';const img=sfE.querySelector('img');
    if(img&&img.naturalWidth){const cs=getComputedStyle(img),bw=img.offsetWidth,bh=img.offsetHeight,cv=document.createElement('canvas');cv.width=Math.round(bw*R);cv.height=Math.round(bh*R);const c=cv.getContext('2d');c.scale(R,R);
      const iw=img.naturalWidth,ih=img.naturalHeight,k=Math.max(bw/iw,bh/ih),dw=iw*k,dh=ih*k,op=(cs.objectPosition||'50% 20%').split(/\s+/).map(v=>parseFloat(v)/100);c.drawImage(img,(bw-dw)*(isNaN(op[0])?.5:op[0]),(bh-dh)*(isNaN(op[1])?.2:op[1]),dw,dh);
      fullL={t:full||stT.querySelector('.sfull > *'),cv,w:bw,h:bh}}
    const af=getComputedStyle(sfE,'::after').backgroundImage;if(af&&af!=='none'){fullAfter=document.createElement('canvas');fullAfter.width=W;fullAfter.height=H;const c=fullAfter.getContext('2d');c.scale(R,R);cssGrad(c,af,360,640)}}
  // the still words and pictures, with every moving part left out
  el.classList.add('fg-only');
  const baseOpt={pixelRatio:R,width:360,height:640,cacheBust:false,fontEmbedCSS:fc};let base=await visOff([...hideE],()=>h.toCanvas(el,baseOpt));if(isSafari)base=await visOff([...hideE],()=>h.toCanvas(el,baseOpt));// Safari can leave pictures out of the first pass
  // each moving part on its own (parts inside it that move separately are left out of its picture)
  for(const o of L){if(o.k==='count'){o.e=E_(o.t);o.pb=probe(o.t);continue}
    if(o.k==='svg'){const root=o.t.ownerSVGElement,rootE=E_(root),me=E_(o.t),others=[...rootE.querySelectorAll('*')].filter(x=>x!==me&&!x.contains(me)&&!me.contains(x)&&!x.closest('defs')&&x.tagName.toLowerCase()!=='defs');
      o.root=root;o.U0=vSvgU(E_(o.t));const r=rootE.getBoundingClientRect();o.rw=r.width;o.rh=r.height;
      const eo=E_(o.t),ko=eo.style.opacity;eo.style.opacity='1';const sopt=()=>h.toCanvas(rootE,{pixelRatio:R,width:r.width+2*VPAD,height:r.height+2*VPAD,cacheBust:false,fontEmbedCSS:fc,style:{margin:VPAD+'px',transform:'none',opacity:'1',visibility:'visible',position:'relative',left:'0',top:'0',width:r.width+'px',height:r.height+'px'}});o.cv=await visOff(others,sopt);if(isSafari)o.cv=await visOff(others,sopt);eo.style.opacity=ko;
      const ds=getComputedStyle(o.t).strokeDasharray;o.dash=ds&&ds!=='none';try{const b=o.t.getBBox(),sw=parseFloat(getComputedStyle(o.t).strokeWidth)||0;o.bb={x:b.x-sw,y:b.y-sw,w:b.width+2*sw,h:b.height+2*sw}}catch(e){}
      continue}
    const e=E_(o.t);o.pb=probe(o.t);if(!o.pb){o.skip=1;continue}o.clips=clipAncs(o.t).map(c=>({c,pb:probe(c)})).filter(x=>x.pb);o.mask=maskAnc(o.t);if(o.mask){o.mpb=probe(o.mask);const mc=getComputedStyle(o.mask);o.mi=mc.maskImage||mc.webkitMaskImage}
    o.back=getComputedStyle(o.t).backfaceVisibility==='hidden';
    const inner=[...hideE].filter(x=>x!==e&&e.contains(x)),w=o.pb.w,hh=o.pb.h;
    if(!w||!hh){o.skip=1;continue}
    // content that runs past the part's box (a wall column's cards) is kept in its picture
    const sw=o.sw=Math.max(w,e.scrollWidth||0),sh=o.sh=Math.max(hh,e.scrollHeight||0);
    o.cv=await visOff(inner,()=>h.toCanvas(e,{pixelRatio:R,width:sw+2*VPAD,height:sh+2*VPAD,cacheBust:false,fontEmbedCSS:fc,style:{margin:VPAD+'px',transform:'none',translate:'none',rotate:'none',scale:'none',opacity:'1',visibility:'visible',position:'relative',left:'0',top:'0',right:'auto',bottom:'auto',width:w+'px',height:hh+'px',boxSizing:'border-box',display:getComputedStyle(e).display==='inline'?'inline-block':getComputedStyle(e).display,animation:'none',flex:'none'}}));
    if(isSafari)o.cv=await visOff(inner,()=>h.toCanvas(e,{pixelRatio:R,width:sw+2*VPAD,height:sh+2*VPAD,cacheBust:false,fontEmbedCSS:fc,style:{margin:VPAD+'px',transform:'none',translate:'none',rotate:'none',scale:'none',opacity:'1',visibility:'visible',position:'relative',left:'0',top:'0',right:'auto',bottom:'auto',width:w+'px',height:hh+'px',boxSizing:'border-box',animation:'none',flex:'none'}}))}
  if(fullL)fullL.pb=probe(fullL.t);
  // counting numbers: how each is drawn
  for(const o of L.filter(o=>o.k==='count')){const cs=getComputedStyle(o.e),pc=getComputedStyle(o.e.parentElement);o.font=cs.fontStyle+' '+cs.fontWeight+' '+parseFloat(cs.fontSize)*R+'px '+fam+','+cs.fontFamily;o.col=cs.webkitTextFillColor&&cs.webkitTextFillColor!=='transparent'&&!/rgba\(0, 0, 0, 0\)/.test(cs.webkitTextFillColor)?cs.webkitTextFillColor:getComputedStyle(o.t).color;o.ls=parseFloat(cs.letterSpacing)||0;o.align=/right|end/.test(pc.textAlign)?'right':pc.textAlign==='center'?'center':'left';
    o.to=+o.t.dataset.count;o.pre=o.t.dataset.pre||'';o.suf=o.t.dataset.suf||'';o.d=+(o.t.dataset.d||0);o.dur=+(o.t.dataset.dur||1300)}
  // ---- read every frame from the hidden copy
  const N=Math.ceil(T*VFPS)+1,FR=[];
  for(let f=0;f<N;f++){const t=f/VFPS;seek(t);const fr={L:[],bg:[],full:null};
    for(const o of L){if(o.skip||!o.cv&&o.k!=='count'){fr.L.push(null);continue}
      if(o.k==='svg'){const root=o.root,sr=stT.getBoundingClientRect(),rr=root.getBoundingClientRect();
        const Mu=vViewM(root,sr),V=vMul(vM(1,0,0,1,-(rr.left-sr.left),-(rr.top-sr.top)),Mu);const Ud=vMul(vSvgU(o.t),vInv(o.U0));
        fr.L.push({m:vMul(vMul(Mu,Ud),vInv(V)),mu:vMul(Mu,Ud),a:alphaOf(o.t),dash:o.dash?Math.max(0,Math.min(1,1-(parseFloat(getComputedStyle(o.t).strokeDashoffset)||0))):1});continue}
      const m=quad(o.pb),a=alphaOf(o.t);
      fr.L.push({m,a:o.back&&(m.a*m.d-m.b*m.c)<0?0:a,clips:o.clips?o.clips.map(c=>quad(c.pb)):[],mk:o.mpb?quad(o.mpb):null})}
    if(bgSvg){const sr=stT.getBoundingClientRect(),bgT=stT.querySelector('svg.bgl'),V=bgT?vViewM(bgT,sr):vM(1,0,0,1,0,0);
      bgL.forEach(b=>{const Ud=vMul(vSvgU(b.t),vInv(b.U0));fr.bg.push({m:vMul(vMul(V,Ud),vInv(V)),a:alphaOf(b.t)})})}
    if(fullL&&fullL.pb)fr.full={m:quad(fullL.pb),a:alphaOf(fullL.t)};
    FR.push(fr)}
  host.innerHTML='';
  // ---- play it back on a canvas while recording
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  const grp=document.createElement('canvas');grp.width=W;grp.height=H;const g=grp.getContext('2d');
  const poly=(cx,m,w,hh)=>{cx.beginPath();const P=[[0,0],[w,0],[w,hh],[0,hh]].map(([x,y])=>[(m.a*x+m.c*y+m.e)*R,(m.b*x+m.d*y+m.f)*R]);cx.moveTo(P[0][0],P[0][1]);P.slice(1).forEach(p=>cx.lineTo(p[0],p[1]));cx.closePath()};
  function drawLayer(cx,o,s,t){if(!s||!s.a)return;cx.save();cx.globalAlpha=Math.min(1,s.a);
    if(o.k==='svg'){cx.setTransform(1,0,0,1,0,0);if(s.dash<1&&o.bb){const m=s.mu;cx.setTransform(m.a*R,m.b*R,m.c*R,m.d*R,m.e*R,m.f*R);cx.beginPath();cx.rect(o.bb.x,o.bb.y-50,o.bb.w*s.dash,o.bb.h+100);cx.clip()}
      const m=s.m;cx.setTransform(m.a*R,m.b*R,m.c*R,m.d*R,m.e*R,m.f*R);cx.drawImage(o.cv,-VPAD,-VPAD,o.rw+2*VPAD,o.rh+2*VPAD);cx.restore();return}
    (s.clips||[]).forEach((q,i)=>{const pb=o.clips[i].pb;cx.setTransform(1,0,0,1,0,0);poly(cx,q,pb.w,pb.h);cx.clip()});
    const m=s.m;cx.setTransform(m.a*R,m.b*R,m.c*R,m.d*R,m.e*R,m.f*R);
    if(o.k==='count'){const k=Math.max(0,Math.min(1,(t*1000-o.d)/o.dur)),v=o.to*(1-Math.pow(1-k,2)),txt=o.pre+NFR.format(Math.round(v))+o.suf;cx.setTransform(m.a,m.b,m.c,m.d,m.e*R,m.f*R);cx.font=o.font;cx.fillStyle=o.col;try{cx.letterSpacing=o.ls*R+'px'}catch(e){}
      const met=cx.measureText(txt),asc=met.fontBoundingBoxAscent!=null?met.fontBoundingBoxAscent:parseFloat(o.font.split(' ')[2])*.8;cx.textBaseline='alphabetic';cx.textAlign=o.align;cx.fillText(txt,o.align==='right'?o.pb.w*R:o.align==='center'?o.pb.w*R/2:0,asc);cx.restore();return}
    cx.drawImage(o.cv,-VPAD,-VPAD,(o.sw||o.pb.w)+2*VPAD,(o.sh||o.pb.h)+2*VPAD);cx.restore()}
  function frame(t){const fr=FR[Math.min(FR.length-1,Math.round(t*VFPS))];c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.clearRect(0,0,W,H);c.drawImage(bgUnder,0,0);
    bgL.forEach((b,i)=>{const s=fr.bg[i];if(!s||!s.a)return;c.save();c.globalAlpha=s.a;const m=s.m;c.setTransform(m.a*R,m.b*R,m.c*R,m.d*R,m.e*R,m.f*R);c.drawImage(b.cv,0,0,360,640);c.restore()});
    if(sfColor){c.fillStyle=sfColor;c.fillRect(0,0,W,H)}
    if(fullL&&fr.full&&fr.full.a){c.save();c.globalAlpha=fr.full.a;const m=fr.full.m;c.setTransform(m.a*R,m.b*R,m.c*R,m.d*R,m.e*R,m.f*R);c.drawImage(fullL.cv,0,0,fullL.w,fullL.h);c.restore()}
    if(fullAfter)c.drawImage(fullAfter,0,0);
    c.drawImage(base,0,0,W,H);
    for(let i=0;i<L.length;){const o=L[i];
      if(o.mask){const mkA=o.mask;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);let j=i,ms=null;while(j<L.length&&L[j].mask===mkA){const s=fr.L[j];if(s&&s.mk)ms=s.mk;drawLayer(g,L[j],s,t);j++}
        if(ms){const pb=o.mpb,mi=o.mi;g.save();g.globalCompositeOperation='destination-in';g.setTransform(ms.a*R,ms.b*R,ms.c*R,ms.d*R,ms.e*R,ms.f*R);cssGradMask(g,mi,pb.w,pb.h);g.restore();
          g.save();g.globalCompositeOperation='destination-in';g.setTransform(1,0,0,1,0,0);poly(g,ms,pb.w,pb.h);g.fillStyle='#000';g.fill();g.restore()}
        c.setTransform(1,0,0,1,0,0);c.drawImage(grp,0,0);i=j;continue}
      drawLayer(c,o,fr.L[i],t);i++}}
  frame(0);const stream=cv.captureStream(30),rec=new MediaRecorder(stream,{mimeType:VMIME,videoBitsPerSecond:6e6}),chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  const done=new Promise(r=>{rec.onstop=r});rec.start(250);const t0=performance.now();
  await new Promise(res=>{(function step(){const t=(performance.now()-t0)/1000;frame(Math.min(T,t));onTick&&onTick(t/T);if(t<T+.15)requestAnimationFrame(step);else res()})()});
  rec.stop();await done;stream.getTracks().forEach(tr=>tr.stop());return new Blob(chunks,{type:VMIME.split(';')[0]})}
// a CSS mask gradient (clear to solid) painted as a canvas mask over a part's box
function cssGradMask(c,css,w,hh){const s=String(css||'').replace(/rgba?\(0, 0, 0(, 1)?\)|#000\b|black/g,'rgba(0,0,0,1)');cssGrad(c,s,w,hh)}

// the video: each story's own motion; if anything goes wrong, the simpler one-piece version
async function storyVideo(n,onTick){try{return await storyVideoLive(n,onTick)}catch(e){console.warn('story video (pieces)',e);return storyVideoSimple(n,onTick)}}
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
const themeOK=i=>!isFree()||freeThemes().includes(i),bgOK=b=>!isFree()||BG_FREE.includes(b);
// themes: free users see their two in the chips; the sheet shows the rest with a lock
const _paintChips=paintChips;paintChips=function(){_paintChips();if(!isFree())return;const f=freeThemes(),el=$('thm');if(!themeOK(th))th=f[1];
  el.innerHTML=f.map(i=>'<button class="tchip" aria-pressed="'+(i===th)+'" data-i="'+i+'"><span class="tsw">'+sw(TH[i])+'</span>'+TH[i][0]+'</button>').join('')+'<button class="tchip more" data-all><span class="rbw" aria-hidden="true"></span>All themes</button>'};
const _pg2=paintGrid;paintGrid=function(){_pg2();if(!isFree())return;$('tgrid').querySelectorAll('[data-i]').forEach(b=>{if(!themeOK(+b.dataset.i)){b.classList.add('lockd');b.setAttribute('aria-disabled','true');b.insertAdjacentHTML('beforeend','<em class="lk" title="Premium"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg></em>')}else if(+b.dataset.i===freeThemes()[1])b.insertAdjacentHTML('beforeend','<em class="tm">This month</em>')})};
$('tgrid').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b||themeOK(+b.dataset.i))return;e.stopImmediatePropagation();$('ths-s').textContent='All 24 themes come with Premium. Free includes Jewel and a theme of the month picked from your profile color.';$('ths-s').classList.add('msg')},true);
const _setTheme2=setTheme;setTheme=function(i){if(!themeOK(i)){try{parent.CTPremiumOpen&&parent.CTPremiumOpen('locked theme')}catch(e){}return}_setTheme2(i)};
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
// the cardtab.app mark: Premium gets plain text in the lower right; free keeps the highlight up top
const _stHTML=stHTML;stHTML=function(s,i,on){let h=_stHTML(s,i,on);if(!isFree()){const p=palN(i);h=h.replace(/<div class="brand">[\s\S]*?<\/div>/,'').replace('<div class="sin">','<div class="sin"><span class="pmark" style="color:'+p.ink+'">cardtab.app</span>')}return h};
// keep the plan in step when it changes (Premium turned on or off)
const _cs2=window.csSync;window.csSync=function(){_cs2();paintChips();paintShelf();tellParent()};
paintChips();paintShelf();
// ================= v39.2 Free downloads: Clean background, one image a month (video is Premium, below) =================
// Free users can look at their stories with Blobs in the app; anything they save or share is drawn on Clean.
// They get one image each month, counted in the account and reset with their 20 free entries.
const fUse=()=>{try{const m=parent.CTStore.meta('storiesFree');return m&&m.month===ym()?m:{month:ym(),video:0,image:0}}catch(e){return {month:ym(),video:0,image:0}}};
const fLeft=k=>isFree()?Math.max(0,1-(fUse()[k]||0)):Infinity;
async function fBump(k){if(!isFree())return;try{const m=fUse();m[k]=(m[k]||0)+1;await parent.CTStore.setMeta('storiesFree',m)}catch(e){}}
const resetOn=()=>{try{return parent.CTStore.usage().resetsOn}catch(e){return 'next month'}};
const withClean=async fn=>{const b=bgStyle;if(isFree())bgStyle='Clean';try{return await fn()}finally{bgStyle=b}};
// images
const _saveStories=saveStories;saveStories=async function(list,share){
  if(isFree()){if(list.length>1){(pl.open?pl.toast.bind(pl):say)('Free includes one image a month. Open a story and tap Share to save it.');return}
    if(fLeft('image')<1){(pl.open?pl.toast.bind(pl):say)('Your free image for '+mName(ym())+' is used. More on '+resetOn()+', or go Premium.');return}}
  await withClean(()=>_saveStories(list,share));if(isFree())await fBump('image')};
// the share sheet says what's left; the background picker says downloads use Clean
pl.build=(b=>function(){b();if(!isFree())return;const n=plEl.querySelector('.pshs .shn');if(n)n.textContent=(fLeft('image')?'1 free image this month':'Free image used this month')+', saved on Clean'})(pl.build.bind(pl));
new MutationObserver(()=>{if(!isFree())return;const r=$('bgrow');if(r&&!r.parentElement.querySelector('.bgnote')){r.insertAdjacentHTML('afterend','<p class="bgnote">On Free, saved images use Clean. Video comes with Premium.</p>')}}).observe($('bgrow'),{childList:true});
// ================= v39.3 Video saving is Premium =================
// Free users watch their stories on Clean or Blobs and save one image a month on Clean; saving or sharing video is Premium.
const openPrem=(c)=>{try{parent.CTPremiumOpen&&parent.CTPremiumOpen(typeof c==='string'?c:'locked story')}catch(e){}};
shareVideo=(orig=>async function(n,share){if(isFree()){pl.toast('Saving video comes with Premium.');openPrem();return}return orig(n,share)})(shareVideo);
pl.build=(b=>function(){b();if(!isFree()||!VMIME)return;const sh=plEl.querySelector('.pshs');if(!sh)return;
  sh.querySelectorAll('[data-shx="vshare"],[data-shx="vsave"]').forEach(x=>x.remove());
  const img=sh.querySelector('[data-shx="share"]');if(img)img.insertAdjacentHTML('beforebegin','<button type="button" class="vlock" data-vprem>Save video <span>Premium</span></button>');
  const n=sh.querySelector('.shn');if(n)n.textContent=(fLeft('image')?'1 free image this month':'Free image used this month')+', saved on Clean · video with Premium'})(pl.build.bind(pl));
plEl.addEventListener('click',e=>{if(!e.target.closest('[data-vprem]'))return;e.stopPropagation();plEl.querySelector('.pshs').hidden=true;openPrem()},true);
// ================= v40 Style panel (wide desktop) + Hide amounts =================
// From 1200px wide, the theme chips give way to a panel beside the stories: a short list of themes (current, recent,
// then popular) with "All 24 themes" for the rest, the background, and Hide amounts. Narrower screens keep the chips
// and the theme sheet, which gets the Hide amounts switch too.
(()=>{
  const LOCKI='<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 10V8A5 5 0 0 0 7 8v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 8a3 3 0 0 1 6 0v2H9z"/></svg>';
  let recent=[];try{recent=JSON.parse(localStorage.getItem('cs.recent'))||[]}catch(e){}
  const _st=setTheme;setTheme=function(i){_st(i);recent=[i].concat(recent.filter(x=>x!==i)).slice(0,6);try{localStorage.setItem('cs.recent',JSON.stringify(recent))}catch(e){}paintPanel()};
  // v48 favorites (starred in the All themes sheet) follow the account; the panel shows 8: current, favorites, recent, popular
  const favs=()=>{try{const v=parent.CTStore.meta('storyFav');return Array.isArray(v)?v.filter(i=>TH[i]):[]}catch(e){return []}};
  window.csFav={get:favs,async toggle(i){const f=favs(),n=f.includes(i)?f.filter(x=>x!==i):[i].concat(f).slice(0,24);try{await parent.CTStore.setMeta('storyFav',n)}catch(e){}paintPanel();if(typeof paintGrid==='function')paintGrid();return n.includes(i)}};
  function shortList(){const out=[th];favs().concat(isFree()?freeThemes():[],recent,TH.map((_,i)=>i)).forEach(i=>{if(out.length<8&&!out.includes(i)&&TH[i])out.push(i)});return out}
  const sw=i=>swCols(TH[i]);
  // the panel sits beside the shelf
  const row=document.createElement('div');row.className='shelfrow';shelf.before(row);row.appendChild(shelf);
  const pan=document.createElement('aside');pan.className='spanel';pan.setAttribute('aria-label','Story style');row.appendChild(pan);
  const swtHTML=id=>'<div class="hrow"><span>Hide amounts<small>Show % instead of $, in saved stories too</small></span><button type="button" class="hswt" role="switch" aria-checked="'+hideAmt+'" data-hide aria-label="Hide amounts"><i></i></button></div>';
  window.paintPanel=paintPanel;function paintPanel(){const f=isFree(),list=shortList();
    const fv=favs(),big=hideAmt?(D.x.roi>=0?'+':'')+D.x.roi+'%':signedS(D.x.t.profit);
    pan.innerHTML='<div class="sph"><h4>Theme</h4><em>'+esc(TH[th][0])+'</em></div><div class="sptg">'+list.map(i=>{const q=fixP(TH[i][1][0]),lk=!themeOK(i);return '<button type="button" class="spt'+(i===th?' on':'')+'" data-i="'+i+'" aria-label="'+esc(TH[i][0])+(lk?', Premium':'')+(fv.includes(i)?', favorite':'')+'" aria-pressed="'+(i===th)+'" title="'+esc(TH[i][0])+'" style="background:'+q.bg+';--a:'+q.acc+';--k:'+q.ink+'"><i class="t"></i><i class="t2"></i><b>'+esc(big)+'</b><span class="nm">'+esc(TH[i][0])+'</span>'+(fv.includes(i)?'<em class="star" aria-hidden="true">★</em>':'')+(lk?'<span class="lk">'+LOCKI+'</span>':'')+(f&&i===freeThemes()[1]?'<span class="tg">This month</span>':'')+'</button>'}).join('')+
      '<button type="button" class="spall" data-all aria-label="All 24 themes">All 24<small>themes</small></button></div>'+(f?'<p class="spnote">Free includes Jewel and a theme of the month. <button type="button" data-prem>All 24 with Premium</button></p>':'')+
      '<div class="sph"><h4>Background</h4></div><div class="spbg" role="radiogroup" aria-label="Background">'+BGS.map(b=>'<button type="button" role="radio" aria-checked="'+(b===bgStyle)+'" data-bg="'+b+'"><span class="bgpv">'+bgSvg(b,palN(0),3,120,80)+'</span><span class="bgn">'+b+(f&&!bgOK(b)?'<span class="lk">'+LOCKI+'</span>':'')+'</span></button>').join('')+'</div>'+swtHTML()}
  window.csSetHide=v=>setHide(v);function setHide(v){hideAmt=v;try{localStorage.setItem('cs.hide',v?'1':'0')}catch(e){}paintShelf();paintPanel();document.querySelectorAll('[data-hide]').forEach(b=>b.setAttribute('aria-checked',v));if(pl.open)pl.build()}
  pan.addEventListener('click',e=>{const t=e.target.closest('[data-i]');if(t){const i=+t.dataset.i;if(!themeOK(i)){openPrem();return}setTheme(i);return}
    if(e.target.closest('[data-all]')){openSheet('ths');return}if(e.target.closest('[data-prem]')){openPrem();return}
    const b=e.target.closest('[data-bg]');if(b){const k=b.dataset.bg;if(!bgOK(k)){say('Stickers come with Premium.');openPrem();return}bgStyle=k;try{localStorage.setItem('cs.bg',k)}catch(er){}paintShelf();paintPanel();if(typeof paintGrid==='function')paintGrid();return}
    if(e.target.closest('[data-hide]'))setHide(!hideAmt)});
  // the theme sheet (phones and narrower windows) gets the same switch, under the background
  const bw=document.querySelector('.bgw');if(bw){const d=document.createElement('div');d.className='hidew';d.innerHTML=swtHTML();bw.after(d);d.addEventListener('click',e=>{if(e.target.closest('[data-hide]'))setHide(!hideAmt)})}
  const _ps=paintShelf;paintShelf=function(){_ps();if(pan.isConnected)paintPanel()};
  // v48 the panel starts level with the big story and is as tall as it
  const fitPan=()=>{const h=shelf.querySelector('.hero');if(!h)return;if(getComputedStyle(pan).display==='none'){pan.style.minHeight='';pan.style.marginTop='';h.style.minHeight='';return}
    pan.style.marginTop=Math.max(0,h.getBoundingClientRect().top-row.getBoundingClientRect().top)+'px';pan.style.minHeight='';h.style.minHeight='';
    pan.style.minHeight=h.offsetHeight+'px'};
  addEventListener('resize',()=>requestAnimationFrame(fitPan));
  const _pp=paintPanel;paintPanel=function(){_pp();requestAnimationFrame(fitPan)};window.paintPanel=paintPanel;
  paintPanel();
})();
// v42.7 while a sheet is open the page behind it can't scroll: drags on the dim area do nothing, drags inside the sheet scroll the sheet
{const _ms=modalSync;modalSync=function(){_ms();const open=[...document.querySelectorAll('.sheetw')].some(w=>!w.hidden&&!w.classList.contains('out'));document.documentElement.classList.toggle('sh-lock',open)};
 let y0=0;document.addEventListener('touchstart',e=>{y0=e.touches[0].clientY},{passive:true});
 document.addEventListener('touchmove',e=>{const w=e.target.closest&&e.target.closest('.sheetw');if(!w||w.hidden)return;const sh=e.target.closest('.sheet');
  if(!sh){e.preventDefault();return}
  // at the top or bottom of the sheet, stop the drag here instead of handing it to the page
  const dy=e.touches[0].clientY-y0,atTop=sh.scrollTop<=0,atEnd=sh.scrollTop+sh.clientHeight>=sh.scrollHeight-1;
  if(sh.scrollHeight<=sh.clientHeight||(dy>0&&atTop)||(dy<0&&atEnd))e.preventDefault()},{passive:false});}

// v42.8 sheets stay up for the whole fall (.24s) before they're hidden
closeSheet=function(id){const w=$(id);if(w.hidden||w.classList.contains('out'))return;navDone('sh:'+id);w.classList.add('out');modalSync();setTimeout(()=>{w.hidden=true;w.classList.remove('out');modalSync()},matchMedia('(prefers-reduced-motion: reduce)').matches?0:240)};
// ================= v42.27 Save all: photos or videos =================
// The header's Save all asks which. Photos: one image per story (one zip on computers). Videos: one clip per story
// (Premium), one zip on computers; phones get the share sheet, or one file each.
let savingV=false;
async function saveVideos(){if(savingV||saving)return;
  if(isFree()){say('Saving video comes with Premium.');openPrem();return}
  if(!VMIME){say('This browser can’t make videos. Try saving photos instead.');return}
  savingV=true;const files=[],N=SS.length;
  try{for(let n=0;n<N;n++){say('Making video '+(n+1)+' of '+N+'…',0);const b=await storyVideo(n,()=>{});const ext=/mp4/.test(b.type)?'mp4':'webm';files.push({name:'Card Stories '+(n+1)+' - '+SS[n].k.replace(/[\\/:*?"<>|]/g,'')+'.'+ext,blob:b});$('xhost').innerHTML=''}
    say('Your '+N+' videos are ready.');
    if(phoneUI())saveReady(files);else saveReady([{name:'Card Stories videos - '+D.lab.replace(/[\\/:*?"<>|]/g,'')+'.zip',blob:await zipOf(files),n:N}])}
  catch(e){console.error(e);say('Couldn’t make the videos. Try again.')}
  finally{savingV=false;$('xhost').innerHTML=''}}
window.csSaveAll=kind=>kind==='videos'?saveVideos():saveStories(SS.map((_,i)=>i));
window.csCanVideo=()=>!!VMIME;
// v47 phones, inside the app: Themes moved to the round button, so the theme chips give their row to one line about Stories
;(function(){let inApp=false;try{inApp=window.parent!==window&&!!parent.document.getElementById('ct-fab')}catch(e){}if(!inApp)return;
  document.documentElement.classList.add('inapp');const thm=$('thm');if(!thm||document.querySelector('.stintro'))return;
  const p=document.createElement('p');p.className='stintro';p.textContent='The collection, told in stories. Tap one to play.';thm.parentNode.insertBefore(p,thm)})();

// ================= v48: 20 ways to tell the story =================
// Each new story picks one fact from the entries, gives it a one-line headline, a big number and its own motion. A story
// only appears when its fact is worth telling (a streak needs 3+ days, a long hold has to end in a win…). Free plays the
// first 4 (In cards, Top win, Where the cards came from, On budget); the rest show on the shelf with a Premium tag.
const FREE_N=4;let SSL=[];
const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const setOf=n=>{const p=String(n).split(' - ').map(x=>x.trim()).filter(Boolean);return p.length>=3?p[p.length-1]:''};
const NUMW=['zero','one','two','three','four','five','six','seven','eight','nine','ten'],word=n=>NUMW[n]||String(n),cap=w=>w[0].toUpperCase()+w.slice(1);
function moreStories(){const x=D.x,L=x.L,t=x.t,H=hideAmt,M=x.M,out=[];
  const sales=L.filter(e=>e.type==='sale'),buysL=L.filter(e=>e.type==='purchase');
  // every card in this period that was bought (any time) and sold (in this period)
  const B={},Sx={};E.forEach(e=>{if(e.type==='purchase')(B[key(e)]=B[key(e)]||[]).push(e)});sales.forEach(e=>{(Sx[key(e)]=Sx[key(e)]||[]).push(e)});
  const flips=Object.keys(Sx).filter(k=>B[k]).map(k=>{const b=B[k].slice().sort((p,q)=>p.date<q.date?-1:1)[0],sl=Sx[k].slice().sort((p,q)=>p.date<q.date?-1:1),s1=sl[sl.length-1],cost=B[k].reduce((a,e)=>a+e.amount,0),kept=sl.reduce((a,e)=>a+e.net,0),gross=sl.reduce((a,e)=>a+e.amount,0);
    return {name:b.name,b,s:s1,cost,kept,gross,gain:kept-cost,held:Math.max(0,days(b.date,s1.date)),roi:cost?(kept-cost)/cost:0}}).filter(f=>f.s.date>=f.b.date);
  // 7 · the splurge: the priciest single card bought — it drops in and lands
  const top=buysL.slice().sort((a,b)=>b.amount/(b.qty||1)-a.amount/(a.qty||1))[0];
  if(top)out.push({c:'s-drop',k:'The splurge',cover:H?'Top buy':short(top.amount/(top.qty||1)),h:'One card, all in.',big:H?'':cntSpan(Math.round(top.amount/(top.qty||1)/100),'$',''),
    line:esc(sn(top.name))+' · '+dShort(top.date)+(H?'':' on '+esc(top.platform))+'.',dark:!!artOf(top.name),full:()=>{const a=artOf(top.name);return a?'<div class="sfull"><img src="'+esc(a)+'" alt=""></div>':''},vis:p=>'<div class="sdrop">'+cardEl(top.name)+'<i class="shd" style="background:'+p.ink+'"></i></div>'});
  // 8 · best month: bars rise, one lights up
  if(M.length>=3){const bi=x.by.reduce((a,v,i)=>v.profit>x.by[a].profit?i:a,0),bm=x.by[bi];
    if(bm&&bm.profit>0){const mx=Math.max(1,...x.by.map(v=>Math.max(0,v.profit))),share=t.profit>0?Math.round(bm.profit/t.profit*100):0,nm=mName(M[bi]);
      out.push({c:'s-mbars',k:'Best month',cover:mName(M[bi],{month:'short'}),h:esc(nm)+(share>=40?' carried '+(M.length>=12?'the year':'the stretch')+'.':' led the way.'),big:H?cntSpan(share,'','%'):cntSpan(Math.round(bm.profit/100),'+$',''),
        line:H?'of the profit came in '+esc(nm)+'.':'The best month for profit, out of '+M.length+'.',
        vis:p=>'<div class="smb">'+x.by.slice(-12).map((v,i,a)=>{const on=i===a.length-1-(x.by.length-1-bi);return '<i style="height:'+Math.max(4,Math.max(0,v.profit)/mx*100).toFixed(1)+'%;background:'+(on?p.acc:p.ink)+';opacity:'+(on?1:.22)+';--d:'+(.2+i*.06).toFixed(2)+'s"></i>'}).join('')+'</div>'})}}
  // 9 · the streak: days in a row with a sale; the days fill in
  const sd=[...new Set(sales.map(e=>e.date))].sort();let run=1,best=sd.length?1:0,bEnd=sd[0],cur0=sd[0];
  for(let i=1;i<sd.length;i++){if(days(sd[i-1],sd[i])===1){run++;}else{run=1;cur0=sd[i]}if(run>best){best=run;bEnd=sd[i]}}
  if(best>=3){const n=best;out.push({c:'s-dots',k:'The streak',cover:n+' in a row',h:n<=10?cap(word(n))+' days, '+word(n)+' sales.':n+' days in a row with a sale.',big:cntSpan(n,'',' in a row'),
    line:'Ending '+dShort(bEnd)+'.',vis:p=>'<div class="sdt">'+Array.from({length:Math.min(n,14)},(_,i)=>'<i style="background:'+p.acc+';--d:'+(.25+i*.12).toFixed(2)+'s"></i>').join('')+'</div>'})}
  // 10 · quick turn: the fastest buy-to-sale at a profit
  const qk=flips.filter(f=>f.gain>0).sort((a,b)=>a.held-b.held)[0];
  if(qk&&qk.held<=14)out.push({c:'s-turn',k:'Quick turn',cover:qk.held?qk.held+(qk.held===1?' day':' days'):'Same day',h:qk.held?'In and out in '+word(qk.held)+(qk.held===1?' day.':' days.'):'Bought and sold the same day.',big:qk.held?cntSpan(qk.held,'',qk.held===1?' day':' days'):'',
    line:esc(sn(qk.name))+(H?'':' · '+signed(qk.gain))+'.',vis:()=>'<div class="sturn"><span class="in">'+cardEl(qk.name)+'<b>In</b></span><span class="out">'+cardEl(qk.name)+'<b>Out</b></span></div>'});
  // 11 · patience paid: the longest hold that ended in a win; a timeline stretches
  const lg=flips.filter(f=>f.gain>0).sort((a,b)=>b.held-a.held)[0];
  if(lg&&lg.held>=60){const r=lg.cost?lg.kept/lg.cost:0;out.push({c:'s-time',k:'Patience paid',cover:lg.held+' days',h:'Held '+lg.held+' days.'+(r>=1.5?' Sold for '+(Math.round(r*10)/10)+'×.':' Sold at a profit.'),big:cntSpan(lg.held,'',' days'),
    line:esc(sn(lg.name))+'.',vis:p=>{const P='M14 128 C 70 126, 110 122, 150 104 S 230 46, 286 26';return '<div class="spat"><svg viewBox="0 0 300 150" aria-hidden="true"><path class="ppf" d="'+P+' L286 150 L14 150Z" fill="'+p.acc+'"/><path class="ppg" d="M14 140 H286" stroke="'+p.ink+'" stroke-width="1.5" stroke-dasharray="3 6" fill="none"/><path class="ppl" d="'+P+'" pathLength="1" stroke="'+p.acc+'" stroke-width="5" stroke-linecap="round" fill="none"/><circle class="pp0" cx="14" cy="128" r="6" fill="'+p.ink+'"/><circle class="pp1" cx="286" cy="26" r="7" fill="'+p.acc+'"/></svg>'+
      '<span class="pin">'+cardEl(lg.name)+(r>=1.2?'<b style="background:'+p.acc+';color:'+p.on+'">×'+(Math.round(r*10)/10)+'</b>':'')+'</span><div class="tl"><span><i>Bought</i>'+(H?'':short(lg.cost)+' · ')+dShort(lg.b.date)+'</span><span><i>Sold</i>'+(H?'':short(lg.kept)+' · ')+dShort(lg.s.date)+'</span></div></div>'}})}
  // 12 · the fees: a receipt unrolls (the Card Tab logo is a receipt)
  if(sales.length>=2&&t.fees>0){const pf={};sales.forEach(e=>{pf[e.platform]=(pf[e.platform]||0)+(e.amount-e.net)});const rows=Object.keys(pf).map(k=>[k,pf[k]]).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),pc=Math.round(t.fees/Math.max(1,t.sales)*1000)/10;
    out.push({c:'s-rcpt',k:'The fees',cover:H?pc+'%':short(t.fees),h:'The cost of selling.',big:H?cntSpan(Math.round(pc),'','%'):cntSpan(Math.round(t.fees/100),'$',''),line:H?'of every sale went to fees and shipping.':pc+'% of every sale went to fees and shipping.',
      vis:()=>'<div class="srcpt"><div class="rp">'+rows.map(([k,v])=>'<div><span>'+esc(k)+'</span><span>'+(H?Math.round(v/t.fees*100)+'%':money(v))+'</span></div>').join('')+'<div class="tot"><span>Total</span><span>'+(H?'100%':money(t.fees))+'</span></div></div></div>'})}
  // 13 · on repeat: the card traded most; copies fan out like a hand
  const ct={};L.forEach(e=>{const k=key(e);(ct[k]=ct[k]||{n:0,name:e.name}).n+=1});const rp=Object.values(ct).sort((a,b)=>b.n-a.n)[0];
  if(rp&&rp.n>=3)out.push({c:'s-fan',k:'On repeat',cover:'×'+rp.n,h:esc(sn(rp.name))+', again and again.',big:cntSpan(rp.n,'×',''),line:'Bought or sold '+rp.n+' times.',vis:()=>'<div class="sfn">'+cardEl(rp.name)+cardEl(rp.name)+cardEl(rp.name)+'</div>'});
  // 14 · through these hands: every card bought and sold; a stack builds up
  const nC=t.nb+t.ns,arts=[...new Set(L.map(e=>e.name))].sort((a,b)=>(artOf(b)?1:0)-(artOf(a)?1:0)).slice(0,4);
  if(nC>=10)out.push({c:'s-stack',k:'Through these hands',cover:NFR.format(nC)+' cards',h:NFR.format(nC)+' cards and counting.',big:cntSpan(nC,'',''),line:t.nb+' bought, '+t.ns+' sold.',vis:()=>'<div class="sstk">'+arts.map(cardEl).join('')+'</div>'});
  // 15 · best return: the biggest percent gain on one card; it spins once, then rests
  const br=flips.filter(f=>f.cost>0&&f.roi>=.5&&!(x.f0&&key(f.b)===key(x.f0.b))).sort((a,b)=>b.roi-a.roi)[0];
  if(br){const pct=Math.round(br.roi*100);out.push({c:'s-spin',k:'Best return',cover:'+'+NFR.format(pct)+'%',h:br.cost<=2000?'Small buy, big return.':'The best return.',big:cntSpan(pct,'+','%'),
    line:esc(sn(br.name))+(H?'':' · '+short(br.cost)+' → '+short(br.gross))+'.',vis:()=>'<div class="sspn">'+cardEl(br.name)+'</div>'})}
  // 16 · busiest day: the weekday with the most sales; the week pulses and one day grows
  if(sales.length>=8){const wd=[0,0,0,0,0,0,0];sales.forEach(e=>{wd[new Date(e.date+'T12:00:00').getDay()]++});const bd=wd.indexOf(Math.max(...wd)),sh=Math.round(wd[bd]/sales.length*100);
    if(sh>=25)out.push({c:'s-week',k:'Busiest day',cover:DOW[bd].slice(0,3),h:DOW[bd]+'s are for selling.',big:cntSpan(sh,'','%'),line:'of sales landed on a '+DOW[bd]+'.',
      vis:p=>'<div class="swk">'+[1,2,3,4,5,6,0].map((d,i)=>'<i class="'+(d===bd?'hot':'')+'" style="'+(d===bd?'background:'+p.acc+';color:'+p.on:'border-color:'+p.ink)+';--d:'+(.2+i*.08).toFixed(2)+'s">'+DOW[d][0]+'</i>').join('')+'</div>'})}
  // 17 · favorite set: the set with the most entries; set chips slide in
  const sc={};L.forEach(e=>{const st=setOf(e.name);if(st)sc[st]=(sc[st]||0)+(e.qty||1)});const sets=Object.keys(sc).sort((a,b)=>sc[b]-sc[a]);
  if(sets.length&&sc[sets[0]]>=3)out.push({c:'s-sets',k:'Favorite set',cover:sets[0].length>14?sc[sets[0]]+' cards':sets[0],h:esc(sets[0])+', on repeat.',big:cntSpan(sc[sets[0]],'',' cards'),line:'The most-logged set.',
    vis:p=>'<div class="sst">'+sets.slice(0,3).map((st,i)=>'<i style="background:'+(i?'transparent':p.acc)+';color:'+(i?p.ink:p.on)+';border-color:'+p.ink+';--d:'+(.3+i*.14).toFixed(2)+'s">'+esc(st)+' · '+sc[st]+'</i>').join('')+'</div>'});
  // 18 · still in the binder: bought and not sold yet; a binder page turns
  if(x.hold.length){const n=x.hold.reduce((a,e)=>a+(e.qty||1),0),ha=[...new Set(x.hold.map(e=>e.name))].slice(0,8);
    out.push({c:'s-bind',k:'Still in the binder',cover:n+(n===1?' card':' cards'),h:'',big:cntSpan(n,'',''),line:n===1?'card, still holding.':'cards, still holding.',
      vis:p=>{const bg=String(p.bg).startsWith('#')?p.bg:'#1d1d1d',pg='background:color-mix(in srgb,'+p.ink+' 9%,'+bg+')';return '<div class="sbn"><div class="pgb" style="'+pg+'">'+ha.slice(4,8).concat(ha.slice(0,4)).slice(0,4).map(cardEl).join('')+'</div><div class="pgf" style="'+pg+'">'+ha.slice(0,4).map(cardEl).join('')+'</div></div>'}})}
  // 19 · first card of the year: a ball drops, then the card rises (only when the range starts a year)
  const jan=M.find(m=>m.slice(5,7)==='01');
  if(jan){const yr=jan.slice(0,4),fc=buysL.filter(e=>e.date.slice(0,4)===yr).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0)[0];
    if(fc)out.push({c:'s-first',k:'First card of '+yr,cover:dShort(fc.date),h:'Where '+yr+' started.',big:'',line:esc(sn(fc.name))+' · '+dShort(fc.date)+'.',vis:p=>'<div class="sfst"><i class="ball" style="background:'+p.acc+'"></i>'+cardEl(fc.name)+'</div>'})}
  // 20 · biggest month for buying: the months tick by on a calendar until that one
  if(M.length>=3){const bi=x.by.reduce((a,v,i)=>v.spent>x.by[a].spent?i:a,0),bm=x.by[bi];
    if(bm&&bm.spent>0){const lead=M.slice(Math.max(0,bi-6),bi),sh=Math.round(bm.spent/Math.max(1,t.spent)*100),yr=M[bi].slice(0,4);
      out.push({c:'s-cal',k:'Biggest month for buying',cover:mName(M[bi],{month:'short'}),h:esc(mName(M[bi]))+' was for buying.',big:H?cntSpan(sh,'','%'):cntSpan(Math.round(bm.spent/100),'$',''),
        line:cnt(bm.nb,'card','cards')+' bought, the most in any month.',
        vis:p=>{const pg=(m,k,last)=>'<div class="cpg'+(last?' hot':'')+'" style="z-index:'+(40-k)+';'+(last?'background:'+p.acc+';color:'+p.on:'')+';--d:'+(.9+k*.6).toFixed(2)+'s"><i class="rg"></i><small>'+m.slice(0,4)+'</small><b>'+mName(m,{month:'short'})+'</b>'+(last?'<em>'+cnt(bm.nb,'card','cards')+'</em>':'')+'</div>';
          return '<div class="scal2" style="--n:'+lead.length+'">'+lead.map((m,k)=>pg(m,k,false)).join('')+pg(M[bi],lead.length,true)+'</div>'}})}}
  return out}
const _bs48=buildStories;buildStories=function(){const S=_bs48().concat(moreStories());if(!isFree()){SSL=[];return S}SSL=S.slice(FREE_N);return S.slice(0,FREE_N)};
// Free: the stories that come with Premium sit on the shelf after the free ones, with a tag; tapping one opens Premium
{const _ps48=paintShelf;paintShelf=function(){_ps48();const cv=shelf.querySelector('.covers');if(!cv||!SSL.length)return;
  cv.insertAdjacentHTML('beforeend',SSL.map((s,i)=>cvHTML(s,SS.length+i,'lkcv').replace(/data-play="\d+"/,'data-lk="1"').replace('<span class="sin">','<span class="pmt">Premium</span><span class="sin">')).join(''));
  const mh=shelf.querySelector('.covw .mh span');if(mh)mh.textContent=SS.length+' of '+(SS.length+SSL.length)+' stories · '+mh.textContent}
 shelf.addEventListener('click',e=>{if(e.target.closest('[data-lk]'))openPrem()});}

// v48 a star on each tile of the All themes sheet: starred themes come first in the panel
{const _pg48=paintGrid;paintGrid=function(){_pg48();const f=window.csFav?csFav.get():[];$('tgrid').querySelectorAll('[data-i]').forEach(b=>{const i=+b.dataset.i,on=f.includes(i);b.insertAdjacentHTML('beforeend','<span class="tfav'+(on?' on':'')+'" role="button" tabindex="0" data-fav="'+i+'" aria-pressed="'+on+'" aria-label="'+(on?'Unstar ':'Star ')+esc(TH[i][0])+'">'+(on?'★':'☆')+'</span>')})};
 const favHit=e=>{const s=e.target.closest&&e.target.closest('[data-fav]');if(!s)return false;e.stopImmediatePropagation();e.preventDefault();if(window.csFav)csFav.toggle(+s.dataset.fav).then(on=>say(on?TH[+s.dataset.fav][0]+' starred. It comes first in the panel.':'Star removed.'));return true};
 $('tgrid').addEventListener('click',favHit,true);$('tgrid').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[data-fav]'))favHit(e)},true);
 try{paintGrid()}catch(e){}}

// ================= v49 Stage (wide desktop): the story plays right on the page =================
// From 1180px wide the shelf gives way to three columns: the story playing in place on the left, "Up next" with the
// period's totals in the middle, and a Style panel that slides in from the right. The panel shows a few themes and
// backgrounds as story-shaped previews (2½ in view; slide, drag or use the arrows), with a 4th card and an "All" link
// that open every one. Hovering a preview shows it on the playing story; clicking keeps it. Phones and narrower windows
// keep the shelf and the full-screen player.
(()=>{
  const stM=matchMedia('(min-width:1180px)'),STAR='★',LK='<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 10V8A5 5 0 0 0 7 8v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 8a3 3 0 0 1 6 0v2H9z"/></svg>';
  const FULL='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const row=document.querySelector('.shelfrow')||shelf;
  const stg=document.createElement('section');stg.className='stg';stg.setAttribute('aria-label','Stories');row.before(stg);
  // the Style button sits beside Save all
  const sbtn=document.createElement('button');sbtn.type='button';sbtn.className='svall stbtn';sbtn.setAttribute('aria-expanded','false');sbtn.innerHTML='<i class="dot"></i>Style';
  const sva=$('svall');if(sva)sva.before(sbtn);
  const D2={i:0,t0:0,el:0,paused:false,raf:0,open:false,view:'main',pth:null,pbg:null};
  const favs=()=>window.csFav?csFav.get():[];
  const tCols=i=>fixP(TH[i][1][0]);
  const on=()=>stM.matches&&document.documentElement.classList.contains('stg-on');
  // ---------- the player ----------
  function slides(){const keepT=th,keepB=bgStyle;if(D2.pth!=null)th=D2.pth;if(D2.pbg!=null)bgStyle=D2.pbg;const h=SS.map((s,k)=>stHTML(s,k,k===D2.i)).join('');th=keepT;bgStyle=keepB;return h}
  function playerHTML(){return '<div class="dpl" id="dpl"><div class="dsl">'+slides()+'</div><div class="pbars">'+SS.map(()=>'<i><b></b></i>').join('')+'</div><span class="pvtag" id="pvtag" aria-live="polite"></span>'+
    '<div class="tapz l" data-dgo="-1"></div><div class="tapz r" data-dgo="1"></div>'+
    '<div class="dbot"><button type="button" class="ghost" data-dpause aria-label="Pause">'+PAUSE+'</button><span class="sp"></span><button type="button" class="ghost" data-dfull aria-label="Full screen">'+FULL+'</button><button type="button" data-dshare>'+SHARE+'Share</button></div></div>'}
  function animIn(){const cur=stg.querySelectorAll('.dpl .st')[D2.i];if(!cur)return;
    cur.querySelectorAll('.pop,.rise,.plat i,.mo i,.stick,.ln,.ar').forEach(n=>{n.style.animation='none';void n.offsetWidth;n.style.animation=''});
    cur.querySelectorAll('[data-count]').forEach(n=>{const to=+n.dataset.count,pre=n.dataset.pre||'',suf=n.dataset.suf||'',d=+(n.dataset.d||0),dur=+(n.dataset.dur||1300),fmt=v=>pre+NFR.format(Math.round(v))+suf;
      if(calmM.matches){n.textContent=fmt(to);return}n.textContent=fmt(0);const t0=performance.now()+d,tok=(n._tok=(n._tok||0)+1);
      (function f(now){if(n._tok!==tok)return;const k=Math.max(0,Math.min(1,(now-t0)/dur));n.textContent=fmt(to*(1-Math.pow(1-k,2)));if(k<1)requestAnimationFrame(f)})(performance.now())})}
  function paint(){stg.querySelectorAll('.dpl .st').forEach((s,k)=>s.classList.toggle('on',k===D2.i));const bars=stg.querySelector('.dpl .pbars');if(bars){const keep=th;if(D2.pth!=null)th=D2.pth;bars.style.color=SS[D2.i]&&SS[D2.i].dark?'#fff':palN(D2.i).ink;th=keep}stg.querySelectorAll('.dpl .pbars i b').forEach((b,k)=>{b.style.transform=k<D2.i?'scaleX(1)':'scaleX(0)'});animIn();paintNext()}
  function setI(n){D2.i=(n+SS.length)%SS.length;D2.el=0;D2.t0=performance.now();paint()}
  function pause(v){if(v===D2.paused)return;if(v)D2.el+=performance.now()-D2.t0;else D2.t0=performance.now();D2.paused=v;const b=stg.querySelector('[data-dpause]');if(b){b.innerHTML=v?PLAY:PAUSE;b.setAttribute('aria-label',v?'Play':'Pause')}}
  function tick(now){D2.raf=0;if(!on()||pl.open||document.hidden){return}if(!D2.paused){const k=Math.min(1,(D2.el+now-D2.t0)/DUR),bar=stg.querySelectorAll('.dpl .pbars i b')[D2.i];if(bar)bar.style.transform='scaleX('+k+')';if(k>=1)setI(D2.i+1)}D2.raf=requestAnimationFrame(tick)}
  const run=()=>{if(!D2.raf&&on()){D2.t0=performance.now();D2.raf=requestAnimationFrame(tick)}};
  function repaintSlides(){const sl=stg.querySelector('.dsl');if(!sl)return;sl.innerHTML=slides();sl.querySelectorAll('.st').forEach((s,k)=>s.classList.toggle('on',k===D2.i));
    const t=document.getElementById('pvtag');if(t){const pv=D2.pth!=null?TH[D2.pth][0]:D2.pbg!=null?D2.pbg:'';t.textContent=pv?'Previewing '+pv:'';t.classList.toggle('on',!!pv)}}
  // ---------- Up next and the totals ----------
  function nextHTML(){const n=Math.min(5,SS.length);let h='';for(let k=0;k<n;k++){const i=(D2.i+k)%SS.length,s=SS[i],p=palN(i);
      h+='<button type="button" class="nx'+(k?'':' on')+'" data-dset="'+i+'"><i class="th" style="background:'+(p.bg.startsWith('#')?p.bg:p.bg)+';--a:'+p.acc+'"></i><span><b>'+esc(s.k)+'</b></span>'+(String(s.cover).toLowerCase()===String(s.k).toLowerCase()?'':'<em>'+esc(s.cover)+'</em>')+'</button>'}
    return h}
  function paintNext(){const l=stg.querySelector('.nxl');if(l){l.innerHTML=nextHTML();fitRows()}}
  function totalsHTML(){const t=D.x.t;return '<div class="tot"><div><small>Profit</small><b>'+(hideAmt?pctS(D.x.roi):signedS(t.profit))+'</b></div><div><small>Return</small><b>'+(t.spent?D.x.roi+'%':'—')+'</b></div><div><small>Entries</small><b>'+NFR.format(t.n)+'</b></div></div>'}
  function sideHTML(){const more=SS.length+SSL.length;return '<div class="side"><h3>Up next</h3><div class="nxl">'+nextHTML()+'</div><button type="button" class="lnk" data-allst>See all '+more+' stories →</button>'+totalsHTML()+'</div>'}
  // ---------- the Style panel ----------
  function tBox(i){const q=tCols(i),lk=!themeOK(i),f=favs().includes(i);return '<button type="button" class="tb'+(i===th?' on':'')+'" data-t="'+i+'" aria-label="'+esc(TH[i][0])+(lk?', Premium':'')+'" aria-pressed="'+(i===th)+'"><span class="bx" style="background:'+q.bg+';--k:'+q.ink+';--a:'+q.acc+'"><i class="a"></i><i class="b"></i><b>'+esc(hideAmt?pctS(D.x.roi):signedS(D.x.t.profit))+'</b><s></s><u></u>'+(lk?'<em class="lk">'+LK+'</em>':'')+'</span><span class="nm">'+esc(TH[i][0])+
      (D2.view==='themes'?'<span class="fv'+(f?' on':'')+'" role="button" tabindex="0" data-fav="'+i+'" aria-pressed="'+f+'" aria-label="'+(f?'Unstar ':'Star ')+esc(TH[i][0])+'">'+(f?STAR:'☆')+'</span>':f?'<span class="fv on" aria-hidden="true">'+STAR+'</span>':'')+'</span></button>'}
  function bBox(b,k){const p=palN(0),keep=th;const pp=D2.pth!=null?(th=D2.pth,palN(0)):p;th=keep;const lk=!bgOK(b);return '<button type="button" class="bb'+(b===bgStyle?' on':'')+'" data-b="'+b+'" aria-label="'+b+(lk?', Premium':'')+'" aria-pressed="'+(b===bgStyle)+'"><span class="bx bgpv">'+bgSvg(b,pp,40+k,90,140)+(lk?'<em class="lk">'+LK+'</em>':'')+'</span><span class="nm">'+b+'</span></button>'}
  function allTCard(){return '<button type="button" class="allc" data-view="themes" aria-label="All '+TH.length+' themes"><span class="bx mos">'+TH.slice(0,9).map((_,i)=>{const q=tCols(i);return '<i style="background:'+q.bg+';box-shadow:inset 0 -8px 0 '+q.acc+'"></i>'}).join('')+'<em>All '+TH.length+'</em></span><span class="nm">All themes</span></button>'}
  function allBCard(){const p=palN(0);return '<button type="button" class="allc" data-view="bgs" aria-label="All '+BGS.length+' backgrounds"><span class="bx mos">'+BGS.map((b,k)=>'<i class="bgpv">'+bgSvg(b,p,60+k,40,60)+'</i>').join('')+'<em>All '+BGS.length+'</em></span><span class="nm">All backgrounds</span></button>'}
  const car=(items,lab)=>'<div class="carw"><button type="button" class="arr l" data-arr="-1" aria-label="Earlier '+lab+'">‹</button><div class="car">'+items+'</div><button type="button" class="arr r" data-arr="1" aria-label="More '+lab+'">›</button></div>';
  function panelHTML(){const hd=(b)=>'<div class="ph">'+b+'<button type="button" class="done" data-done>Done</button></div>';
    if(D2.view==='themes')return hd('<button type="button" class="back" data-view="main">‹ Style</button>')+'<h3 class="vt">Themes <span>'+TH.length+(isFree()?' · Free includes 2':'')+' · ★ to favorite</span></h3><div class="allg">'+(D2.gOrd=D2.gOrd||[th].concat(favs(),TH.map((_,i)=>i)).filter((v,i,a)=>a.indexOf(v)===i)).map(tBox).join('')+'</div>';
    if(D2.view==='bgs')return hd('<button type="button" class="back" data-view="main">‹ Style</button>')+'<h3 class="vt">Backgrounds <span>'+BGS.length+(isFree()?' · Free includes '+BG_FREE.length:'')+'</span></h3><div class="allg">'+BGS.map(bBox).join('')+'</div>';
    /* rows keep their order while the panel is open, so the tile under the pointer is the one picked */if(!D2.tOrd)D2.tOrd=[th].concat(favs(),isFree()?freeThemes():[],recentT(),[0,1,2,3]).filter((v,i,a)=>TH[v]&&a.indexOf(v)===i).slice(0,3);if(!D2.bOrd)D2.bOrd=[bgStyle].concat(BG_FREE,BGS).filter((v,i,a)=>a.indexOf(v)===i).slice(0,3);const tl=D2.tOrd,bl=D2.bOrd;
    return hd('<h3>Style</h3>')+'<div class="sg"><h5>Theme <em>'+esc(TH[th][0])+' <a class="seeall" data-view="themes">All '+TH.length+' →</a></em></h5>'+car(tl.map(tBox).join('')+allTCard(),'themes')+'</div>'+
      '<div class="sg"><h5>Background <em>'+bgStyle+' <a class="seeall" data-view="bgs">All '+BGS.length+' →</a></em></h5>'+car(bl.map(bBox).join('')+allBCard(),'backgrounds')+'</div>'+
      '<div class="hrow"><span>Hide amounts<small>Show % instead of $, in saved stories too</small></span><button type="button" class="hswt" role="switch" aria-checked="'+hideAmt+'" data-shide aria-label="Hide amounts"><i></i></button></div>'}
  const recentT=()=>{try{return JSON.parse(localStorage.getItem('cs.recent'))||[]}catch(e){return []}};
  function paintPanel2(anim){const w=stg.querySelector('.stp');if(!w)return;const pos=[...w.querySelectorAll('.car')].map(c=>c.scrollLeft),g=w.querySelector('.allg'),gt=g&&!anim?g.scrollTop:0;
    w.className='stp v-'+D2.view+(anim?' swap':'');w.innerHTML=panelHTML();w.querySelectorAll('.car').forEach((c,i)=>{c.style.scrollBehavior='auto';c.scrollLeft=pos[i]||0;c.style.scrollBehavior=''});const g2=w.querySelector('.allg');if(g2)g2.scrollTop=gt;wireCars();if(D2.view==='main')fitPanel()}
  function arrows(){stg.querySelectorAll('.carw').forEach(w=>{const c=w.querySelector('.car');w.querySelector('.arr.l').disabled=c.scrollLeft<8;w.querySelector('.arr.r').disabled=c.scrollLeft+c.clientWidth>=c.scrollWidth-8})}
  function wireCars(){stg.querySelectorAll('.car').forEach(c=>{if(c._w)return;c._w=1;c.addEventListener('scroll',arrows,{passive:true});let x0=0,s0=0,down=false,moved=false;
    c.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button)return;down=true;moved=false;x0=e.clientX;s0=c.scrollLeft});
    const mv=e=>{if(!down)return;const dx=e.clientX-x0;if(Math.abs(dx)>5){moved=true;c.classList.add('drag')}if(moved)c.scrollLeft=s0-dx};
    const up=()=>{if(!down)return;down=false;if(moved){c.classList.remove('drag');const w=c.firstElementChild.offsetWidth+10;c.scrollTo({left:Math.round(c.scrollLeft/w)*w,behavior:'smooth'});c.dataset.nc='1';setTimeout(()=>delete c.dataset.nc,60)}};
    addEventListener('pointermove',mv);addEventListener('pointerup',up)});arrows()}
  function setOpen(v){D2.open=v;if(!v){D2.tOrd=D2.bOrd=D2.gOrd=null}stg.classList.toggle('open',v);sbtn.setAttribute('aria-expanded',v);sbtn.classList.toggle('on',v);
    if(!v){if(D2.pth!=null||D2.pbg!=null){D2.pth=D2.pbg=null;repaintSlides()}if(D2.view!=='main'){D2.view='main';setTimeout(()=>{if(!D2.open)paintPanel2()},480)}}else{requestAnimationFrame(arrows);setTimeout(()=>{fitPanel()},480)}setTimeout(fitRows,480);tellStyle()}
  // ---------- all stories ----------
  const sh=document.createElement('div');sh.className='stall';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-label','All stories');document.body.appendChild(sh);
  // v50.2 All stories: a list people can read — a small cover, the story's name, what it says, and its number
  const plain=h=>{const d=document.createElement('div');d.innerHTML=String(h||'');return d.textContent.trim()};
  const GRP=[['The basics',['In cards','Top win','Where the cards came from','On budget','In and out','The game']],['Moments',['The splurge','Best month','The streak','Quick turn','Patience paid','First card','Biggest month for buying','Busiest day']],['The numbers',['The fees','On repeat','Through these hands','Best return','Favorite set','Still in the binder']]];
  const grpOf=k=>{const t=String(k).toLowerCase(),g=GRP.find(([,ks])=>ks.some(x=>t.includes(x.toLowerCase())));return g?g[0]:'More'};
  function rowHTML(s,i,lk){const p=palN(i),h=plain(s.h)||plain(s.line);return '<button type="button" class="sar'+(lk?' lk':'')+(!lk&&i===D2.i&&on()?' cur':'')+'" '+(lk?'data-lk="1"':'data-play="'+i+'"')+' aria-label="'+(lk?'Premium: ':'Play ')+esc(s.k)+'">'+
      '<span class="sat" style="color:'+p.ink+'">'+bgSvg(bgStyle,p,i+1,120,160)+'<b style="color:'+(String(s.cover).startsWith('+')||s.big?p.acc:p.ink)+'">'+esc(s.cover)+'</b></span>'+
      '<span class="sax"><b>'+esc(s.k)+'</b><small>'+esc(h)+'</small></span>'+(lk?'<em class="pmt2">Premium</em>':'<i class="sap" aria-hidden="true">'+PLAY+'</i>')+'</button>'}
  function openAll(){const all=SS.map((s,i)=>[s,i,false]).concat(SSL.map((s,i)=>[s,SS.length+i,true])),groups={};all.forEach(r=>{const g=grpOf(r[0].k);(groups[g]=groups[g]||[]).push(r)});
    sh.innerHTML='<div class="sa" role="document"><div class="sagrab" aria-hidden="true"></div><div class="sah"><h3>All '+all.length+' stories</h3><button type="button" class="x" data-sax aria-label="Close">✕</button></div><div class="sab">'+
      ['The basics','Moments','The numbers','More'].filter(g=>groups[g]).map(g=>'<div class="sgr"><h4>'+g+'</h4>'+groups[g].map(r=>rowHTML(r[0],r[1],r[2])).join('')+'</div>').join('')+'</div></div>';
    sh.hidden=false;modalSync();
    if(!calmM.matches){const ph=matchMedia('(max-width:760px)').matches;sh.firstChild.animate(ph?[{transform:'translateY(100%)'},{transform:'none'}]:[{opacity:0,transform:'translateY(10px) scale(.98)'},{opacity:1,transform:'none'}],{duration:ph?380:260,easing:'cubic-bezier(.2,.9,.25,1)'});sh.animate([{opacity:0},{opacity:1}],{duration:220})}
    const x=sh.querySelector('[data-sax]');if(x)x.focus({preventScroll:true})}
  // nothing behind the sheet scrolls while it's open
  sh.addEventListener('touchmove',e=>{if(!e.target.closest('.sab'))e.preventDefault()},{passive:false});
  {const _msA=modalSync;modalSync=function(){_msA();if(!sh.hidden){document.documentElement.classList.add('sh-lock');try{parent.csModal&&parent.csModal(true)}catch(e){}}}}
  const closeAll=()=>{sh.hidden=true;sh.innerHTML='';modalSync()};window.csOpenAll=openAll;
  sh.addEventListener('click',e=>{const b=e.target.closest('[data-play]');if(b){closeAll();if(on()){setI(+b.dataset.play);pause(false)}else pl.show(+b.dataset.play);return}if(e.target.closest('[data-lk]')){openPrem();return}if(e.target===sh||e.target.closest('[data-sax]'))closeAll()});
  // ---------- build ----------
  function build(){if(!stM.matches)return;const has=SS.length>0;document.documentElement.classList.toggle('stg-on',has);if(!has){stg.innerHTML='';if(D2.open)setOpen(false);return}if(D2.i>=SS.length)D2.i=0;stg.innerHTML='<div class="stl3">'+playerHTML()+sideHTML()+'<div class="dockw"><div class="stp v-'+D2.view+'">'+panelHTML()+'</div></div></div>';
    stg.classList.toggle('open',D2.open);paint();wireCars();fit();const dot=sbtn.querySelector('.dot'),q=tCols(th);dot.style.cssText='--tb:'+q.bg+';--ta:'+q.acc;tellStyle();D2.t0=performance.now();D2.el=0;run()}
  // v49.2 everything fits the window at launch: the story's height follows the window (it keeps its 9:16 shape),
  // Up next shows as many rows as fit, and the Style previews shrink until the panel fits
  function fit(){const l=stg.querySelector('.stl3');if(!l)return;const top=l.getBoundingClientRect().top+scrollY,h=Math.max(430,Math.min(658,Math.floor(innerHeight-top-26)));
    l.style.setProperty('--sh',h+'px');l.style.setProperty('--sw',Math.round(h*9/16)+'px');fitRows();fitPanel()}
  function fitRows(){const l=stg.querySelector('.nxl');if(!l)return;const rs=[...l.querySelectorAll('.nx')];rs.forEach(r=>r.hidden=false);const b=l.getBoundingClientRect().bottom;rs.forEach(r=>{if(r.getBoundingClientRect().bottom>b+1)r.hidden=true})}
  function fitPanel(){const p=stg.querySelector('.stp');if(!p)return;const car=p.querySelector('.car');if(!car)return;const max=(car.clientWidth-28)/2.5;let tw=max;p.style.setProperty('--tw',tw+'px');
    for(let k=0;k<4;k++){const over=p.scrollHeight-p.clientHeight;if(over<=0)break;tw=Math.max(70,tw-(over/2+2)*9/13);p.style.setProperty('--tw',tw+'px')}arrows()}
  addEventListener('resize',()=>{if(on())requestAnimationFrame(fit)});
  function mode(){const w=stM.matches;if(w)build();else{document.documentElement.classList.remove('stg-on');stg.innerHTML='';cancelAnimationFrame(D2.raf);D2.raf=0;if(D2.open)setOpen(false)}}
  const _ps49=paintShelf;paintShelf=function(){_ps49();if(stM.matches)build()};
  // hover a preview: the playing story shows it; move away to go back
  stg.addEventListener('mouseover',e=>{const a=e.target.closest('[data-t]'),b=e.target.closest('[data-b]');
    if(a&&D2.pth!==+a.dataset.t){D2.pth=+a.dataset.t;D2.pbg=null;repaintSlides()}else if(b&&D2.pbg!==b.dataset.b){D2.pbg=b.dataset.b;D2.pth=null;repaintSlides()}});
  stg.addEventListener('mouseout',e=>{const a=e.target.closest('[data-t],[data-b]');if(a&&!a.contains(e.relatedTarget)&&(D2.pth!=null||D2.pbg!=null)){D2.pth=D2.pbg=null;repaintSlides()}});
  stg.addEventListener('click',e=>{const t=e.target;
    if(t.closest('.car[data-nc]'))return;
    const fv=t.closest('[data-fav]');if(fv){e.stopPropagation();if(window.csFav)csFav.toggle(+fv.dataset.fav).then(()=>paintPanel2());return}
    const g=t.closest('[data-dgo]');if(g){setI(D2.i+(+g.dataset.dgo));return}
    if(t.closest('[data-dpause]')){pause(!D2.paused);return}
    if(t.closest('[data-dfull]')){pause(true);pl.show(D2.i);return}
    if(t.closest('[data-dshare]')){pause(true);pl.show(D2.i);requestAnimationFrame(()=>{const s=plEl.querySelector('[data-share]');if(s)s.click()});return}
    const ds=t.closest('[data-dset]');if(ds){setI(+ds.dataset.dset);pause(false);return}
    if(t.closest('[data-allst]')){openAll();return}
    if(t.closest('[data-done]')){setOpen(false);return}
    const v=t.closest('[data-view]');if(v){D2.view=v.dataset.view;D2.pth=D2.pbg=null;repaintSlides();paintPanel2(true);return}
    const ar=t.closest('[data-arr]');if(ar){const c=ar.parentElement.querySelector('.car');c.scrollBy({left:+ar.dataset.arr*(c.clientWidth*.8),behavior:'smooth'});return}
    if(t.closest('[data-shide]')){window.csSetHide&&csSetHide(!hideAmt);return}
    const a=t.closest('[data-t]');if(a){const i=+a.dataset.t;if(!themeOK(i)){openPrem('locked theme');return}D2.pth=null;setTheme(i);try{paintGrid()}catch(er){}paintShelf();return}
    const b=t.closest('[data-b]');if(b){const k=b.dataset.b;if(!bgOK(k)){say(k+' comes with Premium.');openPrem('locked background');return}D2.pbg=null;bgStyle=k;try{localStorage.setItem('cs.bg',k)}catch(er){}paintShelf();try{paintGrid()}catch(er){}return}});
  sbtn.addEventListener('click',()=>{if(!on())return;setOpen(!D2.open)});
  window.csStyle=()=>{if(on())setOpen(!D2.open)};
  const tellStyle=()=>{try{const q=tCols(th);parent.CTStyleState&&parent.CTStyleState(D2.open,q.bg.startsWith('#')?q.bg:'#555',q.acc)}catch(e){}};
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!sh.hidden){closeAll();return}if(D2.open&&!pl.open)setOpen(false)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
  // after the full-screen player closes, pick up where it left off
  const _hide=pl.hide.bind(pl);pl.hide=function(f){const i=pl.i;_hide(f);if(on()){setI(i);run()}};
  stM.addEventListener('change',mode);mode();
})();

// v49.3 the shelf (phones and narrower windows) shows the first 5 stories and a "See all" tile for the rest
{const SHOW=5,_ps493=paintShelf;paintShelf=function(){_ps493();const cv=shelf.querySelector('.covers');if(!cv)return;const all=[...cv.querySelectorAll('.scv')],n=SS.length+SSL.length;
  if(all.length<=SHOW+1)return;all.forEach((c,k)=>{if(k>=SHOW)c.classList.add('xtra')});
  cv.insertAdjacentHTML('beforeend','<button type="button" class="scv seeall" data-seeall aria-label="See all '+n+' stories"><span class="fan">'+[SHOW,SHOW+1,SHOW+2].map((k,j)=>{const q=palN(k);return '<i style="background:'+q.bg+';--r:'+(j*9-9)+'deg;--a:'+q.acc+'"></i>'}).join('')+'</span><span class="sal"><b>See all</b><small>'+n+' stories</small></span></button>')}
 shelf.addEventListener('click',e=>{if(e.target.closest('[data-seeall]')&&window.csOpenAll)csOpenAll()});}

// v49.4 every story's picture fits its 9:16 frame: it sits centered in the space under the words, and if it's taller
// than that space it scales down (from its top) so it never runs into cardtab.app or the buttons
function fitSt(st){if(!st)return;const sin=st.querySelector('.sin'),sv=st.querySelector('.svis'),w=sv&&sv.querySelector('.svw');if(!w)return;
  const wall=w.querySelector('.wall');if(wall)wall.style.height='';
  w.style.transform='';sv.style.height='';const cs=getComputedStyle(sin),prev=sv.previousElementSibling;if(!sin.clientHeight)return;
  const top=prev?prev.offsetTop+prev.offsetHeight:parseFloat(cs.paddingTop),pm=sin.querySelector('.pmark'),limit=Math.min(sin.clientHeight-parseFloat(cs.paddingBottom),pm&&pm.offsetHeight?pm.offsetTop-8:1e9),avail=limit-top-22,h=w.offsetHeight;
  // v50.26: on saved pictures and videos the card wall runs down behind cardtab.app, nearly to the bottom, fading out
  if(wall&&st.closest('#xhost')){const av2=sin.clientHeight-28-top-22;if(av2>80){wall.style.height=Math.floor(wall.offsetHeight+(av2-h))+'px';return}}
  // v50.25: the card wall keeps its full width (edge to edge) and just gets shorter; only other pictures scale down
  if(wall&&h>avail&&avail>40){wall.style.height=Math.max(80,Math.floor(wall.offsetHeight-(h-avail)))+'px';return}
  if(h>avail&&avail>40){const k=avail/h;w.style.transform='scale('+k.toFixed(3)+')';sv.style.height=Math.floor(h*k)+'px'}}
const fitAllSt=root=>{if(!root)return;root.querySelectorAll('.st').forEach(fitSt);
  root.querySelectorAll('.st img').forEach(im=>{if(!im.complete&&!im._fit){im._fit=1;im.addEventListener('load',()=>fitSt(im.closest('.st')),{once:true})}});
  if(document.fonts&&document.fonts.status!=='loaded')document.fonts.ready.then(()=>root.querySelectorAll('.st').forEach(fitSt))};
{const _pp=pl.paint.bind(pl);pl.paint=function(){_pp();fitAllSt(plEl)};
 addEventListener('resize',()=>{requestAnimationFrame(()=>{fitAllSt(plEl);fitAllSt(document.querySelector('.stg .dpl'))})});
 const xh=$('xhost');if(xh)new MutationObserver(()=>fitAllSt(xh)).observe(xh,{childList:true,subtree:false});
 const dk=()=>fitAllSt(document.querySelector('.stg .dpl'));new MutationObserver(dk).observe(document.querySelector('.stg')||document.body,{childList:true,subtree:true});}

// v50 usage counts (counts only; the parent app decides whether anything is sent)
{const T=(e,d,v)=>{try{parent.CTTrack&&parent.CTTrack.ev(e,d,v)}catch(er){}},K=s=>String(s&&s.k||'').replace(/\d{4}/g,'').trim().toLowerCase();
 let seen=new Set(),runN=0;
 const _show=pl.show.bind(pl);pl.show=function(n){seen=new Set();runN=0;T('story_play',n?'from a story':'from the start');return _show(n)};
 const _pnt=pl.paint;pl.paint=function(){_pnt.call(this);const s=SS[this.i];if(s&&!seen.has(this.i)){seen.add(this.i);runN++;T('story_view',K(s));T('story_depth',String(runN));if(this.i===SS.length-1)T('story_end','full screen')}};
 const _st=setTheme;setTheme=function(i){const was=th;_st(i);if(th!==was&&TH[th])T('theme',TH[th][0])};
 if(typeof saveStories==='function'){const _sv=saveStories;saveStories=function(list,share){T(share?'story_share':'story_save',(list&&list.length>1?'all':'one'));return _sv.apply(this,arguments)}}
 if(typeof storyVideo==='function'){const _vd=storyVideo;storyVideo=function(){T('story_save','video');return _vd.apply(this,arguments)}}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-bg]');if(b)setTimeout(()=>T('background',bgStyle),0)},true);}

// ================= v50.4 saving a finished video =================
// Making a video takes ~8 seconds, and browsers only open the share sheet or a "Save as" window straight after a tap. So
// when the video is ready, a small window shows it playing with a Save button: that fresh tap opens the phone's share
// sheet (Save Video puts it in Photos / the camera roll) or, on a computer, a window to pick where it goes (Chrome and
// Edge; Safari and Firefox save to Downloads, or ask, per the browser's own setting).
function saveReady(files,share){
  let w=$('vready');if(!w){w=document.createElement('div');w.id='vready';w.className='vready';w.hidden=true;document.body.appendChild(w);
    const _m=modalSync;modalSync=function(){_m();if(!w.hidden){document.documentElement.classList.add('sh-lock');try{parent.csModal&&parent.csModal(true)}catch(e){}}}}
  const one=files.length===1&&!files[0].n,zip=/\.zip$/.test(files[0].name),url=one?URL.createObjectURL(files[0].blob):'';
  const ff=files.map(f=>new File([f.blob],f.name,{type:f.blob.type||'application/octet-stream'}));
  const canSh=!zip&&(phoneUI()||share)&&navigator.canShare&&(()=>{try{return navigator.canShare({files:ff})}catch(e){return false}})();
  const label=canSh?(share?'Share':'Save'):(window.showSaveFilePicker?'Save':'Download');const count=zip?files[0].n:files.length;
  w.innerHTML='<div class="vrc" role="dialog" aria-modal="true" aria-label="Video ready">'+(one?'<video src="'+url+'" autoplay muted loop playsinline></video>':'<div class="vrn"><b>'+count+'</b><span>videos</span></div>')+
    '<b class="vrt">'+(one?'Your video is ready':'Your '+count+' videos are ready')+'</b><small>'+(canSh?(share?'Pick where to send it.':'Choose Save Video to put it in Photos.'):(window.showSaveFilePicker?'Choose where to save '+(one?'it':'them')+' on your computer.':'Your browser saves '+(one?'it':'them')+' to Downloads (or asks where, if it’s set to).'))+'</small>'+
    '<button type="button" class="vrs">'+label+(one?' video':zip?' zip':' videos')+'</button><button type="button" class="vrx">Not now</button></div>';
  const close=()=>{w.hidden=true;w.innerHTML='';if(url)URL.revokeObjectURL(url);modalSync()};
  w.onclick=e=>{if(e.target===w||e.target.closest('.vrx'))close()};
  w.querySelector('.vrs').onclick=async()=>{
    if(canSh){try{await navigator.share({files:ff});close()}catch(e){if(e&&e.name==='AbortError')return;for(const f of files)download(f.blob,f.name);close()}return}
    if(window.showSaveFilePicker&&files.length===1){const f=files[0],ext=f.name.split('.').pop(),mime=f.blob.type||'application/octet-stream';
      try{const h=await showSaveFilePicker({suggestedName:f.name,types:[{description:ext==='zip'?'Zip':'Video',accept:{[mime]:['.'+ext]}}]});const st=await h.createWritable();await st.write(f.blob);await st.close();pl.toast('Saved.');close();return}
      catch(e){if(e&&e.name==='AbortError')return}}
    for(const f of files){download(f.blob,f.name);if(files.length>1)await new Promise(r=>setTimeout(r,450))}pl.toast(files.length>1?'Saved '+files.length+' videos.':'Saved to Downloads.');close()};
  w.hidden=false;modalSync();setTimeout(()=>{const b=w.querySelector('.vrs');b&&b.focus()},50)}
{const _lr=loadReal;loadReal=function(){GRM=null;return _lr.apply(this,arguments)}}
// v50.40: on phones, Stories' sheets follow your finger like the app's (the app's js/sheetdrag.js does the work)
try{if(parent!==window&&parent.CTSheetDrag)parent.CTSheetDrag.attach({zone:document,on:()=>matchMedia('(max-width:600px)').matches,sheetOf:t=>t.closest&&t.closest('.sheetw:not([hidden])>.sheet'),dismiss:sh=>closeSheet(sh.parentElement.id)})}catch(e){}
// v50.50: Stories is all pictures: no right-click/long-press menu anywhere in it, except in text fields
window.addEventListener('contextmenu',e=>{const t=e.target;if(!(t&&t.closest&&t.closest('input,textarea,[contenteditable]')))e.preventDefault()},true);
document.addEventListener('dragstart',e=>{if(e.target&&e.target.tagName==='IMG')e.preventDefault()},true);
