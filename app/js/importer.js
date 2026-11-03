/* Card Tab import rules: turn any spreadsheet's rows into clean Card Tab entries.
   1. Find the sheet and header row, and work out what each column holds (by its name, then by its contents).
   2. Read every row: dates in any common format, money with or without $ , ( ) or commas, the type
      (from a column or worked out from the amounts), quantity, platform, condition and notes.
   3. Sales: your sold-for and after-fees numbers are the source of truth. Notes like "-$7.36 fees / -$0.80 stamp"
      split the difference into transaction fees and shipping only when they add up exactly; otherwise the
      difference is kept as "fees and shipping (combined)" and the row is listed for an optional check.
   4. The card: titles go through the same parser as the add-card sheet. Image links that carry a TCGplayer
      product number or a TCGdex card id are kept, so each line can be matched to the exact printing.
   All money is in whole cents. Nothing is guessed silently: anything unusual is listed on the review screen. */
(function (root) {
  'use strict';

  // ---------- column names we recognise (lower case, punctuation removed) ----------
  const FIELDS = {
    date: ['date', 'order date', 'sold date', 'sale date', 'purchase date', 'transaction date', 'day', 'when'],
    type: ['transaction', 'type', 'transaction type', 'kind', 'buy sell', 'buy or sell', 'action', 'category'],
    platform: ['platform', 'marketplace', 'site', 'source', 'where', 'venue', 'channel', 'store', 'sold on', 'bought on', 'seller', 'buyer'],
    name: ['items', 'item', 'card', 'cards', 'card name', 'name', 'title', 'description', 'product', 'listing', 'item name', 'what', 'card or item', 'item description', 'details'],
    gross: ['gross', 'gross profit', 'gross sale', 'sold for', 'sale price', 'sold price', 'price sold', 'sale amount', 'revenue', 'sale total', 'sold'],
    net: ['net', 'net profit', 'payout', 'after fees', 'you keep', 'net sale', 'earnings', 'take home', 'net amount', 'proceeds'],
    purchase: ['total purchase price', 'purchase price', 'purchase', 'cost', 'paid', 'buy price', 'bought for', 'price paid', 'amount paid', 'spent'],
    amount: ['amount', 'price', 'total', 'value'],
    fees: ['fees', 'fee', 'transaction fees', 'seller fees', 'platform fees', 'selling fees'],
    ship: ['shipping', 'shipping cost', 'postage', 'label', 'ship'],
    qty: ['qty', 'quantity', 'count', 'units', '#'],
    condition: ['condition', 'cond', 'grade'],
    note: ['note', 'notes', 'comment', 'comments', 'memo'],
    image: ['image', 'img', 'art', 'picture', 'photo', 'image url', 'url', 'link']
  };
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();

  function headerScore(row) {
    let n = 0; const used = new Set();
    (row || []).forEach(c => { const h = norm(c); for (const f in FIELDS) if (!used.has(f) && FIELDS[f].includes(h)) { used.add(f); n++; break; } });
    return n;
  }
  // Pick the sheet that looks most like a buy/sell log, and its header row
  function findTable(book) {
    let best = null;
    book.sheets.forEach((sh, si) => {
      for (let r = 0; r < Math.min(25, sh.rows.length); r++) {
        const sc = headerScore(sh.rows[r]);
        const hasCore = mapColumns(sh.rows[r]).date != null;
        const bodyRows = sh.rows.slice(r + 1).filter(x => x && x.some(v => v != null && v !== '')).length;
        const score = sc * 10 + (hasCore ? 15 : 0) + Math.min(bodyRows, 500) / 100;
        if ((sc >= 3 || (sc >= 2 && bodyRows > 0)) && (!best || score > best.score)) best = { sheet: si, header: r, score };
      }
    });
    return best;
  }
  function mapColumns(header) {
    const map = {};
    (header || []).forEach((c, i) => {
      const h = norm(c); if (!h) return;
      for (const f in FIELDS) if (map[f] == null && FIELDS[f].includes(h)) { map[f] = i; return; }
      // looser: header contains a known word ("Sale Price (USD)")
      for (const f of ['date', 'gross', 'net', 'purchase', 'fees', 'ship', 'qty', 'platform', 'name', 'type', 'note', 'image', 'condition'])
        if (map[f] == null && FIELDS[f].some(k => k.length > 3 && h.includes(k))) { map[f] = i; return; }
    });
    return map;
  }

  // ---------- values ----------
  function cents(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
    let s = String(v).trim(), neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[\s$£€,]|usd/gi, '').replace(/^[−-]/, m => { neg = !neg; return ''; });
    if (!/^\d*\.?\d+$/.test(s)) return null;
    const [w, f = ''] = s.split('.');
    const c = parseInt(w || '0', 10) * 100 + parseInt((f + '00').slice(0, 2), 10) + (f.length > 2 && +f[2] >= 5 ? 1 : 0);
    return neg ? -c : c;
  }
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = n => String(n).padStart(2, '0');
  function ymdOk(y, m, d) { if (y < 100) y += 2000; const dt = new Date(y, m - 1, d); return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && y > 1990 && y < 2100 ? y + '-' + pad(m) + '-' + pad(d) : null; }
  function date(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') { if (v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); } return null; }
    const s = String(v).trim(); let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return ymdOk(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s))) return ymdOk(+m[3], +m[1], +m[2]) || ymdOk(+m[3], +m[2], +m[1]); // US first, then day/month
    if ((m = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/i.exec(s)) && MONTHS[m[1].slice(0, 4).toLowerCase()] || (m && MONTHS[m[1].slice(0, 3).toLowerCase()])) return ymdOk(+m[3], MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
    if ((m = /^(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{2,4})$/i.exec(s)) && MONTHS[m[2].slice(0, 3).toLowerCase()]) return ymdOk(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
    return null;
  }
  function typeOf(v) {
    const s = norm(v); if (!s) return null;
    if (/refund|return/.test(s)) return 'refund';
    if (/^(sale|sold|sell|selling|s|out)$|sale|sold/.test(s)) return 'sale';
    if (/^(purchase|bought|buy|buying|p|in)$|purchase|bought|buy/.test(s)) return 'purchase';
    return null;
  }
  const PLATFORMS = [[/^tcg ?player/i, 'TCGplayer'], [/^e ?bay/i, 'eBay'], [/^mercari/i, 'Mercari'], [/^whatnot/i, 'Whatnot'], [/^(fb|facebook)?\s*market ?place|^facebook/i, 'Facebook Marketplace'], [/^card ?show/i, 'Card Show'], [/^(lgs|local game store|local shop)/i, 'Local game store'], [/^cardmarket/i, 'Cardmarket'], [/^instagram|^ig$/i, 'Instagram'], [/^reddit/i, 'Reddit']];
  function platformOf(v) { const s = String(v == null ? '' : v).trim(); if (!s) return ''; for (const [re, name] of PLATFORMS) if (re.test(s)) return name; return s.length <= 3 ? s.toUpperCase() : s.replace(/\b\w/g, c => c.toUpperCase()); }
  const COND = [[/near ?mint|\bnm\b/i, 'Near Mint'], [/lightly ?played|\blp\b/i, 'Lightly Played'], [/moderately ?played|\bmp\b/i, 'Moderately Played'], [/heavily ?played|\bhp\b/i, 'Heavily Played'], [/damaged|\bdmg\b/i, 'Damaged'], [/psa|bgs|cgc|sgc|graded|slab/i, 'Graded'], [/sealed/i, 'Sealed']];
  const condOf = s => { for (const [re, c] of COND) if (re.test(s || '')) return c; return ''; };

  // Exact card references hidden in image links
  function refOf(url) {
    const s = String(url || '');
    let m = /tcgplayer[^/]*\/product\/(\d+)/i.exec(s) || /tcgplayer\.com\/product\/(\d+)/i.exec(s); if (m) return { tcgplayerId: m[1] };
    m = /assets\.tcgdex\.net\/[a-z-]+\/[^/]+\/([^/]+)\/([^/.]+)/i.exec(s); if (m) return { tcgdex: m[1] + '-' + m[2] };
    m = /cardtrader\.com\/.*?\/(\d{4,})/i.exec(s); if (m) return { cardtrader: m[1] };
    return null;
  }

  // ---------- fee notes ----------
  const SHIP_WORDS = /ship|shupping|shiping|stamp|label|track|ups\b|usps|fedex|dhl|postage|mail|envelope|ground advantage|first class|pwe/i;
  function noteSplit(text) {
    let fees = 0, ship = 0, found = false; const lines = String(text || '').split(/\n|\||;|,(?=\s*\$?-?\d)/).map(l => l.trim()).filter(Boolean);
    for (const l of lines) {
      const low = l.toLowerCase();
      if (/sold|org\.|original|refund|between|entire|order|x\d|\$\d+ sold/.test(low) && !/fee|ship|stamp|track/.test(low)) continue;
      const amts = [...l.matchAll(/-?\$?\s?(\d[\d,]*(?:\.\d{1,2})?)/g)].map(m => cents(m[1]));
      if (!amts.length) continue;
      if (/fee|tax/.test(low) && SHIP_WORDS.test(low)) return null; // one line mixing both: can't split it
      if (/fee|tax|commission/.test(low)) { fees += amts[amts.length - 1]; found = true; }
      else if (SHIP_WORDS.test(low)) { ship += amts[amts.length - 1]; found = true; }
    }
    return found ? { fees, ship } : null;
  }

  // Tidy display name in the "Name - number - set" format, using what the parser understood
  function displayName(raw, p) {
    if (p && p.name && p.set && p.number) return p.name + ' - ' + p.number + ' - ' + p.set;
    if (p && p.name && p.set) return p.name + ' - ' + p.set;
    return String(raw).replace(/^(pok[eé]mon|dragon ball super( ccg)?|magic|yu-?gi-?oh!?|one piece|lorcana)\s*-\s*/i, '').replace(/\s*\(\d+\)\s*$/, '').trim();
  }

  // ---------- rows -> entries ----------
  function build(book, opts) {
    opts = opts || {};
    const t = opts.table || findTable(book);
    if (!t) return { ok: false, reason: 'no-table' };
    const sh = book.sheets[t.sheet], header = sh.rows[t.header], map = Object.assign(mapColumns(header), opts.map || {});
    const out = [], skipped = [];
    const parse = root.CardParser ? root.CardParser.parse : null;
    for (let r = t.header + 1; r < sh.rows.length; r++) {
      const row = sh.rows[r] || [], get = f => (map[f] == null ? null : row[map[f]]);
      const note = c => (c == null ? '' : sh.notes[r + ',' + c] || '');
      if (!row.some(v => v != null && v !== '')) continue;
      const rawName = get('name'), d = date(get('date'));
      let gross = cents(get('gross')), net = cents(get('net')), buy = cents(get('purchase')), amt = cents(get('amount'));
      const flags = [], x = { row: r + 1, flags };
      if (!rawName && gross == null && net == null && buy == null && amt == null) { skipped.push({ row: r + 1, why: 'No card or amount' }); continue; }
      let type = typeOf(get('type'));
      // No type column: the wording decides first ("sold", "bought"), then which money columns are filled.
      // A single amount column with no wording counts as a purchase (money out) and is listed for a check.
      if (!type) {
        const words = String(rawName || '') + ' ' + String(get('note') || '');
        type = /\b(sold|sale|sell)\b/i.test(words) ? 'sale' : /\b(bought|buy|purchased?)\b/i.test(words) ? 'purchase' : /\brefund/i.test(words) ? 'refund'
          : (gross != null || net != null) && buy == null ? 'sale' : buy != null ? 'purchase' : amt != null ? 'purchase' : null;
        if (type && map.gross == null && map.net == null && map.purchase == null && !/\b(sold|sale|sell|bought|buy|purchased?|refund)/i.test(words)) flags.push('No sale or purchase column, so it was set as a purchase. Change it after importing if it was a sale.');
      }
      if (!type) { skipped.push({ row: r + 1, why: 'Couldn’t tell if it’s a sale or a purchase' }); continue; }
      const allNotes = [note(map.gross), note(map.net), note(map.purchase), note(map.name), note(map.amount), String(get('note') || '')].filter(Boolean);
      const e = { type, date: d, platform: platformOf(get('platform')), source: String(rawName || '').trim(), qty: 1, condition: '', note: allNotes.join('\n') };
      if (!d) { flags.push('No readable date, so it was set to today. Edit it after importing.'); }
      // the card
      const p = parse && rawName ? parse(String(rawName)) : null;
      e.name = rawName ? displayName(rawName, p) : 'Untitled entry';
      if (p && p.qty) e.qty = p.qty; const q = parseInt(get('qty'), 10); if (q > 0) e.qty = q;
      e.condition = condOf(get('condition')) || (p && p.condition ? ({ NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played' }[p.condition] || '') : '') || (p && p.grade ? 'Graded' : '');
      if (p && p.grade) e.note = ('Graded ' + p.grade + (e.note ? '\n' + e.note : '')).trim();
      const ref = refOf(get('image'));
      e.ref = ref || null;
      // Keep the sheet's own image link too, so art can be brought in (converted to small WebP by our art service) even when the card can't be matched exactly
      const img = String(get('image') || '').trim(); e.artSource = /^https?:\/\//i.test(img) ? img.slice(0, 500) : null; e.parsed = p ? { name: p.name || '', number: p.number || '', set: p.set || '', game: p.game || '' } : null;
      e.match = ref && (ref.tcgplayerId || ref.tcgdex) ? 'exact' : p && p.name && (p.number || p.set) ? 'name' : 'typed';
      // money
      if (type === 'sale') {
        if (gross == null && amt != null) gross = Math.abs(amt);
        if (gross == null && net != null) { gross = net; flags.push('Only an after-fees amount, so it’s treated as sold for that with no fees.'); }
        if (net == null) net = gross;
        e.amount = gross;
        const fsC = cents(get('fees')), shC = cents(get('ship'));
        const split = fsC != null || shC != null ? { fees: Math.abs(fsC || 0), ship: Math.abs(shC || 0) } : noteSplit(note(map.net) || note(map.gross) || get('note'));
        if (split && split.fees + split.ship === gross - net) { e.fees = split.fees; e.ship = split.ship; if (fsC == null && shC == null) x.fromNote = true; }
        else { e.net = net; if (gross !== net) flags.push(split ? 'The note’s fees and shipping don’t add up to this sale, so they’re kept together as one amount.' : 'No note splitting fees from shipping, so they’re kept together as one amount.'); e.combined = gross !== net; }
      } else if (type === 'purchase') {
        e.amount = Math.abs(buy != null ? buy : amt != null ? amt : gross != null ? gross : 0);
        if (e.amount === 0) flags.push('Recorded at $0.');
      } else { // refund: money paid back to a buyer
        e.amount = Math.abs(net != null ? net : gross != null ? gross : amt != null ? amt : buy != null ? buy : 0);
        if (e.amount === 0) flags.push('A $0 refund, kept for your history.');
      }
      x.entry = e; x.hasNote = allNotes.length > 0; out.push(x);
    }
    return { ok: true, notesRead: out.filter(x => x.hasNote).length, notesSplit: out.filter(x => x.fromNote).length, sheet: sh.name, sheetIndex: t.sheet, headerRow: t.header + 1, header, map, rows: out, skipped };
  }

  // Summary for the review screen (cents)
  function summarize(res, store) {
    const es = res.rows.map(x => x.entry);
    const have = store ? new Set(store.all().map(e => store.fingerprint(e))) : new Set();
    const fresh = [], dupes = [];
    res.rows.forEach(x => { const fp = store ? store.fingerprint(Object.assign({}, x.entry, { net: x.entry.type === 'sale' ? (x.entry.net != null ? x.entry.net : x.entry.amount - (x.entry.fees || 0) - (x.entry.ship || 0)) : null })) : ''; (have.has(fp) ? dupes : fresh).push(x); });
    const c = k => fresh.filter(x => x.entry.type === k).length;
    const dates = fresh.map(x => x.entry.date).filter(Boolean).sort();
    return { total: fresh.length, sales: c('sale'), purchases: c('purchase'), refunds: c('refund'), dupes: dupes.length, from: dates[0], to: dates[dates.length - 1],
      exact: fresh.filter(x => x.entry.match === 'exact').length, byName: fresh.filter(x => x.entry.match === 'name').length, typed: fresh.filter(x => x.entry.match === 'typed').length,
      split: fresh.filter(x => x.entry.type === 'sale' && x.entry.fees != null).length, combined: fresh.filter(x => x.entry.combined).length,
      flagged: fresh.filter(x => x.flags.length), fresh, all: es };
  }

  const api = { build, summarize, findTable, mapColumns, cents, date, typeOf, platformOf, noteSplit, refOf, displayName, FIELDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CTImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
