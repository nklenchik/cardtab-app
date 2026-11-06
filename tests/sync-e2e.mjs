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
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); } }, ADMIN_EMAILS: 'nklenchik@gmail.com', EMAIL: { async send(m) { mails.push(m); } }, ART: { async get() { return null; } } };
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

async function signIn(ctx, email) {
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p._errs = errs;
  await p.goto('https://app.cardtab.app/'); await p.waitForTimeout(1200);
  await p.fill('#auth-email', email); await p.click('#auth-go'); await p.waitForTimeout(700);
  const code = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1]; await p.fill('#auth-code', code); await p.waitForTimeout(2500);
  return p;
}
const add = (p, name, amt) => p.evaluate(async ([n, a]) => (await CTStore.add({ type: 'purchase', name: n, amount: a, date: CTStore.today(), platform: 'eBay' })).id, [name, amt]);
const names = p => p.evaluate(() => CTStore.all().map(e => e.name).sort());
const settle = async (...ps) => { for (const p of ps) { await p.evaluate(() => window.CTSync.now()); } await ps[0].waitForTimeout(1800); };
const phone = await ctxFor(390), mac = await ctxFor(1280);
// phone: entries made before sync existed (first sync sends them)
const P = await signIn(phone, 'collector@x.com');
await P.evaluate(() => window.CTSync.stop());
await add(P, 'Raichu', '10.00'); await add(P, 'Blastoise', '120.00');
await P.evaluate(() => CTStore._sync.setState(null));   // as if this device had never synced
await P.evaluate(() => window.CTSync.start()); await P.waitForTimeout(2500);
ok(await P.evaluate(() => window.CTSync.status()) === 'synced', 'phone: first sync sends what was already there (' + await P.evaluate(() => window.CTSync.status()) + ')');
const M = await signIn(mac, 'collector@x.com'); await M.waitForTimeout(1500);
ok(JSON.stringify(await names(M)) === JSON.stringify(['Blastoise', 'Raichu']), 'mac: signs in and gets the phone\'s entries ' + JSON.stringify(await names(M)));
// mac adds; phone picks it up when it comes back to the front
await add(M, 'Gengar ex', '64.80'); await settle(M); await settle(P);
ok((await names(P)).includes('Gengar ex'), 'phone: gets the mac\'s new entry');
// edit on the phone wins on the mac
await P.evaluate(async () => { const e = CTStore.all().find(x => x.name === 'Raichu'); await CTStore.update(e.id, { amount: '15.00' }); }); await settle(P); await settle(M);
ok(await M.evaluate(() => CTStore.all().find(x => x.name === 'Raichu').amount) === 1500, 'mac: sees the phone\'s edit');
// delete travels
await M.evaluate(async () => { const e = CTStore.all().find(x => x.name === 'Blastoise'); await CTStore.remove(e.id); }); await settle(M); await settle(P);
ok(!(await names(P)).includes('Blastoise'), 'phone: the mac\'s delete reaches it');
// same entry edited on both while offline: the later edit wins everywhere
await phone.setOffline(true); await P.evaluate(() => window.dispatchEvent(new Event('offline')));
await P.evaluate(async () => { const e = CTStore.all().find(x => x.name === 'Gengar ex'); await CTStore.update(e.id, { note: 'phone edit' }); }); await P.waitForTimeout(1500);
ok(await P.evaluate(() => window.CTSync.status()) === 'offline-pending', 'phone offline: knows changes are waiting');
ok(await P.evaluate(() => document.getElementById('app-avatar').classList.contains('sync-off')), 'phone offline: small cloud shows on the picture');
await P.waitForTimeout(1100);
await M.evaluate(async () => { const e = CTStore.all().find(x => x.name === 'Gengar ex'); await CTStore.update(e.id, { note: 'mac edit (later)' }); }); await settle(M);
await phone.setOffline(false); await P.evaluate(() => window.dispatchEvent(new Event('online'))); await P.waitForTimeout(2500); await settle(P); await settle(M);
const nP = await P.evaluate(() => CTStore.all().find(x => x.name === 'Gengar ex').note), nM = await M.evaluate(() => CTStore.all().find(x => x.name === 'Gengar ex').note);
ok(nP === 'mac edit (later)' && nM === 'mac edit (later)', 'after reconnecting, the later edit wins on both (' + nP + ' / ' + nM + ')');
ok(!(await P.evaluate(() => document.getElementById('app-avatar').classList.contains('sync-off'))), 'back online: the cloud goes away');
// settings follow too
await M.evaluate(() => CTStore.setBudget({ cents: 15000, alert: true })); await settle(M); await settle(P);
ok(await P.evaluate(() => (CTStore.budget() || {}).cents) === 15000, 'budget set on the mac shows on the phone');
// free limit counts across devices
const used = await P.evaluate(() => CTStore.usage().used); ok(used === 2, 'usage counted from entries on any device: ' + used);
// profile menu line
const line = await M.evaluate(() => { document.getElementById('app-avatar').click(); const l = document.getElementById('am-sync'); return !l.hidden && l.textContent; });
ok(/saved to your account/.test(line || ''), 'profile menu: ' + line);
// someone else sees none of it
const other = await ctxFor(390); const O = await signIn(other, 'someone@x.com'); await O.waitForTimeout(1500);
ok((await names(O)).length === 0, 'another account sees none of these entries');
ok(!P._errs.length && !M._errs.length && !O._errs.length, 'no page errors ' + [...P._errs, ...M._errs].slice(0, 2).join(' | '));
console.log(out.join('\n')); await b.close();
