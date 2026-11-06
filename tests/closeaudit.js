// Which windows vanish at once when closed on a phone (vs slide down)? Opens every dialog, closes it with its own close button, looks 90ms later.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch();
 const p = await (await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', expires: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1000);
 await p.evaluate(() => { [...document.querySelectorAll('.sh-tabs button, .ct-tabs button, .ct-tbar button')].find(x => x.offsetParent && /board/i.test(x.textContent)).click(); }); await p.waitForTimeout(3500);
 for (const f of p.frames()) {
  const ids = await f.evaluate(() => [...document.querySelectorAll('dialog')].map((d, i) => d.id || d.className || 'dlg' + i)).catch(() => []);
  for (const [i, id] of ids.entries()) {
   const r = await f.evaluate(async i => { const d = document.querySelectorAll('dialog')[i]; if (d.open) return null; try { d.showModal(); } catch (e) { return 'cannot open'; }
     await new Promise(r => setTimeout(r, 700)); const btn = d.querySelector('[data-close],[data-x],.x,.ed-x,[aria-label=Close],[data-as-close],[data-imp-close],[data-ntf-close],[data-fix-close],[data-gx]');
     if (btn && btn.offsetParent) btn.click(); else d.close();
     const kid0 = [...d.querySelectorAll('*')].find(x => x.getBoundingClientRect().height > 120) || d.firstElementChild; const trace = []; for (let k = 0; k < 8; k++) { await new Promise(r => setTimeout(r, 40)); const c = getComputedStyle(kid0); trace.push(d.open ? Math.round(new DOMMatrix(c.transform === 'none' ? undefined : c.transform).m42) + '/' + (+c.opacity).toFixed(1) : 'gone'); } window.__tr = trace.join(' '); const kid = [...d.querySelectorAll('*')].find(x => x.getBoundingClientRect().height > 120) || d.firstElementChild; const vis = d.open && kid && kid.getBoundingClientRect().height > 0; const cs = kid ? getComputedStyle(kid) : {}; const tr = kid ? new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform) : { m42: 0 }; const top0 = kid ? Math.round(kid.getBoundingClientRect().top) : 0;
     const how = btn && btn.offsetParent ? 'button' : 'close()'; await new Promise(r => setTimeout(r, 600)); if (d.open) d.close();
     return (vis ? 'animates ' : 'INSTANT  ') + how + ' dy=' + Math.round(tr.m42) + ' op=' + cs.opacity + ' top=' + top0 + ' ' + window.__tr; }, i).catch(e => 'err ' + e.message);
   if (r) console.log(r.padEnd(18), id, f === p.mainFrame() ? '' : '(frame)');
  }
 }
 console.log('errors', errs.slice(0, 3)); await b.close(); })();
