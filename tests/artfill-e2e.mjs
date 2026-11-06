// End to end: the app on "app.cardtab.app" talking to the real sign-in code (run in Node with SQLite), emails captured.
import { createRequire } from 'node:module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const API = '/home/claude/cardtab-app/api', APP = process.cwd() + '/app-soft';
const worker = (await import(API + '/src/index.js')).default;
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(API + '/schema.sql', 'utf8'));
const stmt = sql => { const o = { args: [], bind(...a) { o.args = a; return o; }, async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const mails = [];
const realFetch = globalThis.fetch;
let jtCalls = 0;
globalThis.fetch = async (url, opt) => { const u = String(url); if (u.includes('api.justtcg.com')) { jtCalls++; if (/q=Raichu/.test(u)) return new Response(JSON.stringify({ data: [{ id: 'pokemon-base-set-raichu-holo-rare', game: 'Pokemon', name: 'Raichu', set_name: 'Base Set', number: '014/102', rarity: 'Holo Rare', tcgplayerId: 42354 }, { id: 'pokemon-jungle-raichu', game: 'Pokemon', name: 'Raichu', set_name: 'Jungle', number: '14/64', rarity: 'Rare', tcgplayerId: 1 }] })); return new Response(JSON.stringify({ data: [] })); } if (u.includes('tcgplayer-cdn')) return new Response('no', { status: 404 }); return realFetch(url, opt); };
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); } }, ALLOWED_ORIGIN: 'https://app.cardtab.app', ADMIN_EMAILS: 'nklenchik@gmail.com', EMAIL: { async send(m) { mails.push(m); } }, ART: { async get() { return null; } } };
const out = []; const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);
const b = await chromium.launch();
async function ctxFor(w) {
  const ctx = await b.newContext(w < 700 ? { ...devices['iPhone 13'], viewport: { width: w, height: 800 } } : { viewport: { width: w, height: 860 } });
  await ctx.route('https://app.cardtab.app/**', async r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(APP, decodeURIComponent(p));
    if (!existsSync(f)) return r.fulfill({ status: 404, body: 'nf' }); const ext = path.extname(f).slice(1); const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', json: 'application/json', woff2: 'font/woff2', webmanifest: 'application/manifest+json' };
    r.fulfill({ status: 200, body: readFileSync(f), headers: { 'content-type': types[ext] || 'application/octet-stream' } }); });
  await ctx.route('https://api.cardtab.app/**', async r => { const q = r.request(); const res = await worker.fetch(new Request(q.url(), { method: q.method(), headers: q.headers(), body: q.method() === 'POST' ? q.postData() : undefined, redirect: 'manual' }), env, {});
    const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); r.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) }); });
  return ctx;
}

const ctx = await ctxFor(390); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('https://app.cardtab.app/'); await p.waitForTimeout(1200);
await p.fill('#auth-email', 'importer@x.com'); await p.click('#auth-go'); await p.waitForTimeout(700);
const code = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; await p.fill('#auth-code', code); await p.waitForTimeout(2500);
await p.evaluate(() => window.CTArtFill.stop());
await p.evaluate(() => CTStore.importMany([
  { type: 'purchase', name: 'Raichu - 014/102 - Base Set', amount: '20.00', date: '2026-10-01', parsed: { name: 'Raichu', number: '014/102', set: 'Base Set', game: '' } },
  { type: 'sale', name: 'Raichu - 014/102 - Base Set', amount: '45.00', net: '40.00', date: '2026-10-09', parsed: { name: 'Raichu', number: '014/102', set: 'Base Set', game: '' } },
  { type: 'purchase', name: 'Mystery Promo Thing', amount: '5.00', date: '2026-10-03' }]));
const before = jtCalls;
await p.evaluate(() => { window.CTArtFill.start(); }); await p.waitForTimeout(14000);
const rows = await p.evaluate(() => CTStore.all().map(e => ({ n: e.name, art: e.art && e.art.list, tried: !!e.artTry })));
const r1 = rows.filter(r => /Raichu/.test(r.n));
ok(r1.length === 2 && r1.every(r => /\/art\/pokemon-base-set-raichu-holo-rare\/list$/.test(r.art || '')), 'both Raichu entries got Base Set art ' + JSON.stringify(r1.map(r => r.art)));
const m = rows.find(r => /Mystery/.test(r.n)); ok(m && !m.art && m.tried, 'no clear match: left alone, marked to try again later');
ok(jtCalls - before <= 4, 'one lookup per unique card (JustTCG requests: ' + (jtCalls - before) + ')');
await p.evaluate(() => window.CTSync.now()); await p.waitForTimeout(1500);
ok(await p.evaluate(() => window.CTSync.status()) === 'synced', 'art changes saved to the account');
// Change card: pick a card for the mystery entry; a second entry with the same text follows the pick
await p.evaluate(() => CTStore.importMany([{ type: 'purchase', name: 'Mystery Promo Thing', amount: '6.00', date: '2026-10-05' }]));
await p.evaluate(() => { const e = CTStore.all().find(x => x.name === 'Mystery Promo Thing'); window.CTNotify.change(e); });
await p.waitForTimeout(400); await p.fill('#fix-q', 'Raichu 014/102'); await p.waitForTimeout(2500);
await p.click('#fix .ntf-li'); await p.waitForTimeout(2500);
const ms = await p.evaluate(() => CTStore.all().filter(x => x.name === 'Mystery Promo Thing').map(x => ({ from: x.artFrom, art: x.art && x.art.list })));
ok(ms.length === 2 && ms.every(x => x.from === 'pick' && /raichu/.test(x.art || '')), 'Change card: your pick is used for both entries with that text ' + JSON.stringify(ms));
await p.evaluate(() => window.CTArtFill.now()); await p.waitForTimeout(1500);
ok(await p.evaluate(() => CTStore.all().filter(x => x.name === 'Mystery Promo Thing').every(x => x.artFrom === 'pick')), 'the background job never overrides a pick');
// today's art share used up: the app makes no lookups, shows nothing, and leaves the entry to try later
sq.prepare("INSERT INTO usage (day,src,plan,calls,reqs) VALUES (?, 'fill', 'free', 100000, 1) ON CONFLICT(day,src,plan) DO UPDATE SET calls=calls+100000").run(new Date().toISOString().slice(0, 10));
sq.prepare("INSERT INTO usage (day,src,plan,calls,reqs) VALUES ('2026-01-01', 'type', 'none', 0, 1)").run();
const jb = jtCalls;
await p.evaluate(() => CTStore.importMany([{ type: 'purchase', name: 'Blastoise - 2/102 - Base Set', amount: '9.00', date: '2026-10-06' }]));
await p.evaluate(() => window.CTArtFill.now()); await p.waitForTimeout(3000);
const bl = await p.evaluate(() => { const e = CTStore.all().find(x => /Blastoise/.test(x.name)); return { art: !!e.art, tried: !!e.artTry }; });
const line = await p.evaluate(() => { const el = document.getElementById('am-art'); return el ? el.hidden : true; });
ok(jtCalls === jb && !bl.art && !bl.tried && line, 'when today’s art share is used up: no lookups, nothing shown, tried again later ' + JSON.stringify(bl));
ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | '));
console.log(out.join('\n')); await b.close();
