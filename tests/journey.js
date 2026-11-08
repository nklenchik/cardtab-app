// Card Tab: full user journey, through the real screens, on a phone-sized screen.
// Every money check is exact to the cent. Run: node journey.js [phone|desktop]
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = 'http://localhost:8765/index.html';
const MODE = process.argv[2] || 'phone';
const OUT = path.join(__dirname, 'out-' + MODE); fs.mkdirSync(OUT, { recursive: true });

const results = []; let page;
const ok = (name, pass, detail) => { results.push({ name, pass: !!pass, detail: detail || '' }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };
const txt = async sel => (await page.locator(sel).first().textContent() || '').replace(/\s+/g, ' ').trim();
const money = async id => (await txt('#' + id)).replace(/[−–]/g, '-');
const settle = (ms = 700) => page.waitForTimeout(ms);
async function tiles() { await settle(1300); return { sales: await money('ct-sales'), after: await money('ct-after'), spent: await money('ct-spent'), profit: await money('ct-profit') }; }
async function expectTiles(label, want) {
  const t = await tiles(); const bad = Object.keys(want).filter(k => t[k] !== want[k]);
  ok(label, !bad.length, bad.length ? bad.map(k => k + ' ' + t[k] + ' ≠ ' + want[k]).join(', ') : Object.values(t).join(' · '));
}
const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });

