/* Graded cards (v50.29).
   An entry can carry a grade: { co: 'PSA', g: '10', w: 'GEM MINT', cert: '12345678' } (w and cert optional).
   Graded cards show as a slab drawn in code: a clear case, a plain Card Tab label (the grading company's name as
   text, the card, its number, the cert and the grade) and the entry's own art in the well. One label design for
   every company, so it never copies any company's label.
   Older entries saved the grade only as a note ("Graded PSA 10") or a condition ("PSA 10" from an import); those
   show as slabs too. */
(function () {
  'use strict';
  const CO = ['PSA', 'BGS', 'CGC', 'SGC', 'TAG'];
  const RE = /\b(PSA|BGS|BECKETT|CGC|SGC|TAG)\s*(10|[1-9](?:\.5)?)(?:\s+(pristine|gem mint|gem-mt|mint\+?|black label|perfect))?\b/i;
  const WORDS = { '10': 'GEM MINT', '9.5': 'MINT+', '9': 'MINT', '8.5': 'NM-MT+', '8': 'NM-MT', '7.5': 'NM+', '7': 'NEAR MINT', '6.5': 'EX-MT+', '6': 'EX-MT', '5.5': 'EX+', '5': 'EXCELLENT', '4.5': 'VG-EX+', '4': 'VG-EX', '3.5': 'VG+', '3': 'VERY GOOD', '2.5': 'GOOD+', '2': 'GOOD', '1.5': 'FAIR', '1': 'POOR' };
  // where companies name a grade differently from the general scale
  const BY = { BGS: { '10': 'PRISTINE', '9.5': 'GEM MINT' }, CGC: { '9.5': 'MINT+' }, SGC: { '9.5': 'MINT+' } };
  const word = (co, g) => (BY[co] && BY[co][g]) || WORDS[g] || '';
  const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n);

  // "PSA 10", "Graded BGS 9.5 Pristine", "cgc10" -> grade object (or null)
  function parse(s) {
    const m = RE.exec(String(s || '')); if (!m) return null;
    const co = m[1].toUpperCase() === 'BECKETT' ? 'BGS' : m[1].toUpperCase(), g = m[2];
    const extra = m[3] ? m[3].toUpperCase().replace('GEM-MT', 'GEM MINT') : '';
    return { co, g, w: extra && extra !== word(co, g) ? extra : '' };
  }
  // tidy a grade before it's saved
  function norm(x) {
    if (!x) return null; if (typeof x === 'string') x = parse(x); if (!x || typeof x !== 'object') return null;
    const co = clean(x.co, 12).toUpperCase(), g = String(x.g == null ? '' : x.g).trim();
    if (!co || !/^(10|[1-9](\.5)?)$/.test(g)) return null;
    const o = { co, g }; const w = clean(x.w, 20).toUpperCase(); if (w) o.w = w; const c = clean(x.cert, 20).replace(/[^\w-]/g, ''); if (c) o.cert = c;
    return o;
  }
  // the grade an entry shows: its own, else one found in an older note or condition
  function of(e) {
    if (!e) return null;
    if (e.grade && typeof e.grade === 'object') return norm(e.grade);
    if (e.grade === false) return null;
    const n = /\bgraded\b/i.test(e.note || '') || /graded/i.test(e.condition || '') ? parse(e.note) : null;
    return n || parse(e.condition) || null;
  }
  const label = gr => gr ? gr.co + ' ' + gr.g : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const numOf = n => { const m = /(?:^|[\s#-])([A-Z]{0,4}\d{1,4}\/[A-Z]{0,4}\d{1,4})\b/i.exec(n || ''); return m ? m[1] : ''; };
  const short = n => String(n || '').split(' - ')[0].replace(/\s*[×x]\d+$/, '');

  // the slab. `art` is the image markup (or a placeholder) that sits in the well
  function slab(e, art, cls) {
    const gr = of(e); if (!gr) return '';
    const meta = [numOf(e.name), gr.cert ? '#' + gr.cert : ''].filter(Boolean).join(' · ');
    return '<span class="slab' + (cls ? ' ' + cls : '') + '" aria-label="' + esc(label(gr) + (gr.w ? ' ' + gr.w : '')) + ' graded">' +
      '<span class="sl-in"><span class="sl-lbl">' +
        '<span class="sl-co">' + esc(gr.co) + '</span><span class="sl-nm">' + esc(short(e.name)) + '</span>' + (meta ? '<span class="sl-meta">' + esc(meta) + '</span>' : '') +
        '<span class="sl-gr"><b>' + esc(gr.g) + '</b><small>' + esc(gr.w || word(gr.co, gr.g)) + '</small></span>' +
        '<span class="sl-tiny">' + esc(label(gr)) + '</span>' +
      '</span><span class="sl-well">' + art + '</span></span></span>';
  }
  const chip = e => { const gr = of(e); return gr ? '<span class="sl-chip">' + esc(label(gr)) + '</span>' : ''; };

  window.CTGrade = { CO, parse, norm, of, word, label, slab, chip, GRADES: ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1'] };
})();
