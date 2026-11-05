
// ---- the app's side: one back-gesture history shared with the app, live data, open/refresh ----
if(window.CTNav){navPush=(k,fn)=>window.CTNav.push('cb:'+k,fn);navDone=k=>{if(!navPopping)window.CTNav.done('cb:'+k)}}
// Card Stories reads the same entries as the board
window.cbEntries=()=>E;
const syncStories=()=>{try{const f=document.querySelector('#csx iframe');if(f&&f.contentWindow&&f.contentWindow.csSync)f.contentWindow.csSync()}catch(e){}};
window.CTBoard={open(){window.cbSyncPlan();open()},close(){close()},get shown(){return shown},
  refresh(rows){E=rows||(window.CTBoardData?window.CTBoardData():E);window.cbSyncPlan();const t=new Date();TODAY=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');if(shown)render(false);else ready=false;syncStories()},
  user(u){if(!u)return;const n=document.getElementById('cb-am-name');if(n&&u.name)n.textContent=u.name;const em=document.querySelector('#cb-amenu .amh small');if(em&&u.email)em.textContent=u.email;const pr=document.querySelector('#cb-amenu .prem2');if(pr)pr.hidden=!u.premium;window.cbSyncPlan()}};
