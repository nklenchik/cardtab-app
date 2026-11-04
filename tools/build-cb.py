import json,base64
P=json.load(open('dash-parts.json'))
board_css=open('board-part.html').read().replace('__SITECSS__',open('site-cb.css').read())+open('board3.css').read()
markup='''<section class="cbx enter" id="cbx" hidden role="dialog" aria-modal="true" aria-label="Card Board">
<div id="cb"><div class="frame">
  <div class="topbar">
    <h1 class="cbt">Card Board <span class="prem"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>Premium</span></h1>
    <div class="tctl">
    <button type="button" class="tlink" id="cb-reset" hidden>Reset to default</button>
    <button type="button" class="tbtn" id="cb-edit">Customize</button>
    <div class="perwrap"><button type="button" class="pill alt" id="cb-plat" aria-haspopup="true" aria-expanded="false"><span id="cb-platl">All platforms</span> <i>▾</i></button><div class="cb-menu" id="cb-pmenu" hidden role="menu"></div></div>
    <div class="perwrap"><button type="button" class="pill on" id="cb-per" aria-haspopup="true" aria-expanded="false"><span id="cb-perl">Last 12 months</span> <i>▾</i></button><div class="cb-menu" id="cb-menu" hidden role="menu"></div></div>
    </div>
    <button class="close" id="close" type="button" aria-label="Close Card Board"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg></button>
  </div>
  <div class="simple" id="simple"></div>
</div>
<div class="cb-menu" id="wmenu" hidden role="menu"></div>
<dialog id="aw" aria-labelledby="aw-h"><div class="awp">
  <div class="awh"><h2 id="aw-h">Add a widget</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <div><p class="lab">What to measure</p><div class="chips" id="aw-metrics"></div></div>
  <div><p class="lab">Show it as</p><div class="chips" id="aw-views"></div></div>
  <div><p class="lab">Size</p><div class="chips" id="aw-sizes"></div></div>
  <div class="prev" id="aw-prev"></div>
  <button type="button" class="go" id="aw-go">Add to board</button>
</div></dialog>
</div>
</section>
<div class="tip" id="tip" role="tooltip"></div>
<div class="note" id="note">Preview with your real entries · click ⤢ on Insights</div>
'''
tipcss='''.tip{position:fixed;z-index:60;pointer-events:none;background:var(--text);color:var(--bg);border-radius:10px;padding:8px 11px;font-size:12.5px;line-height:1.4;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0;transition:opacity .12s;text-align:left}
.tip.on{opacity:1}
.note{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:40;background:var(--text);color:var(--bg);border-radius:999px;padding:8px 14px;font-size:12px;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.2)}
'''
data=open('cb-data2.json').read()
head_js='''<script>
(function(){
'use strict';
// Nick's 199 entries from Card_Collection.xlsx (Cash Flow), as Card Tab's import read them: [date, type, platform, card, amount¢, net¢, qty, number, set]
const RAW=__DATA__;
const E=RAW.map(r=>({date:r[0],type:r[1]==='s'?'sale':r[1]==='r'?'refund':'purchase',platform:r[2]||'Other',name:r[3],amount:r[4],net:r[5],qty:r[6]||1,no:r[7]||'',set:r[8]||''}));
const TODAY='2026-11-03';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money=(c,d=2)=>(c<0?'−':'')+'$'+(Math.abs(c)/100).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const pad=n=>String(n).padStart(2,'0');
const ym=d=>d.slice(0,7);
const mLabel=(k,o)=>new Date(k+'-15T12:00:00').toLocaleString('en-US',o);
function monthsBack(n){const t=new Date(TODAY+'T12:00:00'),out=[];for(let i=n-1;i>=0;i--){const d=new Date(t.getFullYear(),t.getMonth()-i,1);out.push(d.getFullYear()+'-'+pad(d.getMonth()+1))}return out}
function totals(list){let sales=0,after=0,spent=0,ref=0,fees=0;list.forEach(e=>{if(e.type==='sale'){sales+=e.amount;after+=e.net;fees+=e.amount-e.net}else if(e.type==='purchase')spent+=e.amount;else ref+=e.amount});after-=ref;return{sales,after,spent,profit:after-spent,fees,n:list.length}}
const calm=matchMedia('(prefers-reduced-motion: reduce)');
'''.replace('__DATA__',data)
page=P['css']+board_css+tipcss+'</style>\n\n'+P['html']+markup+head_js+P['js']+open('board3.js').read()+'\n})();\n</script>\n'
logo='data:image/webp;base64,'+base64.b64encode(open('/home/claude/cardtab-app/app/assets/logo-128.webp','rb').read()).decode()
open('card-board-preview.html','w').write(page.replace('__LOGO__',logo))
print(len(page))
