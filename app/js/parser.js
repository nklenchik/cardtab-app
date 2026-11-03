/* Card Tab entry parser. Turns one line of free text into fields. Works in the browser (window.CardParser) and node. */
(function (root) {
  var GAMES = [
    [/^(?:pok[eé]mon(?: tcg)?)\b/i, 'Pokémon'],
    [/^dragon ball (?:super )?fusion world\b/i, 'Fusion World'],
    [/^fusion world\b/i, 'Fusion World'],
    [/^dragon ball super(?: ccg| card game)?\b/i, 'Dragon Ball Super'],
    [/^dragon ball(?: ccg)?\b/i, 'Dragon Ball Super']
  ];
  var RARITY = 'SPR|SCR|SLR|SEC|TPR|UR|SR|HR|AR|SAR|SIR|CHR|CSR';
  var COND = { 'near mint': 'NM', 'lightly played': 'LP', 'moderately played': 'MP', 'heavily played': 'HP', 'damaged': 'DMG' };
  var FINISH = /\b(reverse holo(?:foil)?|holofoil|holo|foil|unlimited|1st edition|shadowless|gold stamped(?: with reflective shatterfoil)?|gold stamp)\b/gi;

  function clean(s) { return s.replace(/\s+/g, ' ').replace(/^[\s\-–:/,()]+|[\s\-–:/,()]+$/g, '').trim(); }

  function parse(input) {
    var raw = String(input || ''), s = ' ' + raw.trim() + ' ', o = { raw: raw.trim(), finishes: [] }, m;

    // quantity: trailing (n) or x n
    if ((m = s.match(/\((\d{1,3})\)\s*$/)) || (m = s.match(/\sx(\d{1,3})\s*$/i))) { o.qty = +m[1]; s = s.slice(0, m.index) + ' '; }

    // grade
    if ((m = s.match(/\b(PSA|CGC|BGS|SGC|TAG)\s*(\d{1,2}(?:\.5)?)(?:\s+(Pristine|Gem Mint|Mint|Black Label))?/i))) {
      o.grade = m[1].toUpperCase() + ' ' + m[2] + (m[3] ? ' ' + m[3] : '');
      s = s.replace(m[0], ' / ');
    }

    // sealed products
    if (/\b(booster (?:box|pack|bundle)|elite trainer box|etb|sealed|display box|unopened|case)\b/i.test(s)) o.sealed = true;
    s = s.replace(/\(\s*sealed\s*\)/i, ' ');

    // condition
    var cm = s.match(/\b(near mint|lightly played|moderately played|heavily played|damaged)\b/i);
    if (cm) { o.condition = COND[cm[1].toLowerCase()]; s = s.replace(cm[0], ' '); }
    else if ((cm = s.match(/(?:^|[\s(])(NM|LP|MP|HP)(?=[\s)]|$)/))) { o.condition = cm[1]; s = s.replace(cm[0], ' '); }

    // finish words
    s = s.replace(FINISH, function (w) { o.finishes.push(w.replace(/\b\w/g, function (c) { return c.toUpperCase(); })); return ' '; });

    // number
    var numRes = [/#?\b([A-Z]{0,4}\d{1,3}\/[A-Z]{0,3}\d{1,3})\b/, /#?\b(P-\d{2,4}|[A-Z]{1,3}\d{1,2}-\d{2,3})\b/, /#([A-Z]*\d{2,4})\b/];
    for (var i = 0; i < numRes.length && !o.number; i++) {
      if ((m = s.match(numRes[i]))) { o.number = m[1]; s = s.replace(m[0], ' / '); }
    }
    if (!o.number && (m = s.match(/\b(\d{1,3}\/\d{1,3})\b/))) { o.number = m[1]; s = s.replace(m[0], ' / '); }

    // set code in the last parentheses, like (M2) or (DBS-BE23)
    // rarity code anywhere as its own token, or in parentheses
    var rr = new RegExp('(?:\\(\\s*(' + RARITY + ')\\s*\\)|\\b(' + RARITY + ')\\b)'), rm = s.match(rr);
    if (rm) { o.rarity = rm[1] || rm[2]; s = s.replace(rm[0], ' '); }

    // parenthesised groups (balanced): set codes, set names, variants
    var groups = [], out = '', depth = 0, buf = '';
    for (var k = 0; k < s.length; k++) {
      var ch = s[k];
      if (ch === '(') { if (depth++ === 0) { buf = ''; continue; } }
      if (ch === ')' && depth > 0) { if (--depth === 0) { groups.push(clean(buf)); out += ' '; continue; } }
      if (depth > 0) buf += ch; else out += ch;
    }
    if (depth > 0) out += ' ' + buf;
    s = out;
    var vars = [], setHints = [];
    groups.forEach(function (g) {
      if (!g) return;
      if (/^[A-Z]{1,5}\d{0,3}(?:-[A-Z]*\d+)?$/.test(g)) { if (!o.setCode) o.setCode = g; }
      else if (/stamp|print|foil|regional|silver|gold|alt|art|promo|shatter|prerelease|pre-release|1st/i.test(g) && !/pack|vol|set|box/i.test(g)) vars.push(g);
      else setHints.push(g);
    });
    if (vars.length) o.variant = vars.join(', ');

    // game prefix
    var t = clean(s);
    for (var g = 0; g < GAMES.length; g++) { if (GAMES[g][0].test(t)) { o.game = GAMES[g][1]; t = clean(t.replace(GAMES[g][0], '')); break; } }

    // split into segments on " - " or " / "
    var segs = t.split(/\s+[-–/]\s+|\s*\/\s+|\s+\/\s*/).map(clean).filter(Boolean);
    if (segs.length === 1 && / - |–/.test(t) === false) segs = [t];

    var name = '', set = '', rest = [];
    if (segs.length) {
      var first = segs[0];
      if (/^[^()]{3,60}:\s+\S/.test(first) && (o.game || segs.length > 1 && /:/.test(first))) {
        // "Set: Name"
        var ix = first.indexOf(':'); set = clean(first.slice(0, ix)); name = clean(first.slice(ix + 1));
      } else name = first;
      rest = segs.slice(1);
    }
    // later segments: pick the one that looks like a set ("Set Name", "M2: Inferno X"), the rest are notes
    rest.forEach(function (sg) {
      if (!set && (/:/.test(sg) || /\b(set|pack|box|deck|vol|series|collection|promo|masquerade|rivals|combination|awakened|ambition)\b/i.test(sg) || /^[A-Z][^,]{4,}$/.test(sg))) set = sg;
    });
    // game or set text after a colon on the right ("... / Dragon Ball Super: Fighter's Ambition")
    if (!set && /:/.test(name)) { var j = name.indexOf(':'); set = clean(name.slice(j + 1)); name = clean(name.slice(0, j)); }

    if (!set && setHints.length) set = setHints[0];
    o.name = name; o.set = set;
    o.leftover = o.name ? '' : o.raw;
    return o;
  }

  var api = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CardParser = api;
})(typeof window !== 'undefined' ? window : this);
