const { chromium, devices } = require('playwright');
const MODE = process.argv[2] || 'phone', DARK = process.argv[3] === 'dark';
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(MODE === 'phone' ? { ...devices['iPhone 13'], colorScheme: DARK ? 'dark' : 'light' } : { viewport: { width: 1280, height: 860 }, colorScheme: DARK ? 'dark' : 'light' }); const p = await ctx.newPage();
 const errs = []; p.on('pageerror', e => errs.push('page: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
 const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + MODE + ': ' + n + (d ? '  — ' + d : ''));
 const tag = MODE + (DARK ? '-dark' : '');
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'st39@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })));
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1500);
 await p.evaluate(() => { const t = [...document.querySelectorAll('.ct-tbar button, .sh-tabs button, .ct-tabs button')].find(x => /stories/i.test(x.textContent)); t.click(); }); await p.waitForTimeout(5000);
 const f = p.frames().find(fr => fr !== p.mainFrame() && fr.url() !== 'about:blank' || (fr !== p.mainFrame()));
 const fr = p.frames().filter(x => x !== p.mainFrame()).find(x => x.name() !== '' || true);
 const fs = p.frames().filter(x => x !== p.mainFrame());
 let S = null; for (const x of fs) { if (await x.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) S = x; }
 ok('Stories frame has the shelf', !!S); if (!S) { console.log(errs); await b.close(); return; }
 const info = await S.evaluate(() => ({ covers: document.querySelectorAll('#shelf .scv').length, hero: (document.querySelector('#shelf .hero') || {}).innerText, names: [...document.querySelectorAll('#shelf .scv')].map(c => c.innerText.replace(/\s+/g, ' ')) }));
 ok('Story covers on the shelf', info.covers >= 6, info.names.join(' | ')); ok('Big cover shows the period and profit', /\$/.test(info.hero), info.hero.replace(/\s+/g, ' '));
 await p.screenshot({ path: 'tests/out-phone/s39-shelf-' + tag + '.png' });
 await S.evaluate(() => document.querySelector('#shelf .hero').click()); await p.waitForTimeout(1600);
 ok('Player opens', await S.evaluate(() => !document.querySelector('.pl').hidden));
 ok('Covers the app header and tab bar', await p.evaluate(() => document.documentElement.classList.contains('cs-modal')));
 for (let i = 0; i < 14 && !(await S.evaluate(() => document.querySelector('.pl').hidden)); i++) { await p.screenshot({ path: 'tests/out-phone/s39-st' + (i + 1) + '-' + tag + '.png' }); const txt = await S.evaluate(() => document.querySelector('.pl .st.on').innerText.replace(/\s+/g, ' ').slice(0, 140)); console.log('   story ' + (i + 1) + ': ' + txt);
   await S.evaluate(() => document.querySelector('.pl .tapz.r').click()); await p.waitForTimeout(i === 2 ? 2600 : 2000); }
 ok('Tapping past the last story closes the player', await S.evaluate(() => document.querySelector('.pl').hidden));
 ok('Header back in place after closing', !(await p.evaluate(() => document.documentElement.classList.contains('cs-modal'))));
 // theme + background through the theme sheet
 await S.evaluate(() => window.csThemes.set(1)); await p.waitForTimeout(300);
 await S.evaluate(() => window.csThemes.all()); await p.waitForTimeout(700);
 ok('Theme sheet has the background choice', await S.evaluate(() => document.querySelectorAll('#bgrow [data-bg]').length >= 3));
 await p.screenshot({ path: 'tests/out-phone/s39-sheet-' + tag + '.png' });
 await S.evaluate(() => document.querySelector('#bgrow [data-bg="Stickers"]').click()); await p.waitForTimeout(300);
 ok('Background choice applies to the shelf', await S.evaluate(() => !!document.querySelector('#shelf .hero .fl')));
 await S.evaluate(() => document.querySelector('#ths [data-close]').click()); await p.waitForTimeout(500);
 // controls
 await S.evaluate(() => window.csPlay(2)); await p.waitForTimeout(900);
 await S.evaluate(() => document.querySelector('.pl [data-pause]').click()); await p.waitForTimeout(300);
 ok('Pause works', await S.evaluate(() => document.querySelector('.pl').classList.contains('paused')));
 await S.evaluate(() => document.querySelector('.pl [data-share]').click()); await p.waitForTimeout(400);
 ok('Share sheet opens', await S.evaluate(() => !document.querySelector('.pl .pshs').hidden));
 await p.screenshot({ path: 'tests/out-phone/s39-share-' + tag + '.png' });
 await S.evaluate(() => document.querySelector('.pl [data-shx=""]').click()); await p.waitForTimeout(300);
 await p.keyboard.press('Escape'); await p.waitForTimeout(500);
 ok('Escape closes', await S.evaluate(() => document.querySelector('.pl').hidden));
 ok('No errors', !errs.length, errs.slice(0, 4).join(' | '));
 await b.close(); })();
