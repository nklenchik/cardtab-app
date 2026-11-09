// v50.63: plan picker, checkout sheet, welcome, Plan and billing (preview mode: no Stripe off cardtab.app)
const { chromium, devices } = require('playwright');
const OUT = __dirname + '/out-qa/';
(async () => { const b = await chromium.launch(); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : ''));
 for (const [mode, opt] of [['phone', { ...devices['iPhone 13'] }], ['desktop', { viewport: { width: 1280, height: 860 } }], ['phone-dark', { ...devices['iPhone 13'], colorScheme: 'dark' }]]) {
  const p = await b.newPage(opt); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'bu' + Math.random() + '@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async () => { await CTStore.setPlan('free'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1200);
  await p.evaluate(() => CTBoardLoader.load()); await p.waitForTimeout(2500);
  await p.evaluate(() => CTPremiumOpen()); await p.waitForTimeout(1200);
  const pk = await p.evaluate(() => ({ plans: document.querySelectorAll('#pms .pmplan').length, on: (document.querySelector('#pms .pmplan.on') || {}).dataset, cta: document.getElementById('pm-go').textContent, fnd: !!document.querySelector('#pms .pmfnd'), soon: /soon/i.test(document.getElementById('pms').innerText) }));
  ok(mode + ': plan picker with yearly first', pk.plans === 2 && pk.on && pk.on.iv === 'year' && /\$40 a year/.test(pk.cta) && pk.fnd, JSON.stringify(pk));
  ok(mode + ': no Soon label', !pk.soon);
  await p.screenshot({ path: OUT + 'bill-sheet-' + mode + '.png' });
  await p.evaluate(() => document.querySelector('#pms .pmplan[data-iv="month"]').click()); await p.waitForTimeout(200);
  ok(mode + ': monthly switches the button', /\$4 a month/.test(await p.textContent('#pm-go')));
  await p.evaluate(() => document.querySelector('#pms .pmplan[data-iv="year"]').click());
  await p.evaluate(() => document.getElementById('pm-go').click()); await p.waitForTimeout(900);
  ok(mode + ': checkout sheet opens', await p.evaluate(() => !!document.querySelector('dialog.ckd[open]')));
  await p.screenshot({ path: OUT + 'bill-checkout-' + mode + '.png' });
  await p.evaluate(() => document.getElementById('ck-demo-pay').click()); await p.waitForTimeout(900);
  ok(mode + ': Premium on and welcome shows', await p.evaluate(() => CTStore.plan() === 'premium' && !!document.querySelector('dialog.wlc[open]')));
  await p.screenshot({ path: OUT + 'bill-welcome-' + mode + '.png' });
  await p.evaluate(() => document.querySelector('.wl-go').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('.app-avatar').click()); await p.waitForTimeout(700);
  ok(mode + ': menu row says Premium', /Premium/.test(await p.evaluate(() => document.querySelector('[data-sv="plan"]').textContent)));
  await p.evaluate(() => document.querySelector('[data-amp="billing"]').click()); await p.waitForTimeout(800);
  const bl = await p.evaluate(() => document.getElementById('am-bill').innerText.replace(/\s+/g, ' '));
  ok(mode + ': Plan and billing shows the plan', /Founding member/i.test(bl) && /Premium · Yearly/.test(bl) && /Switch to monthly/.test(bl) && /Cancel Premium/.test(bl), bl.slice(0, 200));
  await p.evaluate(() => [...document.querySelectorAll('#am-bill [data-bl]')].find(x => x.dataset.bl.startsWith('switch')).click()); await p.waitForTimeout(400);
  ok(mode + ': switch shows the change at renewal', /Switches to monthly/.test(await p.evaluate(() => document.getElementById('am-bill').innerText)));
  await p.screenshot({ path: OUT + 'bill-settings-' + mode + '.png' });
  // a failed payment
  await p.evaluate(() => { const s = CTBilling.status(); s.sub.status = 'past_due'; s.sub.graceUntil = Math.floor(Date.now() / 1000) + 6 * 86400; CTBilling.paint(); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => CTBilling.render()); await p.waitForTimeout(500);
  ok(mode + ': failed card shows a banner on Entries', await p.evaluate(() => !!document.querySelector('.ct-paybar') && /didn’t go through/.test(document.querySelector('.ct-paybar').innerText)));
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200); await p.screenshot({ path: OUT + 'bill-payfail-' + mode + '.png' });
  ok(mode + ': and a notification', await p.evaluate(() => (CTStore.meta('notif') || {}).items.some(x => x.kind === 'payfail')));
  await p.evaluate(() => { const s = CTBilling.status(); s.sub.status = 'active'; s.sub.graceUntil = null; CTBilling.render(); }); await p.waitForTimeout(400);
  ok(mode + ': both clear once the card works', await p.evaluate(() => !document.querySelector('.ct-paybar') && !(CTStore.meta('notif') || {}).items.some(x => x.kind === 'payfail')));
  ok(mode + ': no errors', !errs.length, errs.join(' | ')); await p.close(); }
 await b.close(); })();
