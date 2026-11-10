/* Board numbers arrive (v50.88): the first time a widget's number comes into view after the app opens, it counts up from $0
   while sliding into place, up from below for a gain and down from above for a loss. After that a widget's number just shows,
   even when the Board redraws (a new month, a filter). Only transform and opacity move; the digits are tabular, so nothing jitters.
   Skipped for people who turn animations off. */
(function () {
  'use strict';
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const SEL = 'section.w[data-id] .bn.num, section.w[data-id] .xbig.num';
  const seen = new Set();
  const key = el => { const w = el.closest('section.w[data-id]'); return (w ? w.dataset.id : '') + ':' + el.className; };
  // the first bit of text with digits in it, split into what comes before, the number, and what comes after
  function part(el) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) { const m = n.textContent.match(/^([^\d]*?)(\d[\d,]*(?:\.(\d+))?)(.*)$/s); if (m) return { n, pre: m[1], v: +m[2].replace(/,/g, ''), dp: m[3] ? m[3].length : 0, post: m[4], comma: m[2].indexOf(',') >= 0 || +m[2].replace(/,/g, '') >= 1000 }; }
    return null;
  }
  function run(el) {
    const p = part(el); if (!p || !p.v) return;
    const neg = /[−-]/.test(p.pre) || el.classList.contains('r') || el.classList.contains('neg');
    const fmt = v => p.pre + v.toLocaleString('en-US', { minimumFractionDigits: p.dp, maximumFractionDigits: p.dp, useGrouping: p.comma }) + p.post;
    el._ctRising = 1;
    const final = p.n.textContent, t0 = performance.now(), D = 900, dy = neg ? -14 : 14;
    el.animate([{ transform: 'translateY(' + dy + 'px)', opacity: 0, offset: 0 }, { opacity: 1, offset: .35 }, { transform: 'none', opacity: 1 }], { duration: D, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const step = now => { if (!p.n.isConnected) { el._ctRising = 0; return; } const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      p.n.textContent = k < 1 ? fmt(p.v * e) : final; if (k < 1) requestAnimationFrame(step); else el._ctRising = 0; };
    p.n.textContent = fmt(0); requestAnimationFrame(step);
  }
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); const k = key(e.target); if (!seen.has(k)) { seen.add(k); if (!calm.matches && !document.hidden) run(e.target); } e.target.style.opacity = ''; }), { threshold: 0.25 });
  const take = el => { if (el._ctRise) return; el._ctRise = 1; if (!seen.has(key(el))) { if (!calm.matches) el.style.opacity = '0'; io.observe(el); } };  // hidden until it counts in, so the final number never flashes first
  const scan = root => { if (root.matches && root.matches(SEL)) take(root); if (root.querySelectorAll) root.querySelectorAll(SEL).forEach(take); };
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') scan(document); else document.addEventListener('DOMContentLoaded', () => scan(document));
})();