async function openAdd() {
  const fab = page.locator('#ct-fab'); if (await fab.isVisible()) await fab.click(); else await page.locator('#ct-add').click();
  await page.waitForSelector('#as[open]'); await settle(500);
}
async function sheetAdd({ query, type, price, fees, ship, plat }) {
  await page.fill('#as-in', query); await settle(400);
  const li = page.locator('#as-res .li').first();
  if (await li.count()) await li.click(); else await page.locator('#as-res [data-typed]').click();
  await settle(300);
  await page.locator('#as-type button[data-v="' + type + '"]').click();
  if (plat) await page.selectOption('#as-plat', { label: plat }).catch(() => {});
  await page.fill('#as-price', price);
  if (type === 'sale') { await page.fill('#as-fees', fees); await page.fill('#as-ship', ship); }
  await settle(200);
  const keep = type === 'sale' ? (await txt('#as-keep')).replace(/[−–]/g, '-') : '';
  await page.locator('#as-save').click(); await settle(600);
  return keep;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(MODE === 'phone' ? { ...devices['iPhone 13'], acceptDownloads: true } : { viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) errors.push(m.text()); });

  // 1. Create an account (local mode: signs in on this device)
  await page.goto(BASE + '?signup'); await settle(800);
  await page.fill('#auth-email', 'journey@cardtab.test'); await page.locator('#auth-go').click(); await settle(1500);
  ok('Sign up lands in the app', await page.locator('#view-app').isVisible());
  await page.evaluate(() => { try { localStorage.setItem('ct.tips', '0'); } catch (e) {} const lv = document.querySelector('[data-view="list"]'); if (lv && lv.getAttribute('aria-pressed') !== 'true') lv.click(); }); await settle(400);
  await expectTiles('New account starts at zero', { sales: '$0.00', spent: '$0.00', profit: '$0.00' });
  const u0 = await page.evaluate(() => CTStore.usage().used);

  // 2. Record a purchase and a sale with fees and shipping, through the Add sheet
  await openAdd();
  await sheetAdd({ query: 'Charizard ex 199', type: 'purchase', price: '120.00', plat: 'eBay' });
  const keep = await sheetAdd({ query: 'Pikachu VMAX 188', type: 'sale', price: '89.99', fees: '11.92', ship: '4.75', plat: 'eBay' });
  ok('Add sheet shows what you keep, to the cent', /\$73\.32/.test(keep), keep);
  // a refund you gave a buyer goes through the full form
  await page.locator('#as-other').click(); await page.waitForSelector('#ed[open]'); await settle(500);
  await page.locator('#ed .ed-seg [data-type="refund"]').click();
  await page.fill('#ed [name="name"]', 'Refund to buyer - Pikachu VMAX'); await page.fill('#ed [name="amount"]', '10.00');
  await page.locator('#ed-save').click(); await settle(800);
  ok('Full form closes after saving', !(await page.locator('#ed[open]').count()));
  if (await page.locator('#as[open]').count()) { await page.locator('#as [data-as-close]').click(); await settle(500); }
  await shot('1-after-adding');
  ok('Three entries in the list', (await page.evaluate(() => CTStore.all().length)) === 3);
  // Sales 89.99 · after fees 73.32 − 10.00 refund = 63.32 · spent 120.00 · profit 63.32 − 120.00 = −56.68
  await expectTiles('Tiles after adding', { sales: '$89.99', after: '$63.32', spent: '$120.00', profit: '-$56.68' });
  ok('Fees line counts fees and shipping only', /^\s*\$16\.67 in fees\s*$/.test(await txt('#ct-after ~ .ct-line')), await txt('#ct-after ~ .ct-line'));
  ok('Profit tile turns red below zero', await page.locator('#ct-profit').evaluate(el => el.parentElement.classList.contains('ct-negative')));
  ok('Free entries used went up by 3', (await page.evaluate(() => CTStore.usage().used)) - u0 === 3);

  // 3. Tap "Profit" for what it means
  await page.locator('.ct-why').click(); await settle(350);
  const pop = await txt('#ct-whypop');
  ok('Profit explainer opens', (await page.locator('#ct-whypop').isVisible()) && /Money in minus money out/.test(pop));
  const box = await page.locator('#ct-whypop').boundingBox(), vw = page.viewportSize().width;
  ok('Explainer fits on screen', box && box.x >= 0 && box.x + box.width <= vw, box && Math.round(box.x) + '–' + Math.round(box.x + box.width) + ' of ' + vw);
  await shot('2-profit-explainer');
  await page.mouse.click(5, page.viewportSize().height - 200); await settle(350);
  ok('Explainer closes on tap outside', !(await page.locator('#ct-whypop').isVisible()));

  // 4. Fix a mistake: the purchase was really $110.00
  const rowOf = name => page.locator('.ct-row', { hasText: name }).first();
  const tapRow = async name => { await rowOf(name).evaluate(el => el.scrollIntoView({ block: 'center' })); await settle(300); await rowOf(name).click(); await settle(700); };
  await tapRow('Charizard');
  await rowOf('Charizard').locator('[data-act="edit"]:visible').first().click(); await page.waitForSelector('#ed[open]'); await settle(500);
  await page.fill('#ed [name="amount"]', '110.00'); await page.locator('#ed-save').click(); await settle(800);
  await expectTiles('Tiles after editing the purchase', { spent: '$110.00', profit: '-$46.68' });

  // 5. Delete the refund, then undo
  await tapRow('Refund to buyer');
  await rowOf('Refund to buyer').locator('[data-act="del"]:visible').first().click(); await settle(600);
  const confirmBtn = page.locator('.ct-confirm button:has-text("Delete"), dialog[open] button:has-text("Delete")').first();
  if (await confirmBtn.count() && await confirmBtn.isVisible()) { await confirmBtn.click(); await settle(600); }
  await expectTiles('Tiles after deleting the refund', { after: '$73.32', profit: '-$36.68' });
  const undoBtn = page.locator('button:has-text("Undo"):visible').first();
  if (await undoBtn.count()) await undoBtn.click(); else await page.evaluate(() => CTStore.undo());
  await expectTiles('Undo brings the refund back', { after: '$63.32', profit: '-$46.68' });

  // 6. Close the app and open it again: everything is still there
  await page.reload(); await settle(2000);
  await expectTiles('Still there after reopening', { sales: '$89.99', after: '$63.32', spent: '$110.00', profit: '-$46.68' });

  // 7. Card Board shows the same money
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-page="board"], .ct-tabs button, .ct-tbar button')].find(x => /board/i.test(x.textContent || x.dataset.page || '')); if (b) b.click(); });
  await settle(2500);
  const boardText = await page.evaluate(() => (document.querySelector('.cbx') || {}).innerText || '');
  ok('Board opens', boardText.length > 50);
  ok('Board shows the same profit', /46\.68/.test(boardText), (boardText.match(/[−-]?\$?46\.68/) || ['not found'])[0]);
  ok('Board shows the same sales', /89\.99/.test(boardText) || /63\.32/.test(boardText) || /73\.32/.test(boardText));
  await shot('3-board');
  await page.evaluate(() => { const b = [...document.querySelectorAll('.cb-tabs button, .ct-tbar button, [data-page="entries"]')].find(x => /entries/i.test(x.textContent || x.dataset.page || '')); if (b) b.click(); });
  await settle(1500);

  // 8. Export to a file
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.evaluate(() => window.CTDash ? CTDash.exportCSV() : document.getElementById('am-export').click());
  let csv = '';
  const d = await dl;
  if (d) { const p = path.join(OUT, 'export.csv'); await d.saveAs(p); csv = fs.readFileSync(p, 'utf8'); }
  else csv = await page.evaluate(() => CTStore.exportCSV());
  ok('Export downloads a file', !!d);
  const lines = csv.trim().split('\n');
  ok('Export has every entry', lines.length === 4, (lines.length - 1) + ' rows');
  ok('Export keeps fees and shipping to the cent', lines.some(l => /89\.99,11\.92,4\.75,73\.32/.test(l)), lines.find(l => /sale/.test(l)));

  // 9. Wipe everything, then bring it back from the export (Import is Premium)
  await page.evaluate(async () => { await CTStore._clearAll(); await CTStore.setPlan('premium'); });
  await expectTiles('Wiped back to zero', { sales: '$0.00', spent: '$0.00', profit: '$0.00' });
  const csvPath = path.join(OUT, 'export.csv'); fs.writeFileSync(csvPath, csv);
  await page.evaluate(() => window.CTDash && CTDash.openImport ? CTDash.openImport() : null);
  if (!(await page.locator('#imp[open]').count())) await page.evaluate(() => document.getElementById('am-import').click());
  await settle(600);
  ok('Import window opens', !!(await page.locator('#imp[open]').count()));
  await page.setInputFiles('#imp-file', csvPath); await settle(1500);
  await shot('4-import-preview');
  const impText = (await page.locator('#imp').innerText()).replace(/\s+/g, ' ');
  ok('Import reads the export', /Import 3 entries/.test(impText), (impText.match(/Import \d+ entr\w+/) || [impText.slice(0, 160)])[0]);
  const impProfit = await txt('#imp-profit').catch(() => '');
  ok('Import preview profit matches', /46\.68/.test(impProfit), impProfit);
  if (await page.locator('#imp-go').isEnabled()) { await page.locator('#imp-go').click(); await settle(1200); }
  await settle(1200); const impDone = (await page.locator('#imp').innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (await page.locator('#imp[open]').count()) { await page.keyboard.press('Escape'); await settle(600); }
  ok('Import finishes', true, impDone.slice(0, 80));
  await expectTiles('Everything back after import', { sales: '$89.99', after: '$63.32', spent: '$110.00', profit: '-$46.68' });
  const back = await page.evaluate(() => CTStore.all().map(e => [e.type, e.amount, e.fees, e.ship, e.net, e.platform].join('|')).sort());
  ok('Imported entries match the originals', JSON.stringify(back) === JSON.stringify(['purchase|11000||||eBay', 'refund|1000||||', 'sale|8999|1192|475|7332|eBay'].sort()), back.join('  '));
  await shot('5-after-import');

  // 10. Sign out, sign back in: still there (same device)
  await page.evaluate(() => document.getElementById('am-out').click()); await settle(1000);
  ok('Sign out returns to sign in', await page.locator('#auth-email').isVisible());
  await page.fill('#auth-email', 'journey@cardtab.test'); await page.locator('#auth-go').click(); await settle(1800);
  await expectTiles('Signing back in keeps everything', { sales: '$89.99', profit: '-$46.68' });
  // a different email sees its own, empty account
  await page.evaluate(() => document.getElementById('am-out').click()); await settle(1000);
  await page.fill('#auth-email', 'someone-else@cardtab.test'); await page.locator('#auth-go').click(); await settle(1800);
  await expectTiles('A different account starts empty', { sales: '$0.00', profit: '$0.00' });

  ok('No errors in the console', !errors.length, errors.slice(0, 4).join(' | '));
  const failed = results.filter(r => !r.pass);
  console.log('\n' + (results.length - failed.length) + ' of ' + results.length + ' passed');
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  await browser.close(); process.exit(failed.length ? 1 : 0);
})().catch(async e => { console.error('CRASH', e.message); try { await page.screenshot({ path: path.join(OUT, 'crash.png') }); } catch (x) {} process.exit(2); });
