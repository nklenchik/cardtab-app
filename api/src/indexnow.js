/* IndexNow for cardtab.app (v52.45): tells Bing (and through it ChatGPT search and Copilot), Yandex and other IndexNow
   search engines when a page on the marketing site is new or changed, so they pick it up in hours instead of weeks.
   Runs from the 5-minute schedule, at most once an hour: reads https://cardtab.app/sitemap.xml, compares each page's
   lastmod with what it saw last time (D1 meta 'indexnow'), and sends only the new or changed pages. The site's sitemap
   generator (scripts/gen-sitemap.py) moves a page's lastmod only when its file changes, so nothing extra to do on deploy.
   The key isn't a secret: IndexNow checks it against https://cardtab.app/<key>.txt, which proves the site is ours. */
const KEY = '021474cf897ee23d3f727e31807fa8b7', HOST = 'cardtab.app';

export async function indexNow(env, t = Date.now()) {
  try {
    const hr = new Date(t).toISOString().slice(0, 13);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta ( k TEXT PRIMARY KEY, v TEXT )').run();
    const row = await env.DB.prepare("SELECT v FROM meta WHERE k='indexnow'").first();
    const st = row ? JSON.parse(row.v) : { hr: '', seen: {} };
    if (st.hr === hr) return { skipped: true };
    st.hr = hr;
    const r = await fetch('https://' + HOST + '/sitemap.xml', { cf: { cacheTtl: 0 } });
    let changed = [];
    if (r.ok) {
      const xml = await r.text(), seen = {};
      for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)) seen[m[1].trim()] = (m[2] || '').trim();
      changed = Object.keys(seen).filter(u => u.startsWith('https://' + HOST + '/') && st.seen[u] !== seen[u]);
      if (changed.length) {
        const res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: changed.slice(0, 10000) }) });
        if (res.ok || res.status === 202) st.seen = seen; else changed = [];   // try again next hour
        st.last = { at: t, status: res.status, n: changed.length };
      }
    }
    await env.DB.prepare("INSERT INTO meta (k,v) VALUES ('indexnow',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(st)).run();
    return { sent: changed.length };
  } catch (e) { return { error: String(e && e.message || e) }; }
}
