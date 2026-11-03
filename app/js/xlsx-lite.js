/* Card Tab spreadsheet reader: Excel (.xlsx) and CSV, read entirely on the device.
   No outside library: an .xlsx file is a zip of XML files, so this unzips it with the browser's built-in
   DecompressionStream and reads the few parts Import needs: sheet names, cell values, dates and cell notes.
   Returns { sheets: [{ name, rows: [[value, ...], ...], notes: { "row,col": "text" } }] } with 0-based rows/cols.
   Dates come back as "YYYY-MM-DD" strings. */
(function (root) {
  'use strict';

  // ---------- zip ----------
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }
  async function unzip(buf) {
    const b = new Uint8Array(buf), v = new DataView(buf), files = {};
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not-a-zip');
    const count = v.getUint16(eocd + 10, true); let p = v.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
      const nlen = v.getUint16(p + 28, true), elen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
      files[name] = { method, data: b.subarray(start, start + csize) };
      p += 46 + nlen + elen + clen;
    }
    return {
      has: n => !!files[n],
      async text(n) { const f = files[n]; if (!f) return null; const raw = f.method === 8 ? await inflateRaw(f.data) : f.data; return dec.decode(raw); }
    };
  }

  // ---------- tiny XML helpers (the parts of these files are simple and machine-written) ----------
  const ent = s => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()] || (e[1] === 'x' || e[1] === 'X' ? String.fromCodePoint(parseInt(e.slice(2), 16)) : String.fromCodePoint(parseInt(e.slice(1), 10)))));
  const attr = (tag, a) => { const m = new RegExp('\\s' + a + '="([^"]*)"').exec(tag); return m ? ent(m[1]) : null; };
  const texts = xml => { let s = ''; xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (m, t) => { s += ent(t); }); return s; };
  const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const rowIndex = ref => parseInt(ref.replace(/[A-Z]+/gi, ''), 10) - 1;
  const resolve = (base, target) => { if (target.startsWith('/')) return target.slice(1); const parts = base.split('/').slice(0, -1); target.split('/').forEach(t => { if (t === '..') parts.pop(); else if (t !== '.') parts.push(t); }); return parts.join('/'); };
  function rels(xml) { const m = {}; if (xml) xml.replace(/<Relationship\b[^>]*>/g, t => { m[attr(t, 'Id')] = { target: attr(t, 'Target'), type: attr(t, 'Type') || '' }; }); return m; }

  const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
  const isDateFormat = code => /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')) && !/^[#0.,%\s]*$/.test(code);
  function serialToDate(n, d1904) {
    const ms = Math.round((n - (d1904 ? 24107 : 25569)) * 864e5); const d = new Date(ms);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  async function readXlsx(buf) {
    const z = await unzip(buf);
    const wb = await z.text('xl/workbook.xml'); if (!wb) throw new Error('not-xlsx');
    const d1904 = /date1904="(1|true)"/.test(wb);
    const wbRels = rels(await z.text('xl/_rels/workbook.xml.rels'));
    const shared = []; const ss = await z.text('xl/sharedStrings.xml');
    if (ss) ss.replace(/<si>([\s\S]*?)<\/si>/g, (m, si) => { shared.push(texts(si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''))); });
    // which cell styles are dates
    const dateXf = []; const st = await z.text('xl/styles.xml');
    if (st) {
      const custom = {}; st.replace(/<numFmt\b[^>]*>/g, t => { custom[attr(t, 'numFmtId')] = attr(t, 'formatCode') || ''; });
      const xfs = (/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st) || [])[1] || '';
      xfs.replace(/<xf\b[^>]*>/g, t => { const id = +attr(t, 'numFmtId'); dateXf.push(BUILTIN_DATE.has(id) || (custom[id] != null && isDateFormat(custom[id]))); });
    }
    const sheets = [];
    const list = []; wb.replace(/<sheet\b[^>]*>/g, t => list.push({ name: attr(t, 'name'), rid: attr(t, 'r:id') }));
    for (const sh of list) {
      const rel = wbRels[sh.rid]; if (!rel) continue;
      const path = resolve('xl/workbook.xml', rel.target), xml = await z.text(path); if (!xml) continue;
      const rows = [];
      xml.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (m, a, inner) => {
        const ref = attr(' ' + a, 'r'); if (!ref || inner == null) return;
        const t = attr(' ' + a, 't'), s = attr(' ' + a, 's');
        const vm = /<v>([\s\S]*?)<\/v>/.exec(inner); let val = null;
        if (t === 's') val = vm ? shared[+vm[1]] : null;
        else if (t === 'inlineStr') val = texts(inner);
        else if (t === 'str' || t === 'e') val = vm ? ent(vm[1]) : null;
        else if (t === 'b') val = vm ? vm[1] === '1' : null;
        else if (vm) { const n = parseFloat(vm[1]); val = s != null && dateXf[+s] && n > 0 && n < 2958466 ? serialToDate(n, d1904) : n; }
        if (val === null || val === '') return;
        const r = rowIndex(ref), c = colIndex(ref);
        (rows[r] = rows[r] || [])[c] = val;
      });
      for (let i = 0; i < rows.length; i++) rows[i] = rows[i] || [];
      // cell notes (Google Sheets and Excel both save notes as "comments")
      const notes = {}; const sRels = rels(await z.text(path.replace(/([^/]+)$/, '_rels/$1.rels')));
      for (const k in sRels) {
        if (!/\/comments$/.test(sRels[k].type)) continue;
        const cx = await z.text(resolve(path, sRels[k].target)); if (!cx) continue;
        cx.replace(/<comment\b([^>]*)>([\s\S]*?)<\/comment>/g, (m, a, inner) => { const ref = attr(' ' + a, 'ref'); if (ref) notes[rowIndex(ref) + ',' + colIndex(ref)] = texts(inner).replace(/\r\n?/g, '\n').trim(); });
      }
      sheets.push({ name: sh.name, rows, notes });
    }
    return { sheets };
  }

  // ---------- CSV ----------
  function readCsv(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return { sheets: [{ name: 'CSV', rows: rows.map(r => r.map(c => (c.trim() === '' ? undefined : c.trim()))), notes: {} }] };
  }

  async function read(file) {
    const name = (file.name || '').toLowerCase();
    if (/\.(csv|tsv|txt)$/.test(name)) return readCsv(await file.text());
    const buf = await file.arrayBuffer();
    const sig = new Uint8Array(buf, 0, 4);
    if (sig[0] === 0x50 && sig[1] === 0x4b) return readXlsx(buf);
    if (/\.xls$/.test(name)) { const err = new Error('old-xls'); err.code = 'old-xls'; throw err; }
    return readCsv(new TextDecoder().decode(buf));
  }

  root.CTSheet = { read, readXlsx, readCsv };
})(typeof window !== 'undefined' ? window : globalThis);
