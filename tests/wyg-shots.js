// Captures the marketing site's "What you get" phone screenshots from their own sample collection (run with the app served on :8765).
// These use cards that appear nowhere else on the site: Umbreon VMAX, Rayquaza VMAX, Lugia V, Blue-Eyes White Dragon, Elsa, Spirit of Winter (Enchanted), Sheoldred.
// Card art comes from the app's own catalog (api.cardtab.app/art/<id>/...), saved to ART and served to the page as /x-wyg/<file>.
const { chromium, devices } = require('playwright');
const OUT = process.env.OUT || '/tmp/claude-0/-home-claude/0d23d6a4-0497-5286-ae54-9e35a72a5811/scratchpad/sitepv/';
const ART = process.env.ART || '/tmp/claude-0/-home-claude/0d23d6a4-0497-5286-ae54-9e35a72a5811/scratchpad/wyg-art/';
const WYG = () => { const now = new Date(), Y = now.getFullYear(), M = now.getMonth(), D = now.getDate();
  const at = (mb, d) => { const last = new Date(Y, M - mb + 1, 0).getDate(); return CTStore.ymd(new Date(Y, M - mb, mb === 0 ? Math.min(d, D) : Math.min(d, last))); };
  const A = k => ({ list: 'x-wyg/' + k + '-list', detail: 'x-wyg/' + k + '-detail' });
  const C = { umb: 'Umbreon VMAX - 215/203 - SWSH07: Evolving Skies', ray: 'Rayquaza VMAX - 218/203 - SWSH07: Evolving Skies', lug: 'Lugia V - 186/195 - SWSH12: Silver Tempest',
    bew: 'Blue-Eyes White Dragon - LOB-001 - Legend of Blue Eyes White Dragon', elsa: 'Elsa, Spirit of Winter - 207/204 - The First Chapter', she: 'Sheoldred, the Apocalypse - 107 - Dominaria United' };
  const e = (mb, d, type, k, amount, o = {}) => Object.assign({ date: at(mb, d), type, platform: 'eBay', name: C[k], amount: String(amount), condition: 'Near Mint', art: A(k) }, o);
  const sale = (mb, d, k, amt, fees, ship, o) => e(mb, d, 'sale', k, amt, Object.assign({ fees: String(fees), ship: String(ship) }, o || {}));
  const psa = { grade: { co: 'PSA', g: '10' }, condition: 'Graded' };
  return [
    sale(0, 3, 'umb', 1520, 182, 6, psa), sale(0, 6, 'lug', 219, 28.5, 4.2),
    e(1, 12, 'purchase', 'ray', 310, { platform: 'TCGplayer' }), sale(1, 22, 'bew', 132, 17.2, 1.27, { platform: 'TCGplayer' }), sale(1, 27, 'elsa', 395, 51.4, 4.2, { platform: 'TCGplayer' }),
    e(2, 8, 'purchase', 'lug', 145), e(2, 15, 'purchase', 'bew', 88, { platform: 'Card Show', condition: 'Lightly Played' }), sale(2, 26, 'she', 79, 10.3, 1.27, { platform: 'TCGplayer' }),
    e(3, 20, 'purchase', 'umb', 980, Object.assign({ platform: 'PWCC' }, psa)), e(3, 4, 'purchase', 'she', 62, { platform: 'TCGplayer' }), e(4, 9, 'purchase', 'elsa', 240, { platform: 'TCGplayer' })
  ]; };
