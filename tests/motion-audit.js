// Motion audit: opens and closes every window in the app (sheets, dialogs, menus, popovers) on a phone and a desktop,
// with the CPU slowed 4x like a mid-range phone, and reports for each: what animates (and whether it's only transform and
// opacity, which run smoothly on the GPU), how long, which easing, and the frame times while it runs.
// Run with the app served on :8765.  node motion-audit.js [phone|desk] [filter]
const { chromium, devices } = require('playwright');
const which = process.argv[2] || 'phone', only = process.argv[3] || '';
const WYG = () => { const now = new Date(), Y = now.getFullYear(), M = now.getMonth(), D = now.getDate();
  const at = (mb, d) => CTStore.ymd(new Date(Y, M - mb, Math.min(d, mb ? 28 : D)));
  const e = (mb, d, type, name, amount, o = {}) => Object.assign({ date: at(mb, d), type, platform: 'eBay', name, amount: String(amount), condition: 'Near Mint' }, o);
  return [e(0, 3, 'sale', 'Umbreon VMAX - 215/203 - SWSH07: Evolving Skies', 1520, { fees: '182', ship: '6' }), e(0, 2, 'sale', 'Lugia V - 186/195 - SWSH12: Silver Tempest', 219, { fees: '28.5', ship: '4.2' }),
    e(1, 12, 'purchase', 'Rayquaza VMAX - 218/203 - SWSH07: Evolving Skies', 310, { platform: 'TCGplayer' }), e(2, 8, 'purchase', 'Lugia V - 186/195 - SWSH12: Silver Tempest', 145), e(3, 20, 'purchase', 'Umbreon VMAX - 215/203 - SWSH07: Evolving Skies', 980)]; };
// [name, where, open (in page), close (in page)]
const W = [
  ['Add a card', 'entries', 'CTAddSheet.open()', 'CTAddSheet.close()'],
  ['Edit entry', 'entries', 'CTEditor.open(CTStore.all()[0].id)', 'CTEditor.close()'],
  ['Import', 'entries', 'CTImportUI.open()', 'CTImportUI.close()'],
  ['Budget', 'entries', 'CTBudget.open()', 'CTBudget.shut()'],
  ['Profile menu', 'entries', 'CTMenu.open(document.getElementById("app-avatar"))', 'CTMenu.open(document.getElementById("app-avatar"))'],
  ['Notifications', 'entries', 'CTNotify.open()', 'CTNotify.close()'],
  ['Filters card', 'entries', 'document.querySelector(".fb-fbtn") && document.querySelector(".fb-fbtn").click()', 'document.querySelector(".fb-fs .fb-fdone") && document.querySelector(".fb-fs .fb-fdone").click()'],
  ['Premium', 'entries', 'CTPremiumOpen()', 'document.getElementById("pms").close()'],
  ['Ask', 'board', 'document.getElementById("askd").showModal()', 'document.getElementById("askd").close()'],
  ['Share', 'board', 'document.getElementById("shd").showModal()', 'document.getElementById("shd").close()'],
  ['Layouts', 'board', 'document.getElementById("lyd").showModal()', 'document.getElementById("lyd").close()'],
  ['Board entries list', 'board', 'document.getElementById("ent").showModal()', 'document.getElementById("ent").close()'],
  ['Time range', 'board', 'document.getElementById("cr").showModal()', 'document.getElementById("cr").close()'],
  ['Export', 'board', 'document.getElementById("ex").showModal()', 'document.getElementById("ex").close()'],
  ['Add widget', 'board', 'document.getElementById("aw").showModal()', 'document.getElementById("aw").close()'],
  ['Avatar', 'board', 'document.getElementById("av").showModal()', 'document.getElementById("av").close()'],
  ['Reset', 'board', 'document.getElementById("rs").showModal()', 'document.getElementById("rs").close()'],
];
const GPU = /^(transform|opacity|translate|scale|rotate|offset|easing|composite|computedOffset|filter|backdrop-filter|visibility)$/;
(async () => {
  const b = await chromium.launch();
  const ctxOpt = which === 'desk' ? { viewport: { width: 1280, height: 860 } } : { ...devices['iPhone 13'] };
  const p = await b.newPage(ctxOpt); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.setItem('ct.session', JSON.stringify({ email: 'show@x.test', name: 'Nick', via: 'email', at: Date.now(), exp: Date.now() + 864e5 })); for (const k of ['ct.hint.board', 'cb.hint', 'ct.hint', 'cb.hint.edit']) localStorage.setItem(k, '1'); });
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(async src => { await CTStore.setPlan('free'); await CTStore._loadSample(eval('(' + src + ')')()); }, WYG.toString()); await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelectorAll('.ct-hint,.cbhint,.ct-a2hs').forEach(x => x.remove()));
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // watch one open or close: frame gaps for 700 ms, and what was animating
  const watch = code => p.evaluate(async code => {
    const gaps = [], seen = new Map(); let last = performance.now(), run = true;
    const tick = t => { gaps.push(t - last); last = t; for (const a of document.getAnimations()) { if (seen.has(a)) continue; const ef = a.effect, el = ef && ef.target, kf = ef && ef.getKeyframes ? ef.getKeyframes() : [];
        const props = new Set(); kf.forEach(k => Object.keys(k).forEach(x => props.add(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase())))); if (a.transitionProperty) props.add(a.transitionProperty);
        const tm = ef && ef.getTiming ? ef.getTiming() : {}; const nm = el ? (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '')) + (ef.pseudoElement || '') : '?';
        seen.set(a, { nm, props: [...props].filter(x => !/^(offset|easing|composite|computed-offset)$/.test(x)), ms: Math.round(+tm.duration || 0), delay: Math.round(+tm.delay || 0), ease: tm.easing === 'linear' && kf[0] && kf[0].easing ? kf[0].easing : tm.easing, kind: a.constructor.name.replace('CSS', '').replace('Animation', 'anim') }); }
      if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });
    await new Promise(r => setTimeout(r, 30)); const t0 = performance.now(); try { (0, eval)(code); } catch (e) { return { err: String(e) }; }
    await new Promise(r => setTimeout(r, 700)); run = false;
    const g = gaps.filter(x => x > 0), slow = g.filter(x => x > 25).length;
    return { frames: g.length, worst: Math.round(Math.max(0, ...g)), slow, anims: [...seen.values()], took: Math.round(performance.now() - t0) };
  }, code);
  const fmt = r => r.err ? 'ERROR ' + r.err : 'frames ' + r.frames + ', worst gap ' + r.worst + 'ms, slow frames ' + r.slow + '\n' + (r.anims.length ? r.anims.map(a => '      ' + (a.props.every(x => GPU.test(x)) ? 'ok ' : 'LAYOUT ') + a.kind + ' ' + a.nm + ' [' + a.props.join(',') + '] ' + a.ms + 'ms' + (a.delay ? ' +' + a.delay : '') + ' ' + a.ease).join('\n') : '      (nothing animated)');
  let where = 'entries';
  for (const [name, w, open, close] of W) {
    if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
    if (w !== where) { await p.evaluate(t => { const x = document.querySelector('.sh-tabs [data-tab="' + t + '"]'); x && x.click(); }, w); await p.waitForTimeout(3500); where = w; }
    const o = await watch(open); await p.waitForTimeout(300); const c = await watch(close); await p.waitForTimeout(500);
    console.log('\n' + name + '\n  OPEN  ' + fmt(o) + '\n  CLOSE ' + fmt(c));
  }
  await b.close();
})();
