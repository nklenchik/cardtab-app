// v50.69: which entries are the same card. Shared by the Card Board (build-cb.py) and Stories (mk-stories.py).
// An entry belongs to a card by its matched catalog card, else its exact name and number, kept apart by grade.
// A sale with no purchase of its own may join a purchase written differently ("Wartortle" vs "Wartortle - 008/165 - 151"),
// but only when exactly one bought card fits: same name once the number, set and year are taken out, same grade,
// no disagreement on card number or set, and bought on or before the sale. A Flygon 15/97 sale never joins a Flygon 088/080 buy.
const CM=(()=>{
  const NUMRE=/(?:\b(?:SWSH|SVP|SV|SM|XY|BW|HGSS|DP|MEP)\s?\d{2,3}\b|\b[A-Z]{0,4}\d{1,4}[a-z]?\s*\/\s*[A-Z]{0,4}\d{1,4}\b)/i;
  const strip=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const normNo=v=>String(v||'').toUpperCase().replace(/\s+/g,'').replace(/\d+/g,d=>String(parseInt(d,10)));
  const noOf=e=>normNo(e.no)||normNo((String(e.name||'').match(NUMRE)||[])[0]);
  const setOf=e=>strip(e.set);
  const baseOf=e=>{let n=String(e.name||'').replace(new RegExp(NUMRE.source,'gi'),' ').replace(/#\s?\d+/g,' ').replace(/\b(?:19|20)\d{2}\b/g,' ');
    if(e.set)n=n.split(e.set).join(' ');return strip(n)};
  const gTag=e=>e.grade&&e.grade.co?'#'+e.grade.co+e.grade.g+(e.grade.w||''):'';
  const exact=e=>strip(e.name)+'|'+(e.no||'');
  const setsAgree=(a,b)=>!a||!b||a===b||a.includes(b)||b.includes(a);
  function make(rows){
    const idOf={};rows.forEach(e=>{if(e.cardId){const x=exact(e);idOf[x]=idOf[x]||'id:'+e.cardId}});
    const base=e=>((e.cardId?'id:'+e.cardId:idOf[exact(e)])||exact(e))+gTag(e);
    // the same name and number from two different sets are two cards (a set written two ways, "151" and "SV 151", still agrees)
    const variants={},groups={},byBase={};
    const variantOf=(e,add)=>{const b=base(e),s=setOf(e),V=variants[b]||[];let v=V.find(x=>!s||!x.set||setsAgree(s,x.set));
      if(!v&&add){v={k:V.length?b+'~'+s:b,set:s};(variants[b]=V).push(v)}if(v&&add&&s&&!v.set)v.set=s;return v};
    rows.filter(e=>e.type==='purchase').sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).forEach(e=>{const k=variantOf(e,true).k;let G=groups[k];
      if(!G){G=groups[k]={k,nos:new Set(),sets:new Set(),first:e.date};const b=baseOf(e)+gTag(e);(byBase[b]=byBase[b]||[]).push(G)}
      const n=noOf(e),s=setOf(e);if(n)G.nos.add(n);if(s)G.sets.add(s);if(e.date<G.first)G.first=e.date});
    const fits=(e,G)=>{const n=noOf(e),s=setOf(e);if(n&&G.nos.size&&!G.nos.has(n))return false;
      if(s&&G.sets.size&&![...G.sets].some(x=>setsAgree(s,x)))return false;return G.first<=e.date};
    const memo=new Map();
    return e=>{let m=memo.get(e);if(m)return m;const v=variantOf(e,false);
      if(v)m=v.k;else{const own=base(e)+(variants[base(e)]?'~'+setOf(e):'');
        if(e.type!=='sale')m=own;else{const c=(byBase[baseOf(e)+gTag(e)]||[]).filter(G=>fits(e,G));m=c.length===1?c[0].k:own}}
      memo.set(e,m);return m}}
  // one row per sale with what its copies cost: the average cost of this card's purchases made on or before the sale
  // (a sale from before you bought it has no known cost and is left out). bought = the latest of those purchases.
  function saleCost(buys,e){let c=0,q=0,last='';buys.forEach(b=>{if(b.date<=e.date){c+=b.amount;q+=b.qty||1;if(b.date>last)last=b.date}});
    if(!q||c<=0)return null;const n=e.qty||1;return {cost:Math.round(c/q*n),bought:last}}
  return {make,saleCost,noOf,baseOf}})();
