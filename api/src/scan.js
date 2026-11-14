/* Add from photo (v52.96): photos of cards in, what's on them out.
   POST /auth/scan {images:[dataURL, ...]}  ->  {items:[{photo, kind, game, name, number, set, grader, grade, cert, lang, sure}], left, limit, resets}
   POST /auth/scan {check:true}            ->  {left, limit, resets, plan}
   - Claude reads each card's name, number and set (and the label on a graded slab, or a sealed product's name). It never
     decides which printing it is: the app matches every item against the card catalog (/api/lookup), the same way typing does,
     and the person checks the list before anything is added.
   - Photos per calendar month (UTC): Free SCAN_FREE (5), Premium SCAN_PREMIUM (50), the same as Ask's questions. Admins aren't limited. Each photo counts once.
   - Shares Ask's monthly spending cap (ASK_MONTH_USD) and spend record, so one number keeps all AI costs in check.
   - Photos are sent to Anthropic and nowhere else and are never kept. What is kept, to learn from: what was read on each
     photo (card names, numbers, sets, how sure), how the person fixed the list, the time taken and the tokens used (v52.99).
   - POST /auth/scan {images, stream:true} streams one JSON line per card as it's read, then a done line (v52.99).
   - POST /auth/scan {feedback:{scan, added, rows:[{i, outcome, auto, final}]}} records how the list was used. */
import { claudeCall, claudeStream, addSpend, askLimits, ASK_MODEL, ASK_PRICE } from './ask.js';
const n = (v, d) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && v !== '' && v != null ? x : d; };
export const scanLimits = env => ({ free: n(env.SCAN_FREE, 5), premium: n(env.SCAN_PREMIUM, 50) });
const MAX_PHOTOS = 4, MAX_CHARS = 3200000;   // per request; the app sends JPEGs about 1568px on the long edge (~300-600 KB)
const month = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);
const resets = (t = Date.now()) => { const d = new Date(t); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10); };
const KINDS = ['card', 'graded', 'sealed'];
const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC', 'TAG'];

const TOOL = {
  name: 'cards', description: 'Every trading card, graded slab and sealed product visible in the photos.',
  input_schema: { type: 'object', required: ['items'], properties: {
    photos: { type: 'array', description: 'One entry per photo: can its cards be read well?', items: { type: 'object', required: ['photo', 'readable'], properties: {
      photo: { type: 'integer' }, readable: { type: 'boolean', description: 'false when the card names and numbers cannot be read at all' },
      problem: { type: 'string', enum: ['', 'blurry', 'glare', 'far', 'cut', 'dark'], description: 'The main thing making cards hard to read: blurry, glare (light reflecting on the cards or sleeves), far (cards too small in the photo), cut (cards cut off at the edge), dark. Empty if the photo is fine.' } } } },
    crowded: { type: 'array', items: { type: 'integer' }, description: 'Photo numbers that show more than 4 cards (only the first 4 of each are listed)' },
    items: { type: 'array', maxItems: 16, items: { type: 'object', required: ['photo', 'kind', 'name'], properties: {
    photo: { type: 'integer', description: 'Which photo it is in, starting at 1' },
    kind: { type: 'string', enum: KINDS, description: 'card = a raw card (sleeved or in a toploader too); graded = in a grading company slab; sealed = an unopened pack, box, tin, ETB or bundle' },
    game: { type: 'string', description: 'Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Disney Lorcana, Dragon Ball Super, Digimon, sports, or other' },
    name: { type: 'string', description: 'The card name exactly as printed, in English if the card is English (for sealed: the product name, e.g. "Prismatic Evolutions Elite Trainer Box")' },
    number: { type: 'string', description: 'The collector number exactly as printed, e.g. 199/165, 025/198, BT29-086, OP05-119. On a slab label it may be just #4: give 4. Empty if you cannot read it clearly. Never guess digits.' },
    set: { type: 'string', description: 'The set name if printed, on the slab label, or clearly identifiable from the set symbol or code (e.g. Base Set, Jungle, Scarlet & Violet 151); otherwise empty' },
    grader: { type: 'string', enum: ['', ...GRADERS], description: 'Graded only: the grading company on the label' },
    grade: { type: 'string', description: 'Graded only: the grade number on the label, e.g. 10, 9.5' },
    cert: { type: 'string', description: 'Graded only: the certification number on the label, if readable' },
    lang: { type: 'string', description: 'Card language if not English, e.g. Japanese' },
    sure: { type: 'number', description: 'How sure you are that name and number are right, 0 to 1' } } } } } }
};
const PROMPT = 'These photos are from a trading card collector adding cards to their purchase and sale tracker. List every trading card, ' +
  'graded slab and sealed product you can see, once each, reading left to right, top to bottom, photo by photo. For each, read the name, ' +
  'collector number and set exactly as printed (on modern Pokémon cards the number and set code are at the bottom left; on Magic cards the ' +
  'collector number and set code are at the bottom left; on One Piece and Dragon Ball cards the code like OP05-119 is at the bottom right). ' +
  'For graded slabs read the label: company, grade, cert number, card name, set name and card number (labels often show the year, game and set, e.g. "1999 Pokemon Game Base Set #4 Charizard Holo": set Base Set, number 4). ' +
  'For each photo also say whether its cards are readable and the main problem if any (blurry, glare, too far away, cut off, too dark), so the collector can retake it. ' +
  'List at most 4 items per photo; if a photo shows more, list the first 4 and add its number to crowded. If a number is blurry, cut off or hidden by glare, ' +
  'leave it empty rather than guess. Skip card backs, sleeves with no card, and anything that is not a trading card product. ' +
  'If there are no cards, return an empty list.';

