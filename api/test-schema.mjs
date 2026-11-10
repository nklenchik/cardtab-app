// The Worker applies schema.sql by itself (v51.4): the copy matches the file, runs on a fresh database, and only re-runs when it changes.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import SQL from './src/schema-sql.js';
import { ensureSchema, statements } from './src/schema.js';
assert.equal(SQL, readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'), 'src/schema-sql.js is out of date: run node gen-schema.mjs');
assert.ok(statements().every(s => /^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS/i.test(s)), 'schema.sql must only have CREATE ... IF NOT EXISTS');
const sq = new DatabaseSync(':memory:'); let n = 0;
const stmt = sql => { n++; const o = { args: [], bind(...a) { o.args = a; return o; }, async first() { return sq.prepare(sql).get(...o.args) || null; }, async run() { sq.prepare(sql).run(...o.args); return {}; } }; return o; };
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); } } };
assert.equal(await ensureSchema(env), true, 'applied on a fresh database');
assert.ok(sq.prepare("SELECT name FROM sqlite_master WHERE name='an_copy'").get(), 'tables made');
n = 0; assert.equal(await ensureSchema(env), false); assert.equal(n, 0, 'same isolate: nothing at all');
assert.equal(await ensureSchema(env, SQL + '\nCREATE TABLE IF NOT EXISTS later_t ( a TEXT );'), true, 'a changed file is applied');
assert.ok(sq.prepare("SELECT name FROM sqlite_master WHERE name='later_t'").get());
console.log('schema tests ok:', statements().length, 'statements');
