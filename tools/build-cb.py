import json,base64
P=json.load(open('dash-parts.json'))
board_css=open('board-part.html').read().replace('__SITECSS__',open('site-cb.css').read())+open('board4.css').read()+open('board5.css').read()+open('board6.css').read()
markup='''<section class="cbx enter" id="cbx" hidden role="dialog" aria-modal="true" aria-label="Card Board">
<div id="cb"><div class="frame">
  <div class="topbar">
    <button class="back" id="close" type="button" aria-label="Back to dashboard"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>Dashboard</span></button>
    <h1 class="cbt">Card Board <span class="prem"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>Premium</span></h1>
    <div class="tctl">
    <span class="ehint">Drag to move · drag a corner to resize</span><button type="button" class="tlink" id="cb-reset" hidden>Reset to default</button>
    <button type="button" class="tbtn" id="cb-edit">Customize</button>
    <div class="perwrap"><button type="button" class="pill alt" id="cb-plat" aria-haspopup="true" aria-expanded="false"><span id="cb-platl">All platforms</span> <i>▾</i></button><div class="cb-menu" id="cb-pmenu" hidden role="menu"></div></div>
    <div class="perwrap"><button type="button" class="pill on" id="cb-per" aria-haspopup="true" aria-expanded="false"><span id="cb-perl">Last 12 months</span> <i>▾</i></button><div class="cb-menu" id="cb-menu" hidden role="menu"></div></div>
    </div>
    <div class="perwrap acctw"><button type="button" class="acct" id="cb-acct" aria-haspopup="true" aria-expanded="false" aria-label="Account"><span class="av" id="cb-av">N</span></button>
<div class="cb-menu am" id="cb-amenu" hidden role="menu">
  <button type="button" class="amh" data-am="profile"><span class="av lg" id="cb-av2">N</span><span><b>Nick <i class="prem2">✦ Premium</i></b><small>nklenchik@gmail.com</small></span></button>
  <div class="amg"><button type="button" data-am="profile"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.4-3.8 4.2-5.8 7.5-5.8s6.1 2 7.5 5.8"/></svg>Edit profile</button><button type="button" data-am="plan"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.1 5.6 5.9 2-5.9 2.1L12 19l-2.1-5.8L4 11.1l5.9-2z"/></svg>Plan and billing</button></div>
  <div class="amg"><button type="button" data-am="import"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 14.5V19h14v-4.5"/></svg>Import entries</button><button type="button" data-am="export"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 14.5V19h14v-4.5"/></svg>Export</button></div>
  <div class="amg"><button type="button" data-am="plat"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5L5.5 5h13L20 9.5M5 9.5V19h14V9.5M4 9.5h16M10 19v-5h4v5"/></svg>Platforms and fees</button><button type="button" data-am="goal"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>Budget and goals</button></div>
  <div class="amg"><div class="amr"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg><span>Appearance</span><div class="seg" id="am-theme" role="radiogroup" aria-label="Appearance"><button type="button" data-th="light" role="radio">Light</button><button type="button" data-th="dark" role="radio">Dark</button><button type="button" data-th="auto" role="radio">Auto</button></div></div>
    <div class="amr" id="am-hapr"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3.5" width="8" height="17" rx="2.2"/><path d="M4.5 9v6M19.5 9v6"/></svg><span>Haptics</span><button type="button" class="swt" id="am-hap" role="switch" aria-checked="true" aria-label="Haptics"><i></i></button></div></div>
  <div class="amg"><button type="button" data-am="help"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8h.01"/></svg>Help and feedback</button><button type="button" data-am="out"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>Sign out</button></div>
</div></div>
  </div>
  <div class="simple" id="simple"></div>
</div>
<div class="cb-menu" id="wmenu" hidden role="menu"></div>
<dialog id="av" class="sheet" aria-labelledby="av-h"><div class="awp avp">
  <div class="awh"><h2 id="av-h">Your picture</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <div class="avstage"><div class="avc" id="av-c"><img id="av-img" alt="" hidden draggable="false"><span id="av-l">N</span></div></div>
  <div class="avzoom" id="av-zw" hidden><span aria-hidden="true">−</span><input type="range" id="av-zoom" min="1" max="3" step="0.01" value="1" aria-label="Zoom"><span aria-hidden="true">+</span></div>
  <p class="avhint" id="av-hint" hidden>Drag the photo to position it</p>
  <div id="av-colw"><p class="lab">Color</p><div class="avsw" id="av-sw" role="radiogroup" aria-label="Color"></div></div>
  <div class="avbtns"><label class="tbtn">Upload photo<input type="file" accept="image/*" id="av-up" hidden></label><label class="tbtn" id="av-camw">Take photo<input type="file" accept="image/*" capture="user" id="av-cam" hidden></label><button type="button" class="tlink" id="av-rm" hidden>Remove photo</button></div>
  <button type="button" class="go" id="av-save">Save</button>
</div></dialog>
<dialog id="ex" class="sheet" aria-labelledby="ex-h"><div class="awp exp">
  <div class="awh"><h2 id="ex-h">Export</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <div class="exg"><p class="lab">Your entries</p><div class="chips"><button type="button" data-ex="csv">CSV</button><button type="button" data-ex="xlsx">Excel</button></div><small>Every entry, to the cent, with fees and shipping.</small></div>
  <div class="exg"><p class="lab">Report</p><div class="chips"><button type="button" data-ex="pdf">PDF</button></div><small>This Card Board, ready to print or save.</small></div>
  <div class="exg"><p class="lab">Card Board as an image</p><div class="chips"><button type="button" data-ex="png">PNG</button><button type="button" data-ex="jpg">JPG</button><button type="button" data-ex="webp">WebP</button></div><small>For sharing. Uses the period and platform you have picked.</small></div>
  <p class="exs" id="ex-s" role="status"></p>
</div></dialog>
<div class="cbtoast" id="cbtoast" role="status" aria-live="polite"></div>
<dialog id="aw" aria-labelledby="aw-h"><div class="awp">
  <div class="awh"><h2 id="aw-h">Add a widget</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <div class="opts" id="aw-list"></div>
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
page=P['css']+board_css+tipcss+'</style>\n\n'+P['html']+markup+head_js+P['js']+open('board5.js').read()+'\n})();\n</script>\n'
logo='data:image/webp;base64,'+base64.b64encode(open('/home/claude/cardtab-app/app/assets/logo-128.webp','rb').read()).decode()
open('card-board-preview.html','w').write(page.replace('__LOGO__',logo))
print(len(page))
