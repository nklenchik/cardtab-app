/* Add from photo (v52.96): photos of cards in, what's on them out.
   POST /auth/scan {images:[dataURL, ...]}  ->  {items:[{photo, kind, game, name, number, set, grader, grade, cert, lang, sure}], left, limit, resets}
   POST /auth/scan {check:true}            ->  {left, limit, resets, plan}
   - Claude reads each card's name, number and set (and the label on a graded slab, or a sealed product's name). It never
     decides which printing it is: the app matches every item against the card catalog (/api/lookup), the same way typing does,
     and the person checks the list before anything is added.
   - Photos per calendar month (UTC): Free SCAN_FREE (5), Premium SCAN_PREMIUM (50), the same as Ask's questions. Admins aren't limited. Each photo counts once.
   - Shares Ask's monthly spending cap (ASK_MONTH_USD) and spend record, so one number keeps all AI costs in check.
   - Photos are sent to Anthropic and nowhere else, and nothing is kept: only the monthly count (scan_usage). */
import { claudeCall, addSpend, askLimits, ASK_MODEL, ASK_PRICE } from './ask.js';
const n = (v, d) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && v !== '' && v != null ? x : d; };
export const scanLimits = env => ({ free: n(env.SCAN_FREE, 5), premium: n(env.SCAN_PREMIUM, 50) });
const MAX_PHOTOS = 4, MAX_CHARS = 3200000;   // per request; the app sends JPEGs about 1568px on the long edge (~300-600 KB)
const month = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);
const resets = (t = Date.now()) => { const d = new Date(t); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10); };
const KINDS = ['card', 'graded', 'sealed'];
const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC', 'TAG'];

const TOOL = {
  name: 'cards', description: 'Every trading card, graded slab and sealed product visible in the photos.',
  input_schema: { type: 'object', required: ['items'], properties: { items: { type: 'array', maxItems: 40, items: { type: 'object', required: ['photo', 'kind', 'name'], properties: {
    photo: { type: 'integer', description: 'Which photo it is in, starting at 1' },
    kind: { type: 'string', enum: KINDS, description: 'card = a raw card (sleeved or in a toploader too); graded = in a grading company slab; sealed = an unopened pack, box, tin, ETB or bundle' },
    game: { type: 'string', description: 'Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Disney Lorcana, Dragon Ball Super, Digimon, sports, or other' },
    name: { type: 'string', description: 'The card name exactly as printed, in English if the card is English (for sealed: the product name, e.g. "Prismatic Evolutions Elite Trainer Box")' },
    number: { type: 'string', description: 'The collector number exactly as printed, e.g. 199/165, 025/198, BT29-086, OP05-119. Empty if you cannot read it clearly. Never guess digits.' },
    set: { type: 'string', description: 'The set name or set code if printed or clearly identifiable; otherwise empty' },
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
  'For graded slabs read the label (company, grade, cert number, card name and number). If a number is blurry, cut off or hidden by glare, ' +
  'leave it empty rather than guess. Skip card backs, sleeves with no card, and anything that is not a trading card product. ' +
  'If there are no cards, return an empty list.';

const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export function tidy(raw, photos) {
  const out = [];
  for (const x of (raw && Array.isArray(raw.items) ? raw.items : []).slice(0, 40)) {
    if (!x || typeof x !== 'object') continue;
    const name = clean(x.name, 120); if (!name) continue;
    const kind = KINDS.includes(x.kind) ? x.kind : 'card', grader = GRADERS.includes(String(x.grader || '').toUpperCase()) ? String(x.grader).toUpperCase() : '';
    const grade = /^(10|[1-9](\.5)?)$/.test(String(x.grade || '').trim()) ? String(x.grade).trim() : '';
    const photo = Math.min(Math.max(1, Math.round(Number(x.photo) || 1)), photos);
    out.push({ photo, kind: kind === 'graded' && !(grader && grade) ? 'card' : kind, game: clean(x.game, 40), name, number: clean(x.number, 24), set: clean(x.set, 80),
      grader: kind === 'graded' ? grader : '', grade: kind === 'graded' ? grade : '', cert: kind === 'graded' ? clean(x.cert, 20).replace(/[^\w-]/g, '') : '',
      lang: clean(x.lang, 20), sure: Math.max(0, Math.min(1, Number(x.sure) || 0)) });
  }
  return out;
}

export async function handleScan(env, req, me, out) {
  const key = String(env.ANTHROPIC_API_KEY || '').trim();
  if (!key) return out({ error: 'setup' }, 503);
  const L = scanLimits(env), m = month(), plan = me.plan === 'premium' ? 'premium' : 'free', limit = L[plan], admin = me.role === 'admin';
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS scan_usage ( user_id TEXT NOT NULL, month TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, month) )').run();
  const used = (await env.DB.prepare('SELECT n FROM scan_usage WHERE user_id=? AND month=?').bind(me.id, m).first() || {}).n || 0;
  const info = { limit, left: Math.max(0, limit - used), resets: resets(), plan };
  let b; try { b = await req.json(); } catch (e) { b = {}; }
  if (b.check) return out(info);
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
  let res;
  try {
    res = await claudeCall(env, { model: env.SCAN_MODEL || ASK_MODEL, max_tokens: 2500, tools: [TOOL], tool_choice: { type: 'tool', name: 'cards' }, messages: [{ role: 'user', content }] });
  } catch (e) {
    const why = e.status === 429 || e.status === 529 || e.status === 503 ? 'busy' : e.status === 401 || e.status === 403 ? 'key' : e.status === 400 && /credit|billing|balance/i.test(e.detail || '') ? 'billing' : 'failed';
    console.log('scan error', e.status || '', e.detail || e.message);
    return out(Object.assign({ error: why, detail: admin ? (e.status ? e.status + ': ' : '') + (e.detail || e.message) : undefined }, info), 502);
  }
  const tin = (res.usage && res.usage.input_tokens) || 0, tout = (res.usage && res.usage.output_tokens) || 0;
  const use = (res.content || []).find(c => c.type === 'tool_use' && c.name === 'cards');
  const items = tidy(use && use.input, imgs.length);
  await env.DB.batch([env.DB.prepare('INSERT INTO scan_usage (user_id,month,n) VALUES (?,?,?) ON CONFLICT(user_id,month) DO UPDATE SET n=n+excluded.n').bind(me.id, m, imgs.length)]);
  await addSpend(env, m, tin, tout);
  return out({ items, limit, left: Math.max(0, limit - used - imgs.length), resets: info.resets, plan });
}
