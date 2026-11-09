// Captures the marketing-site screenshots from a sample collection (run with the app served on :8765)
const { chromium, devices } = require('playwright');
const OUT = '/tmp/claude-0/-home-claude/0d23d6a4-0497-5286-ae54-9e35a72a5811/scratchpad/sitepv/';
const SHOW = () => { const now = new Date(), Y = now.getFullYear(), M = now.getMonth(), D = now.getDate();
  const at = (mb, d) => { const last = new Date(Y, M - mb + 1, 0).getDate(); return CTStore.ymd(new Date(Y, M - mb, mb === 0 ? Math.min(d, D) : Math.min(d, last))); };
  const A = (k, wall) => ({ list: 'assets/card-art/' + k + '-sm.webp?v=3', detail: 'assets/card-art/' + k + '.webp?v=3', ...(wall ? { wall: 'assets/card-art/' + k + '-wall.webp?v=3' } : {}) });
  const C = { pik: ['Pikachu ex - 238/191 - SV08: Surging Sparks', 'pikachu-ex'], gen: ['Gengar ex - 154/128 - ME: 30th Celebration', 'gengar-ex'], chi: ['Chi-Yu ex - 259/193 - SV02: Paldea Evolved', 'chi-yu-ex'],
   goh: ['Son Gohan : Youth - FB03-139 (Alternate Art) - Raging Roar', 'son-gohan-youth'], cha: ['Charizard ex - 199/165 - SV: Scarlet & Violet 151', 'charizard-ex'], gre: ['Greninja ex - 214/167 - SV06: Twilight Masquerade', 'greninja-ex'],
   bla: ['Blastoise - 2/102 - Base Set Unlimited', 'blastoise'], hou: ['Houndoom - 4/64 - Neo Revelation', 'houndoom'], mgg: ['Mega Gengar ex - 284/217 - Ascended Heroes', 'mega-gengar-ex'], art: ['Articuno ex - 036/082 - Japanese', 'articuno-ex'],
   mag: ['Magby - 186/182 - Paradox Rift', 'magby'], dra: ['Houndoom - 4/64 - Neo Revelation', 'houndoom'] };
  const e = (mb, d, type, k, amount, o = {}) => Object.assign({ date: at(mb, d), type, platform: 'eBay', name: C[k][0], amount: String(amount), condition: 'Near Mint', art: A(C[k][1], ['mgg', 'art', 'mag'].includes(k)) }, o);
  const sale = (mb, d, k, amt, fees, ship, o) => e(mb, d, 'sale', k, amt, Object.assign({ fees: String(fees), ship: String(ship) }, o || {}));
  const X = (n, f) => ({ name: n, art: { list: 'x-demo/' + f, detail: 'x-demo/' + f } });
  const tiny = (mb, d, type, c, amount, o = {}) => Object.assign({ date: at(mb, d), type, platform: 'eBay', name: c.name, amount: String(amount), condition: 'Near Mint', art: c.art }, o);
  const LAT = X('Latias - 8/124 - Dragons Exalted', 'demo-latias.webp'), LUD = X('Ludicolo - 31/162 - BREAKthrough', 'demo-ludicolo.webp'), PK = X('Pikachu - 58/102 - Base Set', 'demo-pikachu.webp');
  return [
   sale(0, 9, 'pik', 255, 33.8, 6.7), sale(0, 6, 'art', 230, 29.9, 1.27, { condition: 'Lightly Played' }), e(0, 3, 'purchase', 'cha', 389, { platform: 'PWCC', grade: { co: 'PSA', g: '10' }, condition: 'Graded' }),
   sale(0, 2, 'chi', 186, 24.2, 2.2, { platform: 'TCGplayer', qty: 2 }), e(0, 1, 'purchase', 'gen', 64.8),
   sale(1, 24, 'gre', 349, 45.4, 4.2, { platform: 'TCGplayer' }), sale(1, 14, 'mgg', 421.5, 27.83, 1.27), e(1, 9, 'purchase', 'mag', 48.99, { platform: 'TCGplayer' }), tiny(1, 5, 'sale', LAT, 88, { fees: '11.4', ship: '1.27' }),
   e(2, 25, 'purchase', 'mgg', 312, { grade: { co: 'CGC', g: '10', w: 'PRISTINE' }, condition: 'Graded' }), sale(2, 18, 'bla', 210, 0, 0, { platform: 'Card Show', condition: 'Lightly Played' }), sale(2, 11, 'gen', 172, 22.4, 4.5),
   e(2, 6, 'purchase', 'art', 40, { platform: 'Card Show', condition: 'Lightly Played' }), tiny(2, 3, 'purchase', LUD, 12, { platform: 'Whatnot' }),
   sale(3, 22, 'mag', 159, 20.7, 1.27, { platform: 'TCGplayer' }), e(3, 15, 'purchase', 'pik', 118, { platform: 'TCGplayer' }), e(3, 9, 'purchase', 'chi', 62, { platform: 'TCGplayer', qty: 2 }), tiny(3, 4, 'purchase', LAT, 35, { platform: 'Card Show' }),
   sale(4, 26, 'goh', 238, 30.9, 4.2, { platform: 'TCGplayer' }), e(4, 18, 'purchase', 'bla', 64, { platform: 'Card Show' }), e(4, 10, 'purchase', 'mgg', 145, { platform: 'TCGplayer' }), tiny(4, 6, 'sale', LUD, 30, { fees: '3.9', ship: '1.27', platform: 'Mercari' }),
   e(5, 20, 'purchase', 'goh', 96, { platform: 'TCGplayer' }), e(5, 12, 'purchase', 'gre', 140, { platform: 'TCGplayer' }), tiny(5, 5, 'purchase', PK, 20, { platform: 'Card Show', condition: 'Lightly Played' })
  ]; };
