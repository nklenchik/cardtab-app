/* Audience (v52.43): who's using Card Tab, for the admin dashboard (Growth → Audience). No third-party tracking.
   - Campaigns: links can carry utm_source / utm_campaign / utm_content. cardtab.app passes them on to the app (ctj), and the
     first time someone signs in they're kept on their own record (an_user.camp / an_user.ad). The dashboard shows sign-ups,
     Premium and the upgrade rate for each campaign and ad. The admin types what a campaign cost; nothing is sent anywhere.
   - Best users: Premium vs Free, side by side: games they collect, where they sell and buy, sellers vs collectors, how many
     entries a month, device and country. Totals across groups only (never one person), worked out from what's already in
     the database. People who switched off "Share anonymous usage", gifted accounts and admins are left out.
   POST /auth/admin/adspend {camp, usd}   admins: what a campaign cost (0 removes it) */
import { device } from './people.js';

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const admins = env => String(env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
export const tag = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9 _.\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

let made = false;
export async function ensureAudience(env) {
  if (made) return;
  for (const c of ['camp', 'ad']) { try { await env.DB.prepare('ALTER TABLE an_user ADD COLUMN ' + c + ' TEXT').run(); } catch (e) { /* already there */ } }
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ad_spend (camp TEXT PRIMARY KEY, usd REAL NOT NULL, at INTEGER)').run();
  made = true;
}

// sign-ups by campaign and ad in these dates, with Premium, plus what each campaign cost
export async function campaigns(env, from, to) {
  try {
    await ensureAudience(env);
    const rows = (await env.DB.prepare("SELECT COALESCE(src,'not known') src, camp, ad, plan0, plan, up_day FROM an_user WHERE first_day BETWEEN ? AND ? AND camp IS NOT NULL AND camp <> ''").bind(from, to).all()).results || [];
    const m = {};
    rows.forEach(r => { const k = r.camp + '\u0001' + (r.ad || ''); const o = m[k] = m[k] || { camp: r.camp, ad: r.ad || '', src: r.src, n: 0, prem0: 0, up: 0 }; o.n++; if (r.plan0 === 'premium') o.prem0++; else if (r.up_day) o.up++; });
    const spend = (await env.DB.prepare('SELECT camp, usd FROM ad_spend').all()).results || [];
    return { rows: Object.values(m).sort((a, b) => b.n - a.n), spend: Object.fromEntries(spend.map(s => [s.camp, s.usd])) };
  } catch (e) { return { rows: [], spend: {} }; }
}

export async function handleAdSpend(env, req, out) {
  await ensureAudience(env);
  const b = await req.json().catch(() => ({})), camp = tag(b.camp), usd = Math.max(0, Math.min(1e7, Math.round((+b.usd || 0) * 100) / 100));
  if (!camp) return out({ error: 'Which campaign?' }, 400);
  if (!usd) await env.DB.prepare('DELETE FROM ad_spend WHERE camp=?').bind(camp).run();
  else await env.DB.prepare('INSERT INTO ad_spend (camp,usd,at) VALUES (?,?,?) ON CONFLICT(camp) DO UPDATE SET usd=excluded.usd, at=excluded.at').bind(camp, usd, Math.floor(Date.now() / 1000)).run();
  return out({ ok: true, camp, usd });
}

// ---------- best users: Premium vs Free ----------
const PLAT = ['ebay', 'tcgplayer', 'mercari', 'whatnot', 'card show', 'facebook marketplace', 'local game store'];
const platName = p => { const k = String(p || '').trim().toLowerCase(); if (!k) return ''; const i = PLAT.indexOf(k); return i >= 0 ? ['eBay', 'TCGplayer', 'Mercari', 'Whatnot', 'Card show', 'Facebook Marketplace', 'Local game store'][i] : 'Other'; };
const gameName = g => { const k = String(g || '').trim(); if (!k) return ''; const l = k.toLowerCase();
  return /pok/.test(l) ? 'Pokémon' : /magic|mtg/.test(l) ? 'Magic' : /one piece/.test(l) ? 'One Piece' : /yu.?gi/.test(l) ? 'Yu-Gi-Oh!' : /lorcana/.test(l) ? 'Lorcana' : /fusion|dragon ball/.test(l) ? 'Dragon Ball' : /sport|baseball|basketball|football|hockey|soccer/.test(l) ? 'Sports' : k.slice(0, 24); };
const parse = v => { try { return JSON.parse(v); } catch (e) { return v; } };

export async function bestUsers(env) {
  const q = async (sql, ...a) => { try { return (await env.DB.prepare(sql).bind(...a).all()).results || []; } catch (e) { return []; } };
  const adm = admins(env);
  const users = (await q('SELECT id, email, plan FROM users')).filter(u => !adm.includes(String(u.email).toLowerCase()));
  const off = new Set((await q("SELECT user_id, v FROM user_meta WHERE k='shareUsage'")).filter(r => parse(r.v) === false).map(r => r.user_id));
  const gift = new Set((await q('SELECT user_id FROM billing WHERE gift=1')).map(r => r.user_id));
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const ent = await q("SELECT user_id, json_extract(data,'$.type') t, json_extract(data,'$.platform') p, json_extract(data,'$.game') g, COUNT(*) n, SUM(CASE WHEN json_extract(data,'$.createdAt') >= ? THEN 1 ELSE 0 END) recent FROM entries WHERE deleted=0 GROUP BY user_id, t, p, g", since);
  const games = Object.fromEntries((await q("SELECT user_id, v FROM user_meta WHERE k='games'")).map(r => [r.user_id, parse(r.v)]));
  const ua = {}; (await q('SELECT user_id, ua FROM sessions ORDER BY created_at')).forEach(r => { ua[r.user_id] = r.ua; });
  const geo = Object.fromEntries((await q('SELECT user_id, cc FROM geo')).map(r => [r.user_id, r.cc]));
  const by = {}; ent.forEach(r => { (by[r.user_id] = by[r.user_id] || []).push(r); });
  const blank = () => ({ n: 0, dims: { game: {}, sells: {}, buys: {}, kind: {}, activity: {}, device: {}, country: {} } });
  const out = { premium: blank(), free: blank() };
  const bump = (o, k) => { if (k) o[k] = (o[k] || 0) + 1; };
  for (const u of users) {
    if (off.has(u.id) || gift.has(u.id)) continue;
    const G = out[u.plan === 'premium' ? 'premium' : 'free'], rows = by[u.id] || []; G.n++;
    let sales = 0, buys = 0, recent = 0; const gs = new Set(), so = new Set(), bo = new Set();
    (Array.isArray(games[u.id]) ? games[u.id] : []).forEach(g => gs.add(gameName(g)));
    rows.forEach(r => { recent += r.recent || 0; if (r.g) gs.add(gameName(r.g)); const p = platName(r.p);
      if (r.t === 'sale') { sales += r.n; if (p) so.add(p); } else if (r.t === 'purchase') { buys += r.n; if (p) bo.add(p); } });
    gs.delete(''); gs.forEach(g => bump(G.dims.game, g)); so.forEach(p => bump(G.dims.sells, p)); bo.forEach(p => bump(G.dims.buys, p));
    const tot = sales + buys;
    bump(G.dims.kind, tot < 5 ? 'Just getting started' : sales >= buys * 1.5 ? 'Mostly sells' : buys >= sales * 1.5 ? 'Mostly buys' : 'Buys and sells');
    bump(G.dims.activity, recent === 0 ? 'None in the last 30 days' : recent <= 5 ? '1–5 a month' : recent <= 20 ? '6–20 a month' : recent <= 50 ? '21–50 a month' : 'More than 50 a month');
    bump(G.dims.device, ua[u.id] ? device(ua[u.id]).split(' · ')[0] : '');
    bump(G.dims.country, geo[u.id] || '');
  }
  return out;
}
