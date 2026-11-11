/* Admin Ask (v52.20): questions about the admin dashboard's numbers and about individual accounts, for admins only.
   POST /auth/admin/ask {q, turns:[{role,content}], view:{src,label,from,to}, spots:[card names]}  ->  {text, show:[card names]}
   - Same model and the same monthly spending cap (ASK_MONTH_USD) as the app's Ask; its tokens are added to ask_spend.
     Admin questions don't count toward anyone's monthly question limit.
   - Claude never makes numbers up: it calls the tools below, which read the same figures the dashboard shows
     (handleStats / handleSiteStats), the daily health check, and account details (people.js). It only writes the sentences.
   - Answers may end with "SHOW: name; name": up to two dashboard cards to jump to, picked from the names the page sent. */
import { handleStats, handleSiteStats } from './analytics.js';
import { personDetails } from './people.js';
import { askLimits, claudeCall, addSpend, ASK_MODEL, ASK_PRICE } from './ask.js';

const month = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const isDay = s => /^\d{4}-\d\d-\d\d$/.test(String(s || ''));
const sum = a => (a || []).reduce((t, x) => t + (+x || 0), 0);
// events [{ev,dim,n,v}] -> { ev: { total, by: { dim: n } } }, keeping the busiest 15 dims of each
function evMap(rows) {
  const m = {};
  (rows || []).forEach(r => { const o = m[r.ev] = m[r.ev] || { total: 0, by: {} }; o.total += r.n || 0; if (r.dim) o.by[r.dim] = (o.by[r.dim] || 0) + (r.n || 0); if (r.v) o.value = (o.value || 0) + r.v; });
  for (const k in m) { const e = Object.entries(m[k].by).sort((a, b) => b[1] - a[1]); m[k].by = Object.fromEntries(e.slice(0, 15)); }
  return m;
}
const callOut = async (fn, env, url) => fn(env, new Request(url), b => b);
const qs = a => '?from=' + a.from + '&to=' + a.to + (a.plan ? '&plan=' + a.plan : '') + (a.dev ? '&dev=' + a.dev : '');
function span(a) {
  const to = isDay(a.to) ? a.to : today(), from = isDay(a.from) ? a.from : new Date(Date.parse(to) - 29 * 864e5).toISOString().slice(0, 10);
  return { from, to, plan: ['free', 'premium'].includes(a.plan) ? a.plan : '', dev: ['phone', 'desk'].includes(a.dev) ? a.dev : '' };
}

