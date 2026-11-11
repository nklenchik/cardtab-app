/* Help and feedback (v52.23).
   POST /auth/feedback {kind, msg, page, ver, shot?}      signed in: send a bug report, idea or note (shot: a data: URL image, optional)
   GET  /auth/admin/feedback?status=new|all              admins: the inbox, newest first
   GET  /auth/admin/feedback/shot?id=                    admins: one screenshot (fetched by the dashboard, never public)
   POST /auth/admin/feedback/act {id, act, text?}        admins: act = handled | new | reply (a reply reaches the person as an in-app notice)
   feedbackDigest(env): once a day (with the morning health check) admins get one email listing what came in since the last one.
   Screenshots are kept in the ART bucket under fb/ and removed with the message's account. */
import { sendMail } from './email.js';

const now = () => Math.floor(Date.now() / 1000);
const KINDS = ['bug', 'idea', 'other'];
const MAX_SHOT = 2.5 * 1024 * 1024, PER_DAY = 20;
const admins = env => (env.ADMIN_EMAILS || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

let made = false;
export async function ensureFeedback(env) {
  if (made) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, uid TEXT, email TEXT, name TEXT, kind TEXT, msg TEXT, page TEXT, dev TEXT, ver TEXT,
    shot TEXT, at INTEGER, status TEXT DEFAULT 'new', reply TEXT, replied_at INTEGER, mailed INTEGER DEFAULT 0)`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS feedback_at ON feedback (at)').run();
  made = true;
}
// a picture sent as a data: URL -> bytes, if it really is a small JPEG, PNG or WebP
function picture(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || '')); if (!m) return null;
  let bin; try { bin = atob(m[2].replace(/\s/g, '')); } catch (e) { return null; }
  if (bin.length > MAX_SHOT || bin.length < 100) return null;
  const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const jpg = u8[0] === 0xff && u8[1] === 0xd8, png = u8[0] === 0x89 && u8[1] === 0x50, webp = u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50;
  const type = jpg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : ''; if (!type) return null;
  return { u8, type, ext: type.split('/')[1].replace('jpeg', 'jpg') };
}
const device = ua => { ua = String(ua || ''); const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
  const br = /Instagram/.test(ua) ? 'Instagram' : /FBAN|FBAV/.test(ua) ? 'Facebook' : /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'browser';
  return os + ' · ' + br; };

export async function handleFeedback(env, req, me, path, admin, out) {
  await ensureFeedback(env);
  if (path === '/auth/feedback' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const msg = clip(b.msg, 4000); if (msg.length < 2) return out({ error: 'Write a few words first.' }, 400);
    const kind = KINDS.includes(b.kind) ? b.kind : 'other';
    const today = (await env.DB.prepare('SELECT COUNT(*) n FROM feedback WHERE uid=? AND at>?').bind(me.id, now() - 86400).first() || {}).n || 0;
    if (today >= PER_DAY) return out({ error: 'That’s a lot of messages today. Try again tomorrow, or email hello@cardtab.app.' }, 429);
    const id = crypto.randomUUID();
    let shot = null;
    if (b.shot) { const p = picture(b.shot); if (!p) return out({ error: 'That screenshot couldn’t be added. Try a smaller picture, or send it without one.' }, 400);
      if (env.ART) { shot = 'fb/' + id + '.' + p.ext; await env.ART.put(shot, p.u8, { httpMetadata: { contentType: p.type, cacheControl: 'private, max-age=86400' } }); } }
    await env.DB.prepare('INSERT INTO feedback (id,uid,email,name,kind,msg,page,dev,ver,shot,at,status,mailed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)')
      .bind(id, me.id, me.email || '', me.name || '', kind, msg, clip(b.page, 80), device(req.headers.get('user-agent')), clip(b.ver, 20), shot, now(), 'new').run();
    return out({ ok: true });
  }
  if (!path.startsWith('/auth/admin/feedback')) return null;
  if (!admin) return out({ error: 'Admins only.' }, 403);
  if (path === '/auth/admin/feedback' && req.method === 'GET') {
    const st = new URL(req.url).searchParams.get('status');
    const rows = (await env.DB.prepare('SELECT f.*, u.plan FROM feedback f LEFT JOIN users u ON u.id=f.uid' + (st === 'new' ? " WHERE f.status='new'" : '') + ' ORDER BY f.at DESC LIMIT 200').all()).results || [];
    const counts = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(status='new'),0) fresh FROM feedback").first() || {};
    return out({ items: rows.map(r => ({ id: r.id, uid: r.uid, email: r.email, name: r.name, plan: r.plan || 'free', kind: r.kind, msg: r.msg, page: r.page, dev: r.dev, ver: r.ver, shot: !!r.shot, at: r.at, status: r.status, reply: r.reply || '', repliedAt: r.replied_at || null })), total: counts.n || 0, fresh: counts.fresh || 0 });
  }
  if (path === '/auth/admin/feedback/shot' && req.method === 'GET') {
    const r = await env.DB.prepare('SELECT shot FROM feedback WHERE id=?').bind(String(new URL(req.url).searchParams.get('id') || '')).first();
    const o = r && r.shot && env.ART ? await env.ART.get(r.shot) : null; if (!o) return out({ error: 'No screenshot.' }, 404);
    return new Response(o.body, { headers: { 'content-type': (o.httpMetadata && o.httpMetadata.contentType) || 'image/jpeg', 'cache-control': 'private, max-age=3600', 'access-control-allow-origin': env.APP_URL || 'https://app.cardtab.app', 'access-control-allow-credentials': 'true' } });
  }
  if (path === '/auth/admin/feedback/act' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const f = await env.DB.prepare('SELECT * FROM feedback WHERE id=?').bind(String(b.id || '')).first(); if (!f) return out({ error: 'Not found.' }, 404);
    if (b.act === 'handled' || b.act === 'new') { await env.DB.prepare('UPDATE feedback SET status=? WHERE id=?').bind(b.act, f.id).run(); return out({ ok: true }); }
    if (b.act === 'reply') {
      const text = clip(b.text, 2000); if (text.length < 2) return out({ error: 'Write a reply first.' }, 400);
      await env.DB.prepare("UPDATE feedback SET reply=?, replied_at=?, status='handled' WHERE id=?").bind(text, now(), f.id).run();
      // the person sees it in the app (the same notices as gifts), with what they sent for context
      const was = f.msg.length > 90 ? f.msg.slice(0, 88) + '…' : f.msg;
      await env.DB.prepare('INSERT INTO acct_note (id,uid,at,title,body,seen) VALUES (?,?,?,?,?,0)').bind(crypto.randomUUID(), f.uid, now(), 'Card Tab replied to your feedback', text + '\n\nYou wrote: “' + was + '”').run().catch(() => {});
      return out({ ok: true, told: true });
    }
    return out({ error: 'Unknown action.' }, 400);
  }
  return out({ error: 'not found' }, 404);
}

// the morning email: everything that arrived since the last one (nothing is sent on a day without feedback)
export async function feedbackDigest(env) {
  await ensureFeedback(env);
  const rows = (await env.DB.prepare('SELECT * FROM feedback WHERE mailed=0 ORDER BY at').all()).results || [];
  if (!rows.length) return { sent: 0 };
  const to = admins(env); if (!to.length) return { sent: 0 };
  const app = env.APP_URL || 'https://app.cardtab.app', K = { bug: 'Bug', idea: 'Idea', other: 'Other' };
  const n = rows.length, bugs = rows.filter(r => r.kind === 'bug').length;
  const subject = 'Card Tab feedback: ' + n + ' new' + (bugs ? ' (' + bugs + ' bug' + (bugs > 1 ? 's' : '') + ')' : '');
  const when = t => new Date(t * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1918;max-width:560px">' +
    '<h1 style="font-size:20px;margin:0 0 6px">' + n + ' new message' + (n > 1 ? 's' : '') + ' from Card Tab users</h1><p style="margin:0 0 18px;color:#77736d;font-size:14px">Since the last summary. Reply to anyone from the admin dashboard → Feedback.</p>' +
    rows.map(r => '<div style="border:1px solid #e8e4dd;border-radius:14px;padding:14px 16px;margin:0 0 10px"><div style="font-size:12px;color:#77736d;margin-bottom:6px"><b style="color:' + (r.kind === 'bug' ? '#c0392b' : r.kind === 'idea' ? '#2e8b4f' : '#77736d') + '">' + K[r.kind] + '</b> · ' + esc(r.email) + ' · ' + esc(r.page || '') + ' · ' + esc(r.dev || '') + ' · ' + when(r.at) + (r.shot ? ' · 📎 screenshot' : '') + '</div><div style="font-size:14.5px;line-height:1.5;white-space:pre-wrap">' + esc(r.msg) + '</div></div>').join('') +
    '<p style="margin:18px 0 0"><a href="' + app + '/admin.html#feedback" style="background:#a50e37;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;font-size:14px">Open Feedback</a></p></div>';
  const text = subject + '\n\n' + rows.map(r => '[' + K[r.kind] + '] ' + r.email + ' · ' + (r.page || '') + ' · ' + when(r.at) + '\n' + r.msg).join('\n\n') + '\n\nOpen Feedback: ' + app + '/admin.html#feedback';
  let ok = 0; for (const t of to) { try { await sendMail(env, { to: t, subject, html, text }); ok++; } catch (e) {} }
  if (ok) await env.DB.batch(rows.map(r => env.DB.prepare('UPDATE feedback SET mailed=1 WHERE id=?').bind(r.id)));
  return { sent: ok, items: n };
}
// admin Ask: recent feedback, optionally only bugs/ideas or only unhandled
export async function feedbackForAsk(env, a = {}) {
  await ensureFeedback(env);
  const w = [], p = []; if (KINDS.includes(a.kind)) { w.push('kind=?'); p.push(a.kind); } if (a.status === 'new' || a.status === 'handled') { w.push('status=?'); p.push(a.status); }
  if (a.days) { w.push('at>?'); p.push(now() - Math.min(365, Math.max(1, parseInt(a.days, 10) || 30)) * 86400); }
  const rows = (await env.DB.prepare('SELECT kind,msg,email,page,dev,at,status,reply FROM feedback' + (w.length ? ' WHERE ' + w.join(' AND ') : '') + ' ORDER BY at DESC LIMIT 60').bind(...p).all()).results || [];
  return { count: rows.length, items: rows.map(r => ({ kind: r.kind, msg: r.msg.slice(0, 600), from: r.email, page: r.page, device: r.dev, on: new Date(r.at * 1000).toISOString().slice(0, 10), status: r.status, replied: !!r.reply })) };
}
// account deletion: remove their messages and screenshots
export async function wipeFeedback(env, uid) {
  try { await ensureFeedback(env); const rows = (await env.DB.prepare('SELECT shot FROM feedback WHERE uid=?').bind(uid).all()).results || [];
    for (const r of rows) if (r.shot && env.ART) await env.ART.delete(r.shot).catch(() => {});
    await env.DB.prepare('DELETE FROM feedback WHERE uid=?').bind(uid).run(); } catch (e) {}
}
