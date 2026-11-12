// v52.38 Face ID / Touch ID end to end: the real app (served as app.cardtab.app) and the real Worker (in this process,
// on an in-memory database), with Chrome's virtual authenticator standing in for Touch ID on a Mac.
// Turn it on in Settings → Account, sign out, sign in with Touch ID, remove it. node tests/passkey-e2e.mjs
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import worker from '../api/src/index.js';
const sq = new DatabaseSync(':memory:'); sq.exec(readFileSync(new URL('../api/schema.sql', import.meta.url), 'utf8'));
const stmt = (sql) => { const o = { sql, args: [], bind(...a) { o.args = a; return o; },
  async first() { return sq.prepare(sql).get(...o.args) || null; }, async all() { return { results: sq.prepare(sql).all(...o.args) }; }, async run() { const r = sq.prepare(sql).run(...o.args); return { meta: { changes: r.changes } }; } }; return o; };
const mails = [];
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; } }, APP_URL: 'https://app.cardtab.app', API_URL: 'https://api.cardtab.app', ADMIN_EMAILS: '', EMAIL: { async send(m) { mails.push(m); } } };
const OUT = process.argv[2] || 'tests/out-qa', DARK = process.argv.includes('dark'), PHONE = process.argv.includes('phone'), DROID = process.argv.includes('android');
const res = []; const ok = (c, m) => { const l = (c ? 'PASS ' : 'FAIL ') + m; res.push(l); console.error(l); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: PHONE ? { width: 390, height: 844 } : { width: 1280, height: 900 }, colorScheme: DARK ? 'dark' : 'light', hasTouch: PHONE, isMobile: PHONE,
  userAgent: DROID ? 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36' : PHONE ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' });
await ctx.route('https://app.cardtab.app/**', async r => { const u = new URL(r.request().url()); let f = 'app' + (u.pathname === '/' ? '/index.html' : u.pathname); if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
  const ty = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', json: 'application/json', webmanifest: 'application/manifest+json', woff2: 'font/woff2' }[f.split('.').pop()] || 'application/octet-stream';
  r.fulfill({ status: 200, contentType: ty, body: readFileSync(f) }); });
await ctx.route('https://api.cardtab.app/**', async r => { const q = r.request(), h = await q.allHeaders();
  const resp = await worker.fetch(new Request(q.url(), { method: q.method(), headers: { ...h, 'cf-connecting-ip': '9.9.9.9' }, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() }), env, { waitUntil() {} });
  const hh = {}; resp.headers.forEach((v, k) => { hh[k] = v; }); r.fulfill({ status: resp.status, headers: hh, body: Buffer.from(await resp.arrayBuffer()) }); });
