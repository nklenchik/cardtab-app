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
for (const w of [390, 1280]) {
  const ctx = await ctxFor(w); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const tag = w + '';
  await p.goto('https://app.cardtab.app/'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !document.getElementById('view-auth').hidden), tag + ' signed out: sign-in page');
  ok(await p.evaluate(() => document.getElementById('auth-local').hidden), tag + ' no test-copy note on the real app');
  // email + code (Nick, admin)
  const n0 = mails.length;
  await p.fill('#auth-email', 'nklenchik@gmail.com'); await p.click('#auth-go'); await p.waitForTimeout(800);
  ok(mails.length === n0 + 1 && await p.evaluate(() => document.querySelector('.auth-card').classList.contains('sent')), tag + ' email sent, "Check your inbox" shows');
  if (w === 390) await p.screenshot({ path: 'tests/out-phone/auth-sent.png' });
  const code = /code in the app: (\d{6})/.exec(mails.at(-1).text)[1];
  await p.fill('#auth-code', '000000' === code ? '111111' : '000000'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => !document.getElementById('auth-code-err').hidden), tag + ' wrong code: message shows');
  await p.fill('#auth-code', code); await p.waitForTimeout(2000);
  ok(await p.evaluate(() => !document.getElementById('view-app').hidden), tag + ' right code: signed in');
  ok(await p.evaluate(() => !document.getElementById('am-dev').hidden), tag + ' admin tools show for Nick (from the server)');
  ok((await ctx.cookies('https://api.cardtab.app')).some(c => c.name === 'ct_s' && c.httpOnly), tag + ' session cookie is HttpOnly');
  // reload keeps you signed in
  await p.reload(); await p.waitForTimeout(2000);
  ok(await p.evaluate(() => !document.getElementById('view-app').hidden), tag + ' reload: still signed in');
  // sign out
  await p.evaluate(() => document.getElementById('am-out').click()); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !document.getElementById('view-auth').hidden), tag + ' sign out: back to sign-in');
  ok(!(await ctx.cookies('https://api.cardtab.app')).some(c => c.name === 'ct_s' && c.value), tag + ' sign out clears the cookie');
  // a normal person, via the emailed link
  const who = 'fan' + w + '@x.com';
  await p.fill('#auth-email', who); await p.click('#auth-go'); await p.waitForTimeout(800);
  const link = /(https:\/\/app\.cardtab\.app\/\?login=[\w-]+)/.exec(mails.at(-1).text)[1];
  const p2 = await ctx.newPage(); await p2.goto(link); await p2.waitForTimeout(2000);
  ok(await p2.evaluate(() => !document.getElementById('view-app').hidden && location.search === ''), tag + ' email link signs in and tidies the address');
  ok(await p2.evaluate(() => document.getElementById('am-dev').hidden), tag + ' no admin tools for a normal account');
  ok(await p2.evaluate(e => document.getElementById('am-email').textContent === e, who), tag + ' profile shows their email');
  // a faked admin copy doesn't unlock anything after the server check
  await p2.evaluate(() => { const s = JSON.parse(localStorage.getItem('ct.session')); s.role = 'admin'; localStorage.setItem('ct.session', JSON.stringify(s)); }); await p2.reload(); await p2.waitForTimeout(2200);
  ok(await p2.evaluate(() => document.getElementById('am-dev').hidden), tag + ' editing the copy on the device doesn\'t make you an admin');
  // used link
  const p3 = await ctx.newPage(); await p3.evaluate(() => {}).catch(() => {});
  await ctx.clearCookies(); await p3.goto('https://app.cardtab.app/'); await p3.evaluate(() => localStorage.clear()); await p3.goto(link); await p3.waitForTimeout(1500);
  ok(await p3.evaluate(() => !document.getElementById('view-auth').hidden && !document.getElementById('auth-err').hidden), tag + ' used link: sign-in page explains');
  ok(!errs.length, tag + ' no page errors ' + errs.slice(0, 2).join(' | '));
  await ctx.close();
}
console.log(out.join('\n')); await b.close();
