/* Ask (v45): questions about your own numbers, answered by Claude Haiku 5.5.
   POST /api/ask {q, turns:[{role,content}], view:{label,from,to,platform}}  ->  {text, left, limit, resets}
   - Claude never does the math. It calls the tools below; the Worker works every figure out from the account's synced
     entries, exactly, in cents, the same way the app does. Claude only writes the sentences around them.
   - Questions per calendar month (UTC): Free ASK_FREE (5), Premium ASK_PREMIUM (50). Admins aren't limited.
   - A monthly spending cap (ASK_MONTH_USD, $25 by default) stops all questions for the month if it's ever reached.
   - Nothing is kept except the counts (ask_usage) and the month's token totals (ask_spend). The key lives in the
     ANTHROPIC_API_KEY secret (npx wrangler secret put ANTHROPIC_API_KEY); it is never sent anywhere but Anthropic. */
const MODEL = 'claude-haiku-5-5';
const PRICE = { in: 0.10 / 1e6, out: 0.50 / 1e6 }; // USD per token, prompts under 100k tokens (ours are far below)
const n = (v, d) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : d; };
import { acctOf, askBonus } from './people.js';
export const askLimits = env => ({ free: n(env.ASK_FREE, 5), premium: n(env.ASK_PREMIUM, 50), usd: n(env.ASK_MONTH_USD, 25) });
const month = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);
const resets = (t = Date.now()) => { const d = new Date(t); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10); };

// ---------- the numbers (same rules as the app's store.totals) ----------
const d2 = c => Math.round(c) / 100;
function totals(list) {
  let sales = 0, after = 0, spent = 0, refunds = 0, fees = 0, ns = 0, nb = 0, cards_sold = 0, cards_bought = 0;
  for (const e of list) {
    if (e.type === 'sale') { sales += e.amount; after += e.net; fees += e.amount - e.net; ns++; cards_sold += e.qty || 1; }
    else if (e.type === 'purchase') { spent += e.amount; nb++; cards_bought += e.qty || 1; }
    else if (e.type === 'refund') refunds += e.amount;
  }
  after -= refunds;
  return { sales: d2(sales), fees_and_shipping: d2(fees), kept_after_fees: d2(after), spent: d2(spent), refunds_paid: d2(refunds), profit: d2(after - spent),
    sales_count: ns, purchases_count: nb, cards_sold, cards_bought };
}
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function pick(all, a = {}) {
  const card = norm(a.card), plat = norm(a.platform);
  return all.filter(e => (!a.from || e.date >= a.from) && (!a.to || e.date <= a.to) && (!a.type || e.type === a.type)
    && (!plat || norm(e.platform) === plat) && (!card || norm(e.name).includes(card)));
}
const cardKey = e => norm(e.name).split(' ').slice(0, 8).join(' ');
const TOOLS = [
  { name: 'totals', description: 'Exact totals (US dollars) for the entries that match: sales, fees and shipping, kept after fees, spent, refunds paid to buyers, profit (kept after fees minus spent), and counts. Leave a filter out to include everything.',
    input_schema: { type: 'object', properties: {
      from: { type: 'string', description: 'First day, YYYY-MM-DD' }, to: { type: 'string', description: 'Last day, YYYY-MM-DD' },
      platform: { type: 'string', description: 'Exact platform name, e.g. eBay' }, card: { type: 'string', description: 'Words that appear in the card name' },
      type: { type: 'string', enum: ['sale', 'purchase', 'refund'] } } } },
  { name: 'breakdown', description: 'The same totals split into groups, sorted. Use it for "which platform", "best month", "top cards" and comparisons.',
    input_schema: { type: 'object', required: ['by'], properties: {
      by: { type: 'string', enum: ['month', 'platform', 'card', 'year'] },
      from: { type: 'string' }, to: { type: 'string' }, platform: { type: 'string' }, card: { type: 'string' },
      sort: { type: 'string', enum: ['profit', 'sales', 'spent', 'fees_and_shipping', 'kept_after_fees', 'name'], description: 'Biggest first (name: A to Z; month and year: oldest first if left out)' },
      limit: { type: 'integer', minimum: 1, maximum: 24 } } } },
  { name: 'entries', description: 'Individual entries that match (date, type, card, platform, amount, fees, shipping, kept). Up to 25.',
    input_schema: { type: 'object', properties: {
      from: { type: 'string' }, to: { type: 'string' }, platform: { type: 'string' }, card: { type: 'string' }, type: { type: 'string', enum: ['sale', 'purchase', 'refund'] },
      sort: { type: 'string', enum: ['newest', 'oldest', 'biggest'] }, limit: { type: 'integer', minimum: 1, maximum: 25 } } } },
  { name: 'platforms', description: 'Every platform name used in the entries, with how many entries each has.', input_schema: { type: 'object', properties: {} } }
];
function runTool(all, name, a) {
  a = a || {};
  if (name === 'totals') return totals(pick(all, a));
  if (name === 'platforms') { const m = {}; all.forEach(e => { m[e.platform] = (m[e.platform] || 0) + 1; }); return Object.entries(m).sort((x, y) => y[1] - x[1]).map(([platform, entries]) => ({ platform, entries })); }
  if (name === 'breakdown') {
    const key = a.by === 'month' ? e => e.date.slice(0, 7) : a.by === 'year' ? e => e.date.slice(0, 4) : a.by === 'platform' ? e => e.platform : cardKey;
    const g = new Map(); for (const e of pick(all, a)) { const k = key(e); if (!g.has(k)) g.set(k, { label: a.by === 'card' ? e.name : k, list: [] }); g.get(k).list.push(e); }
    let rows = [...g.values()].map(x => Object.assign({ group: x.label }, totals(x.list)));
    if (a.sort === 'name') rows.sort((x, y) => String(x.group).localeCompare(String(y.group)));
    else if (a.sort) rows.sort((x, y) => y[a.sort] - x[a.sort]);
    else if (a.by === 'month' || a.by === 'year') rows.sort((x, y) => String(x.group).localeCompare(String(y.group)));
    else rows.sort((x, y) => y.profit - x.profit);
    return { groups: rows.length, rows: rows.slice(0, Math.min(24, a.limit || 12)) };
  }
  if (name === 'entries') {
    let l = pick(all, a);
    l.sort(a.sort === 'oldest' ? (x, y) => x.date.localeCompare(y.date) : a.sort === 'biggest' ? (x, y) => y.amount - x.amount : (x, y) => y.date.localeCompare(x.date));
    return { matching: l.length, entries: l.slice(0, Math.min(25, a.limit || 15)).map(e => ({ date: e.date, type: e.type, card: e.name, platform: e.platform, qty: e.qty || 1, amount: d2(e.amount),
      fees: e.type === 'sale' && e.fees != null ? d2(e.fees) : undefined, shipping: e.type === 'sale' && e.ship != null ? d2(e.ship) : undefined, kept: e.type === 'sale' ? d2(e.net) : undefined, condition: e.condition || undefined })) };
  }
  return { error: 'unknown tool' };
}