await ctx.route(/^https:\/\/(?!app\.|api\.)/, r => r.fulfill({ status: 204, body: '' }));
const TAG = (DARK ? '-d' : '') + (PHONE ? '-p' : '') + (DROID ? '-a' : '');
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
await p.goto('https://app.cardtab.app/'); await p.waitForTimeout(1500);
ok(await p.locator('.auth-pk').isHidden(), 'sign-in: no Touch ID button before it’s turned on');
// sign in by email code
await p.fill('#auth-email', 'mac@x.test'); await p.click('#auth-go'); await p.waitForTimeout(600);
const code = /\b(\d{6})\b/.exec(mails.at(-1).text)[1]; await p.fill('#auth-code', code); await p.waitForTimeout(2500);
await p.evaluate(() => { localStorage.setItem('ct.tips', JSON.stringify({ off: 1 })); document.querySelectorAll('.cbhint,.ins').forEach(x => x.remove()); });
// Settings → Account
const openAccount = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(400); await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.getElementById('app-avatar').click(); }); await p.waitForTimeout(600); await p.evaluate(() => document.querySelector('[data-amp=account]').click()); await p.waitForTimeout(1200); };
await openAccount();
ok(await p.locator('#am-pkadd').isVisible(), 'Account offers: ' + (await p.locator('#am-pkadd').innerText()).replace(/\n/g, ' · ') + ' | section: ' + await p.locator('#am-pk-l').innerText());
await p.screenshot({ path: OUT + '/pk-account-before' + TAG + '.png' });
await p.click('#am-pkadd'); await p.waitForTimeout(1500);
ok(await p.locator('.am-pkr').count() === 1, 'the device is listed after turning it on: ' + (await p.locator('.am-pkr').first().innerText().catch(() => '')).replace(/\n/g, ' · '));
ok(await p.locator('#am-pkadd').count() === 0, 'no “add” once this device is set up');
await p.screenshot({ path: OUT + '/pk-account-after' + TAG + '.png' });
// the lock: turn it on (asks once), pick 15 minutes
await p.click('#am-lock'); await p.waitForTimeout(800);
ok(await p.locator('#am-lock').getAttribute('aria-checked') === 'true', 'lock switch on: ' + (await p.locator('.am-lockr').first().innerText()).replace(/\n/g, ' · '));
await p.click('[data-lockt="900"]'); await p.waitForTimeout(300);
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ct.lock')).after) === 900, 'picked 15 minutes');
await p.screenshot({ path: OUT + '/pk-lockrow' + TAG + '.png' });
// reopen the app: locked; Face ID fails first (stays locked), then works
await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
await p.reload(); await p.waitForTimeout(2000);
ok(await p.evaluate(() => document.documentElement.classList.contains('ct-locked')) && await p.locator('#ct-lock').isVisible(), 'opening the app shows the lock: ' + (await p.locator('#ct-lock').innerText()).replace(/\n/g, ' · '));
await p.screenshot({ path: OUT + '/pk-lock' + TAG + '.png' });
await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true });
await p.click('[data-lk=go]'); await p.waitForTimeout(1200);
ok(!(await p.evaluate(() => document.documentElement.classList.contains('ct-locked'))), 'unlocked with ' + await p.evaluate(() => CTPasskey.kindName()));
// back from another app after 1 minute: no lock (15 min); after 20 minutes: lock
const away = async ms => p.evaluate(ms => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
  localStorage.setItem('ct.lock.at', String(Date.now() - ms)); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }, ms);
await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
await away(60e3); await p.waitForTimeout(500); ok(!(await p.evaluate(() => document.documentElement.classList.contains('ct-locked'))), 'back after 1 minute: no lock');
await away(20 * 60e3); await p.waitForTimeout(500); ok(await p.evaluate(() => document.documentElement.classList.contains('ct-locked')), 'back after 20 minutes: locked');
await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true }); await p.click('[data-lk=go]'); await p.waitForTimeout(1000);
await p.evaluate(() => localStorage.setItem('ct.lock', JSON.stringify({ on: true, after: 0 })));
await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
await away(2e3); await p.waitForTimeout(500); ok(await p.evaluate(() => document.documentElement.classList.contains('ct-locked')), 'every time: back after 2 seconds: locked');
await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true }); await p.click('[data-lk=go]'); await p.waitForTimeout(1000);
// sign out, then sign in with Touch ID
await p.evaluate(() => { window.CTSession.signOut(); }); await p.goto('https://app.cardtab.app/'); await p.waitForTimeout(1500);
ok(await p.locator('.auth-pk').isVisible(), 'sign-in: “' + (await p.locator('.auth-pk').innerText().catch(() => '')) + '” shows under Google');
const order = await p.evaluate(() => { const g = document.querySelector('.auth-g:not(.auth-pk)'), k = document.querySelector('.auth-pk'); return g.getBoundingClientRect().top < k.getBoundingClientRect().top; });
ok(order, 'Google stays first');
await p.screenshot({ path: OUT + '/pk-signin' + TAG + '.png' });
await p.click('.auth-pk'); await p.waitForTimeout(2500);
const who = await p.evaluate(() => (window.CTSession.current() || {}).email);
ok(who === 'mac@x.test', 'signed in with Touch ID as ' + who);
// remove it
await openAccount();
await p.click('.am-pkx'); await p.waitForTimeout(200); await p.click('.am-pkx'); await p.waitForTimeout(1500);
ok(await p.locator('.am-pkr').count() === 0 && await p.locator('#am-pkadd').isVisible(), 'removed; the add button is back');
ok(!(await p.evaluate(() => localStorage.getItem('ct.lock'))), 'removing this device turns the lock off');
ok(sq.prepare('SELECT COUNT(*) n FROM passkeys').get().n === 0, 'removed on the server');
ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
await b.close();