const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const PER_PHOTO = 4;
export function tidy(raw, photos) {
  const out = [], per = {};
  for (const x of (raw && Array.isArray(raw.items) ? raw.items : []).slice(0, 40)) {
    if (!x || typeof x !== 'object') continue;
    const name = clean(x.name, 120); if (!name) continue;
    const kind = KINDS.includes(x.kind) ? x.kind : 'card', grader = GRADERS.includes(String(x.grader || '').toUpperCase()) ? String(x.grader).toUpperCase() : '';
    const grade = /^(10|[1-9](\.5)?)$/.test(String(x.grade || '').trim()) ? String(x.grade).trim() : '';
    const photo = Math.min(Math.max(1, Math.round(Number(x.photo) || 1)), photos);
    per[photo] = (per[photo] || 0) + 1; if (per[photo] > PER_PHOTO) continue;   // at most 4 cards a photo
    out.push({ photo, kind: kind === 'graded' && !(grader && grade) ? 'card' : kind, game: clean(x.game, 40), name, number: clean(x.number, 24), set: clean(x.set, 80),
      grader: kind === 'graded' ? grader : '', grade: kind === 'graded' ? grade : '', cert: kind === 'graded' ? clean(x.cert, 20).replace(/[^\w-]/g, '') : '',
      lang: clean(x.lang, 20), sure: Math.max(0, Math.min(1, Number(x.sure) || 0)) });
  }
  return out;
}