async function appStats(env, a) {
  const s = await callOut(handleStats, env, 'https://x/auth/admin/stats' + qs(span(a)));
  const sp = s.askSpend, usd = sp ? sp.tin * ASK_PRICE.in + sp.tout * ASK_PRICE.out : 0;
  return {
    period: s.from + ' to ' + s.to, comparedWith: s.pFrom + ' to ' + s.pTo, filters: { plan: s.plan, device: s.dev },
    accountsNow: s.members, newAccounts: sum((s.signups || []).map(x => x.n)), newAccountsPrev: s.signupsPrev,
    activePeople: s.people, activePeoplePrev: s.peoplePrev, activePerDayAvg: Math.round(sum(s.active) / (s.days || 1)),
    medianSecondsPerDay: Math.round(sum(s.secs) / (s.days || 1)),
    events: evMap(s.events), eventsPrev: evMap(s.eventsPrev),
    featureReach: s.reach, upgradesInPeriod: s.upgraders, avgDaysToUpgrade: Math.round(s.upDays || 0), upgradeTriggers: s.upCtx,
    signupSources: s.signupSrc, cohorts: s.cohorts,
    askSpendThisMonth: sp ? { month: sp.month, questions: sp.n, usd: Math.round(usd * 100) / 100, capUsd: s.askCap } : null,
    note: 'events: page_view (dim = page), entry_add (purchase/sale), entry_game, entry_platform, ask, story_play, widget_add, prem_open (dim = what opened it), prem_tap, upgrade, error. Admins are never counted.'
  };
}
async function siteStats(env, a) {
  const s = await callOut(handleSiteStats, env, 'https://x/auth/admin/site' + qs(span(a)));
  return { period: s.from + ' to ' + s.to, comparedWith: s.pFrom + ' to ' + s.pTo, visitors: sum(s.visitors), visitorsPrev: sum(s.visitorsPrev),
    sources: s.sources, sourcesPrev: s.sourcesPrev, countries: (s.countries || []).slice(0, 15), events: evMap(s.events), eventsPrev: evMap(s.eventsPrev),
    appSignups: s.appSignups, appSignupsPrev: s.appSignupsPrev, note: 'events: pv (page views), join (waitlist joins), sec (sections reached), demo (demos tapped).' };
}
async function findPeople(env, a) {
  const q = String(a.q || '').trim().toLowerCase().replace(/[%_]/g, '').slice(0, 80);
  const where = [], p = [];
  if (q) { where.push('(lower(u.email) LIKE ? OR lower(u.name) LIKE ?)'); p.push('%' + q + '%', '%' + q + '%'); }
  if (a.plan === 'premium' || a.plan === 'free') { where.push('u.plan=?'); p.push(a.plan); }
  if (a.gift) where.push('b.gift=1');
  const adm = String(env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (adm.length && !q) { where.push('lower(u.email) NOT IN (' + adm.map(() => '?').join(',') + ')'); p.push(...adm); }
  const order = a.sort === 'last_seen' ? 'u.last_seen_at DESC' : a.sort === 'oldest' ? 'u.created_at ASC' : 'u.created_at DESC';
  const lim = Math.max(1, Math.min(25, parseInt(a.limit, 10) || 10));
  let rows = [];
  try { rows = (await env.DB.prepare('SELECT u.id,u.email,u.name,u.plan,u.created_at,u.last_seen_at,b.gift,b.status FROM users u LEFT JOIN billing b ON b.user_id=u.id' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY ' + order + ' LIMIT ' + lim).bind(...p).all()).results || []; }
  catch (e) { rows = (await env.DB.prepare('SELECT id,email,name,plan,created_at,last_seen_at FROM users' + (q ? ' WHERE lower(email) LIKE ?' : '') + ' ORDER BY created_at DESC LIMIT ' + lim).bind(...(q ? ['%' + q + '%'] : [])).all()).results || []; }
  const d = t => t ? new Date(t * 1000).toISOString().slice(0, 10) : null;
  return { found: rows.length, people: rows.map(r => ({ id: r.id, email: r.email, name: r.name || '', plan: r.plan || 'free', gift: !!r.gift, joined: d(r.created_at), lastSeen: d(r.last_seen_at) })) };
}
async function person(env, a) {
  let id = String(a.id || '');
  if (!id && a.email) { const r = await env.DB.prepare('SELECT id FROM users WHERE lower(email)=?').bind(String(a.email).trim().toLowerCase()).first(); id = r && r.id; }
  if (!id) return { error: 'No account with that email. Try find_people with part of it.' };
  const p = await personDetails(env, id); if (!p) return { error: 'No such account.' };
  const d = t => t ? new Date(t * 1000).toISOString().slice(0, 10) : null;
  return Object.assign({}, p, { joined: d(p.joined), lastSeen: d(p.lastSeen), giftUntil: d(p.giftUntil), renews: d(p.renews),
    devices: (p.devices || []).map(x => ({ name: x.name, since: d(x.since) })), history: (p.history || []).map(h => ({ on: d(h.at), what: h.what })), share: p.share ? Object.assign({}, p.share, { since: d(p.share.since) }) : null });
}
async function health(env) {
  const r = await env.DB.prepare('SELECT day, ok, n_bad, n_warn, checks FROM health ORDER BY day DESC LIMIT 1').first().catch(() => null);
  if (!r) return { error: 'No daily check has run yet.' };
  let c = []; try { c = JSON.parse(r.checks || '[]'); } catch (e) {}
  return { day: r.day, allOk: !!r.ok, failing: r.n_bad, toLookAt: r.n_warn, checks: c.map(x => ({ name: x.name, ok: x.ok, warn: !!x.warn, note: x.note || '', fix: x.fix || '' })) };
}

const range = { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } };
const TOOLS = [
  { name: 'app_stats', description: 'The app dashboard numbers for a date range: accounts by plan, new accounts, active people, feature use and events, upgrades, sign-up sources, retention cohorts, Ask spending. Each period comes with the period before it for comparison.',
    input_schema: { type: 'object', properties: { ...range, plan: { type: 'string', enum: ['all', 'free', 'premium'] }, dev: { type: 'string', enum: ['all', 'phone', 'desk'] } }, required: ['from', 'to'] } },
  { name: 'site_stats', description: 'The cardtab.app website numbers for a date range: visitors, sources, countries, sections read, demos tapped, waitlist joins, app sign-ups.',
    input_schema: { type: 'object', properties: { ...range, dev: { type: 'string', enum: ['all', 'phone', 'desk'] } }, required: ['from', 'to'] } },
  { name: 'find_people', description: 'Find accounts by part of an email or name, or list accounts (newest first unless sort says otherwise), optionally only Premium, only Free, or only gifted.',
    input_schema: { type: 'object', properties: { q: { type: 'string' }, plan: { type: 'string', enum: ['any', 'free', 'premium'] }, gift: { type: 'boolean' }, sort: { type: 'string', enum: ['newest', 'oldest', 'last_seen'] }, limit: { type: 'integer', minimum: 1, maximum: 25 } } } },
  { name: 'person', description: 'Everything about one account: plan, gift and its end, payments and renewal, entries and Ask questions this month and limits, total entries, uploads, shared board, devices, account history. Give the id from find_people, or the exact email.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' } } } },
  { name: 'health', description: 'The latest daily health check: each check, whether it passed, notes and suggested fixes.', input_schema: { type: 'object', properties: {} } }
];
async function runTool(env, name, a) {
  try {
    if (name === 'app_stats') return await appStats(env, a || {});
    if (name === 'site_stats') return await siteStats(env, a || {});
    if (name === 'find_people') return await findPeople(env, a || {});
    if (name === 'person') return await person(env, a || {});
    if (name === 'health') return await health(env);
  } catch (e) { console.log('admin ask tool', name, e.message); return { error: 'Couldn’t read that just now.' }; }
  return { error: 'Unknown tool.' };
}
const RULES = (view, spots, t) => 'You answer the owner of Card Tab (a trading card profit tracker) about their admin dashboard: how the app and website are doing, and about individual accounts. ' +
  'Get every number from the tools; never guess or make one up, and never do sums the tools didn\'t give you unless they are simple (adding two numbers, a percentage). If a tool has no data, say so. ' +
  'Answer in one to four short sentences of plain language, no tables or headings, no markdown. Use $ for money. Say dates like "Nov 3". ' +
  'When a question names no dates, use the range they are looking at; if none, the last 30 days. Today is ' + t + '. ' +
  (view && view.label ? 'They are looking at: ' + String(view.label).slice(0, 80) + (isDay(view.from) ? ' (' + view.from + ' to ' + (isDay(view.to) ? view.to : t) + ')' : '') + '. ' : '') +
  (spots && spots.length ? 'If one or two dashboard cards show what you answered, end with a final line "SHOW: " and their exact names separated by "; ", chosen only from this list: ' + spots.join(' | ') + '. Otherwise leave that line out.' : '');

