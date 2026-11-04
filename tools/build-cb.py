import json,base64
P=json.load(open('dash-parts.json'))
board_css=open('board-part.html').read().replace('__SITECSS__',open('site-cb.css').read())+open('board4.css').read()+open('board5.css').read()+open('board6.css').read()+open('board7.css').read()+open('board8.css').read()+open('board9.css').read()
markup='''<div class="cbxbg" id="cbxbg" aria-hidden="true"></div>
<section class="cbx off" id="cbx" inert aria-hidden="true" role="dialog" aria-modal="true" aria-label="Card Board">
<div id="cb"><div class="frame">
  <div class="topbar">
    <button class="back" id="close" type="button" aria-label="Back to dashboard"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>Dashboard</span></button>
    <h1 class="cbt"><span class="cbtn" id="cbtn">Card Board</span><span class="ehint2">Drag to move · drag a corner to resize</span></h1>
    <div class="tctl">
    <button type="button" class="tbtn edit" id="cb-edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg><span>Edit</span></button>
    <div class="perwrap"><button type="button" class="pill on" id="cb-per" aria-haspopup="true" aria-expanded="false"><span id="cb-perl">Last 12 months</span> <i>▾</i></button><div class="cb-menu" id="cb-menu" hidden role="menu"></div></div>
    <div class="perwrap"><button type="button" class="pill alt" id="cb-plat" aria-haspopup="true" aria-expanded="false"><span id="cb-platl">All platforms</span> <i>▾</i></button><div class="cb-menu" id="cb-pmenu" hidden role="menu"></div></div>
    <span class="ehint">Drag to move · drag a corner to resize</span>
    
    </div>
    <button type="button" class="iconb" id="cb-ask" aria-label="Ask about your numbers"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2 5.3 5.5 1.9-5.5 2-2 5.3-2-5.3-5.5-2 5.5-1.9z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg><span>Ask</span></button>
    <button type="button" class="iconb" id="cb-share" aria-label="Share Card Board"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3L10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/></svg><span>Share</span></button>
    <div class="perwrap acctw"><button type="button" class="acct" id="cb-acct" aria-haspopup="true" aria-expanded="false" aria-label="Account"><span class="av" id="cb-av">N</span></button>
<div class="cb-menu am" id="cb-amenu" hidden role="menu">
  <button type="button" class="amh" data-am="profile"><span class="av lg" id="cb-av2">N</span><span><b><span id="am-name">Nick</span> <i class="prem2">✦ Premium</i></b><small>nklenchik@gmail.com</small></span></button>
  <div class="amg"><button type="button" data-am="profile"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.4-3.8 4.2-5.8 7.5-5.8s6.1 2 7.5 5.8"/></svg>Edit profile</button><button type="button" data-am="plan"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.1 5.6 5.9 2-5.9 2.1L12 19l-2.1-5.8L4 11.1l5.9-2z"/></svg>Plan and billing</button></div>
  <div class="amg"><button type="button" data-am="import"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M12 11.5v6M9 14.5h6"/></svg>Import entries</button><button type="button" data-am="export"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 14.5V19h14v-4.5"/></svg>Export</button></div>
  <div class="amg"><button type="button" data-am="plat"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5L5.5 5h13L20 9.5M5 9.5V19h14V9.5M4 9.5h16M10 19v-5h4v5"/></svg>Platforms and fees</button><button type="button" data-am="goal"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>Budget and goals</button></div>
  <div class="amg"><div class="amr"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg><span>Appearance</span><div class="seg" id="am-theme" role="radiogroup" aria-label="Appearance"><button type="button" data-th="light" role="radio">Light</button><button type="button" data-th="dark" role="radio">Dark</button><button type="button" data-th="auto" role="radio">Auto</button></div></div>
    <div class="amr" id="am-hapr"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3.5" width="8" height="17" rx="2.2"/><path d="M4.5 9v6M19.5 9v6"/></svg><span>Haptics</span><button type="button" class="swt" id="am-hap" role="switch" aria-checked="true" aria-label="Haptics"><i></i></button></div></div>
  <div class="amg"><button type="button" data-am="help"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8h.01"/></svg>Help and feedback</button><button type="button" data-am="out"><svg class="mi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>Sign out</button></div>
</div></div>
  </div>
  <div class="vbar" id="vbar" hidden><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>This is what people with your link see</span><button type="button" class="tbtn" id="vbar-x">Back to my board</button></div>
  <button type="button" class="addbar" id="addw" hidden><span aria-hidden="true">+</span> Add widget</button>
  <div class="simple" id="simple"></div>
  <div class="editfoot" id="editfoot" hidden><button type="button" class="tlink rst" id="cb-reset"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>Reset to the starting layout</button></div>
</div>
<div class="cb-menu" id="wmenu" hidden role="menu"></div>
<dialog id="shd" class="sheet" aria-labelledby="sh-h"><div class="awp shp">
  <div class="awh"><h2 id="sh-h">Share Card Board</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <div class="shcard"><div class="shrow"><span class="shic" id="sh-acct"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></span><div class="shtx"><b>Share with a link</b><small id="sh-state"></small></div><button type="button" class="swt" role="switch" id="sh-on" aria-checked="false" aria-label="Share with a link"><i></i></button></div>
    <div class="shlink" id="sh-linkrow"><input id="sh-link" readonly aria-label="Share link"><button type="button" class="tbtn" id="sh-copy">Copy link</button></div>
    <button type="button" class="tlink" id="sh-new">Make a new link</button></div>
  <div class="shcard"><p class="lab">Send by email</p><div class="shmail"><input id="sh-email" type="email" placeholder="name@example.com" autocomplete="email" aria-label="Email address"><button type="button" class="tbtn" id="sh-add">Add</button></div><p class="shmsg" id="sh-emsg"></p><div class="echips" id="sh-emails"></div></div>
  <div class="shcard"><p class="lab">What people with the link see</p>
    <div class="shrow"><div class="shtx"><b>Dollar amounts</b><small>Off shows percentages and counts only</small></div><button type="button" class="swt" role="switch" id="sh-amt" aria-checked="false" aria-label="Show dollar amounts"><i></i></button></div>
    <div class="shrow"><div class="shtx"><b>Card names</b><small>Off hides which cards you bought and sold</small></div><button type="button" class="swt" role="switch" id="sh-names" aria-checked="false" aria-label="Show card names"><i></i></button></div>
    <div class="shrow"><div class="shtx"><b>Details on hover and tap</b><small>Off turns off tooltips and opening rows</small></div><button type="button" class="swt" role="switch" id="sh-tips" aria-checked="false" aria-label="Show details"><i></i></button></div>
    <div class="shrow"><div class="shtx"><b>Keep it updated</b></div><div class="seg" id="sh-live" role="radiogroup" aria-label="Keep it updated"><button type="button" role="radio" data-v="live">Live</button><button type="button" role="radio" data-v="snap">Today’s snapshot</button></div></div>
    <div class="shrow"><div class="shtx"><b>Link stops working</b></div><div class="seg" id="sh-exp" role="radiogroup" aria-label="Link stops working"><button type="button" role="radio" data-v="never">Never</button><button type="button" role="radio" data-v="7">In 7 days</button><button type="button" role="radio" data-v="30">In 30 days</button></div></div></div>
  <button type="button" class="go ghost" id="sh-view">See what they’ll see</button>
  <p class="shnote">Preview: links and emails start working once Card Tab is online.</p>
</div></dialog>
<dialog id="askd" class="sheet drawer" aria-labelledby="ask-h"><div class="awp askp">
  <div class="awh"><div class="askt"><span class="askic" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2 5.3 5.5 1.9-5.5 2-2 5.3-2-5.3-5.5-2 5.5-1.9z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg></span><div><h2 id="ask-h">Ask</h2><small class="askscope" id="ask-scope"></small></div></div><div class="askh"><button type="button" class="tlink" id="ask-new">New chat</button><button type="button" class="x" data-close aria-label="Close">✕</button></div></div>
  <div class="asklog" id="ask-log" aria-live="polite"></div>
  <div class="askstarts" id="ask-starts"></div>
  <p class="askoff" id="ask-off">Ask isn’t available in this view. It works inside Claude now and in the Card Tab app later.</p>
  <form class="askform" id="ask-form" hidden><input id="ask-in" placeholder="Ask about your numbers" autocomplete="off" aria-label="Your question"><button type="submit" class="askgo" id="ask-go" aria-label="Ask"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button><button type="button" class="askgo stop" id="ask-stop" hidden aria-label="Stop"><i></i></button></form>
  <p class="askleft" id="ask-left" role="status" hidden></p>
  <p class="askfine">Answers use only the numbers on this board, for the dates and platforms you picked.</p>
</div></dialog>
<dialog id="rs" class="sheet" aria-labelledby="rs-h"><div class="awp rsp">
  <h2 id="rs-h">Reset the board?</h2><p>Your widgets go back to the starting layout. Your entries aren’t touched.</p>
  <div class="rsb"><button type="button" class="tbtn" id="rs-no">No</button><button type="button" class="go danger" id="rs-yes">Yes, reset</button></div>
</div></dialog>
<dialog id="cr" class="sheet" aria-labelledby="cr-h"><div class="awp crp">
  <div class="awh"><h2 id="cr-h">Custom dates</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <div class="crsum"><button type="button" class="crb" id="cr-fb"><small>From</small><b id="cr-f"></b></button><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg><button type="button" class="crb" id="cr-tb"><small>To</small><b id="cr-t"></b></button></div>
  <div class="cal"><div class="calh"><button type="button" id="cr-prev" aria-label="Previous month">‹</button><b id="cr-title" aria-live="polite"></b><button type="button" id="cr-next" aria-label="Next month">›</button></div>
    <div class="calw" aria-hidden="true"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="cald" id="cr-days"></div></div>
  <div class="crcmp"><span>Compare to</span><div class="seg" id="cr-cmp" role="radiogroup" aria-label="Compare to"><button type="button" role="radio" data-cmp="prev">Previous period</button><button type="button" role="radio" data-cmp="year">Last year</button><button type="button" role="radio" data-cmp="off">Off</button></div></div>
  <p class="crn" id="cr-n" role="status"></p>
  <button type="button" class="go" id="cr-go">Show these dates</button>
</div></dialog>
<dialog id="av" class="sheet" aria-labelledby="av-h"><div class="awp avp">
  <div class="awh"><h2 id="av-h">Edit profile</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <div class="nmf"><label>First name<input id="pf-first" autocomplete="given-name" maxlength="40"></label><label>Last name<input id="pf-last" autocomplete="family-name" maxlength="40" placeholder="Optional"></label></div>
  <div class="shw"><span>Show my name as</span><div class="seg" id="pf-show" role="radiogroup" aria-label="Show my name as"><button type="button" role="radio" data-sh="first">First name</button><button type="button" role="radio" data-sh="full">Full name</button></div></div>
  <div class="avstage"><div class="avc" id="av-c"><img id="av-img" alt="" hidden draggable="false"><span id="av-l">N</span></div></div>
  <div class="avzoom" id="av-zw" hidden><span aria-hidden="true">−</span><input type="range" id="av-zoom" min="1" max="3" step="0.01" value="1" aria-label="Zoom"><span aria-hidden="true">+</span></div>
  <p class="avhint" id="av-hint" hidden>Drag the photo to position it</p>
  <div id="av-colw"><p class="lab">Color</p><div class="avpal"><div class="avsw" id="av-sw" role="radiogroup" aria-label="Color"></div>
    <div class="cpk" id="av-cpk" hidden><div class="sv" id="cp-sv" tabindex="0" role="slider" aria-label="Color shade. Arrow keys adjust."><i id="cp-dot"></i></div><input type="range" class="hue" id="cp-hue" min="0" max="359" step="1" aria-label="Hue"></div>
    <label class="hexf"><span>Hex</span><input id="av-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex color"></label></div></div>
  <div class="avbtns"><label class="tbtn">Upload photo<input type="file" accept="image/*" id="av-up" hidden></label><label class="tbtn" id="av-camw">Take photo<input type="file" accept="image/*" capture="user" id="av-cam" hidden></label><button type="button" class="tlink" id="av-rm" hidden>Remove photo</button></div>
  <button type="button" class="go" id="av-save">Save</button>
</div></dialog>
<dialog id="ex" class="sheet" aria-labelledby="ex-h"><div class="awp exp">
  <div class="awh"><h2 id="ex-h">Export</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <div class="exg"><p class="lab">Your entries</p><div class="chips"><button type="button" data-ex="csv">CSV</button><button type="button" data-ex="xlsx">Excel</button></div><small>Every entry, to the cent, with fees and shipping.</small></div>
  <div class="exg"><p class="lab">Report</p><div class="chips"><button type="button" data-ex="pdf">PDF</button></div><small>This Card Board, ready to share or print.</small></div>
  <div class="exg"><p class="lab">Card Board as an image</p><div class="chips"><button type="button" data-ex="png">PNG</button><button type="button" data-ex="jpg">JPG</button><button type="button" data-ex="webp">WebP</button></div><small>For sharing. Uses the period and platform you have picked.</small></div>
  <p class="exs" id="ex-s" role="status"></p>
</div></dialog>
<div class="cbtoast" id="cbtoast" role="status" aria-live="polite"></div>
<dialog id="aw" class="sheet awg" aria-labelledby="aw-h"><div class="awp">
  <div class="awtop"><div class="awh"><h2 id="aw-h">Add widgets</h2><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <label class="aws"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="aw-q" type="search" placeholder="Search widgets" autocomplete="off" aria-label="Search widgets"></label>
  <div class="seg awseg" id="aw-cats" role="group" aria-label="Kind"><button type="button" data-c="all" aria-pressed="true">All</button><button type="button" data-c="num" aria-pressed="false">Numbers</button><button type="button" data-c="chart" aria-pressed="false">Charts</button><button type="button" data-c="list" aria-pressed="false">Lists</button></div></div>
  <div class="thumbs" id="aw-list"></div>
  <div class="awfoot"><p class="awhint">Tap to add · tap again to remove · resize from the corner on your board</p>
  <button type="button" class="go" data-close>Done</button></div>
  <div class="awt" id="aw-t" role="status" aria-live="polite"></div>
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
