// Your own card photos, and shared default art (v50.46).
// - Anyone signed in can upload a photo of their card. The app crops it to the card and shrinks it to the same two sizes
//   auto-fill art uses (640px and 240px wide, WebP where the browser can make it, else JPEG). It's stored in R2 and shows on
//   that person's entry straight away.
// - "Share as this card's default": only for cards matched to the catalog, and only sharp photos (640px wide). An automatic
//   check (Workers AI vision model) asks: is it a trading card, does it look like this card, is anything inappropriate?
//   Passes become the card's default art when auto-fill has none. Anything flagged (or when the check can't run) waits in the
//   admin review queue.
import { currentUser, isAdmin } from './auth.js';

const SIZES = { detail: { maxW: 700, maxH: 1000, maxB: 600 * 1024 }, list: { maxW: 260, maxH: 380, maxB: 160 * 1024 } };
const SHARE_MIN_W = 600, PER_DAY = 40;
const VISION = '@cf/meta/llama-3.2-11b-vision-instruct';
const now = () => Math.floor(Date.now() / 1000);
const rid = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');

// ---- picture checks: real WebP or JPEG, and its size from the file's own header ----
export function picInfo(u8) {
  const s = (o, n) => String.fromCharCode(...u8.subarray(o, o + n));
  if (u8.length > 30 && s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') {
    const k = s(12, 4);
    if (k === 'VP8 ' && u8[23] === 0x9d && u8[24] === 0x01 && u8[25] === 0x2a) return { type: 'image/webp', w: (u8[26] | u8[27] << 8) & 0x3fff, h: (u8[28] | u8[29] << 8) & 0x3fff };
    if (k === 'VP8L' && u8[20] === 0x2f) { const b = u8[21] | u8[22] << 8 | u8[23] << 16 | u8[24] << 24; return { type: 'image/webp', w: (b & 0x3fff) + 1, h: ((b >>> 14) & 0x3fff) + 1 }; }
    if (k === 'VP8X') return { type: 'image/webp', w: 1 + (u8[24] | u8[25] << 8 | u8[26] << 16), h: 1 + (u8[27] | u8[28] << 8 | u8[29] << 16) };
    return null;
  }
  if (u8[0] === 0xff && u8[1] === 0xd8) {
    let i = 2;
    while (i + 9 < u8.length) {
      if (u8[i] !== 0xff) { i++; continue; }
      const m = u8[i + 1], len = u8[i + 2] << 8 | u8[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'image/jpeg', h: u8[i + 5] << 8 | u8[i + 6], w: u8[i + 7] << 8 | u8[i + 8] };
      i += 2 + len;
    }
  }
  return null;
}

// ---- the automatic check ----
export async function aiCheck(env, u8, cardName) {
  if (!env.AI) return { ok: false, reason: 'Automatic check isn’t set up' };
  const prompt = 'You check photos people upload as the picture for a trading card in a collection app. The card should be: "' + String(cardName || '').slice(0, 120) + '".\n' +
    'Answer with JSON only, no other text: {"card": true|false (is the main subject a single trading card?), "match": true|false (does the name printed on it plausibly match the card above? true if unsure but it is a card of the same character or name), "unsafe": true|false (nudity, sexual content, gore, hate symbols, or anything inappropriate for a general audience), "seen": "the card name you can read, or empty"}';
  const run = () => env.AI.run(VISION, { messages: [{ role: 'user', content: prompt }], image: [...u8], max_tokens: 120 });
  let out;
  try { out = await run(); }
  catch (e) {
    // Meta's license for this model is accepted once with a request that says "agree"
    if (/agree|licen[cs]e/i.test(String(e && e.message))) { try { await env.AI.run(VISION, { prompt: 'agree' }); out = await run(); } catch (e2) { return { ok: false, reason: 'Automatic check didn’t run' }; } }
    else return { ok: false, reason: 'Automatic check didn’t run' };
  }
  const txt = String((out && (out.response || out.result || out.description)) || ''), m = /\{[\s\S]*\}/.exec(txt);
  let j = null; try { j = m ? JSON.parse(m[0]) : null; } catch (e) {}
  if (!j) return { ok: false, reason: 'Automatic check wasn’t sure' };
  if (j.unsafe === true) return { ok: false, reason: 'Might be inappropriate', seen: j.seen || '' };
  if (j.card === false) return { ok: false, reason: 'Doesn’t look like a card', seen: j.seen || '' };
  if (j.match === false) return { ok: false, reason: 'Doesn’t look like this card', seen: j.seen || '' };
  return { ok: true, seen: j.seen || '' };
}

const J = (env, cors, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(env) } });
const keyOf = (uid, id, size) => `up/${uid}/${id}/${size}`;

async function publish(env, cardId, uid, id) {
  for (const size of ['detail', 'list']) {
    const o = await env.ART.get(keyOf(uid, id, size)); if (!o) continue;
    await env.ART.put(`art/c/${cardId}/${size}`, await o.arrayBuffer(), { httpMetadata: { contentType: (o.httpMetadata && o.httpMetadata.contentType) || 'image/webp', cacheControl: 'public, max-age=86400' } });
  }
}