(async () => { const b = await chromium.launch();
 const route = p => p.route('**/x-demo/*', r => r.fulfill({ path: '/home/claude/cardtab-site/assets/' + r.request().url().split('/x-demo/')[1].split('?')[0] }));
 const setup = async (p, dark) => { await route(p); await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'show@x.test', name: 'Nick', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); for (const k of ['ct.hint.board', 'cb.hint', 'ct.hint', 'cb.hint.edit']) localStorage.setItem(k, '1'); });
   await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async src => { await CTStore.setPlan('premium'); await CTStore._loadSample(eval('(' + src + ')')()); }, SHOW.toString()); await p.waitForTimeout(2500);
   await p.evaluate(() => { document.querySelectorAll('.ct-hint,.cbhint,.ct-a2hs').forEach(x => x.remove()); }); };
 const shot = async (p, n) => { await p.evaluate(() => document.querySelectorAll('.ct-hint,.cbhint,[class*="hint"][class*="pop"]').forEach(x => x.remove())); await p.screenshot({ path: OUT + n + '.png' }); };
 // desktop grid + board
 let p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); await setup(p);
 await p.evaluate(() => { window.CTMonth && CTMonth.set('all'); const g = document.querySelector('.fb-vopts [data-gs="m"]'); g && g.click(); }); await p.waitForTimeout(1200); await p.evaluate(() => { const so = document.getElementById('ct-sort'); so.value = 'high'; so.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(1000);
 await p.evaluate(() => { const f = document.querySelector('.ct-fbar'); scrollTo(0, f.getBoundingClientRect().top + scrollY - 150); }); await p.waitForTimeout(700); await shot(p, 'd-grid');
 await p.evaluate(() => document.querySelector('.sh-tabs [data-tab="board"]').click()); await p.waitForTimeout(2500);
 await p.evaluate(() => { localStorage.setItem('cb.layout.v4', JSON.stringify([{ id: 'a', k: 'profit', size: 'S' }, { id: 'b', k: 'sales', size: 'S' }, { id: 'c', k: 'spent', size: 'S' }, { id: 'd', k: 'fees', size: 'S' }, { id: 'f', k: 'feat', metric: 'win', size: 'L' }, { id: 'g', k: 'sell', size: 'M' }, { id: 'h', k: 'kept', size: 'M' }, { id: 'i', k: 'month', size: 'X' }])); cbReloadLayout(); });
 await p.waitForTimeout(800); await p.evaluate(() => { const b = [...document.querySelectorAll('button,[role=button]')].find(x => /^Year$|^6 months$|Last 6/i.test(x.textContent.trim())); }); 
 await p.evaluate(() => { window.CTMonth && CTMonth.set('all'); }); await p.waitForTimeout(2500); await p.evaluate(() => scrollTo(0, 0)); await shot(p, 'd-board');
 await p.close();
 // phone list + stories
 p = await b.newPage({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); await setup(p);
 await p.evaluate(() => { window.CTMonth && CTMonth.set('all'); }); await p.waitForTimeout(900);
 await p.evaluate(() => { const f = document.querySelector('.ct-fbar'); scrollTo(0, f.getBoundingClientRect().top + scrollY - 110); }); await p.waitForTimeout(700); await shot(p, 'p-list');
 for (const scheme of ['light', 'dark']) { const q = await b.newPage({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: scheme }); await setup(q);
  await q.evaluate(() => document.querySelector('.sh-tabs [data-tab="board"]').click()); await q.waitForTimeout(2500);
  await q.evaluate(() => { localStorage.setItem('cb.layout.v4', JSON.stringify([{ id: 'a', k: 'profit', size: 'S' }, { id: 'b', k: 'sales', size: 'S' }, { id: 'f', k: 'feat', metric: 'win', size: 'L' }, { id: 'c', k: 'spent', size: 'S' }, { id: 'd', k: 'fees', size: 'S' }, { id: 'g', k: 'month', size: 'L' }])); cbReloadLayout(); window.CTMonth && CTMonth.set('all'); });
  await q.waitForTimeout(2500); await q.evaluate(() => scrollTo(0, 0)); await q.waitForTimeout(400); await shot(q, 'hero-board-' + scheme); await q.close() }
 await p.evaluate(() => document.querySelector('.sh-tabs [data-tab="stories"]').click()); await p.waitForTimeout(3500); await p.evaluate(() => scrollTo(0, 0)); await shot(p, 'p-stories');
 await p.close(); await b.close() })();
