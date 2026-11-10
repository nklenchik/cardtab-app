/* Catalog fill (v51.3).
   JustTCG's monthly allowance doesn't roll over: whatever is left when it resets (RESET_DAY) is gone. So in the last
   WINDOW days before the reset, the leftover goes into our own card catalog, newest sets first, working back to older
   ones. Every card saved this way answers later lookups from our own database (no JustTCG request), and its art can be
   made ahead of time.
   - Users always come first. Each day the leftover (minus a cushion) is spread over the days left, and whatever users
     used today comes off the top. The plan's daily limit is respected, with room kept for users.
   - Sets people are already adding cards from jump the line; otherwise newest release first.
   - Only card details are kept (name, number, set, TCGplayer id). Prices are not stored: they're asked for fresh.
   - JustTCG's terms (7.1-7.3, paid plans): caching responses server-side is allowed while the subscription is active,
     only to run our own app, never exported or shared as a dataset.
   - Runs every 5 minutes in small steps (a free-plan Worker gets little CPU time and ~50 outside requests per run);
     outside the window a run does nothing at all.
   - Art made ahead is capped per day, since image resizing has its own free monthly allowance that users' art needs too.
   Nobody is told any of this. */
import { limits, cycle, totals, today } from './budget.js';
const JT = 'https://api.justtcg.com';
const n = (v, d) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && v !== '' && v != null ? x : d; };
export function catLimits(env) {
  return { window: n(env.CAT_WINDOW, 7), cushion: n(env.CAT_CUSHION, 500), cushionLast: n(env.CAT_CUSHION_LAST, 150), keepDay: n(env.CAT_KEEP_DAY, 100),
    perRun: n(env.CAT_PER_RUN, 4), page: n(env.CAT_PAGE, 100), artDay: n(env.CAT_ART_DAY, 150), artRun: n(env.CAT_ART_RUN, 4), on: env.CAT_FILL !== 'off' };
}
// which games to fill (English printings; Japanese is for later)
const GAME_RX = [/^pok[eé]mon$/i, /magic/i, /one.?piece/i, /fusion/i, /dragon.?ball/i, /lorcana/i, /yu.?gi.?oh/i];
const pickGames = list => (list || []).filter(g => !/japan|\bjp\b/i.test(g.id + ' ' + g.name) && GAME_RX.some(rx => rx.test(g.id) || rx.test(g.name)));
const released = s => String(s.release_date || s.releaseDate || s.released_at || s.released || s.published_at || '').slice(0, 10);

export async function ensure(env) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS cat_sets ( id TEXT PRIMARY KEY, game TEXT, name TEXT, released TEXT, total INTEGER, next_offset INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, cards INTEGER NOT NULL DEFAULT 0, listed TEXT )'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS cat_cards ( id TEXT PRIMARY KEY, art INTEGER NOT NULL DEFAULT 0, at INTEGER )'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS cat_day ( day TEXT PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0, sets INTEGER NOT NULL DEFAULT 0, cards INTEGER NOT NULL DEFAULT 0, art INTEGER NOT NULL DEFAULT 0 )')
  ]);
}

// how many JustTCG requests the catalog may still use today (0 outside the window)
export async function allowance(env, t = Date.now()) {
  const L = limits(env), C = catLimits(env), c = cycle(env, t);
  if (!C.on || c.daysLeft > C.window) return { left: 0, why: 'not yet', daysLeft: c.daysLeft };
  const T = await totals(env, t), d = today(t);
  const mine = (await env.DB.prepare('SELECT calls FROM cat_day WHERE day=?').bind(d).first()) || { calls: 0 };
  const cushion = c.daysLeft <= 1 ? C.cushionLast : C.cushion;
  const perDay = Math.floor((L.month - T.before - cushion) / c.daysLeft);   // the day's share, set at the start of the day
  const users = T.day - mine.calls;
  const left = Math.max(0, Math.min(perDay - users - mine.calls, L.day - C.keepDay - T.day, L.month - cushion - T.month));
  return { left, perDay, users, mine: mine.calls, daysLeft: c.daysLeft };
}