export async function handleArt(env, req, path, cors, ctx) {
  // the pictures themselves (public; the id in the address can't be guessed)
  let m = path.match(/^\/up\/([\w-]{1,64})\/([a-f0-9]{24})\/(detail|list)$/);
  if (m && req.method === 'GET') {
    const o = await env.ART.get(keyOf(m[1], m[2], m[3])); if (!o) return new Response('not found', { status: 404, headers: cors(env) });
    return new Response(o.body, { headers: { 'content-type': (o.httpMetadata && o.httpMetadata.contentType) || 'image/webp', 'cache-control': 'public, max-age=31536000, immutable', ...cors(env) } });
  }
  const me = await currentUser(env, req).catch(() => null);
  if (path === '/api/art/upload' && req.method === 'POST') {
    if (!me) return J(env, cors, { error: 'Sign in to upload a photo.' }, 401);
    const recent = await env.DB.prepare('SELECT COUNT(*) n FROM art_uploads WHERE user_id=? AND created>?').bind(me.id, now() - 86400).first();
    if (recent && recent.n >= PER_DAY) return J(env, cors, { error: 'That’s a lot of photos for one day. Try again tomorrow.' }, 429);
    let fd; try { fd = await req.formData(); } catch (e) { return J(env, cors, { error: 'Couldn’t read the photo.' }, 400); }
    const files = {};
    for (const size of ['detail', 'list']) {
      const f = fd.get(size); if (!f || typeof f === 'string') return J(env, cors, { error: 'Photo missing.' }, 400);
      const u8 = new Uint8Array(await f.arrayBuffer()), info = picInfo(u8), lim = SIZES[size];
      if (!info || u8.length > lim.maxB || info.w > lim.maxW || info.h > lim.maxH || info.w < 40 || info.h <= info.w) return J(env, cors, { error: 'That photo couldn’t be used.' }, 400);
      files[size] = { u8, info };
    }
    const id = rid();
    for (const size of ['detail', 'list']) await env.ART.put(keyOf(me.id, id, size), files[size].u8, { httpMetadata: { contentType: files[size].info.type, cacheControl: 'public, max-age=31536000, immutable' } });
    const cardId = String(fd.get('card') || '').slice(0, 240), name = String(fd.get('name') || '').slice(0, 160), wantShare = fd.get('share') === '1';
    const art = { list: `/up/${me.id}/${id}/list`, detail: `/up/${me.id}/${id}/detail` };
    let share = null;
    if (wantShare) {
      const card = /^[\w-]{3,240}$/.test(cardId) ? await env.DB.prepare('SELECT id,name,number,set_name FROM cards WHERE id=?').bind(cardId).first() : null;
      if (!card) share = { status: 'no', why: 'Only cards picked from the search can be shared.' };
      else if (files.detail.info.w < SHARE_MIN_W) share = { status: 'no', why: 'Sharing needs a sharper photo.' };
      else {
        const full = [card.name, card.number, card.set_name].filter(Boolean).join(' · ');
        const chk = await aiCheck(env, files.detail.u8, full || name);
        const had = await env.ART.head(`art/c/${card.id}/detail`).catch(() => null);
        const ok = chk.ok && !had, reason = chk.ok ? (had ? 'This card already has shared art' : '') : chk.reason;
        await env.DB.prepare('INSERT INTO art_uploads (id,user_id,card_id,name,w,h,status,reason,seen,created) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, me.id, card.id, full || name, files.detail.info.w, files.detail.info.h, ok ? 'approved' : 'pending', reason, chk.seen || '', now()).run();
        if (ok) await publish(env, card.id, me.id, id);
        share = { status: ok ? 'shared' : 'review' };
      }
    }
    if (!share || share.status === 'no') await env.DB.prepare('INSERT INTO art_uploads (id,user_id,card_id,name,w,h,status,reason,seen,created) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, me.id, cardId || null, name, files.detail.info.w, files.detail.info.h, 'private', '', '', now()).run();
    return J(env, cors, { ok: true, art, share });
  }
  // the review queue (admins)
  if (path === '/api/admin/art') {
    if (!me || !isAdmin(env, me.email)) return J(env, cors, { error: 'not allowed' }, 403);
    if (req.method === 'GET') {
      const r = await env.DB.prepare("SELECT a.id,a.user_id,a.card_id,a.name,a.w,a.h,a.reason,a.seen,a.created,u.email FROM art_uploads a LEFT JOIN users u ON u.id=a.user_id WHERE a.status='pending' ORDER BY a.created DESC LIMIT 100").all();
      return J(env, cors, { items: (r.results || []).map(x => ({ ...x, art: { list: `/up/${x.user_id}/${x.id}/list`, detail: `/up/${x.user_id}/${x.id}/detail` } })) });
    }
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      const row = await env.DB.prepare("SELECT * FROM art_uploads WHERE id=? AND status='pending'").bind(String(b.id || '')).first();
      if (!row) return J(env, cors, { error: 'not found' }, 404);
      if (b.action === 'approve') { await publish(env, row.card_id, row.user_id, row.id); await env.DB.prepare("UPDATE art_uploads SET status='approved' WHERE id=?").bind(row.id).run(); }
      else await env.DB.prepare("UPDATE art_uploads SET status='rejected' WHERE id=?").bind(row.id).run();
      return J(env, cors, { ok: true });
    }
  }
  return null;
}

// a card with no auto-fill art shows its shared default
export async function communityArt(env, cardId, size, cors) {
  const o = await env.ART.get(`art/c/${cardId}/${size}`).catch(() => null); if (!o) return null;
  return new Response(o.body, { headers: { 'content-type': (o.httpMetadata && o.httpMetadata.contentType) || 'image/webp', 'cache-control': 'public, max-age=86400', 'x-art-why': 'shared', ...cors(env) } });
}
