// Entry open/close smoothness: taps entries open and closed on a phone with the CPU slowed 4x and reports what animates
// and the frame gaps. node rows-audit.js
const { chromium, devices } = require('playwright');
const WYG = () => { const now = new Date(), Y = now.getFullYear(), M = now.getMonth(), D = now.getDate(); const at = d => CTStore.ymd(new Date(Y, M, Math.min(d, D)));
  const names = ['Umbreon VMAX - 215/203 - SWSH07: Evolving Skies', 'Lugia V - 186/195 - SWSH12: Silver Tempest', 'Rayquaza VMAX - 218/203 - SWSH07: Evolving Skies', 'Sceptile - 10/100 - Stormfront', 'Beautifly - 2/109 - EX Ruby and Sapphire', 'Moltres - 10/100 - Majestic Dawn', 'Mew ex - 151/165 - Scarlet & Violet 151', 'Charizard ex - 199/165 - Scarlet & Violet 151'];
  return names.map((n, i) => ({ date: at(1 + i), type: i % 2 ? 'sale' : 'purchase', platform: 'eBay', name: n, amount: String(30 + i * 17), fees: i % 2 ? '4.2' : undefined, ship: i % 2 ? '1' : undefined, condition: 'Near Mint' })); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ ...devices['iPhone 13'] }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'show@x.test', name: 'Nick', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); localStorage.setItem('ct.view', 'list'); for (const k of ['ct.hint.board', 'cb.hint', 'ct.hint', 'cb.hint.edit']) localStorage.setItem(k, '1'); });
  await p.reload(); await p.waitForTimeout(1200); await p.evaluate(async src => { await CTStore.setPlan('premium'); await CTStore._loadSample(eval('(' + src + ')')()); }, WYG.toString()); await p.waitForTimeout(1800);
  await p.evaluate(() => { const r = document.querySelectorAll('#ct-rows [data-tx]')[2]; r.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(600);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const watch = idx => p.evaluate(async idx => { const gaps = [], seen = new Map(); let last = performance.now(), run = true;
    const tick = t => { gaps.push(t - last); last = t; for (const a of document.getAnimations()) { if (seen.has(a)) continue; const ef = a.effect, el = ef && ef.target; const props = new Set(); (ef && ef.getKeyframes ? ef.getKeyframes() : []).forEach(k => Object.keys(k).forEach(x => props.add(x))); if (a.transitionProperty) props.add(a.transitionProperty);
        seen.set(a, (el ? (el.className && el.className.baseVal == null ? String(el.className).split(' ')[0] : el.tagName) : '?') + '[' + [...props].filter(x => !/^(offset|easing|composite|computedOffset|transformOrigin)$/.test(x)).join(',') + ']'); } if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); }); await new Promise(r => setTimeout(r, 40));
    document.querySelectorAll('#ct-rows [data-tx]')[idx].click(); await new Promise(r => setTimeout(r, 600)); run = false;
    const g = gaps.filter(x => x > 0); const cnt = {}; [...seen.values()].forEach(v => cnt[v] = (cnt[v] || 0) + 1);
    return 'frames ' + g.length + ', worst ' + Math.round(Math.max(...g)) + 'ms, over 25ms: ' + g.filter(x => x > 25).length + ' | ' + Object.entries(cnt).map(([k, v]) => v + '× ' + k).join(' '); }, idx);
  for (const [label, idx] of [['open #3', 2], ['close #3', 2], ['open #4', 3], ['open #2 (row above closes)', 1], ['close #2', 1]]) { console.log(label.padEnd(28), await watch(idx)); await p.waitForTimeout(400); }
  await b.close(); })();