// ---------- v52.99 learning: every scan is logged (what was read, never the photo), and how the person fixed it ----------
// scan_log   one row per scan: photos, items, tokens, time taken, photo problems
// scan_item  one row per item read: what was read, how sure, and what happened (kept the match, changed it, removed it...)
// scan_learn what people chose after a misread: read (name|number|set) -> the card they picked. Once two scans agree, the
//            next scan that reads the same thing gets it as a hint, so the app picks the right card straight away.
const DDL = [
  'CREATE TABLE IF NOT EXISTS scan_usage ( user_id TEXT NOT NULL, month TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, month) )',
  'CREATE TABLE IF NOT EXISTS scan_log ( id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, user_id TEXT NOT NULL, month TEXT NOT NULL, photos INTEGER NOT NULL, items INTEGER NOT NULL, tin INTEGER NOT NULL, tout INTEGER NOT NULL, ms INTEGER NOT NULL, issues TEXT, model TEXT, added INTEGER, done INTEGER NOT NULL DEFAULT 0 )',
  'CREATE TABLE IF NOT EXISTS scan_item ( scan_id INTEGER NOT NULL, idx INTEGER NOT NULL, read_name TEXT, read_number TEXT, read_set TEXT, kind TEXT, sure REAL, learned TEXT, outcome TEXT, auto INTEGER, final TEXT, PRIMARY KEY (scan_id, idx) )',
  'CREATE TABLE IF NOT EXISTS scan_learn ( k TEXT NOT NULL, final TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL, PRIMARY KEY (k, final) )'
];
let ready = false;
async function ensure(env) { if (ready) return; for (const s of DDL) await env.DB.prepare(s).run(); ready = true; }
const kn = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/]+/g, ' ').trim();
export const learnKey = it => [kn(it.name), kn(it.number).replace(/\b0+(?=\d)/g, ''), kn(it.set)].join('|');
const LEARN_MIN = 2;

// Claude, streamed: each item is sent on as soon as it's complete, so the first card shows in about a second
export function itemsFrom(buf, from) {
  // finds complete {...} objects inside the "items":[ ... ] array of a partial JSON string, starting at character `from`
  let i = from;
  if (!i) { const k = buf.indexOf('"items"'); if (k < 0) return { found: [], next: 0 }; const a = buf.indexOf('[', k); if (a < 0) return { found: [], next: 0 }; i = a + 1; }
  const found = []; let depth = 0, start = -1, str = false, esc = false, j = i;
  for (; j < buf.length; j++) {
    const c = buf[j];
    if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') { str = true; continue; }
    if (c === '{') { if (depth === 0) start = j; depth++; }
    else if (c === '}') { depth--; if (depth === 0 && start >= 0) { try { found.push(JSON.parse(buf.slice(start, j + 1))); } catch (e) {} start = -1; i = j + 1; } }
    else if (c === ']' && depth === 0) { return { found, next: j + 1, end: true }; }
  }
  return { found, next: i };
}
async function read(env, content, onItem) {
  const body = { model: env.SCAN_MODEL || ASK_MODEL, max_tokens: 2500, tools: [TOOL], tool_choice: { type: 'tool', name: 'cards' }, messages: [{ role: 'user', content }] };
  if (!onItem) { const res = await claudeCall(env, body); const use = (res.content || []).find(c => c.type === 'tool_use' && c.name === 'cards'); return { input: (use && use.input) || {}, tin: (res.usage && res.usage.input_tokens) || 0, tout: (res.usage && res.usage.output_tokens) || 0 }; }
  const r = await claudeStream(env, Object.assign({ stream: true }, body));
  const dec = new TextDecoder(), rd = r.body.getReader();
  let sse = '', buf = '', pos = 0, ended = false, tin = 0, tout = 0;
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    sse += dec.decode(value, { stream: true });
    let nl; while ((nl = sse.indexOf('\n')) >= 0) {
      const line = sse.slice(0, nl).trim(); sse = sse.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
      if (ev.type === 'message_start' && ev.message && ev.message.usage) { tin = ev.message.usage.input_tokens || 0; tout = ev.message.usage.output_tokens || 0; }
      else if (ev.type === 'message_delta' && ev.usage) { tout = ev.usage.output_tokens || tout; }
      else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'input_json_delta') {
        buf += ev.delta.partial_json || '';
        if (!ended) { const got = itemsFrom(buf, pos); pos = got.next; ended = !!got.end; for (const x of got.found) await onItem(x); }
      } else if (ev.type === 'error') { const e = new Error('ai stream'); e.status = 529; e.detail = (ev.error && ev.error.message) || ''; throw e; }
    }
  }
  let input = {}; try { input = JSON.parse(buf || '{}'); } catch (e) {}
  return { input, tin, tout };
}
async function hints(env, items) {
  // the card people chose last time this exact thing was read, once at least two scans agree
  const out = {}; const keys = [...new Set(items.map(learnKey))];
  for (const k of keys) { const r = await env.DB.prepare('SELECT final, n FROM scan_learn WHERE k=? AND n>=? ORDER BY n DESC LIMIT 1').bind(k, LEARN_MIN).first(); if (r) out[k] = r.final; }
  return out;
}

