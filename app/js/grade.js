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
  const RE = /\b(?:graded\s+)?(PSA|BGS|BECKETT|CGC|SGC|TAG)\s*(10|[1-9](?:\.5)?)(?:\s+(pristine|gem mint|gem-mt|mint\+?|black label|perfect))?\b/i;
  const WORDS = { '10': 'GEM MINT', '9.5': 'MINT+', '9': 'MINT', '8.5': 'NM-MT+', '8': 'NM-MT', '7.5': 'NM+', '7': 'NEAR MINT', '6.5': 'EX-MT+', '6': 'EX-MT', '5.5': 'EX+', '5': 'EXCELLENT', '4.5': 'VG-EX+', '4': 'VG-EX', '3.5': 'VG+', '3': 'VERY GOOD', '2.5': 'GOOD+', '2': 'GOOD', '1.5': 'FAIR', '1': 'POOR' };
  // where companies name a grade differently from the general scale
  // (a 10 is GEM MINT unless saved as Pristine: CGC, BGS, SGC and TAG give both)
  const BY = { BGS: { '9.5': 'GEM MINT' } };
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
  const pristine = gr => !!gr && gr.g === '10' && gr.w === 'PRISTINE';
  const label = gr => gr ? gr.co + ' ' + gr.g + (pristine(gr) ? ' Pristine' : '') : '';
  // v50.30: the entry's name without the grade in it ("Charizard PSA 10" -> "Charizard"); the grade shows as the chip instead
  const tidy = s => String(s || '').replace(/\(\s*\)/g, '').replace(/\s*([-–|/])(\s*[-–|/])+\s*/g, ' $1 ').replace(/\s*[-–|/,]\s*$/, '').replace(/^\s*[-–|/,]\s*/, '').replace(/\s{2,}/g, ' ').trim();
  function title(e) {
    const n = String((e && e.name) || ''); if (!of(e)) return n;
    const t = tidy(n.replace(new RegExp(RE.source, 'gi'), ' ')); return t || n;
  }
  // the card itself for the label: no game, no set, no number ("Dragon Ball Super Zenkai Series: SS Rose Goku Black,
  // Future of Despair SLR PSA 10" -> "SS Rose Goku Black, Future of Despair SLR")
  const GAME = /^(?:pok[eé]mon(?:\s+(?:tcg|trading card game|cards?))?|dragon ball(?:\s+super)?(?:\s+(?:fusion world|masters|card game|ccg|tcg))?|fusion world|one piece(?:\s+(?:card game|tcg|ccg))?|magic(?::)?(?:\s+the gathering)?|mtg|yu-?gi-?oh!?|disney lorcana|lorcana|digimon(?:\s+card game)?|union arena|weiss schwarz|flesh and blood|star wars unlimited)\b[\s:,-]*/i;
  const RAR = /\(?\b(SPR|SCR|SLR|SEC|TPR|UR|SR|HR|AR|SAR|SIR|CHR|CSR|IR|ACE)\b\)?/;
  const NUM = /#?\b(?:[A-Z]{0,4}\d{1,4}\/[A-Z]{0,4}\d{1,4}|[A-Z]{1,4}\d{1,3}-\d{2,3}|P-\d{2,4}|(?:SWSH|SVP|SV|SM|XY|BW|HGSS|DP|MEP)\s?\d{2,3})\b/gi;   // v50.52: black star promo numbers (SWSH052, SVP 085)
  const hasNum = x => { NUM.lastIndex = 0; const r = NUM.test(x); NUM.lastIndex = 0; return r; };
  const SETY = /\S:|\b(set|series|pack|box|deck|vol(?:ume)?|collection|expansion|booster|promos?|celebration|edition)\b|^(?:SV|SWSH|SM|XY|BW|ME|OP|EB|ST|FB|BT)\d/i;
  function cardName(e) {
    let n = title(e).replace(/\s*[×x]\d+$/, '').replace(/^(?:19|20)\d\d\s+/, ''), rar = '';   // v50.51: a leading year ("2023 Pokemon …")
    const hadGame = GAME.test(n); n = n.replace(GAME, '');
    const rm = RAR.exec(n); if (rm) { rar = rm[1]; n = n.replace(rm[0], ' '); }
    let segs = n.split(/\s+[-–|]\s+|\s*\/\s+|\s+\/\s*/).map(x => x.trim()).filter(Boolean);
    // v50.51: the part right before a bare card number is the card ("Name - 199/165 - Set" and "Set - Name - 199/165 - Rarity")
    const bare = x => x.replace(NUM, '').replace(/[\s#.,]/g, '') === '';
    const k = segs.findIndex(bare), beforeNum = k > 0 && !bare(segs[k - 1]) && !SETY.test(segs[k - 1]) ? segs[k - 1] : '';
    segs = segs.filter(x => !bare(x));   // drop bare numbers
    let pick = segs[0] || '';
    if (beforeNum) pick = beforeNum;
    else if (segs.length > 1) {
      const card = segs.filter(x => !SETY.test(x)), withNum = segs.find(x => hasNum(x) && !SETY.test(x));
      pick = withNum || card[0] || segs[0];
    }
    // "Set Name: Card Name" after a game ("Pokemon Surging Sparks: Pikachu ex")
    const cm = /\S:(?!.*\S:)/.exec(pick);   // v50.51: only "Set: Card"; "Son Gohan : Youth" keeps its colon
    if (cm && (hadGame || segs.length === 1)) { const after = pick.slice(cm.index + 2).trim(); if (after) pick = after; }
    pick = pick.replace(NUM, ' ').replace(/\s#\d{1,4}\b/g, ' ').replace(/\s{2,}/g, ' ').replace(/[\s,-]+$/, '').trim();
    return (pick || title(e)) + (rar ? ' ' + rar : '');
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const numOf = n => { const m = /(?:^|[\s#(-])([A-Z]{0,4}\d{1,4}\/[A-Z]{0,4}\d{1,4}|[A-Z]{1,4}\d{1,3}-\d{2,3}|P-\d{2,4}|(?:SWSH|SVP|SV|SM|XY|BW|HGSS|DP|MEP)\s?\d{2,3})\b/i.exec(n || ''); return m ? m[1].toUpperCase().replace(/\s/, '') : ''; };

  // the slab. `art` is the image markup (or a placeholder) that sits in the well
  function slab(e, art, cls) {
    const gr = of(e); if (!gr) return '';
    const meta = [numOf(e.name) || (e.no && /\d/.test(e.no) && e.no.length < 14 ? e.no : ''), gr.cert ? '#' + gr.cert : ''].filter(Boolean).join(' · ');
    const nm = cardName(e), long = nm.length > 20 ? (nm.length > 34 ? ' sl-long sl-xlong' : ' sl-long') : '';   // v50.51: long names get a smaller third line instead of "…"
    return '<span class="slab' + long + (cls ? ' ' + cls : '') + '" aria-label="' + esc(label(gr) + (gr.w ? ' ' + gr.w : '')) + ' graded">' +
      '<span class="sl-in"><span class="sl-lbl">' +
        '<span class="sl-co">' + esc(gr.co) + '</span><span class="sl-nm">' + esc(cardName(e)) + '</span>' + (meta ? '<span class="sl-meta">' + esc(meta) + '</span>' : '') +
        '<span class="sl-gr"><b>' + esc(gr.g) + '</b><small>' + esc(gr.w || word(gr.co, gr.g)) + '</small></span>' +
        '<span class="sl-tiny"><span>' + esc(gr.co) + '</span><b>' + esc(gr.g) + '</b></span>' +
      '</span><span class="sl-well">' + art + '</span></span></span>';
  }
  const chip = e => { const gr = of(e); return gr ? '<span class="sl-chip">' + esc(label(gr)) + '</span>' : ''; };

  window.CTGrade = { CO, parse, norm, of, word, label, title, cardName, pristine, slab, chip, GRADES: ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1'] };
})();
