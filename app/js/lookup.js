/* Card lookup. Today it searches a small built-in catalog (real printings from the TCGplayer test).
   Later it calls our own /api/lookup (JustTCG + TCGdex, cached, art saved as WebP) and returns the same shape. */
(function (root) {
  var CAT = [
    { id: 'pk-charizard-199', n: 'Charizard ex', s: 'SV: Scarlet & Violet 151', num: '199/165', r: 'Special Illustration Rare', h: 12, g: 'Pokémon' },
    { id: 'pk-raichu-base', n: 'Raichu', s: 'Base Set', num: '014/102', r: 'Holo Rare', h: 48, g: 'Pokémon' },
    { id: 'pk-raichu-shadowless', n: 'Raichu', s: 'Base Set (Shadowless)', num: '014/102', r: 'Holo Rare', h: 38, g: 'Pokémon' },
    { id: 'pk-gengar-154', n: 'Gengar ex', s: 'ME: 30th Celebration', num: '154/128', r: 'Special Illustration Rare', h: 280, g: 'Pokémon' },
    { id: 'pk-sceptile', n: 'Sceptile', s: 'Stormfront', num: '10/100', r: 'Holo Rare', h: 130, g: 'Pokémon' },
    { id: 'dbs-goku-b-1', n: 'SS Rose Goku Black, Future of Despair', s: 'Fearsome Rivals', num: 'BT29-086', r: 'Uncommon', h: 232, g: 'Dragon Ball Super' },
    { id: 'dbs-goku-b-2', n: 'SS Rose Goku Black, Future of Despair', s: 'Fearsome Rivals Release Event', num: 'BT29-086', r: 'Uncommon', h: 196, g: 'Dragon Ball Super' },
    { id: 'dbs-goku-b-3', n: 'SS Rose Goku Black, Future of Despair', s: 'Fearsome Rivals', num: 'BT29-086', r: 'Special Leader Rare', h: 288, g: 'Dragon Ball Super' },
    { id: 'dbs-broly-1', n: 'Broly, Ultimate Agent of Destruction', s: '5th Anniversary Set', num: 'BT6-125', r: 'Secret Rare', h: 44, g: 'Dragon Ball Super' },
    { id: 'dbs-broly-2', n: 'Broly, Ultimate Agent of Destruction', s: 'Destroyer Kings', num: 'BT6-125', r: 'Secret Rare', h: 18, g: 'Dragon Ball Super' },
    { id: 'dbs-cooler', n: 'Cooler, Armed Force', s: 'Tournament Promotion Cards', num: 'P-455', r: 'Promo', h: 330, g: 'Dragon Ball Super' },
    { id: 'dbs-gohan-st', n: 'SS Son Gohan, Self-Taught Truth', s: 'Perfect Combination', num: 'BT23-011', r: 'Super Rare', h: 100, g: 'Dragon Ball Super' }
  ];
  var RARITY_FULL = { SPR: 'special rare', SCR: 'secret rare', SLR: 'special leader rare', SEC: 'secret rare', SR: 'super rare', TPR: 'promo' };
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function words(s) { return norm(s).split(' ').filter(function (w) { return w.length > 1; }); }
  function hit(hay, needle) { return needle.length && needle.every(function (w) { return hay.some(function (h) { return h.indexOf(w) === 0 || w.indexOf(h) === 0; }); }); }

  function score(c, p) {
    var sc = 0, nm = words(c.n), pn = words(p.name);
    if (p.number && norm(p.number) === norm(c.num)) sc += 3;
    if (pn.length && hit(nm, pn)) sc += 3; else if (pn.length && pn.some(function (w) { return nm.indexOf(w) > -1; })) sc += 1;
    if (p.set && hit(words(c.s), words(p.set))) sc += 2;
    if (p.rarity && norm(c.r).indexOf(RARITY_FULL[p.rarity] || '~') > -1) sc += 1;
    if (p.game && c.g === p.game) sc += 1;
    return sc;
  }

  // returns { list: [candidates, best first], pick: index to pre-select or -1, why: text }
  function search(p) { return rank(CAT, p); }
  function rank(cat, p) {
    if (!p || !p.name && !p.number) return { list: [], pick: -1 };
    var sc = cat.map(function (c) { return { c: c, s: score(c, p) }; }).filter(function (x) { return x.s >= 3; }).sort(function (a, b) { return b.s - a.s; });
    var list = sc.map(function (x) { return x.c; });
    if (!list.length) return { list: [], pick: -1 };
    if (list.length === 1) return { list: list, pick: 0, why: 'one' };
    var top = sc[0], other = sc.filter(function (x) { return x.c.s !== top.c.s || x.c.r !== top.c.r; })[0];
    if (top.s >= 5 && (!other || top.s - other.s >= 2)) return { list: list, pick: 0, why: p.set ? 'Matches “' + p.set + '”' : 'Best match' };
    return { list: list, pick: -1 };
  }
    // Live lookup against our own API (Worker). Falls back to the built-in catalog if the API is not set up or fails.
  function remote(p) {
    var base = root.CARDTAB_API;
    if (!base || !p || !p.name && !p.number) return Promise.resolve(search(p));
    var q = '?name=' + encodeURIComponent(p.name || '') + '&number=' + encodeURIComponent(p.number || '') + '&set=' + encodeURIComponent(p.set || '') + '&game=' + encodeURIComponent(p.game || '');
    return fetch(base + '/api/lookup' + q).then(function (r) { if (!r.ok) throw new Error('lookup'); return r.json(); }).then(function (j) {
      var cards = (j.cards || []).map(function (c) { return { id: c.id, n: c.n, s: c.s, num: c.num, r: c.r, g: c.g, h: 210, art: { list: base + c.art.list, detail: base + c.art.detail } }; });
      return rank(cards, p);
    }).catch(function () { return search(p); });
  }
  root.CardLookup = { search: search, rank: rank, remote: remote };
})(typeof window !== 'undefined' ? window : this);