const RULES = (view, today) => 'You are Ask, inside Card Tab, an app where a trading card collector records what they buy and sell. Answer questions about their own entries.\n' +
  'Rules:\n- Get every number from the tools. Never add, subtract or estimate yourself; if you need a figure, call a tool for it. Quote dollar amounts exactly to the cent, as the tools give them.\n' +
  '- Keep it short: two to five plain sentences, or a short list. Talk to them as "you". No disclaimers, no investment or tax advice.\n' +
  '- "Profit" means kept after fees minus spent. A refund is money they paid back to a buyer.\n' +
  '- If the entries can\'t answer it (for example market prices or what a card is worth today), say so in one sentence.\n' +
  '- Format: plain text. You may use **bold** for one key number and "- " for list items. No headings, no tables.\n' +
  'Today is ' + today + '.' + (view && view.label ? ' They are looking at: ' + String(view.label).slice(0, 80) + (view.from ? ' (' + view.from + ' to ' + (view.to || today) + ')' : '') + (view.platform && view.platform !== 'all' ? ', platform ' + String(view.platform).slice(0, 40) : '') + '. Use that range when the question doesn\'t name one.' : '');

async function claudeRaw(env, body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + String(env.ANTHROPIC_API_KEY || '').trim(), ...(env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': String(env.ANTHROPIC_WORKSPACE_ID).trim() } : {}), 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
  if (!r.ok) { let m = ''; try { const j = await r.json(); m = (j.error && j.error.message) || ''; } catch (er) {} const e = new Error('ai ' + r.status); e.status = r.status; e.detail = String(m).slice(0, 240); throw e; }
  return r;
}
async function claude(env, body) { return (await claudeRaw(env, body)).json(); }
// v52.99: the same call, streamed (photo scans send each card on as soon as it's read)
const claudeStream = claudeRaw;

export async function handleAsk(env, req, me, out) {
  const key = String(env.ANTHROPIC_API_KEY || '').trim();
  // admins are told what's wrong with the key (never the key itself)
  if (!key) return out({ error: 'setup', detail: me.role === 'admin' ? (env.ANTHROPIC_API_KEY == null ? 'The server has no ANTHROPIC_API_KEY secret.' : 'The ANTHROPIC_API_KEY secret is there but empty. Set it again and paste the key at the prompt.') : undefined }, 503);
  const L = askLimits(env), m = month(), plan = me.plan === 'premium' ? 'premium' : 'free', limit = L[plan] + askBonus(await acctOf(env, me.id)), admin = me.role === 'admin';   // v52.9: plus any extra an admin gave this month
  const used = (await env.DB.prepare('SELECT n FROM ask_usage WHERE user_id=? AND month=?').bind(me.id, m).first() || {}).n || 0;
  const info = { limit, left: Math.max(0, limit - used), resets: resets(), plan };
  let b; try { b = await req.json(); } catch (e) { b = {}; }
  if (b.check) return out(info);
  const q = String(b.q || '').trim().slice(0, 500); if (!q) return out({ error: 'Ask a question.' }, 400);
  if (!admin && used >= limit) return out(Object.assign({ error: 'limit' }, info), 429);
  const sp = await env.DB.prepare('SELECT tin, tout FROM ask_spend WHERE month=?').bind(m).first() || { tin: 0, tout: 0 };
  if (sp.tin * PRICE.in + sp.tout * PRICE.out >= L.usd) return out(Object.assign({ error: 'busy' }, info), 503);

  const rows = (await env.DB.prepare('SELECT data FROM entries WHERE user_id=? AND deleted=0').bind(me.id).all()).results || [];
  const all = []; for (const r of rows) { try { const e = JSON.parse(r.data); if (e && !e.deleted && e.date && e.type) all.push(e); } catch (er) {} }
  const turns = (Array.isArray(b.turns) ? b.turns : []).filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string').slice(-8).map(t => ({ role: t.role, content: t.content.slice(0, 2000) }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  const messages = turns.concat([{ role: 'user', content: q }]);
  const today = new Date().toISOString().slice(0, 10);
  let tin = 0, tout = 0, text = '';
  try {
    for (let step = 0; step < 6; step++) {
      const res = await claude(env, { model: MODEL, max_tokens: 700, system: RULES(b.view, today) + (all.length ? '' : '\nThey have no entries yet.'), tools: TOOLS, messages });
      tin += (res.usage && res.usage.input_tokens) || 0; tout += (res.usage && res.usage.output_tokens) || 0;
      const uses = (res.content || []).filter(c => c.type === 'tool_use');
      text = (res.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
      if (res.stop_reason !== 'tool_use' || !uses.length) break;
      messages.push({ role: 'assistant', content: res.content });
      messages.push({ role: 'user', content: uses.map(u => ({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(runTool(all, u.name, u.input)) })) });
      text = '';
    }
  } catch (e) {
    if (tin || tout) await spend(env, m, tin, tout);
    // why, in a word the app can explain (admins also see Anthropic's own message, to fix setup problems fast)
    const why = e.status === 429 || e.status === 529 || e.status === 503 ? 'busy' : e.status === 401 || e.status === 403 ? 'key' : e.status === 400 && /credit|billing|balance/i.test(e.detail || '') ? 'billing' : e.status === 404 ? 'model' : 'failed';
    console.log('ask error', e.status || '', e.detail || e.message);
    return out(Object.assign({ error: why, detail: admin ? (e.status ? e.status + ': ' : '') + (e.detail || e.message) : undefined }, info), 502);
  }
  if (!text) text = 'I couldn’t work that one out. Try asking it a different way.';
  const writes = [env.DB.prepare('INSERT INTO ask_usage (user_id,month,n) VALUES (?,?,1) ON CONFLICT(user_id,month) DO UPDATE SET n=n+1').bind(me.id, m)];
  await env.DB.batch(writes); await spend(env, m, tin, tout);
  return out({ text, limit, left: Math.max(0, limit - used - 1), resets: info.resets, plan });
}
async function spend(env, m, tin, tout, count = 1) {   // count: questions asked (0 for a photo scan, which only adds tokens)
  await env.DB.prepare('INSERT INTO ask_spend (month,tin,tout,n) VALUES (?,?,?,?) ON CONFLICT(month) DO UPDATE SET tin=tin+excluded.tin, tout=tout+excluded.tout, n=n+excluded.n').bind(m, tin, tout, count).run();
}
export { runTool, totals as askTotals };
// v52.20: shared with the admin dashboard's Ask (adminask.js), so both use one model and one monthly spending cap
export { claude as claudeCall, claudeStream, spend as addSpend, MODEL as ASK_MODEL, PRICE as ASK_PRICE };