export async function handleScan(env, req, me, out, raw) {
  const key = String(env.ANTHROPIC_API_KEY || '').trim();
  if (!key) return out({ error: 'setup' }, 503);
  const L = scanLimits(env), m = month(), plan = me.plan === 'premium' ? 'premium' : 'free', limit = L[plan], admin = me.role === 'admin';
  await ensure(env);
  const used = (await env.DB.prepare('SELECT n FROM scan_usage WHERE user_id=? AND month=?').bind(me.id, m).first() || {}).n || 0;
  const info = { limit, left: Math.max(0, limit - used), resets: resets(), plan };
  let b; try { b = await req.json(); } catch (e) { b = {}; }
  if (b.check) return out(info);
  if (b.feedback) return feedback(env, me, b.feedback, out);
  const imgs = (Array.isArray(b.images) ? b.images : []).filter(s => typeof s === 'string').slice(0, MAX_PHOTOS + 1);
  if (!imgs.length) return out(Object.assign({ error: 'Add a photo of your cards.' }, info), 400);
  if (imgs.length > MAX_PHOTOS) return out(Object.assign({ error: 'Up to ' + MAX_PHOTOS + ' photos at a time.' }, info), 400);
  const parts = [];
  for (const s of imgs) {
    const mt = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(s);
    if (!mt || s.length > MAX_CHARS) return out(Object.assign({ error: 'That photo couldn’t be read. Try another one.' }, info), 400);
    parts.push({ type: 'image', source: { type: 'base64', media_type: mt[1], data: mt[2] } });
  }
  if (!admin && used + imgs.length > limit) return out(Object.assign({ error: 'limit' }, info), 429);
  const AL = askLimits(env), sp = await env.DB.prepare('SELECT tin, tout FROM ask_spend WHERE month=?').bind(m).first() || { tin: 0, tout: 0 };
  if (sp.tin * ASK_PRICE.in + sp.tout * ASK_PRICE.out >= AL.usd) return out(Object.assign({ error: 'busy' }, info), 503);
  const content = []; parts.forEach((p, i) => { if (parts.length > 1) content.push({ type: 'text', text: 'Photo ' + (i + 1) + ':' }); content.push(p); });
  content.push({ type: 'text', text: PROMPT });
  const t0 = Date.now();
  const why = e => e.status === 429 || e.status === 529 || e.status === 503 ? 'busy' : e.status === 401 || e.status === 403 ? 'key' : e.status === 400 && /credit|billing|balance/i.test(e.detail || '') ? 'billing' : 'failed';

  // after the read: count it, log it, and attach what earlier scans learned
  const finish = async res => {
    const items = tidy(res.input, imgs.length), inp = res.input || {};
    const PROB = ['blurry', 'glare', 'far', 'cut', 'dark'], issues = [], seen = new Set();
    for (const x of Array.isArray(inp.photos) ? inp.photos : []) { const ph = Math.round(Number(x && x.photo)); if (!(ph >= 1 && ph <= imgs.length) || seen.has(ph)) continue; seen.add(ph); const pr = PROB.includes(x.problem) ? x.problem : (x.readable === false ? 'unreadable' : ''); if (pr) issues.push({ photo: ph, problem: pr, readable: x.readable !== false }); }
    const unread = issues.filter(x => !x.readable && !items.some(it => it.photo === x.photo)).length, counted = imgs.length - unread;
    const counts = {}; (Array.isArray(inp.items) ? inp.items : []).forEach(x => { const k = Math.round(Number(x && x.photo) || 1); counts[k] = (counts[k] || 0) + 1; });
    const crowded = [...new Set([...(Array.isArray(inp.crowded) ? inp.crowded : []).map(Number), ...Object.keys(counts).filter(k => counts[k] > PER_PHOTO).map(Number)])].filter(k => k >= 1 && k <= imgs.length);
    const hint = await hints(env, items); items.forEach(it => { const h = hint[learnKey(it)]; if (h) it.learned = h; });
    const ms = Date.now() - t0;
    const lg = await env.DB.prepare('INSERT INTO scan_log (at,user_id,month,photos,items,tin,tout,ms,issues,model) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id').bind(Math.floor(Date.now() / 1000), me.id, m, imgs.length, items.length, res.tin, res.tout, ms, issues.length ? JSON.stringify(issues.map(x => x.problem)) : null, env.SCAN_MODEL || ASK_MODEL).first();
    const sid = lg && lg.id;
    const st = [env.DB.prepare('INSERT INTO scan_usage (user_id,month,n) VALUES (?,?,?) ON CONFLICT(user_id,month) DO UPDATE SET n=n+excluded.n').bind(me.id, m, counted)];
    items.forEach((it, i) => st.push(env.DB.prepare('INSERT INTO scan_item (scan_id,idx,read_name,read_number,read_set,kind,sure,learned) VALUES (?,?,?,?,?,?,?,?)').bind(sid, i, it.name, it.number, it.set, it.kind, it.sure, it.learned || null)));
    await env.DB.batch(st);
    await addSpend(env, m, res.tin, res.tout, 0);   // tokens share Ask's monthly cap; scans don't count as questions
    return { items, crowded, issues, uncounted: imgs.length - counted, scan: sid, limit, left: Math.max(0, limit - used - counted), resets: info.resets, plan };
  };

  if (!b.stream || !raw) {
    let res;
    try { res = await read(env, content); }
    catch (e) { console.log('scan error', e.status || '', e.detail || e.message); return out(Object.assign({ error: why(e), detail: admin ? (e.status ? e.status + ': ' : '') + (e.detail || e.message) : undefined }, info), 502); }
    return out(await finish(res));
  }
  // streamed: one JSON object per line. {"item":{...}} as each card is read, then {"done":{...same as the plain reply}}
  const ts = new TransformStream(), w = ts.writable.getWriter(), enc = new TextEncoder();
  const send = o => w.write(enc.encode(JSON.stringify(o) + '\n'));
  const per = {};
  const pump = (async () => {
    try {
      const res = await read(env, content, async x => {
        const one = tidy({ items: [x] }, imgs.length)[0]; if (!one) return;
        per[one.photo] = (per[one.photo] || 0) + 1; if (per[one.photo] > PER_PHOTO) return;
        await send({ item: one });
      });
      await send({ done: await finish(res) });
    } catch (e) {
      console.log('scan error', e.status || '', e.detail || e.message);
      try { await send({ error: why(e), detail: admin ? (e.status ? e.status + ': ' : '') + (e.detail || e.message) : undefined }); } catch (er) {}
    } finally { try { await w.close(); } catch (er) {} }
  })();
  if (raw.wait) raw.wait(pump);
  return raw(ts.readable);
}

