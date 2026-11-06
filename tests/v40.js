// v40: neutral copy, Hide amounts, the wide-desktop style panel.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const out = []; const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);
 for (const [w, plan] of [[1280, 'premium'], [1280, 'free'], [390, 'premium']]) {
  const ctx = await b.newContext(w < 700 ? { ...devices['iPhone 13'], viewport: { width: w, height: 800 } } : { viewport: { width: w, height: 860 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const tag = w + '-' + plan;
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'v40@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async pl => { await CTStore.setPlan(pl); document.querySelector('[data-dev=sample]').click(); }, plan); await p.waitForTimeout(1200);
  await p.evaluate(() => { [...document.querySelectorAll('.sh-tabs button, .ct-tabs button, .ct-tbar button')].find(x => x.offsetParent && /stories/i.test(x.textContent)).click(); }); await p.waitForTimeout(4200);
  let S = null; for (const x of p.frames()) if (await x.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) S = x;
  const labels = await S.evaluate(() => [...document.querySelectorAll('.scv small')].map(s => s.textContent));
  ok(labels.length === 6 && !labels.some(l => /\byour?\b/i.test(l)), tag + ' labels: ' + labels.join(' | '));
  // read every story's words in the player
  const words = []; for (let n = 0; n < 6; n++) { await S.evaluate(n => window.csPlay(n), n); await p.waitForTimeout(700); words.push(await S.evaluate(() => { const st = document.querySelector('.pl .st.on'); return st ? [...st.querySelectorAll('h4,.line')].map(e => e.textContent.trim()).join(' / ') : ''; })); }
  await S.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))); await p.evaluate(() => {}); await S.evaluate(() => window.pl && pl.hide && pl.hide()).catch(() => {}); await p.waitForTimeout(500);
  ok(!words.some(t => /\byou(r)?\b/i.test(t)), tag + ' no "you/your" in the stories');
  if (plan === 'premium' && w === 1280) console.log(words.map((t, i) => '   ' + (i + 1) + '. ' + t).join('\n'));
  const panel = await S.evaluate(() => { const pn = document.querySelector('.spanel'); return pn && getComputedStyle(pn).display !== 'none' ? [...pn.querySelectorAll('.spt')].map(t => t.getAttribute('aria-label')) : null; });
  const chips = await p.evaluate(() => { const c = document.querySelector('.sh-chips'); return !!(c && c.offsetParent); });
  if (w >= 1200) { ok(panel && (plan === 'free' ? panel.length === 2 : panel.length === 7), tag + ' panel tiles: ' + (panel || []).join(', ')); ok(!chips, tag + ' header chips hidden'); }
  else ok(!panel, tag + ' no panel on phones');
  // hide amounts
  const tog = async () => { if (w >= 1200) await S.evaluate(() => document.querySelector('.spanel [data-hide]').click()); else await S.evaluate(() => document.querySelector('.hidew [data-hide]').click()); await p.waitForTimeout(500); };
  await tog();
  const hid = await S.evaluate(() => ({ hero: document.querySelector('.hero .sbig').textContent, covers: [...document.querySelectorAll('.scv b')].map(b => b.textContent).join(' ') }));
  ok(!/\$/.test(hid.hero + hid.covers), tag + ' Hide amounts: no $ on shelf (' + hid.hero + ' | ' + hid.covers + ')');
  await S.evaluate(() => window.csPlay(0)); await p.waitForTimeout(2400);
  const ps = await S.evaluate(() => document.querySelector('.pl .st.on').innerText);
  ok(!/\$/.test(ps), tag + ' Hide amounts: no $ in story 1: ' + ps.replace(/\s+/g, ' ').slice(0, 120));
  if (w === 1280 && plan === 'premium') await p.screenshot({ path: 'tests/out-desktop/v40-hidden.png' });
  await S.evaluate(() => { const x = window.pl; if (x && x.hide) x.hide(); }).catch(() => {}); await p.waitForTimeout(400);
  await tog();
  ok(await S.evaluate(() => /\$/.test(document.querySelector('.hero .sbig').textContent)), tag + ' turning it off brings $ back');
  ok(!errs.length, tag + ' no page errors ' + errs.slice(0, 2).join(' | '));
  await ctx.close();
 }
 console.log(out.join('\n')); await b.close(); })();
