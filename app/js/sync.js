/* Card Tab sync: keeps your entries and a few settings the same on every device you sign in on.
   Everything still saves on the device first (instant, works offline). This sends what changed to your account and
   brings back what changed elsewhere: right after you save, when the app opens or comes back to the front, when the
   connection returns, and every minute while it's open. The most recent edit of each entry wins.
   Only runs on the real app (app.cardtab.app) when you're signed in. */
(function () {
  'use strict';
  const S = window.CTStore, Sess = window.CTSession;
  if (!S || !Sess) return;
  let running = false, again = false, timer = 0, tick = 0, status = 'idle', lastOk = 0, listeners = new Set(), on = false;
  const set = s => { if (s === status) return; status = s; listeners.forEach(f => { try { f(s); } catch (e) {} }); };
  const offline = () => typeof navigator.onLine === 'boolean' && !navigator.onLine;

  async function run() {
    if (!on) return;
    if (running) { again = true; return; }
    if (offline()) { set(S._sync.dirty().length ? 'offline-pending' : 'offline'); return; }
    running = true; set('syncing');
    try {
      if (!S._sync.state()) { await S._sync.markAll(); await S._sync.setState({ cursor: 0 }); }   // first time on this device: send what's here
      for (let round = 0; round < 50; round++) {
        const st = S._sync.state() || { cursor: 0 }, list = S._sync.dirty().slice(0, 300), meta = S._sync.dirtyMeta();
        const j = await Sess.api('/auth/sync', { since: st.cursor || 0, entries: list, meta });
        await S._sync.apply(j.entries, j.meta);
        await S._sync.sent(list.filter(e => !(j.rejected || []).includes(e.id)), Object.keys(meta));
        await S._sync.setState({ cursor: j.seq, at: Date.now() });
        if (!j.more && !S._sync.dirty().length && !Object.keys(S._sync.dirtyMeta()).length) break;
      }
      lastOk = Date.now(); set('synced');
    } catch (e) {
      if (e && e.status === 401) { on = false; set('signed-out'); if (window.CTSync.onSignedOut) window.CTSync.onSignedOut(); }
      else set(offline() ? 'offline-pending' : 'error');
    } finally {
      running = false;
      if (again && on) { again = false; setTimeout(run, 300); }
    }
  }
  const soon = (ms) => { clearTimeout(timer); timer = setTimeout(run, ms == null ? 1200 : ms); };

  // saves made here go out a moment later; changes that came from sync don't trigger another send
  S.on(reason => { if (on && reason !== 'sync' && reason !== 'open' && reason !== 'remote') { if (status === 'synced' || status === 'idle') set('pending'); soon(); } }, true);   // every change, notifications too
  addEventListener('online', () => soon(200));
  addEventListener('offline', () => set(S._sync && S._sync.dirty().length ? 'offline-pending' : 'offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(300); });
  addEventListener('focus', () => soon(300));

  window.CTSync = {
    start() { if (!Sess.REAL) return; on = true; clearInterval(tick); tick = setInterval(() => { if (document.visibilityState === 'visible') run(); }, 60000); soon(50); },
    stop() { on = false; clearInterval(tick); clearTimeout(timer); set('idle'); },
    now: () => soon(0),
    status: () => status,
    lastOk: () => lastOk,
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    onSignedOut: null
  };
})();
