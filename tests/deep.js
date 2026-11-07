// Deep audit: layout, touch, text, contrast, images, covered controls — every page, sizes × themes.
const { chromium, devices } = require('playwright');
const SIZES = [['se', 375, 667, true], ['i13', 390, 664, true], ['max', 430, 860, true], ['tab', 768, 1024, true], ['lap', 1280, 800, false], ['wide', 1440, 900, false]];
const CHECK = () => {
  const W = innerWidth, H = innerHeight, out = { wide: [], clip: [], small: [], zoom: [], covered: [], contrast: [], broken: [] };
  const vis = el => { const r = el.getBoundingClientRect(), c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > .05 && !el.closest('[hidden],[inert],dialog:not([open])'); };
  const name = el => { const t = (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).toString().trim().replace(/\s+/g, ' '); return (el.id ? '#' + el.id + ' ' : '') + t.slice(0, 40); };
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(c.overflowX)) return true; } return false; };
  const touch = matchMedia('(hover:none)').matches;
  document.querySelectorAll('body *').forEach(el => {
    if (!vis(el)) return; const r = el.getBoundingClientRect(), c = getComputedStyle(el);
    if ((r.right > W + 2 || r.left < -2) && !inScroller(el) && c.position !== 'fixed') out.wide.push(name(el) + ' (' + Math.round(r.left) + '→' + Math.round(r.right) + ')');
    // clipped text (cut off without an ellipsis)
    if (el.children.length === 0 && el.textContent.trim().length > 2 && el.scrollWidth > el.clientWidth + 2 && /(hidden|clip)/.test(c.overflowX) && c.textOverflow !== 'ellipsis') out.clip.push(name(el));
    // touch targets
    if (touch && el.matches('button, a[href], [role=button], input:not([type=hidden]), select, summary, label.switch') && !el.closest('p, .ntf-fine, small')) {
      if (r.width < 32 || r.height < 32) out.small.push(name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    if (touch && W < 700 && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, select') && parseFloat(c.fontSize) < 16) out.zoom.push(name(el) + ' ' + c.fontSize);
    // interactive things covered by something else at their center
    if (el.matches('button, a[href], [role=button], input, select') && r.top >= 0 && r.bottom <= H && r.left >= 0 && r.right <= W) {
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el) && !hit.closest('label')?.contains(el)) {
        const hc = getComputedStyle(hit); if (hc.pointerEvents !== 'none') out.covered.push(name(el) + ' under ' + name(hit));
      }
    }
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth === 0 && el.getAttribute('src')) out.broken.push(el.getAttribute('src').slice(0, 60));
    // contrast for text leaves
    if (el.children.length === 0 && el.textContent.trim().length > 1 && c.color) {
      const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
      let bg = null; for (let p = el; p; p = p.parentElement) { const pc = getComputedStyle(p); if (pc.backgroundImage !== 'none' && pc.backgroundImage !== '') { bg = null; break; } const v = rgb(pc.backgroundColor); if (v.length >= 3 && (v[3] === undefined || v[3] > .9)) { bg = v; break; } }
      if (bg) { const fg = rgb(c.color), a = fg[3] === undefined ? 1 : fg[3]; const mix = fg.slice(0, 3).map((x, i) => x * a + bg[i] * (1 - a));
        const L = v => { const [R, G, B] = v.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * R + .7152 * G + .0722 * B; };
        const l1 = L(mix), l2 = L(bg), cr = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05), big = parseFloat(c.fontSize) >= 18 || (parseFloat(c.fontSize) >= 14 && +c.fontWeight >= 700);
        if (cr < (big ? 3 : 4.5) && cr < 4) out.contrast.push(name(el) + ' ' + cr.toFixed(2)); }
    }
  });
  for (const k in out) out[k] = [...new Set(out[k])];
  return out;
};
(async () => { const b = await chromium.launch(); const rep = {};
 const add = (k, list) => list.forEach(x => { (rep[k] = rep[k] || new Map()); const m = rep[k]; m.set(x.v, (m.get(x.v) || []).concat(x.where)); });
 for (const [tag, w, h, touch] of SIZES) for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext(touch ? { ...devices['iPhone 13'], viewport: { width: w, height: h }, colorScheme: scheme } : { viewport: { width: w, height: h }, colorScheme: scheme });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.setItem('ct.session', JSON.stringify({ email: 'a@x.test', via: 'email', expires: Date.now() + 864e5 })));
  await p.reload(); await p.waitForTimeout(1300); await p.evaluate(async () => { await CTStore.setPlan('premium'); document.querySelector('[data-dev=sample]').click(); }); await p.waitForTimeout(1400);
  for (const pg of ['entries', 'board', 'stories']) {
   await p.evaluate(pg => { const t = [...document.querySelectorAll('.ct-tbar button, .sh-tabs button, .ct-tabs button')].find(x => x.offsetParent && new RegExp(pg, 'i').test(x.textContent)); if (t) t.click(); }, pg);
   await p.waitForTimeout(pg === 'entries' ? 1000 : 4000);
   const where = tag + '-' + scheme + '-' + pg;
   const r = await p.evaluate(CHECK); for (const k in r) add(k, r[k].map(v => ({ v, where })));
   if (pg === 'stories') { for (const f of p.frames()) if (await f.evaluate(() => !!document.getElementById('shelf')).catch(() => false)) { const rr = await f.evaluate(CHECK); for (const k in rr) add('stories-' + k, rr[k].map(v => ({ v, where }))); } }
  }
  if (errs.length) add('errors', errs.map(v => ({ v, where: tag + '-' + scheme })));
  await ctx.close();
 }
 for (const k in rep) { console.log('\n## ' + k + ' (' + rep[k].size + ')'); [...rep[k].entries()].slice(0, 30).forEach(([v, ws]) => console.log('  ' + v + '   [' + [...new Set(ws)].slice(0, 4).join(', ') + (ws.length > 4 ? ' +' + (ws.length - 4) : '') + ']')); }
 await b.close(); })();
