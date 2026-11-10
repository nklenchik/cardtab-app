/* The Worker keeps its own database tables up to date (v51.4), so an update never needs a database command run by hand.
   schema.sql only ever has "CREATE ... IF NOT EXISTS" statements, safe to run any number of times. A background run (every
   5 minutes) compares the file's fingerprint with the one saved last time and applies it only when it has changed: new
   tables appear within minutes of a deploy, and the rest of the time this costs one tiny read. */
import SQL from './schema-sql.js';
export function statements(sql = SQL) { return sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean); }
async function fingerprint(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); }
let applied = '';
export async function ensureSchema(env, sql = SQL) {
  const fp = await fingerprint(sql); if (applied === fp) return false;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS meta ( k TEXT PRIMARY KEY, v TEXT )').run();
  const row = await env.DB.prepare("SELECT v FROM meta WHERE k='schema'").first();
  if (row && row.v === fp) { applied = fp; return false; }
  await env.DB.batch(statements(sql).map(s => env.DB.prepare(s)));
  await env.DB.prepare("INSERT INTO meta (k,v) VALUES ('schema',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(fp).run();
  applied = fp; return true;
}
