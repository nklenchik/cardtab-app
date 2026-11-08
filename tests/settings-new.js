// v50.55: Graded by default, Show graded cards as slabs, Hide amounts (this device)
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
 for (const mode of ['phone', 'desktop']) {
 const ctx = await b.newContext(mode === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'n' + Math.random() + '@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
 const id = await p.evaluate(async () => { const e = CTStore.all().filter(e => !e.deleted)[0]; await CTStore.update(e.id, { condition: 'Graded', grade: { co: 'PSA', g: '10' } }); return e.id; });
 const openMenu = async pg => { await p.evaluate(() => { document.querySelector('.app-avatar').click(); }); await p.waitForTimeout(700); await p.evaluate(pg => document.querySelector('[data-amp="' + pg + '"]').click(), pg); await p.waitForTimeout(600); };
 const closeMenu = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(500); };
 // Graded by
 await openMenu('entries'); await p.screenshot({ path: 'out-qa/set-entries-' + mode + '.png' });
 await p.evaluate(() => document.querySelector('#am-dgco [data-co="BGS"]').click()); await p.waitForTimeout(400); await closeMenu();
 const other = await p.evaluate(() => CTStore.all().filter(e => !e.deleted)[1]);
 await p.evaluate(id => CTEditor.open(CTStore.all().find(e => e.id === id)), other.id); await p.waitForTimeout(600);
 await p.selectOption('select[name=condition]', 'Graded'); ok(mode + ': editor starts on BGS', (await p.inputValue('select[name=gco]')) === 'BGS');
 await p.keyboard.press('Escape'); await p.waitForTimeout(500);
 // slabs off
 await openMenu('display'); await p.screenshot({ path: 'out-qa/set-display-' + mode + '.png' });
 await p.evaluate(() => document.getElementById('am-slabs').click()); await p.waitForTimeout(700); await closeMenu();
 const view = await p.evaluate(() => ({ slabs: document.querySelectorAll('#ct-rows .slab').length, pills: document.querySelectorAll('#ct-rows .sl-chip:not(.sl-raw)').length }));
 ok(mode + ': slabs off shows plain art and keeps the grade pill', view.slabs === 0 && (view.pills > 0 || mode === 'desktop'), JSON.stringify(view));
 await openMenu('display'); await p.evaluate(() => document.getElementById('am-slabs').click()); await p.waitForTimeout(700);
 // hide amounts
 await p.evaluate(() => document.getElementById('am-hideamt').click()); await p.waitForTimeout(300); await closeMenu();
 const blur = await p.evaluate(() => [...document.querySelectorAll('.ct-stats strong, .ct-row-amt strong, .ct-tile-amt')].filter(x => x.offsetParent).map(x => getComputedStyle(x).filter));
 ok(mode + ': amounts blurred', blur.length > 0 && blur.every(f => /blur/.test(f)), blur.length + ' amounts');
 ok(mode + ': slabs back on', await p.evaluate(() => document.querySelectorAll('#ct-rows .slab').length > 0));
 await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: 'out-qa/set-hidden-' + mode + '.png' });
 ok(mode + ': hide is this device only', await p.evaluate(() => localStorage.getItem('ct.hideamt') === '1' && CTStore.meta('hideamt') == null));
 ok(mode + ': no errors', !errs.length, errs.join(' | ')); await ctx.close(); }
 await b.close(); })();
