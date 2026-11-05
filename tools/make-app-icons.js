const pw=require('playwright');const fs=require('fs');(async()=>{const b=await pw.chromium.launch();const p=await b.newPage();
const svg=fs.readFileSync('app-soft/favicon.svg','utf8');
for(const [n,sz,mask] of [['icon-192.png',192,0],['icon-512.png',512,0],['icon-maskable-512.png',512,1]]){
 await p.setViewportSize({width:sz,height:sz});
 // regular: the logo fills the square; maskable: the logo sits in the middle 80% safe zone on the brand red, so any phone's mask shape keeps it whole
 await p.setContent('<html><body style="margin:0;overflow:hidden;background:'+(mask?'#bc103e':'transparent')+';display:grid;place-items:center;width:'+sz+'px;height:'+sz+'px"><div style="position:absolute;left:'+(mask?-Math.round(sz*.12):0)+'px;top:'+(mask?-Math.round(sz*.12):0)+'px;width:'+(mask?Math.round(sz*1.24):sz)+'px;height:'+(mask?Math.round(sz*1.24):sz)+'px">'+svg.replace(/width="1024" height="1024"/,'width="100%" height="100%"')+'</div></body></html>');
 await p.screenshot({path:'app-soft/'+n,omitBackground:!mask});}
await b.close();console.log('ok')})();