(async () => { const b = await chromium.launch();
  const route = p => p.route('**/x-wyg/*', r => r.fulfill({ path: ART + r.request().url().split('/x-wyg/')[1].split('?')[0], contentType: 'image/webp' }));
  const setup = async (p, view) => { await route(p); await p.goto('http://localhost:8765/index.html');
    await p.evaluate(v => { localStorage.setItem('ct.session', JSON.stringify({ email: 'show@x.test', name: 'Nick', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); for (const k of ['ct.hint.board', 'cb.hint', 'ct.hint', 'cb.hint.edit']) localStorage.setItem(k, '1'); if (v) localStorage.setItem('ct.view', v); }, view);
    await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async src => { await CTStore.setPlan('premium'); await CTStore._loadSample(eval('(' + src + ')')()); }, WYG.toString()); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('.ct-hint,.cbhint,.ct-a2hs').forEach(x => x.remove()); }); };
  // nothing shows behind or below the bottom buttons
  const band = p => p.evaluate(() => { const fx = [...document.querySelectorAll('body *')].filter(e => { const c = getComputedStyle(e); if (c.position !== 'fixed' || c.display === 'none' || c.visibility === 'hidden') return false; const q = e.getBoundingClientRect(); return q.height > 30 && q.height < 160 && q.top > innerHeight * .75; });
    if (!fx.length) return; const top = Math.min(...fx.map(e => e.getBoundingClientRect().top)), z = Math.min(...fx.map(e => parseInt(getComputedStyle(e).zIndex, 10) || 10)), bg = getComputedStyle(document.body).backgroundColor;
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;pointer-events:none;z-index:' + (z - 1) + ';top:' + Math.round(top - 26) + 'px;background:linear-gradient(to bottom,transparent,' + bg + ' 22px)'; document.body.appendChild(d); });
  const shot = async (p, n) => { await p.evaluate(() => document.querySelectorAll('.ct-hint,.cbhint,[class*="hint"][class*="pop"]').forEach(x => x.remove())); await p.screenshot({ path: OUT + n + '.png' }); };
  const phone = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' };
  // 1) the collection as a grid, newest first (every card once on the first screen)
  let p = await b.newPage(phone); await setup(p, 'gallery');
  await p.evaluate(() => { window.CTMonth && CTMonth.set('all'); const g = document.querySelector('.fb-vopts [data-gs="m"]'); g && g.click(); const so = document.getElementById('ct-sort'); if (so) { so.value = 'new'; so.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const f = document.querySelector('.ct-fbar'); if (f) scrollTo(0, f.getBoundingClientRect().top + scrollY - 64); }); await p.waitForTimeout(900); await band(p); await shot(p, 'wyg-grid'); await p.close();
  // 2) the Board: profit, spent, the biggest win in full art, profit by month
  p = await b.newPage(phone); await setup(p);
  await p.evaluate(() => document.querySelector('.sh-tabs [data-tab="board"]').click()); await p.waitForTimeout(2500);
  await p.evaluate(() => { localStorage.setItem('cb.layout.v4', JSON.stringify([{ id: 'a', k: 'profit', size: 'S' }, { id: 'c', k: 'spent', size: 'S' }, { id: 'f', k: 'feat', metric: 'win', size: 'L' }, { id: 'w', k: 'where', size: 'L' }])); cbReloadLayout(); window.CTMonth && CTMonth.set('all');
    const hs = document.createElement('style'); hs.textContent = '.topbar{display:none!important}.mkw{display:none!important}'; document.head.appendChild(hs); document.querySelectorAll('.mkw').forEach(x => x.style.visibility = 'hidden');
    const bt = [...document.querySelectorAll('h1,h2,div,span')].find(x => x.childElementCount === 0 && x.textContent.trim() === 'Board' && x.getBoundingClientRect().top < 60 && x.getBoundingClientRect().left < 60); if (bt) bt.style.transform = 'translateX(8px)'; });
  await p.waitForTimeout(2500); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400); await band(p); await shot(p, 'wyg-board');
  // the numbers the Ask example quotes, straight from this sample
  console.log(JSON.stringify(await p.evaluate(() => { const L = CTStore.all(), m = {}, pl = {}; L.forEach(t => { const k = t.date.slice(0, 7); m[k] = m[k] || 0; if (t.type === 'sale') m[k] += t.net; else m[k] -= t.amount; if (t.type === 'purchase') { pl[t.platform] = pl[t.platform] || [0, 0]; pl[t.platform][0] += t.amount; pl[t.platform][1]++; } }); return { months: m, buys: pl }; })));
  await p.close(); await b.close(); })();
