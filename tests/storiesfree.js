const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message)); const ok = (n, v, d) => console.log((v ? 'PASS ' : 'FAIL ') + n + (d ? '  — ' + d : ''));
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'free2@x.test', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('cb.avatar', JSON.stringify({ color: '#1d3fe0' })); });
 await p.reload(); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelector('[data-dev=sample]').click()); await p.waitForTimeout(1500);
 await p.evaluate(() => { [...document.querySelectorAll('.ct-tbar button')].find(x => /stories/i.test(x.textContent)).click(); }); await p.waitForTimeout(5500);
 ok('No Premium sheet for free users', !(await p.evaluate(() => !!document.querySelector('.pms[open], dialog.pms[open]'))));
 let S = null; for (const x of p.frames()) { if (await x.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) S = x; }
 ok('Free user is on Stories', !!S); if (!S) { await p.screenshot({ path: 'tests/out-phone/free-fail.png' }); console.log(errs); await b.close(); return; }
 ok('Starts on Last month', await S.evaluate(() => window.csRange.per() === 'lm'), await S.evaluate(() => window.csRange.label()));
 const chips = await S.evaluate(() => [...document.querySelectorAll('#thm .tchip')].map(c => c.textContent.trim()));
 ok('Two theme chips plus All themes', chips.length === 3, chips.join(' | '));
 await p.screenshot({ path: 'tests/out-phone/free-shelf.png' });
 ok('Free story has the highlight mark up top', await S.evaluate(() => { window.csPlay(0); return !!document.querySelector('.pl .st .brand mark') && !document.querySelector('.pl .st .pmark'); }));
 await p.waitForTimeout(900); await p.screenshot({ path: 'tests/out-phone/free-story.png' });
 await S.evaluate(() => document.querySelector('.pl [data-share]').click()); await p.waitForTimeout(300);
 ok('Share sheet says 1 free video', /1 free video this month/.test(await S.evaluate(() => document.querySelector('.pl .pshs .shn').textContent)));
 await S.evaluate(() => document.querySelector('.pl [data-shx=""]').click()); await S.evaluate(() => document.querySelector('.pl [data-x]').click()); await p.waitForTimeout(500);
 // a longer range shows the Premium note
 await S.evaluate(() => window.csRange.set('l12')); await p.waitForTimeout(500);
 ok('Longer range shows the Premium note', await S.evaluate(() => !!document.querySelector('#shelf .plock')));
 await p.screenshot({ path: 'tests/out-phone/free-lock.png' });
 await S.evaluate(() => document.querySelector('#shelf [data-lm]').click()); await p.waitForTimeout(400);
 ok('"Show last month" goes back', await S.evaluate(() => window.csRange.per() === 'lm' && !!document.querySelector('#shelf .hero')));
 // locked theme in the sheet
 await S.evaluate(() => window.csThemes.all()); await p.waitForTimeout(600);
 const locked = await S.evaluate(() => document.querySelectorAll('#tgrid .lockd').length);
 ok('22 themes locked in the sheet', locked === 22, locked + ' locked');
 const th0 = await S.evaluate(() => window.csThemes.cur());
 await S.evaluate(() => document.querySelector('#tgrid .lockd').click()); await p.waitForTimeout(300);
 ok('A locked theme does not apply', (await S.evaluate(() => window.csThemes.cur())) === th0);
 ok('Stickers locked', await S.evaluate(() => !!document.querySelector('#bgrow [data-bg="Stickers"].lockd')));
 await p.screenshot({ path: 'tests/out-phone/free-sheet.png' });
 await S.evaluate(() => document.querySelector('#ths [data-close]').click()); await p.waitForTimeout(400);
 // one video a month
 await p.evaluate(async () => CTStore.setMeta('storiesVideo', { month: new Date().toISOString().slice(0, 7), n: 1 }));
 await S.evaluate(() => { window.csPlay(1); }); await p.waitForTimeout(700);
 await S.evaluate(() => document.querySelector('.pl [data-share]').click()); await p.waitForTimeout(300);
 ok('Sheet says the free video is used', /used/.test(await S.evaluate(() => document.querySelector('.pl .pshs .shn').textContent)));
 await S.evaluate(() => document.querySelector('.pl [data-shx="vsave"]').click()); await p.waitForTimeout(500);
 ok('Second video is refused with a note', /is used/.test(await S.evaluate(() => document.querySelector('.pl .ptoast').textContent)), await S.evaluate(() => document.querySelector('.pl .ptoast').textContent));
 await S.evaluate(() => document.querySelector('.pl [data-x]').click()); await p.waitForTimeout(400);
 // Premium: plain cardtab.app in the lower right, all themes
 await p.evaluate(async () => { await CTStore.setPlan('premium'); if (window.CTBoardLoader) window.CTBoardLoader.sync(); });
 await S.evaluate(() => window.csSync()); await p.waitForTimeout(500);
 ok('Premium: all 24 themes available', (await S.evaluate(() => window.csThemes.list().length)) === 24);
 await S.evaluate(() => window.csPlay(0)); await p.waitForTimeout(900);
 const pm = await S.evaluate(() => { const m = document.querySelector('.pl .st.on .pmark'); if (!m) return null; const r = m.getBoundingClientRect(), c = document.querySelector('.pl .pcard').getBoundingClientRect(); return { right: Math.round(c.right - r.right), fromBottom: Math.round(c.bottom - r.bottom), size: getComputedStyle(m).fontSize, brand: !!document.querySelector('.pl .st.on .brand') }; });
 ok('Premium: plain mark in the lower right, no highlight', pm && !pm.brand && pm.right < 40, JSON.stringify(pm));
 await p.screenshot({ path: 'tests/out-phone/prem-story.png' });
 ok('No errors', !errs.length, errs.join(' | ')); await b.close(); })();
