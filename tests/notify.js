const { chromium, devices } = require('playwright');
const MODE = process.argv[2] || 'phone', DARK = process.argv[3] === 'dark';
(async () => { const b = await chromium.launch();
 const ctx = await b.newContext(MODE === 'phone' ? { ...devices['iPhone 13'], colorScheme: DARK ? 'dark' : 'light' } : { viewport: { width: 1280, height: 860 }, colorScheme: DARK ? 'dark' : 'light' });
 const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
 const res = []; const ok = (n, v, d) => { res.push(v); console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? '  — ' + d : '')); };
 const out = n => p.screenshot({ path: 'tests/out-phone/ntf-' + MODE + (DARK ? '-dark' : '') + '-' + n + '.png' });
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'n@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1300);
 const add = async () => p.evaluate(() => (document.getElementById('ct-fab').offsetParent ? document.getElementById('ct-fab') : document.getElementById('ct-add')).click());
 ok('No dot on a new account', !(await p.evaluate(() => document.querySelector('.sh-bell').classList.contains('has-ntf'))));
 // Add New: typo shows did-you-mean; add it as typed anyway
 await add(); await p.waitForTimeout(700);
 await p.fill('#as-in', 'Charzard ex 199'); await p.waitForTimeout(400);
 const lsl = await p.locator('#as-res .lsl').textContent().catch(() => ''), sug = await p.locator('#as-res .li .n').first().textContent().catch(() => '');
 ok('Add New suggests the closest card', /did you mean/i.test(lsl) && /Charizard ex/.test(sug), lsl + ' → ' + sug);
 await out('1-didyoumean');
 await p.locator('#as-res [data-typed]').click(); await p.waitForTimeout(300);
 await p.fill('#as-price', '45.00'); await p.locator('#as-save').click(); await p.waitForTimeout(600);
 await p.evaluate(() => document.querySelector('#as [data-as-close]').click()); await p.waitForTimeout(900);
 ok('Entry is flagged as not matched', await p.evaluate(() => CTStore.all().filter(e => e.unmatched).length === 1));
 ok('Dot shows on the bell', await p.evaluate(() => document.querySelector('.sh-bell').classList.contains('has-ntf')));
 await out('2-dot');
 // menu row and count
 await p.locator('#app-avatar').click(); await p.waitForTimeout(700);
 ok('Menu shows Notifications with a count of 1', (await p.locator('#am-ntf-n').textContent()) === '1' && await p.locator('#am-ntf-n').isVisible());
 await out('3-menu');
 await p.locator('#am-ntf').click(); await p.waitForTimeout(900);
 ok('Notifications window opens', await p.evaluate(() => document.getElementById('ntf').open));
 const body = (await p.locator('#ntf-body').innerText()).replace(/\s+/g, ' ');
 ok('Lists the unmatched card', /wasn’t matched/.test(body) && /Charzard ex 199/.test(body), body.slice(0, 120));
 await out('4-list');
 ok('Dot clears once the list is opened', !(await p.evaluate(() => document.querySelector('.sh-bell').classList.contains('has-ntf'))));
 // fix it
 await p.locator('#ntf [data-act="fix"]').click(); await p.waitForTimeout(900);
 ok('Fix window opens with the typed name', await p.evaluate(() => document.getElementById('fix').open && document.getElementById('fix-q').value === 'Charzard ex 199'));
 await out('5-fix');
 await p.locator('#fix .ntf-li').first().click(); await p.waitForTimeout(900);
 const e = await p.evaluate(() => CTStore.all()[0]);
 ok('Fix changes the name, keeps the amount', e.name.startsWith('Charizard ex - 199/165') && e.amount === 4500 && !e.unmatched, e.name + ' · ' + e.amount);
 // settings
 await p.evaluate(() => CTNotify.open('settings')); await p.waitForTimeout(800);
 await out('6-settings');
 await p.locator('#ntf [data-pref="all"]').click(); await p.waitForTimeout(400);
 ok('Turning off All dims and disables the categories', await p.evaluate(() => [...document.querySelectorAll('#ntf [data-pref="cards"],#ntf [data-pref="tips"]')].every(x => x.disabled)));
 await p.locator('#ntf [data-pref="all"]').click(); await p.waitForTimeout(300);
 await p.evaluate(() => CTNotify.close()); await p.waitForTimeout(500);
 // samples: billing + tips (Free) + found
 await p.evaluate(async () => { await CTStore.add({ type: 'purchase', name: 'Moonbreon', amount: 12000, unmatched: true }); await CTNotify.demo(); }); await p.waitForTimeout(500);
 ok('Sample notices raise the dot', await p.evaluate(() => document.querySelector('.sh-bell').classList.contains('has-ntf')));
 await p.evaluate(() => CTNotify.open('list')); await p.waitForTimeout(900);
 const b2 = (await p.locator('#ntf-body').innerText()).replace(/\s+/g, ' ');
 ok('Billing, cards and tips groups show', /Account and billing/i.test(b2) && /Your cards/i.test(b2) && /Tips and offers/i.test(b2));
 await out('7-all');
 // notifications off: only the failed payment remains
 await p.evaluate(async () => { const s = CTStore.meta('notif'); s.prefs = Object.assign({}, s.prefs, { all: false }); await CTStore.setMeta('notif', s); }); await p.waitForTimeout(400);
 const b3 = (await p.locator('#ntf-body').innerText()).replace(/\s+/g, ' ');
 ok('With everything off, only the failed payment shows', /payment didn’t go through/.test(b3) && !/Tips and offers/i.test(b3) && !/renews/.test(b3), b3.slice(0, 100));
 await p.evaluate(async () => { const s = CTStore.meta('notif'); s.prefs.all = true; await CTStore.setMeta('notif', s); CTNotify.close(); });
 // free tip from Premium taps
 await p.evaluate(async () => { await CTNotify.clearDemo(); for (let i = 0; i < 5; i++) await CTNotify.premiumTap(); await CTStore.setMeta('x', 1); }); await p.waitForTimeout(800);
 ok('Five Premium taps in a month bring one tip', await p.evaluate(() => (CTStore.meta('notif').items || []).filter(i => i.kind === 'tip').length === 1));
 await p.evaluate(async () => { for (let i = 0; i < 5; i++) await CTNotify.premiumTap(); await CTStore.setMeta('x', 2); }); await p.waitForTimeout(500);
 ok('No second tip within two weeks', await p.evaluate(() => (CTStore.meta('notif').items || []).filter(i => i.kind === 'tip').length === 1));
 ok('No errors', !errs.length, errs.slice(0, 3).join(' | '));
 console.log(res.filter(Boolean).length + ' of ' + res.length + ' passed'); await b.close(); })();
