/* Editions for early English Pokémon cards (v53.06).
   Base Set comes as 1st Edition, Shadowless, Unlimited and the UK 4th Edition (1999-2000) print; Jungle through Neo Destiny
   as 1st Edition or Unlimited. The card catalog lists Base Set and Base Set (Shadowless) as two cards and folds 1st Edition
   into Base Set, so Card Tab shows one card with an Edition choice and saves the edition in the entry's name:
   "Charizard - 004/102 - Base Set, 1st Edition". Base Set 2 and every other set are untouched.
   - Starts on what was typed ("1st ed", "shadowless", "4th", "uk") or read from the photo, else Unlimited.
   - Never a required step: there's always a sensible default. */
(function (root) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const BASE = ['1st Edition', 'Shadowless', 'Unlimited', '4th Edition (UK)'], EARLY = ['1st Edition', 'Unlimited'];
  const EARLY_SETS = new Set(['jungle', 'fossil', 'team rocket', 'gym heroes', 'gym challenge', 'neo genesis', 'neo discovery', 'neo revelation', 'neo destiny']);
  const isBase = s => { const n = norm(s); return n === 'base set' || n === 'base set shadowless'; };
  function kind(c) {
    if (!c || c.typed || /japan/i.test(c.g || '')) return null;
    if (isBase(c.s)) return 'base';
    return EARLY_SETS.has(norm(c.s)) ? 'early' : null;
  }
  const list = k => (k === 'base' ? BASE : k === 'early' ? EARLY : []);
  // what someone typed ("charizard base 1st ed") or what the photo reader saw ("4th Edition")
  function fromText(t) {
    const n = norm(t);
    if (/\b(1st|first)( ed| edition)?\b/.test(n)) return '1st Edition';
    if (/\bshadowless\b/.test(n)) return 'Shadowless';
    if (/\b4th( ed| edition)?\b|\buk\b|\b1999 2000\b/.test(n)) return '4th Edition (UK)';
    if (/\bunlimited\b/.test(n)) return 'Unlimited';
    return '';
  }
  // the edition to start on for a card
  function start(c, hint) {
    const k = kind(c); if (!k) return '';
    const h = fromText(hint), ok = list(k);
    if (h && ok.includes(h)) return h;
    if (k === 'base' && norm(c.s) === 'base set shadowless') return 'Shadowless';
    return 'Unlimited';
  }
  const setText = (c, e) => { const k = kind(c); return k && e ? (k === 'base' ? 'Base Set' : c.s) + ', ' + e : (c && c.s) || ''; };
  // Shadowless is its own catalog card; the other editions share the main one
  function cardFor(c, e, all) {
    if (kind(c) !== 'base') return c;
    const want = e === 'Shadowless' ? 'base set shadowless' : 'base set';
    if (norm(c.s) === want) return c;
    return (all || []).find(x => norm(x.s) === want && norm(x.n) === norm(c.n) && norm(x.num).replace(/\b0+(?=\d)/g, '') === norm(c.num).replace(/\b0+(?=\d)/g, '')) || c;
  }
  const name = (c, e) => [c.n, c.num, setText(c, e)].filter(Boolean).join(' - ');
  // Base Set and Base Set (Shadowless) of the same card show as one choice (the Edition row tells them apart)
  function merge(all) {
    return (all || []).filter(c => !(norm(c.s) === 'base set shadowless' && all.some(x => x !== c && norm(x.s) === 'base set' && norm(x.n) === norm(c.n) && norm(x.num).replace(/\b0+(?=\d)/g, '') === norm(c.num).replace(/\b0+(?=\d)/g, ''))));
  }
  const HINT = {
    '1st Edition': 'The black “Edition 1” stamp on the left, just under the art.',
    'Shadowless': 'No stamp, and no shadow along the right side of the art box.',
    'Unlimited': 'The most common printing: a shadow along the right of the art box.',
    '4th Edition (UK)': 'The 1999–2000 print, mostly sold in the UK (look for ©1999-2000 at the bottom).'
  };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  // the chips: attr names the data attribute each chip carries (its value is the edition, plus pre if given)
  const SHORT = { '4th Edition (UK)': '4th (UK)' };   // so all four fit on one line on a phone
  const chips = (k, cur, attr, pre) => list(k).map(e => '<button type="button" class="ed-chip" ' + attr + '="' + esc((pre || '') + e) + '" aria-pressed="' + (e === cur) + '" aria-label="' + esc(e) + '">' + esc(SHORT[e] || e) + '</button>').join('');
  // v53.07 a saved entry's name ("Charizard - 004/102 - Base Set, 1st Edition" or an older "... - Base Set (Shadowless)")
  function fromName(nm) {
    const parts = String(nm || '').split(' - '); if (parts.length < 3) return null;
    let s = parts[parts.length - 1], ed = ''; const m = /^(.*?),\s*(1st Edition|Shadowless|Unlimited|4th Edition \(UK\))\s*$/.exec(s);
    if (m) { s = m[1]; ed = m[2]; }
    const c = { n: parts.slice(0, -2).join(' - '), num: parts[parts.length - 2], s }, k = kind(c); if (!k) return null;
    if (!ed && k === 'base' && norm(s) === 'base set shadowless') ed = 'Shadowless';
    return { k, card: c, ed };
  }
  const rename = (nm, ed) => { const x = fromName(nm); return x ? name(x.card, ed) : nm; };
  root.CTEdition = { kind, list, fromText, start, setText, cardFor, name, merge, HINT, chips, fromName, rename };
})(typeof window !== 'undefined' ? window : this);
