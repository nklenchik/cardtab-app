// Frame pacing on a phone-sized screen with the CPU slowed 4x (roughly a mid-range phone): long frames during each interaction.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }); const p = await ctx.newPage();
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', expires: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1300); await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(2500);
 // more entries, like a real collection
 await p.evaluate(async () => { const base = CTStore.all(); const more = []; for (let i = 0; i < 180; i++) { const e = base[i % base.length]; more.push({ type: e.type, name: e.name, amount: String((e.amount || 1000) / 100), net: e.net != null ? String(e.net / 100) : undefined, date: '2026-' + String(1 + (i % 11)).padStart(2, '0') + '-' + String(1 + (i % 27)).padStart(2, '0'), platform: e.platform }); } await CTStore.importMany(more); });
 await p.waitForTimeout(2000);
 const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
 const rec = async (label, act, ms = 1200) => {
  await p.evaluate(() => { window.__f = []; let last = performance.now(); const id = (window.__id = (window.__id || 0) + 1); const tick = t => { if (window.__id !== id) return; window.__f.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await act(); await p.waitForTimeout(ms);
  const f = await p.evaluate(() => { window.__id++; return window.__f.slice(1); });
  const long = f.filter(x => x > 25).length, worst = Math.max(...f), avg = f.reduce((a, x) => a + x, 0) / f.length;
  console.log(label.padEnd(30), 'frames', String(f.length).padStart(3), ' avg', (1000 / avg).toFixed(0).padStart(3) + 'fps', ' >25ms', String(long).padStart(3), ' worst', worst.toFixed(0) + 'ms');
 };
 const tab = t => p.evaluate(t => { const x = [...document.querySelectorAll('.ct-tbar button')].find(x => x.offsetParent && new RegExp(t, 'i').test(x.textContent)); x && x.click(); }, t);
 await rec('idle (baseline)', async () => {}, 800);
 await rec('scroll entries (fling)', () => p.evaluate(() => new Promise(r => { let y = 0; const s = () => { y += 40; scrollTo(0, y); if (y < 1600) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 400);
 await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
 await rec('expand a row', () => p.evaluate(() => document.querySelector('[aria-label^="Expand"]').click()));
 await rec('collapse the row', () => p.evaluate(() => document.querySelector('.ct-row.expanded [aria-label^="Collapse"], .ct-row.expanded [aria-label^="Expand"], .ct-row.expanded .ct-row-toggle').click()));
 await rec('open Add a card', () => p.evaluate(() => CTOpenAdd()));
 await rec('close Add a card', () => p.evaluate(() => CTAddSheet.close()));
 await rec('open profile menu', () => p.click('#app-avatar'));
 await rec('close profile menu', () => p.evaluate(() => window.CTMenu && CTMenu.close()));
 await rec('open budget', () => p.evaluate(() => CTBudget.open()));
 await rec('close budget', () => p.evaluate(() => CTBudget.shut ? CTBudget.shut() : document.querySelector('#bu-sheet [data-close], #bu-sheet .x')?.click()));
 await rec('open Edit entry', () => p.evaluate(() => CTEditor.open(CTStore.all()[0])));
 await rec('close Edit entry', () => p.evaluate(() => CTEditor.close()));
 await rec('go to Board', () => tab('board'), 2500);
 await rec('scroll Board', () => p.evaluate(() => new Promise(r => { let y = 0; const s = () => { y += 40; scrollTo(0, y); document.scrollingElement.scrollTop = y; if (y < 1200) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); })), 400);
 await rec('go to Stories', () => tab('stories'), 2500);
 await rec('back to Entries', () => tab('entries'), 1500);
 await b.close(); })();