// one small step: a few pages of cards, then a few pieces of art. opts.art(id) makes a card's list-size art.
export async function step(env, opts = {}, t = Date.now()) {
  const C = catLimits(env), c = cycle(env, t);
  if (!C.on || c.daysLeft > C.window) return { skipped: 'not yet' };
  await ensure(env);
  const d = today(t), now = Math.floor(t / 1000);
  const A = await allowance(env, t);
  let calls = 0, cards = 0, sets = 0, art = 0, stop = '';
  const jt = async path => {
    calls++;
    const r = await fetch(JT + path, { headers: { 'x-api-key': env.JUSTTCG_API_KEY, accept: 'application/json' } });
    if (!r.ok) throw Object.assign(new Error('justtcg ' + r.status), { upstream: r.status });
    return r.json();
  };
  let budget = 0, page = C.page;
  try {
    // the list of sets, once per billing month (a request per game)
    if (A.left > 0) {
      const last = await env.DB.prepare('SELECT MAX(listed) m FROM cat_sets').first();
      if (!last || !last.m || last.m < c.start) {
        const games = pickGames((await jt('/v1/games')).data);
        for (const g of games) {
          const list = (await jt('/v1/sets?game=' + encodeURIComponent(g.id))).data || [];
          await env.DB.batch(list.map(s => env.DB.prepare('INSERT INTO cat_sets (id,game,name,released,total,listed) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, released=excluded.released, total=excluded.total, listed=excluded.listed')
            .bind(String(s.id), g.id, s.name || '', released(s), Number(s.cards_count || s.count || s.total || 0) || null, d)));
        }
      }
    }
    budget = Math.min(A.left - calls, C.perRun);
    // pages of cards: sets people already add from first, then newest release first
    while (budget > 0) {
      const s = await env.DB.prepare(`SELECT s.* FROM cat_sets s WHERE s.done=0 ORDER BY
          (SELECT COUNT(*) FROM cards c WHERE c.set_name=s.name AND c.id NOT IN (SELECT id FROM cat_cards)) >= 2 DESC,
          s.released DESC, s.rowid LIMIT 1`).first();
      if (!s) { stop = 'all sets saved'; break; }
      let res;
      budget--;
      try { res = await jt(`/v1/cards?set=${encodeURIComponent(s.id)}&limit=${page}&offset=${s.next_offset}&include_price_history=false`); }
      catch (e) { if (e.upstream === 400 && page > 20) { page = 20; continue; } throw e; }   // a smaller page if the plan won't take 100
      const list = res.data || [], meta = res.meta || {};
      const doneNow = !list.length || meta.hasMore === false;
      const st = list.map(x => env.DB.prepare('INSERT OR REPLACE INTO cards (id,game,name,set_name,number,rarity,tcgplayer_id,fetched_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(x.id, x.game, x.name, x.set_name || x.set || s.name, x.number, x.rarity, x.tcgplayerId ? String(x.tcgplayerId) : '', now));
      list.forEach(x => st.push(env.DB.prepare('INSERT OR IGNORE INTO cat_cards (id,art,at) VALUES (?,0,?)').bind(x.id, now)));
      st.push(env.DB.prepare('UPDATE cat_sets SET next_offset=next_offset+?, cards=cards+?, done=? WHERE id=?').bind(list.length, list.length, doneNow ? 1 : 0, s.id));
      await env.DB.batch(st);
      cards += list.length; if (doneNow) sets++;
    }
  } catch (e) { stop = 'justtcg said no (' + (e.upstream || e.message) + ')'; }   // try again next run
  // art ahead of time, for cards the catalog saved (newest first), within its own daily cap
  if (opts.art) {
    const done = (await env.DB.prepare('SELECT art FROM cat_day WHERE day=?').bind(d).first()) || { art: 0 };
    const room = Math.max(0, Math.min(C.artRun, C.artDay - done.art));
    if (room) {
      const rows = (await env.DB.prepare("SELECT k.id FROM cat_cards k JOIN cards c ON c.id=k.id WHERE k.art=0 AND c.tcgplayer_id<>'' ORDER BY k.at DESC LIMIT ?").bind(room).all()).results || [];
      for (const r of rows) {
        let ok = false; try { const res = await opts.art(r.id); ok = res && res.status === 200 && /webp/i.test(res.headers.get('content-type') || ''); } catch (e) {}
        await env.DB.prepare('UPDATE cat_cards SET art=? WHERE id=?').bind(ok ? 1 : 2, r.id).run();
        if (ok) art++;
      }
    }
  }
  if (calls || art) await env.DB.batch([
    env.DB.prepare('INSERT INTO cat_day (day,calls,sets,cards,art) VALUES (?,?,?,?,?) ON CONFLICT(day) DO UPDATE SET calls=calls+excluded.calls, sets=sets+excluded.sets, cards=cards+excluded.cards, art=art+excluded.art').bind(d, calls, sets, cards, art),
    env.DB.prepare("INSERT INTO usage (day,src,plan,calls,reqs) VALUES (?,'cat','none',?,?) ON CONFLICT(day,src,plan) DO UPDATE SET calls=calls+excluded.calls, reqs=reqs+excluded.reqs").bind(d, calls, calls)
  ]);
  return { calls, cards, sets, art, stop, allowance: A };
}

// for the admin readout
export async function catReport(env, t = Date.now()) {
  try {
    await ensure(env);
    const d = today(t), day = (await env.DB.prepare('SELECT * FROM cat_day WHERE day=?').bind(d).first()) || { calls: 0, sets: 0, cards: 0, art: 0 };
    const s = await env.DB.prepare('SELECT COUNT(*) n, COALESCE(SUM(done),0) done FROM cat_sets').first();
    const k = await env.DB.prepare('SELECT COUNT(*) n, COALESCE(SUM(art=1),0) art FROM cat_cards').first();
    const c = cycle(env, t), C = catLimits(env);
    return { active: C.on && c.daysLeft <= C.window, startsIn: Math.max(0, c.daysLeft - C.window), today: day, sets: s.n, setsDone: s.done, cards: k.n, art: k.art };
  } catch (e) { return null; }
}
