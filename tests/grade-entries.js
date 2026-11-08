const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
 for (const mode of ['phone', 'desktop']) {
 const ctx = await b.newContext(mode === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 860 } }); const p = await ctx.newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'e' + Math.random() + '@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
 const id = await p.evaluate(() => CTStore.all().filter(e => !e.deleted)[0].id);
 // grade it through the editor
 await p.evaluate(id => CTEditor.open(CTStore.all().find(e => e.id === id)), id); await p.waitForTimeout(700);
 await p.selectOption('#ed-form select[name=condition], form select[name=condition]', 'Graded'); await p.waitForTimeout(200);
 ok(mode + ': grade fields show for Graded', await p.evaluate(() => !document.getElementById('ed-grade').hidden));
 await p.selectOption('select[name=gco]', 'CGC'); await p.selectOption('select[name=gg]', '10P'); await p.fill('input[name=gcert]', '12345678');
 await p.evaluate(() => { const f = document.querySelector('#ed-grade').closest('form'); const s = f.querySelector('[type=submit]'); s ? s.click() : f.requestSubmit(); }); await p.waitForTimeout(900);
 const e1 = await p.evaluate(id => CTStore.all().find(e => e.id === id), id);
 ok(mode + ': saved as CGC 10 Pristine', e1.grade && e1.grade.co === 'CGC' && e1.grade.g === '10' && e1.grade.w === 'PRISTINE' && e1.grade.cert === '12345678', JSON.stringify(e1.grade));
 await p.evaluate(() => document.querySelector('.fb-view [data-view="list"]').click()); await p.waitForTimeout(500);
 ok(mode + ': list shows the slab and pill', await p.evaluate(id => { const r = document.querySelector('[data-tx="' + id + '"]'); const row = r && r.closest('.ct-row'); return !!(row && row.querySelector('.slab, .ct-slab-art') && row.querySelector('.sl-chip')); }, id));
 // ungrade
 await p.evaluate(id => CTEditor.open(CTStore.all().find(e => e.id === id)), id); await p.waitForTimeout(600);
 await p.selectOption('select[name=condition]', 'Near Mint');
 await p.evaluate(() => { const f = document.querySelector('#ed-grade').closest('form'); const s = f.querySelector('[type=submit]'); s ? s.click() : f.requestSubmit(); }); await p.waitForTimeout(900);
 const e2 = await p.evaluate(id => CTStore.all().find(e => e.id === id), id);
 ok(mode + ': changing to Near Mint removes the grade', !e2.grade && e2.condition === 'Near Mint', JSON.stringify([e2.grade, e2.condition]));
 ok(mode + ': back to plain art', await p.evaluate(id => { const r = document.querySelector('[data-tx="' + id + '"]'); const row = r && r.closest('.ct-row'); return !!row && !row.querySelector('.slab'); }, id));
 // duplicate keeps grade; undo works
 await p.evaluate(async id => { await CTStore.update(id, { condition: 'Graded', grade: { co: 'PSA', g: '9' } }); }, id);
 const n0 = await p.evaluate(() => CTStore.all().filter(e => !e.deleted).length);
 await p.evaluate(async id => { await CTStore.duplicate(id); }, id); await p.waitForTimeout(300);
 const dup = await p.evaluate(() => CTStore.all().filter(e => !e.deleted));
 ok(mode + ': duplicate adds one', dup.length === n0 + 1);
 // right-click on art is blocked
 await p.evaluate(() => document.querySelector('.fb-view [data-gs="l"]').click()); await p.waitForTimeout(600);
 const blocked = await p.evaluate(() => { const i = document.querySelector('.ct-tile img'); if (!i) return 'no img'; const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }); i.dispatchEvent(ev); return ev.defaultPrevented; });
 ok(mode + ': right-click save blocked on art', blocked === true, String(blocked));
 const inputOk = await p.evaluate(() => { const i = document.querySelector('input'); const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); i.dispatchEvent(ev); return !ev.defaultPrevented; });
 ok(mode + ': right-click still works in text boxes', inputOk);
 ok(mode + ': no errors', errs.length === 0, errs.join(' | '));
 await ctx.close(); }
 await b.close(); })();
