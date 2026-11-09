# Rebuilds stories2.tpl.html from the v38 base plus the v39 Stories module.
s=open('stories2.v38.bak.html').read()
a="  return {lab,stories:["; assert a in s
s=s.replace(a,"  return {lab,x:{t,roi,f0,bigSale,plats,by,M,under,one,wk,WB,nbE,soldE,hold,hv,L,cum,mo1},stories:[")
css=open('stories-v39.css').read(); i=s.rfind('</style>'); s=s[:i]+css+s[i:]
m="\n})();\n\n// v33.1"; assert m in s; s=s.replace(m,"\n"+open('stories-v39.js').read()+m,1)
# v42.27: saving uses the six stories shown (the old list had five, so Save all left the last story out)
for a,b2 in [("D.stories[n].name.replace(","(SS[n]?SS[n].k:D.stories[n].name).replace("),("D.stories[list[0]].name","(SS[list[0]]?SS[list[0]].k:D.stories[list[0]].name)"),("saveStories([0,1,2,3,4].slice(0,D.stories.length))","saveStories(SS.map((_,i)=>i))")]:
    assert a in s, a; s=s.replace(a,b2)

# v50.53: Top win is the best single sale (priced at the card's average cost per copy), not every sale of a card added up
a="  const flips=Object.keys(sells).filter(k=>buys[k]).map(k=>{const b=buys[k].slice().sort((x,z)=>x.date<z.date?-1:1)[0],s=sells[k][sells[k].length-1],c=buys[k].reduce((a,e)=>a+e.amount,0),kept=sells[k].reduce((a,e)=>a+e.net,0),g=sells[k].reduce((a,e)=>a+e.amount,0);return {name:b.name,b,s,cost:c,kept,gross:g,gain:kept-c,held:Math.max(0,days(b.date,s.date))}}).sort((a,b)=>b.gain-a.gain);"
assert a in s
s=s.replace(a,"  const flips=[];Object.keys(sells).filter(k=>buys[k]).forEach(k=>{const bl=buys[k],b=bl.slice().sort((x,z)=>x.date<z.date?-1:1)[0],bq=bl.reduce((a,e)=>a+(e.qty||1),0),per=bl.reduce((a,e)=>a+e.amount,0)/Math.max(1,bq);sells[k].forEach(s=>{const c=Math.round(per*(s.qty||1));flips.push({name:b.name,b,s,cost:c,kept:s.net,gross:s.amount,gain:s.net-c,held:Math.max(0,days(b.date,s.date))})})});flips.sort((a,b)=>b.gain-a.gain);")

# v50.67: a sale finds its purchase by the matched catalog card, then exact name+number, then the name alone (one bought card)
a="const key=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+e.no;"
assert a in s
s=s.replace(a,"const exactKey=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+e.no,looseKey=e=>e.name.toLowerCase().replace(/[^a-z0-9]/g,'');let KC=null;const key=e=>{if(!KC||KC.E!==E){const idOf={},bought={};E.forEach(x=>{if(x.cardId)idOf[exactKey(x)]=idOf[exactKey(x)]||'id:'+x.cardId});const kO=x=>(x.cardId?'id:'+x.cardId:idOf[exactKey(x)])||exactKey(x);E.forEach(x=>{if(x.type==='purchase'){const l=looseKey(x);(bought[l]=bought[l]||new Set()).add(kO(x))}});KC={E,kO,bought}}const k=KC.kO(e);if(e.type!=='sale')return k;const l=KC.bought[looseKey(e)];return l&&!l.has(k)&&l.size===1?[...l][0]:k};")
a="no:r.no||'',set:r.set||'',art:r.art||null}));"
assert a in s
s=s.replace(a,"no:r.no||'',set:r.set||'',art:r.art||null,cardId:r.cardId||''}));")
open('stories2.tpl.html','w').write(s)