export async function handleAdminAsk(env, req, out) {
  if (!String(env.ANTHROPIC_API_KEY || '').trim()) return out({ error: 'setup', detail: 'The server has no ANTHROPIC_API_KEY secret.' }, 503);
  let b; try { b = await req.json(); } catch (e) { b = {}; }
  const q = String(b.q || '').trim().slice(0, 600); if (!q) return out({ error: 'Ask a question.' }, 400);
  const m = month(), L = askLimits(env);
  const sp = await env.DB.prepare('SELECT tin, tout FROM ask_spend WHERE month=?').bind(m).first() || { tin: 0, tout: 0 };
  if (sp.tin * ASK_PRICE.in + sp.tout * ASK_PRICE.out >= L.usd) return out({ error: 'cap', detail: 'This month’s Ask spending cap ($' + L.usd + ') has been reached.' }, 503);
  const spots = (Array.isArray(b.spots) ? b.spots : []).map(s => String(s).replace(/[|;\n]/g, ' ').trim().slice(0, 70)).filter(Boolean).slice(0, 160);
  const turns = (Array.isArray(b.turns) ? b.turns : []).filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-8).map(x => ({ role: x.role, content: x.content.slice(0, 2000) }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  const messages = turns.concat([{ role: 'user', content: q }]);
  let tin = 0, tout = 0, text = '';
  try {
    for (let step = 0; step < 6; step++) {
      const res = await claudeCall(env, { model: ASK_MODEL, max_tokens: 700, system: RULES(b.view, spots, today()), tools: TOOLS, messages });
      tin += (res.usage && res.usage.input_tokens) || 0; tout += (res.usage && res.usage.output_tokens) || 0;
      const uses = (res.content || []).filter(c => c.type === 'tool_use');
      text = (res.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
      if (res.stop_reason !== 'tool_use' || !uses.length) break;
      messages.push({ role: 'assistant', content: res.content });
      const results = [];
      for (const u of uses) results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(await runTool(env, u.name, u.input)).slice(0, 60000) });
      messages.push({ role: 'user', content: results });
      text = '';
    }
  } catch (e) {
    if (tin || tout) await addSpend(env, m, tin, tout);
    console.log('admin ask error', e.status || '', e.detail || e.message);
    return out({ error: 'failed', detail: (e.status ? e.status + ': ' : '') + (e.detail || e.message) }, 502);
  }
  await addSpend(env, m, tin, tout);
  let show = [];
  const mm = /\n?\s*SHOW:\s*(.+)\s*$/i.exec(text);
  if (mm) { show = mm[1].split(';').map(s => s.trim()).filter(s => spots.includes(s)).slice(0, 2); text = text.slice(0, mm.index).trim(); }
  if (!text) text = 'I couldn’t work that one out. Try asking it a different way.';
  return out({ text, show });
}
