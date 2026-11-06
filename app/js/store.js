/* Card Tab local-first store (Drop 1).
   Everything lives on this device in IndexedDB, one database per signed-in account.
   Money is kept in whole cents (integers) so totals are exact, never floating-point estimates.
   Entries carry ids, timestamps and soft-delete flags so a sync backend can be added later without reshaping data.

   Plan rules
   - Free: 20 new entries per calendar month (local time). Warn at 17, block at 20, resets on the 1st.
     Adding (or duplicating) uses a slot, counted by when it was added (not its date, so backdating
     doesn't dodge the limit). Editing is free. Deleting an entry added this month gives its slot back;
     deleting an entry from an earlier month doesn't.
   - Premium: unlimited.
*/
(function () {
  'use strict';

  const FREE_LIMIT = 20, WARN_AT = 17;
  const TYPES = ['purchase', 'sale', 'refund'];
  const SCHEMA = 1;
  const DEFAULT_PLATFORMS = ['eBay', 'TCGplayer', 'Mercari', 'Whatnot', 'Card Show', 'Facebook Marketplace', 'Local game store', 'Other'];

  // ---------- small helpers ----------
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const ym = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  const today = () => ymd(new Date());
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const clone = o => JSON.parse(JSON.stringify(o));

  /* Parse what someone typed into whole cents without floating-point maths.
     Accepts "12", "12.5", "$1,204.99", "-3.10". Returns null if it isn't a money amount. */
  function toCents(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
    const s = String(input == null ? '' : input).replace(/[\s$,]/g, '').replace(/^−/, '-');
    const m = /^(-)?(\d*)(?:\.(\d{0,2})\d*)?$/.exec(s);
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) return null;
    const whole = parseInt(m[2] || '0', 10), frac = parseInt(((m[3] || '') + '00').slice(0, 2), 10);
    const c = whole * 100 + frac;
    return m[1] ? -c : c;
  }
  const fromCents = c => (c / 100).toFixed(2);

  function hashId(str) { // short, stable id for an account (used to name its database)
    let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // ---------- IndexedDB (falls back to memory only, with a warning) ----------
  function idbOpen(name) {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('no-idb'));
      const r = indexedDB.open(name, SCHEMA);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  // ---------- the store ----------
  const listeners = new Set();
  let db = null, chan = null, account = null, persistent = true;
  let entries = new Map();          // id -> entry (including soft-deleted)
  let meta = {};                    // k -> value
  const undoStack = [];             // [{label, run}]

  function emit(reason) { listeners.forEach(fn => { try { fn(reason); } catch (e) { console.error(e); } }); }

  async function putEntry(e) { entries.set(e.id, e); if (db) await reqP(db.transaction('entries', 'readwrite').objectStore('entries').put(e)); }
  async function dropEntry(id) { entries.delete(id); if (db) await reqP(db.transaction('entries', 'readwrite').objectStore('entries').delete(id)); }
  async function putMeta(k, v) { meta[k] = v; if (db) await reqP(db.transaction('meta', 'readwrite').objectStore('meta').put({ k, v })); }
  function changed(reason) { emit(reason); if (chan) chan.postMessage({ reason }); }

  async function loadAll() {
    entries = new Map(); meta = {};
    if (!db) return;
    const tx = db.transaction(['entries', 'meta']);
    const [es, ms] = await Promise.all([reqP(tx.objectStore('entries').getAll()), reqP(tx.objectStore('meta').getAll())]);
    es.forEach(e => entries.set(e.id, e));
    ms.forEach(m => { meta[m.k] = m.v; });
  }

  // ---------- validation ----------
  function normalize(input, base) {
    const e = Object.assign({}, base || {}, input);
    e.type = TYPES.includes(e.type) ? e.type : 'purchase';
    e.name = String(e.name || '').trim().slice(0, 300);
    e.platform = String(e.platform || '').trim().slice(0, 60);
    e.condition = String(e.condition || '').trim().slice(0, 40);
    e.note = String(e.note || '').trim().slice(0, 1000);
    e.qty = Math.max(1, Math.min(9999, parseInt(e.qty, 10) || 1));
    e.date = /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') ? e.date : today();
    e.amount = Number.isInteger(e.amount) ? e.amount : toCents(e.amount);
    // Sales keep the sale price, the platform's transaction fees and the seller's shipping cost, each to the cent.
    // What you keep (net) is worked out from those three. Older entries may only have net.
    const cents = v => (v === '' || v == null ? null : Number.isInteger(v) ? v : toCents(v));
    if (e.type === 'sale') {
      e.fees = cents(e.fees); e.ship = cents(e.ship);
      if (e.fees != null || e.ship != null || input.fees !== undefined || input.ship !== undefined) {
        e.fees = e.fees == null ? 0 : e.fees; e.ship = e.ship == null ? 0 : e.ship;
        if (e.amount != null) e.net = e.amount - e.fees - e.ship;
      } else { e.net = cents(e.net); }
    } else { e.net = null; e.fees = null; e.ship = null; }
    e.art = e.art || null;
    if (e.unmatched) e.unmatched = true; else delete e.unmatched;
    if (e.source != null) e.source = String(e.source).slice(0, 400);
    if (e.artSource != null) e.artSource = /^https?:\/\//i.test(e.artSource) ? String(e.artSource).slice(0, 500) : null;
    const errors = {};
    if (!e.name) errors.name = 'Add the card or item';
    if (e.amount == null || e.amount < 0) errors.amount = 'Enter an amount';
    if (e.type === 'sale') {
      if (e.fees != null && e.fees < 0) errors.fees = 'Fees can’t be negative';
      if (e.ship != null && e.ship < 0) errors.ship = 'Shipping can’t be negative';
      if (e.net == null && !errors.amount) errors.fees = 'Enter the fees and shipping';
    }
    return { e, errors, ok: !Object.keys(errors).length };
  }

  // ---------- plan + usage ----------
  function plan() { return meta.plan === 'premium' ? 'premium' : 'free'; }
  function usageRaw() {
    const u = meta.usage, m = ym(new Date());
    return u && u.month === m ? u : { month: m, used: 0 };
  }
  function usage() {
    const u = usageRaw(), p = plan(), now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const resetsOn = next.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    if (p === 'premium') return { plan: p, used: u.used, limit: Infinity, left: Infinity, warn: false, blocked: false, resetsOn };
    const left = Math.max(0, FREE_LIMIT - u.used);
    return { plan: p, used: u.used, limit: FREE_LIMIT, left, warn: u.used >= WARN_AT && u.used < FREE_LIMIT, blocked: u.used >= FREE_LIMIT, resetsOn };
  }
  async function bumpUsage(d) { const u = usageRaw(); await putMeta('usage', { month: u.month, used: Math.max(0, u.used + d) }); }

  // ---------- undo ----------
  function pushUndo(label, run) { undoStack.push({ label, run }); if (undoStack.length > 30) undoStack.shift(); }
  async function undo() {
    const u = undoStack.pop(); if (!u) return null;
    await u.run(); changed('undo'); return u.label;
  }

  // ---------- public API ----------
  const Store = {
    FREE_LIMIT, WARN_AT, toCents, fromCents, today, ymd,
    get persistent() { return persistent; },
    get account() { return account; },

    async open(acc) {
      account = acc;
      const name = 'cardtab-' + hashId((acc.email || acc.id || 'local').toLowerCase());
      try { db = await idbOpen(name); persistent = true; } catch (err) { db = null; persistent = false; console.warn('Card Tab: device storage unavailable, keeping entries in memory only', err); }
      await loadAll();
      if (!meta.createdAt) await putMeta('createdAt', new Date().toISOString());
      // count distinct days signed in (used to decide when Free users first see the Premium Import link)
      const days = (meta.signinDays || []).slice(-60), t = today();
      if (!days.includes(t)) { days.push(t); await putMeta('signinDays', days); }
      if (chan) chan.close();
      if ('BroadcastChannel' in window) {
        chan = new BroadcastChannel(name);
        chan.onmessage = async () => { await loadAll(); emit('remote'); }; // another tab changed something
      }
      undoStack.length = 0;
      emit('open');
    },
    close() { if (chan) chan.close(); chan = null; if (db) db.close(); db = null; entries = new Map(); meta = {}; undoStack.length = 0; },

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    all() { return [...entries.values()].filter(e => !e.deleted).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)); },
    get(id) { const e = entries.get(id); return e && !e.deleted ? clone(e) : null; },
    // Platforms used in entries, most used first (for filters)
    platforms() { const s = new Map(); this.all().forEach(e => { if (e.platform) s.set(e.platform, (s.get(e.platform) || 0) + 1); }); return [...s.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); },
    // Platforms someone added themselves. Saved in their own account only, never shared.
    customPlatforms() { return (meta.customPlatforms || []).slice(); },
    async addPlatform(name) {
      const n = String(name || '').trim().slice(0, 40); if (!n) return null;
      const all = DEFAULT_PLATFORMS.concat(meta.customPlatforms || []);
      const hit = all.find(p => p.toLowerCase() === n.toLowerCase()); if (hit) return hit;
      await putMeta('customPlatforms', (meta.customPlatforms || []).concat([n])); changed('platforms'); return n;
    },
    // Removing your own platform only takes it off the pickers; entries that already use it keep it
    async removePlatform(name) { await putMeta('customPlatforms', (meta.customPlatforms || []).filter(p => p !== name)); changed('platforms'); },
    // Everything to offer when picking a platform: ones you use most, then your own, then the standard list
    // the pickers end with their own "Other…" (type a platform), so a plain "Other" isn't listed separately
    pickerPlatforms() { return [...new Set(this.platforms().concat(meta.customPlatforms || [], DEFAULT_PLATFORMS))].filter(p => p.toLowerCase() !== 'other'); },
    DEFAULT_PLATFORMS,

    // ---------- import ----------
    // Fingerprint used to skip entries that are already in the account when the same file is imported again
    fingerprint(e) { return [e.date, e.type, e.amount, e.type === 'sale' ? e.net : '', String(e.source || e.name).toLowerCase().replace(/[^a-z0-9]+/g, '')].join('|'); },
    // Add many entries at once (Premium import). One Undo removes the whole import. Imports don't use Free entry slots.
    async importMany(list) {
      const t = new Date().toISOString(), ids = [];
      const rows = list.map(r => { const { e } = normalize(r); e.id = uid(); e.createdAt = t; e.updatedAt = t; e.deleted = false; e.counted = false; e.imported = true; ids.push(e.id); return e; });
      rows.forEach(e => entries.set(e.id, e));
      if (db) { const tx = db.transaction('entries', 'readwrite'), os = tx.objectStore('entries'); rows.forEach(e => os.put(e)); await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
      pushUndo('Import undone', async () => { for (const id of ids) await dropEntry(id); });
      changed('import'); return ids.length;
    },

    validate(input, base) { return normalize(input, base); },

    async add(input, opts) {
      const u = usage();
      if (u.blocked) { const err = new Error('limit'); err.code = 'limit'; throw err; }
      const { e, errors, ok } = normalize(input);
      if (!ok) { const err = new Error('invalid'); err.code = 'invalid'; err.errors = errors; throw err; }
      const t = new Date().toISOString();
      e.id = uid(); e.createdAt = t; e.updatedAt = t; e.deleted = false; e.counted = true;
      await putEntry(e); await bumpUsage(1);
      pushUndo((opts && opts.label) || 'Entry added', async () => { await dropEntry(e.id); await bumpUsage(-1); });
      changed('add'); return clone(e);
    },

    async update(id, patch) {
      const cur = entries.get(id); if (!cur || cur.deleted) throw new Error('missing');
      const before = clone(cur);
      const { e, errors, ok } = normalize(patch, cur);
      if (!ok) { const err = new Error('invalid'); err.code = 'invalid'; err.errors = errors; throw err; }
      e.updatedAt = new Date().toISOString();
      await putEntry(e);
      pushUndo('Changes saved', async () => { before.updatedAt = new Date().toISOString(); await putEntry(before); });
      changed('update'); return clone(e);
    },

    async remove(id) {
      const cur = entries.get(id); if (!cur || cur.deleted) return;
      const e = Object.assign(clone(cur), { deleted: true, updatedAt: new Date().toISOString() });
      // An entry added this month gives its slot back when deleted. Older entries don't (that month is over).
      const giveBack = e.counted !== false && String(e.createdAt).slice(0, 7) === ym(new Date());
      await putEntry(e);
      if (giveBack) await bumpUsage(-1);
      pushUndo('Entry deleted', async () => { e.deleted = false; e.updatedAt = new Date().toISOString(); await putEntry(e); if (giveBack) await bumpUsage(1); });
      changed('remove');
    },

    async duplicate(id) {
      const cur = this.get(id); if (!cur) return null;
      const copy = { type: cur.type, name: cur.name, platform: cur.platform, condition: cur.condition, qty: cur.qty, amount: cur.amount, net: cur.net, fees: cur.fees, ship: cur.ship, art: cur.art, note: cur.note, date: today() };
      return this.add(copy, { label: 'Entry duplicated' });
    },

    undo, canUndo: () => undoStack.length > 0, undoLabel: () => (undoStack.length ? undoStack[undoStack.length - 1].label : ''),

    plan, usage,
    // Monthly budget for cards (cents). null when not set. alert = the one-time heads-up at 80%.
    budget() { const b = meta.budget; return b && b.cents > 0 ? { cents: b.cents, alert: b.alert !== false } : null; },
    async setBudget(b) { await putMeta('budget', b && b.cents > 0 ? { cents: Math.round(b.cents), alert: b.alert !== false } : null); changed('budget'); },
    budgetFlag(k) { return (meta.budgetFlags || {})[k]; },
    async setBudgetFlag(k, v) { await putMeta('budgetFlags', Object.assign({}, meta.budgetFlags, { [k]: v })); },
    async setPlan(p) { await putMeta('plan', p === 'premium' ? 'premium' : 'free'); changed('plan'); },

    /* Free users don't see Import at first. A Premium-tagged Import appears after 3 different days
       signed in, or when they're near the limit late in the month. Premium sees it from day one. */
    showImport() {
      if (plan() === 'premium') return true;
      const u = usage(), d = new Date().getDate();
      return (meta.signinDays || []).length >= 3 || (u.used >= WARN_AT && d >= 20);
    },

    // Totals for a list of entries, in cents
    totals(list) {
      let sales = 0, after = 0, bought = 0, refunds = 0, fees = 0;
      list.forEach(e => {
        if (e.type === 'sale') { sales += e.amount; after += e.net; fees += e.amount - e.net; }
        else if (e.type === 'purchase') bought += e.amount;
        else if (e.type === 'refund') refunds += e.amount;
      });
      // A refund is money you paid back to a buyer on a sale, so it comes out of what you kept (as in Nick's Cash Flow sheet).
      // A refund you receive on a purchase is handled by editing that purchase.
      after -= refunds;
      const spent = bought;
      return { sales, after, spent, profit: after - spent, fees, refunds, entries: list.length };
    },

    exportCSV() {
      const cols = ['date', 'type', 'platform', 'name', 'qty', 'amount', 'fees', 'shipping', 'after_fees', 'condition', 'note'];
      const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const rows = this.all().slice().reverse().map(e => [e.date, e.type, e.platform, e.name, e.qty, fromCents(e.amount), e.type === 'sale' && e.fees != null ? fromCents(e.fees) : '', e.type === 'sale' && e.ship != null ? fromCents(e.ship) : '', e.type === 'sale' ? fromCents(e.net) : '', e.condition, e.note].map(q).join(','));
      return [cols.join(',')].concat(rows).join('\n');
    },

    // ---------- small per-account settings (notifications and the like) ----------
    meta(k) { const v = meta[k]; return v == null ? null : clone(v); },
    async setMeta(k, v) { await putMeta(k, v); changed('meta'); },
    // Unmatched cards: Fix sets the card's name and art (never the amounts); Leave keeps it as typed. One Undo puts it back.
    async matchCard(id, patch) {
      const cur = entries.get(id); if (!cur || cur.deleted) return null;
      const before = clone(cur), e = Object.assign(clone(cur), patch || {}, { updatedAt: new Date().toISOString() });
      delete e.unmatched; await putEntry(e);
      pushUndo(patch ? 'Card fixed' : 'Kept as typed', async () => { before.updatedAt = new Date().toISOString(); await putEntry(before); });
      changed('update'); return clone(e);
    },

    // ---------- testing tools (local mode only) ----------
    async _setUsage(n) { await putMeta('usage', { month: ym(new Date()), used: n }); changed('usage'); },
    async _loadSample(rows) {
      const t = new Date().toISOString();
      for (const r of rows) { const { e } = normalize(r); e.id = uid(); e.createdAt = t; e.updatedAt = t; e.deleted = false; e.counted = false; await putEntry(e); }
      changed('sample');
    },
    async _clearAll() {
      for (const id of [...entries.keys()]) await dropEntry(id);
      const keep = { createdAt: meta.createdAt, signinDays: meta.signinDays, plan: meta.plan };
      if (db) await reqP(db.transaction('meta', 'readwrite').objectStore('meta').clear());
      meta = {}; for (const k in keep) if (keep[k] !== undefined) await putMeta(k, keep[k]);
      undoStack.length = 0; changed('clear');
    },
    async _setSigninDays(days) { await putMeta('signinDays', days); changed('meta'); }
  };

  window.CTStore = Store;
})();
