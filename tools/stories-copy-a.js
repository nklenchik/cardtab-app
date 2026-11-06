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
    S.push({k:'Where the cards came from',cover:pl[0].k,h:pct>=40?'Mostly from '+esc(pl[0].k)+'.':esc(pl[0].k)+' led the way.',line:cntSpan(pct,'','%')+' of '+perOf+'purchases came from '+esc(pl[0].k)+'.',
    vis:p=>'<div class="plat">'+pl.slice(0,4).map((q,i)=>{const sh=Math.round(q.v/tot*100);return '<div><span>'+esc(q.k)+(H?'<em data-count="'+sh+'" data-suf="%" data-d="'+(350+i*120)+'">'+sh+'%</em>':'<em data-count="'+Math.round(q.v/100)+'" data-pre="$" data-d="'+(350+i*120)+'">'+short(q.v)+'</em>')+'</span><i style="width:'+(q.v/pl[0].v*100).toFixed(1)+'%;background:'+(i?p.ink:p.acc)+';opacity:'+(i?.4:1)+';--d:'+(.35+i*.12)+'s"></i></div>'}).join('')+'</div>'})}
  else S.push({k:'Where the cards came from',cover:'Platforms',h:'No purchases yet.',line:'Platforms show up once a purchase is logged.',vis:()=>''});
  // 4 · on budget: each checked month pulses as the count reaches it (never shows the budget amount)
  const unit=x.one?x.wk.map(w=>({ok:w.spent<=x.WB,l:String(w.d)})):x.by.slice(-12).map((m,i)=>({ok:m.spent<=BUDGET,l:mName(M.slice(-12)[i],{month:'narrow'})}));
  const okN=unit.filter(u=>u.ok).length,unitW=x.one?'weeks':'months';let run=0,bestRun=0;unit.forEach(u=>{run=u.ok?run+1:0;bestRun=Math.max(bestRun,run)});
  S.push({k:'On budget',cover:okN+' of '+unit.length,h:okN===unit.length&&unit.length?'Under budget every '+(x.one?'week':'month')+'.':okN/Math.max(1,unit.length)>=.5?'Under budget most '+unitW+'.':'Budget: a work in progress.',big:cntSpan(okN,'',' of '+unit.length,2600),
    line:'Spending stayed under the '+(x.one?'weekly':'monthly')+' budget in '+okN+' of '+(x.one?'the month’s ':'the last ')+unit.length+' '+unitW+(bestRun>1&&bestRun<unit.length?', with '+bestRun+' in a row.':'.'),
    vis:p=>{let j=0;const cols=Math.min(6,unit.length);return '<div class="mo" style="grid-template-columns:repeat('+cols+',minmax(0,1fr))">'+unit.map(u=>{if(u.ok)++j;
      return '<div><i class="'+(u.ok?'ok':'no')+'" style="background:'+(u.ok?p.acc:'transparent')+';border:2px solid '+p.acc+';color:'+p.on+(u.ok?';--d:'+(.15+(1-Math.sqrt(1-(j-.5)/Math.max(1,okN)))*2.6).toFixed(2)+'s':'')+'">'+(u.ok?'✓':'')+'</i>'+esc(u.l)+'</div>'}).join('')+'</div>'}});
  // 5 · in and out
  const pct5=x.nbE?Math.round(x.soldE/x.nbE*100):0,keep=x.hold.length,soldArt=[...new Set(x.L.filter(e=>e.type==='sale').map(e=>e.name))],fan=(soldArt.filter(artOf).concat(soldArt.filter(n=>!artOf(n)))).slice(0,3);
  S.push({k:'In and out',cover:pct5+'% sold',h:pct5>=50?'Most cards moved on.':'The collection keeps growing.',big:cntSpan(pct5,'','%'),line:'of the cards bought have sold. '+keep+' '+(keep===1?'is':'are')+' still in the binder.',
    vis:()=>fan.length?'<div class="sfan">'+fan.map(cardEl).join('')+'</div>':''});
  // 6 · the game: card art drifts past in a slow wall
  const buys=x.L.filter(e=>e.type==='purchase'),g={};let all=0;buys.forEach(e=>{const q=e.qty||1;all+=q;const k=gameOf(e)||'other';g[k]=(g[k]||0)+q});
  const top=Object.keys(g).filter(k=>k!=='other').sort((a,b)=>g[b]-g[a])[0],gp=top?Math.round(g[top]/Math.max(1,all)*100):0;
  const arts=[...new Set(x.L.map(e=>e.name).filter(artOf))].slice(0,9);
  const col=(list,cls)=>'<div class="col'+(cls||'')+'">'+list.concat(list).map(cardEl).join('')+'</div>';
  if(all&&top)S.push({k:'The game',cover:top,h:gp>=60?'A <u style="text-decoration-color:{acc}">lot</u> of '+esc(top)+'.':gp>50?'Mostly '+esc(top)+'.':gp===50?'Half '+esc(top)+', half everything else.':'A bit of everything, led by '+esc(top)+'.',big:cntSpan(gp,'','%'),line:'of purchases were '+esc(top)+'. '+(g[top]===all?(all===1?'1 card.':'All '+all+' cards.'):g[top]+' of '+cnt(all,'card','cards')+'.'),
    vis:()=>arts.length>=3?'<div class="wall">'+col(arts.filter((_,i)=>i%3===0))+col(arts.filter((_,i)=>i%3===1),' dn')+col(arts.filter((_,i)=>i%3===2))+'</div>':'<div class="sfan">'+[...new Set(buys.map(e=>e.name))].slice(0,3).map(cardEl).join('')+'</div>'});
  else S.push({k:'The cards',cover:all?cnt(all,'card','cards'):'Cards',h:all?cnt(all,'card','cards')+' collected.':'No cards yet.',line:all?'Across every game.':'Log a purchase to start this story.',vis:()=>arts.length?'<div class="sfan">'+arts.slice(0,3).map(cardEl).join('')+'</div>':''});
  return S}
