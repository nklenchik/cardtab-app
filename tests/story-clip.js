// Records one Card Story playing (the "A $458 month" slide) as frames for the site's story clips (run with the app served on :8765)
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
   sale(0, 9, 'pik', 255, 33.8, 6.7), sale(0, 6, 'art', 230, 29.9, 1.27, { condition: 'Lightly Played' }), e(0, 3, 'purchase', 'cha', 389, { platform: 'Fanatics', grade: { co: 'PSA', g: '10' }, condition: 'Graded' }),
   sale(0, 2, 'chi', 186, 24.2, 2.2, { platform: 'TCGplayer', qty: 2 }), e(0, 1, 'purchase', 'gen', 64.8),
   sale(1, 24, 'gre', 349, 45.4, 4.2, { platform: 'TCGplayer' }), e(1, 20, 'purchase', 'cha', 260, { platform: 'eBay' }), sale(1, 14, 'mgg', 421.5, 27.83, 1.27), e(1, 9, 'purchase', 'mag', 48.99, { platform: 'TCGplayer' }), tiny(1, 5, 'sale', LAT, 88, { fees: '11.4', ship: '1.27' }),
   e(2, 25, 'purchase', 'mgg', 312, { grade: { co: 'CGC', g: '10', w: 'PRISTINE' }, condition: 'Graded' }), sale(2, 18, 'bla', 210, 0, 0, { platform: 'Card Show', condition: 'Lightly Played' }), sale(2, 11, 'gen', 172, 22.4, 4.5),
   e(2, 6, 'purchase', 'art', 40, { platform: 'Card Show', condition: 'Lightly Played' }), tiny(2, 3, 'purchase', LUD, 12, { platform: 'Whatnot' }),
   sale(3, 22, 'mag', 159, 20.7, 1.27, { platform: 'TCGplayer' }), e(3, 15, 'purchase', 'pik', 118, { platform: 'TCGplayer' }), e(3, 9, 'purchase', 'chi', 62, { platform: 'TCGplayer', qty: 2 }), tiny(3, 4, 'purchase', LAT, 35, { platform: 'Card Show' }),
   sale(4, 26, 'goh', 238, 30.9, 4.2, { platform: 'TCGplayer' }), e(4, 18, 'purchase', 'bla', 64, { platform: 'Card Show' }), e(4, 10, 'purchase', 'mgg', 145, { platform: 'TCGplayer' }), tiny(4, 6, 'sale', LUD, 30, { fees: '3.9', ship: '1.27', platform: 'Mercari' }),
   e(5, 20, 'purchase', 'goh', 96, { platform: 'TCGplayer' }), e(5, 12, 'purchase', 'gre', 140, { platform: 'TCGplayer' }), tiny(5, 5, 'purchase', PK, 20, { platform: 'Card Show', condition: 'Lightly Played' })
  ]; };
(async () => { const b = await chromium.launch();
 const OUTD = '/tmp/claude-0/-home-claude/0d23d6a4-0497-5286-ae54-9e35a72a5811/scratchpad/sitepv/';
 const p = await b.newPage({ ...devices['iPhone 13'], viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
 await p.route('**/x-demo/*', r => r.fulfill({ path: '/home/claude/cardtab-site/assets/' + r.request().url().split('/x-demo/')[1].split('?')[0] }));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(([th, bg]) => { localStorage.setItem('ct.session', JSON.stringify({ email: 'st@x.test', name: 'Nick', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('cs.theme', th); if (bg) localStorage.setItem('cs.bg', bg); }, [process.env.THEME || '0', process.env.BG || '']);
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async src => { await CTStore.setPlan('premium'); await CTStore._loadSample(eval('(' + src + ')')()); }, SHOW.toString()); await p.waitForTimeout(2500);
 if (process.env.BUDGET) await p.evaluate(c => { window.CTBudgetCents = () => +c; }, process.env.BUDGET);
 await p.evaluate(r => { if (r && window.CTMonth) CTMonth.set(r); }, process.env.RANGE || ''); await p.waitForTimeout(600); await p.evaluate(() => document.querySelector('.sh-tabs [data-tab="stories"]').click()); await p.waitForTimeout(3500);
 const fr = p.frames().find(f => f !== p.mainFrame());
 const fs = require('fs'), D = OUTD + (process.env.DIR || 'clip') + '/'; fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D);
 if (process.env.SPER) { await fr.locator(':text-is("Last month"):visible').first().click(); await p.waitForTimeout(600); await p.screenshot({ path: OUTD + 'menu.png' });
   await fr.locator(':text-is("' + process.env.SPER + '"):visible').first().click(); await p.waitForTimeout(1500); }
 if (process.env.THEMENAME) console.log('theme', await fr.evaluate(n => { const b = [...document.querySelectorAll('#tgrid [data-i]')].find(x => x.textContent.trim().toLowerCase().includes(n.toLowerCase())); if (b) { b.click(); return b.textContent.trim() + ' ' + b.dataset.i; } return 'not found: ' + [...document.querySelectorAll('#tgrid [data-i]')].map(x => x.textContent.trim()).join('|'); }, process.env.THEMENAME));
 if (process.env.BG) console.log('bg', await fr.evaluate(n => { const b = [...document.querySelectorAll('#bgrow button')].find(x => x.textContent.trim().toLowerCase().includes(n.toLowerCase())); if (b) { b.click(); return b.textContent.trim(); } return 'not found: ' + [...document.querySelectorAll('#bgrow button')].map(x => x.textContent.trim()).join('|') + ' / stored ' + localStorage.getItem('cs.bg'); }, process.env.BG));
  if (process.env.LIST) { const out = []; await fr.click('[data-play="0"]'); await p.waitForTimeout(1500);
   for (let k = 0; k < 12; k++) { await p.waitForTimeout(900); await p.screenshot({ path: OUTD + 'sl-' + k + '.png' }); await p.keyboard.press('ArrowRight'); }
   await b.close(); return; }
 // real-time recording: the page is laid out at the stories' 360-wide size but drawn at 2x (zoom), so the clip is sharp
 const cdp = await p.context().newCDPSession(p); const frames = [];
 cdp.on('Page.screencastFrame', async f => { frames.push({ t: f.metadata.timestamp, d: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {} });
 await fr.evaluate(() => { const st = document.createElement('style'); st.textContent = '.pl .pbot,.pl .arr,.pl .x,.pl .strip{visibility:hidden!important}'; document.head.appendChild(st); });
 await p.setViewportSize({ width: 720, height: 1280 }); await p.evaluate(() => { document.documentElement.style.zoom = 2; }); await p.waitForTimeout(800);   // 360-wide layout, drawn at 720
 const SL = +(process.env.SLIDE || 0);
 await fr.evaluate(() => document.querySelector('[data-play="0"]').click()); await p.waitForTimeout(1200);
 for (let k = 0; k < SL + 1; k++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(450); }
 await p.waitForTimeout(500);
 await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 2000, maxHeight: 4000 });
 const SLOW = +(process.env.SLOW || 1); if (SLOW !== 1) { await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: SLOW }); }
 await p.waitForTimeout(150); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(+(process.env.MS || 4300));
 await cdp.send('Page.stopScreencast');
 frames.forEach((f, k) => fs.writeFileSync(D + String(k).padStart(4, '0') + '.png', Buffer.from(f.d, 'base64')));
 fs.writeFileSync(D + 'times.json', JSON.stringify({ t: frames.map(f => f.t), slow: +(process.env.SLOW || 1) }));
 console.log('frames', frames.length);
 await b.close() })();
