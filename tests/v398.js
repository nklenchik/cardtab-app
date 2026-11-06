// v39.8: Premium sheet list, free CSV export on the Board, tab keys reach Stories, Delete account.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const out = []; const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);
 for (const w of [390, 1280]) {
  const ctx = await b.newContext(w < 700 ? { ...devices['iPhone 13'], viewport: { width: w, height: 800 } } : { viewport: { width: w, height: 860 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'del@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async () => { await CTStore.setPlan('free'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1200);
  await p.evaluate(() => { [...document.querySelectorAll('.sh-tabs button, .ct-tabs button, .ct-tbar button')].find(x => x.offsetParent && /board/i.test(x.textContent)).click(); }); await p.waitForTimeout(3500);
  const feats = await p.evaluate(() => [...document.querySelectorAll('#pms .pmf span')].map(s => s.textContent.trim()).filter(t => t && t !== 'Soon'));
  ok(feats.includes('All Card Board features') && feats.includes('No monthly entry limit') && !feats.some(f => /full-screen|13 widgets/i.test(f)), w + ' Premium list: ' + feats.join(' · '));
  // Board export: CSV works on Free, PNG opens Premium
  await p.evaluate(() => { document.getElementById('ex').showModal(); }); await p.waitForTimeout(400);
  const lk = await p.evaluate(() => [...document.querySelectorAll('#ex button[data-ex]')].map(b => b.dataset.ex + (b.classList.contains('lockd') ? ':locked' : '')));
  ok(lk.includes('csv') && lk.includes('png:locked') && lk.includes('xlsx:locked'), w + ' export buttons: ' + lk.join(' '));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.evaluate(() => document.querySelector('#ex button[data-ex=csv]').click())]);
  ok(!!dl, w + ' free CSV export downloads ' + (dl ? dl.suggestedFilename() : ''));
  await p.waitForTimeout(500);
  await p.evaluate(() => { const e = document.getElementById('ex'); if (!e.open) e.showModal(); document.querySelector('#ex button[data-ex=png]').click(); }); await p.waitForTimeout(700);
  ok(await p.evaluate(() => document.getElementById('pms').open), w + ' PNG on Free opens Premium');
  await p.evaluate(() => document.getElementById('pms').close()); await p.waitForTimeout(400);
  if (w === 1280) { // keyboard: the 3 key goes to Stories on Free
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('3'); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => document.querySelector('.ct-shell').dataset.page) === 'stories', w + ' number key 3 reaches Stories on Free');
  }
  // Delete account from Edit profile
  await p.evaluate(() => window.CTProfileOpen()); await p.waitForTimeout(900);
  const del = await p.evaluate(() => { const d = document.getElementById('av-del'); return d && !d.hidden && d.offsetParent !== null; });
  ok(del, w + ' Delete account shows in Edit profile');
  await p.evaluate(() => document.getElementById('av-del').click()); await p.waitForTimeout(900);
  const st = await p.evaluate(() => ({ open: document.getElementById('dela').open, dis: document.getElementById('dela-go').disabled, prem: !document.getElementById('dela-prem').hidden }));
  ok(st.open && st.dis && !st.prem, w + ' confirm sheet opens, button waits for the checkbox, no Premium note on Free');
  await p.screenshot({ path: 'tests/out-phone/delete-' + w + '.png' });
  await p.evaluate(() => { const c = document.getElementById('dela-ok'); c.click(); }); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('dela-go').click()); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ auth: !document.getElementById('view-auth')?.hidden || !!document.querySelector('#auth-email')?.offsetParent, keys: Object.keys(localStorage).filter(k => /^(cb|ct)\./.test(k)), dbs: indexedDB.databases ? undefined : null }));
  const dbs = await p.evaluate(async () => indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : []);
  ok(after.auth && !after.keys.length && !dbs.some(n => /^cardtab-/.test(n)), w + ' after delete: sign-in shown, local data gone (' + after.keys.join(',') + ' | ' + dbs.join(',') + ')');
  ok(!errs.length, w + ' no page errors ' + errs.slice(0, 2).join(' | '));
  await ctx.close();
 }
 console.log(out.join('\n')); await b.close(); })();