// how the person used the list: kept a match, changed it, removed it, typed it themselves; and whether they added the lot
const OUTCOMES = ['kept', 'changed', 'removed', 'typed', 'unmatched'];
async function feedback(env, me, f, out) {
  const sid = Math.round(Number(f && f.scan)); if (!sid) return out({ ok: false }, 400);
  const lg = await env.DB.prepare('SELECT id, done FROM scan_log WHERE id=? AND user_id=?').bind(sid, me.id).first();
  if (!lg) return out({ ok: false }, 404);
  if (lg.done) return out({ ok: true, again: true });
  const rows = (Array.isArray(f.rows) ? f.rows : []).slice(0, 40), st = [], now = Math.floor(Date.now() / 1000);
  for (const r of rows) {
    const i = Math.round(Number(r && r.i)), oc = OUTCOMES.includes(r && r.outcome) ? r.outcome : null; if (!(i >= 0) || !oc) continue;
    const fin = String((r && r.final) || '').slice(0, 160);
    st.push(env.DB.prepare('UPDATE scan_item SET outcome=?, auto=?, final=? WHERE scan_id=? AND idx=?').bind(oc, r.auto ? 1 : 0, fin || null, sid, i));
  }
  st.push(env.DB.prepare('UPDATE scan_log SET added=?, done=1 WHERE id=?').bind(f.added ? Number(f.added) || 0 : 0, sid));
  await env.DB.batch(st);
  // learn from the fixes that were actually added: read -> what they picked (the server's own record of what was read)
  if (f.added) {
    const fixed = (await env.DB.prepare("SELECT read_name, read_number, read_set, final FROM scan_item WHERE scan_id=? AND outcome IN ('changed','typed') AND final IS NOT NULL").bind(sid).all()).results || [];
    const up = fixed.map(x => env.DB.prepare('INSERT INTO scan_learn (k,final,n,at) VALUES (?,?,1,?) ON CONFLICT(k,final) DO UPDATE SET n=n+1, at=excluded.at').bind(learnKey({ name: x.read_name, number: x.read_number, set: x.read_set }), x.final, now));
    if (up.length) await env.DB.batch(up);
  }
  return out({ ok: true });
}

