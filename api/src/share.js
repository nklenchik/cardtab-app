// Shared Card Boards (v50.5). The app draws the board the way a visitor will see it (with the owner's choices about
// dollar amounts, card names and details already applied), and sends that finished picture here. Anyone with the link
// can view it at app.cardtab.app/b/<id> (cardtab.app/b/<id> forwards there). Nothing else about the account is shared.
// "Live" boards are sent again whenever the owner's numbers change in the app; snapshots stay as they were sent.
import { sendMail } from './email.js';

const ID_OK = /^[a-z0-9]{8,16}$/;
const MAX = 400000, UNUSED = 90 * 86400;
const now = () => Math.floor(Date.now() / 1000);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shareUrl = (env, id) => (env.APP_URL || 'https://app.cardtab.app') + '/b/' + id;

// what the page may contain: the board's own markup. Scripts, frames, forms, styles, event handlers and script links are
// taken out here, and the viewing page also refuses to run anything that isn't its own script file.
export function cleanBoardHTML(h) {
  return String(h || '').slice(0, MAX)
    .replace(/<\s*(script|iframe|object|embed|form|style|link|meta|base|template|noscript)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|form|style|link|meta|base|template|noscript)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|xlink:href|action|formaction|srcset)\s*=\s*("\s*(javascript|data:text|vbscript)[^"]*"|'\s*(javascript|data:text|vbscript)[^']*')/gi, '')
    .replace(/url\(\s*['"]?\s*javascript:[^)]*\)/gi, 'none');
}
const cleanMeta = m => {
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  const css = v => s(v, 600).replace(/[<>{}]|url\s*\(|expression|javascript/gi, '');
  m = m && typeof m === 'object' ? m : {};
  return { title: s(m.title, 80), label: s(m.label, 60), plat: s(m.plat, 40), theme: ['light', 'dark', 'auto'].includes(m.theme) ? m.theme : 'auto', cbStyle: css(m.cbStyle), simStyle: css(m.simStyle), cbClass: s(m.cbClass, 200).replace(/[^\w -]/g, ''), w: Math.max(0, Math.min(4000, +m.w || 0)), amt: !!m.amt, names: !!m.names };
};

export async function handleShare(env, req, me, path, out) {
  const b = await req.json().catch(() => ({}));
  const mine = await env.DB.prepare('SELECT id, exp_opt, created FROM shares WHERE uid=?').bind(me.id).first();
  if (path === '/auth/share') {
    if (b.off) { await env.DB.prepare('DELETE FROM shares WHERE uid=?').bind(me.id).run(); return out({ ok: true, off: true }); }
    if (me.plan !== 'premium' && !me.admin) return out({ error: 'Sharing comes with Premium.' }, 403);
    const id = String(b.id || '');
    if (!ID_OK.test(id)) return out({ error: 'Bad link id.' }, 400);
    const html = cleanBoardHTML(b.html);
    if (!html || String(b.html || '').length > MAX) return out({ error: 'This board is too big to share.' }, 413);
    const taken = await env.DB.prepare('SELECT uid FROM shares WHERE id=?').bind(id).first();
    if (taken && taken.uid !== me.id) return out({ error: 'taken' }, 409);
    const opt = ['7', '30'].includes(String(b.exp)) ? String(b.exp) : 'never';
    // the clock for "stops working in 7 / 30 days" starts when that choice is made (or a new link is made)
    const fresh = !mine || mine.id !== id || mine.exp_opt !== opt, created = fresh ? now() : mine.created;
    const exp = opt === 'never' ? null : created + (+opt) * 86400;
    const st = [];
    if (mine && mine.id !== id) st.push(env.DB.prepare('DELETE FROM shares WHERE uid=?').bind(me.id));   // a new link: the old one stops working
    st.push(env.DB.prepare(`INSERT INTO shares (id, uid, html, meta, live, exp_opt, exp, created, updated, views) VALUES (?,?,?,?,?,?,?,?,?,0)
      ON CONFLICT(id) DO UPDATE SET html=excluded.html, meta=excluded.meta, live=excluded.live, exp_opt=excluded.exp_opt, exp=excluded.exp, created=excluded.created, updated=excluded.updated`)
      .bind(id, me.id, html, JSON.stringify(cleanMeta(b.meta)), b.live ? 1 : 0, opt, exp, created, now()));
    await env.DB.batch(st);
    // the 90-day "not opened" clock starts when a link is made; while the owner keeps it, opening it resets the clock
    if (!mine || mine.id !== id) await env.DB.prepare('INSERT INTO share_open (id, last) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET last=excluded.last').bind(id, now()).run().catch(() => {});
    return out({ ok: true, url: shareUrl(env, id), exp });
  }
  if (path === '/auth/share/invite') {
    if (!mine) return out({ error: 'Turn on the link first.' }, 400);
    const list = (Array.isArray(b.emails) ? b.emails : []).map(x => String(x).trim().toLowerCase()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).slice(0, 10);
    if (!list.length) return out({ error: 'Add an email address.' }, 400);
    const day = new Date().toISOString().slice(0, 10), row = await env.DB.prepare('SELECT inv_day, invites FROM shares WHERE id=?').bind(mine.id).first();
    const used = row && row.inv_day === day ? row.invites || 0 : 0;
    if (used + list.length > 20) return out({ error: 'That’s enough invites for today. Copy the link instead.' }, 429);
    const who = String(me.name || '').trim().split(/\s+/)[0] || 'A Card Tab collector', link = shareUrl(env, mine.id);
    const subject = who + ' shared their Card Board with you';
    const text = `${who} shared their Card Board on Card Tab with you.\n\nSee it here: ${link}\n\nCard Tab tracks trading card buys and sales: https://cardtab.app`;
    const html = `<!doctype html><html><body style="margin:0;background:#f6f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fff;border:1px solid #e9e6de;border-radius:20px"><tr><td style="padding:28px">
      <div style="font-weight:800;font-size:17px;color:#1a1918;margin-bottom:18px">Card Tab</div>
      <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;color:#1a1918">${esc(who)} shared their Card Board with you</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#55524c">Their trading card numbers, laid out the way they like them.</p>
      <a href="${esc(link)}" style="display:block;text-align:center;padding:15px 20px;border-radius:999px;background:#a50e37;color:#fff;font-weight:800;font-size:16px;text-decoration:none">See the board</a>
      <p style="margin:22px 0 0;font-size:12.5px;line-height:1.5;color:#77736d">You got this because ${esc(who)} entered your address in Card Tab. No account is needed to view it.</p>
    </td></tr></table></td></tr></table></body></html>`;
    let sent = 0;
    for (const to of list) { try { await sendMail(env, { to, subject, html, text }); sent++; } catch (e) { if (e.status === 503) return out({ error: 'Email isn’t set up on the server yet.' }, 503); } }
    await env.DB.prepare('UPDATE shares SET inv_day=?, invites=? WHERE id=?').bind(day, used + sent, mine.id).run();
    return out({ ok: true, sent });
  }
  return out({ error: 'Not found.' }, 404);
}

// public: the board behind a link (no sign-in)
export async function handlePublicShare(env, req, id) {
  const h = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff' };
  if (!ID_OK.test(id)) return new Response(JSON.stringify({ error: 'gone' }), { status: 404, headers: h });
  const r = await env.DB.prepare('SELECT html, meta, live, exp, updated FROM shares WHERE id=?').bind(id).first();
  if (!r) return new Response(JSON.stringify({ error: 'gone' }), { status: 404, headers: { ...h, 'cache-control': 'no-store' } });
  if (r.exp && r.exp < now()) return new Response(JSON.stringify({ error: 'expired' }), { status: 410, headers: { ...h, 'cache-control': 'no-store' } });
  // a link nobody has opened for 90 days stops working (the owner can make a new one any time)
  const seen = await env.DB.prepare('SELECT last FROM share_open WHERE id=?').bind(id).first().catch(() => null);
  if (seen && seen.last < now() - UNUSED) return new Response(JSON.stringify({ error: 'unused' }), { status: 410, headers: { ...h, 'cache-control': 'no-store' } });
  await env.DB.batch([env.DB.prepare('UPDATE shares SET views=views+1 WHERE id=?').bind(id), env.DB.prepare('INSERT INTO share_open (id, last) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET last=excluded.last').bind(id, now())]).catch(() => {});
  let meta = {}; try { meta = JSON.parse(r.meta || '{}'); } catch (e) {}
  return new Response(JSON.stringify({ html: r.html, meta, live: !!r.live, updated: r.updated }), { headers: { ...h, 'cache-control': 'public, max-age=30' } });
}

// nightly: links that ended, or that nobody opened for 90 days, are removed
export async function cleanupShares(env) {
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM shares WHERE exp IS NOT NULL AND exp < ?').bind(t),
    env.DB.prepare('DELETE FROM shares WHERE id IN (SELECT id FROM share_open WHERE last < ?)').bind(t - UNUSED),
    env.DB.prepare('DELETE FROM share_open WHERE id NOT IN (SELECT id FROM shares)')
  ]).catch(() => {});
}
