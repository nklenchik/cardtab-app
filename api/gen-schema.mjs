// Copies schema.sql into src/schema-sql.js so the Worker can apply it by itself (v51.4). Run after editing schema.sql:
//   node gen-schema.mjs        (test-schema.mjs fails if the two ever differ)
import { readFileSync, writeFileSync } from 'node:fs';
const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
writeFileSync(new URL('./src/schema-sql.js', import.meta.url), '// Generated from schema.sql by gen-schema.mjs. Do not edit here.\nexport default ' + JSON.stringify(sql) + ';\n');
console.log('src/schema-sql.js written');