// for the admin dashboard: how well it's reading, what it costs, and the most common fixes
export async function scanStats(env, from, to) {
  await ensure(env);
  const a = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000), b = Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000);
  const q = async (s, p) => ((await env.DB.prepare(s).bind(...p).all()).results || []);
  const [tot] = await q('SELECT COUNT(*) scans, COALESCE(SUM(photos),0) photos, COALESCE(SUM(items),0) items, COALESCE(SUM(tin),0) tin, COALESCE(SUM(tout),0) tout, COALESCE(AVG(ms),0) ms, COALESCE(SUM(CASE WHEN added>0 THEN 1 ELSE 0 END),0) added, COALESCE(SUM(done),0) done FROM scan_log WHERE at BETWEEN ? AND ?', [a, b]);
  const oc = await q('SELECT i.outcome, i.auto, COUNT(*) n FROM scan_item i JOIN scan_log l ON l.id=i.scan_id WHERE l.at BETWEEN ? AND ? AND l.done=1 GROUP BY i.outcome, i.auto', [a, b]);
  const iss = await q('SELECT issues FROM scan_log WHERE at BETWEEN ? AND ? AND issues IS NOT NULL', [a, b]);
  const fixes = await q("SELECT i.read_name rn, i.read_number rnum, i.final f, COUNT(*) n FROM scan_item i JOIN scan_log l ON l.id=i.scan_id WHERE l.at BETWEEN ? AND ? AND i.outcome IN ('changed','typed') GROUP BY rn, rnum, f ORDER BY n DESC LIMIT 12", [a, b]);
  const learned = await q('SELECT COUNT(*) n FROM scan_learn WHERE n>=?', [LEARN_MIN]);
  const probs = {}; iss.forEach(r => { try { JSON.parse(r.issues).forEach(p => { probs[p] = (probs[p] || 0) + 1; }); } catch (e) {} });
  return Object.assign({}, tot, { outcomes: oc, problems: probs, fixes, learned: (learned[0] || {}).n || 0, price: ASK_PRICE });
}
