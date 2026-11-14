/* Add from photo (v52.96; v52.98 photo check; v52.99 cards appear as they're read, Undo, learns from every scan).
   Before anything is sent, each photo is checked on the phone for blur, darkness and size (Retake or Use anyway); the
   card reader then says if a photo had glare or cards too far away, and photos it couldn't read don't count.
   Snap or pick up to 4 photos (a binder page, cards on a table, slabs, sealed product). The server reads what's on them
   (/auth/scan, Claude), each item is matched against the card catalog the same way typing a card is (CardLookup.remote),
   and a review sheet lists them. Nothing is added until you press Add: fix or remove any row, then fill in the purchase
   (or sale) once for the whole lot. The lot price is split evenly, or you type a price per item.
   Open it with CTScan.open() (Add sheet's camera button, Ask's camera button). */
(function () {
  'use strict';
  const S = window.CTStore;
  const $ = id => document.getElementById(id);
  const MAX = 4, EDGE = 1568;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = c => '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const listName = c => [c.n, c.num, c.s].filter(Boolean).join(' - ');
  const URL_ = () => window.CT_SCAN_URL || (window.CTSession && window.CTSession.REAL ? window.CTSession.API + '/auth/scan' : '');
  const st = { rows: [], type: 'purchase', mode: 'lot', busy: false, info: null, fixing: -1, tok: 0 };
  let dlg = null;

  // ---------- the sheet ----------
  function build() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog'); dlg.className = 'ed scan'; dlg.id = 'scan'; dlg.setAttribute('aria-label', 'Add from photo');
    dlg.innerHTML = '<div class="ed-form scan-form" id="scan-form">' +
      '<div class="scan-top"><h2 id="scan-h">Add from photo</h2><button type="button" class="ed-x" data-scan-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<section class="scan-step" id="scan-s1"><div class="scan-shots" id="scan-shots"></div><p class="scan-wait" id="scan-wait" aria-live="polite">Reading your cards…</p><p class="scan-tip" id="scan-tip1">Up to 4 cards a photo, in good light.</p><p class="scan-err" id="scan-err" role="alert" hidden></p>' +
        '<div class="scan-acts" id="scan-retry" hidden><label class="scan-btn ghost">Choose other photos<input type="file" accept="image/*" multiple data-scan-file></label></div>' +
        '<div class="scan-acts two" id="scan-chk" hidden><label class="scan-btn">Retake<input type="file" accept="image/*" multiple data-scan-file></label><button type="button" class="scan-btn ghost" data-scan-anyway>Use anyway</button></div>' +
        '<div class="scan-acts" id="scan-up" hidden><button type="button" class="scan-btn ghost up" data-scan-up>See Premium</button></div></section>' +
      '<section class="scan-step" id="scan-s2" hidden>' +
        '<p class="scan-sub" id="scan-sub"></p>' +
        '<div class="scan-rows" id="scan-rows"></div>' +
        '<p class="scan-tip">Up to 4 cards a photo reads best.</p><label class="scan-more"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add another photo<input type="file" accept="image/*" multiple data-scan-file data-add="1"></label>' +
        '<div class="scan-sec"><div class="scan-lab">Details for all of them</div>' +
          '<div class="scan-seg" id="scan-type" role="group" aria-label="Purchase or sale"><button type="button" data-v="purchase" aria-pressed="true">Purchase</button><button type="button" data-v="sale" aria-pressed="false">Sale</button></div>' +
          '<div class="scan-two"><label class="scan-f"><span>Platform</span><select id="scan-plat"></select></label><label class="scan-f"><span>Date</span><input type="date" id="scan-date"></label></div>' +
          '<div class="scan-seg sm" id="scan-mode" role="group" aria-label="How you paid"><button type="button" data-v="lot" aria-pressed="true">One price for all</button><button type="button" data-v="each" aria-pressed="false">Price each</button></div>' +
          '<div class="scan-two" id="scan-lotw"><label class="scan-f"><span id="scan-tlab">Total paid</span><span class="scan-in"><i>$</i><input id="scan-total" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"></span></label></div>' +
          '<div class="scan-two" id="scan-salew" hidden><label class="scan-f"><span>Fees, all together</span><span class="scan-in"><i>$</i><input id="scan-fees" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"></span></label><label class="scan-f"><span>Your shipping</span><span class="scan-in"><i>$</i><input id="scan-ship" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"></span></label></div>' +
          '</div>' +
        '<p class="scan-err" id="scan-err2" role="alert" hidden></p>' +
        '<p class="scan-left" id="scan-left"></p>' +
        '<div class="scan-bar"><p class="scan-sum" id="scan-sum" aria-live="polite"></p><button type="button" class="scan-btn" id="scan-go" disabled>Add</button></div>' +
      '</section></div>';
    document.body.appendChild(dlg);
    dlg.querySelectorAll('[data-scan-close]').forEach(b => b.addEventListener('click', close));
    dlg.querySelector('[data-scan-up]').addEventListener('click', () => { close(); if (window.CTAddSheet && window.CTAddSheet.isOpen) window.CTAddSheet.close(); setTimeout(() => window.CTPremiumOpen && window.CTPremiumOpen('scan'), 260); });
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
    dlg.querySelector('[data-scan-anyway]').addEventListener('click', () => { const p = st.pending; st.pending = null; if (p) run(p.files, p.adding, true); });
    dlg.addEventListener('change', e => { const f = e.target.closest('[data-scan-file]'); if (f && f.files && f.files.length) { const files = [...f.files]; const add = !!f.dataset.add; f.value = ''; run(files, add); } });
    seg('scan-type', v => { st.type = v; paint(); });
    seg('scan-mode', v => { st.mode = v; paint(); });
    ['scan-total', 'scan-fees', 'scan-ship'].forEach(id => { const el = $(id); el.addEventListener('input', sums); el.addEventListener('blur', () => { const c = S.toCents(el.value); if (c != null && c >= 0 && el.value.trim()) el.value = S.fromCents(c); }); });
    $('scan-go').addEventListener('click', addAll);
    $('scan-rows').addEventListener('click', onRow);
    swipe($('scan-rows'));
    $('scan-rows').addEventListener('input', e => { if (e.target.matches('[data-price]')) sums(); if (e.target.matches('[data-q]')) findSoon(+e.target.dataset.q, e.target.value); });
    $('scan-rows').addEventListener('keydown', e => { if (e.target.matches('[data-q]') && e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); st.fixing = -1; paintRows(); } });
    return dlg;
  }
  function seg(id, on) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); on(b.dataset.v); }); }
  function step(n) { $('scan-s1').hidden = n !== 1; $('scan-s2').hidden = n !== 2; }

  // ---------- photos: shrink, send, match ----------
  async function shrink(file) {
    let bmp = null;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { bmp = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(file); }); }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, EDGE / Math.max(w, h));
    const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, cv.width, cv.height);
    return { url: cv.toDataURL('image/jpeg', 0.85), q: assess(cv, Math.min(w, h)) };
  }
  // v52.98 photo check, on the phone: sharpness (how much fine edge detail there is, the variance of a Laplacian over a
  // 640px greyscale copy, read from the sharpest part of the photo so a plain table around the cards doesn't count against
  // it), brightness, and size. Thresholds are set loose: only clearly bad photos are stopped, and Use anyway is always there.
  const Q = { blur: 450, dark: 45, small: 600 };   // calibrated: a card number stops being readable well before sharpness drops to ~1100; 450 only stops clearly blurry photos
  function assess(src, short) {
    const k = Math.min(1, 640 / Math.max(src.width, src.height)), w = Math.max(8, Math.round(src.width * k)), h = Math.max(8, Math.round(src.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data, y = new Float32Array(w * h);
    let sum = 0; for (let i = 0, p = 0; i < y.length; i++, p += 4) { y[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]; sum += y[i]; }
    // sharpness per tile (4 x 4), keep the sharpest quarter of the tiles: the cards are the detailed part of the photo
    const T = 4, tv = [];
    for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
      const x0 = Math.max(1, Math.floor(tx * w / T)), x1 = Math.min(w - 1, Math.floor((tx + 1) * w / T)), y0 = Math.max(1, Math.floor(ty * h / T)), y1 = Math.min(h - 1, Math.floor((ty + 1) * h / T));
      let n = 0, m = 0, m2 = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = yy * w + xx, L = y[i - 1] + y[i + 1] + y[i - w] + y[i + w] - 4 * y[i]; n++; m += L; m2 += L * L; }
      if (n) { m /= n; tv.push(m2 / n - m * m); }
    }
    tv.sort((a, b) => b - a); const top = tv.slice(0, Math.max(1, Math.round(tv.length / 4))), sharp = top.reduce((a, v) => a + v, 0) / top.length;
    const bright = sum / y.length, issues = [];
    if (short < Q.small) issues.push('small'); else if (bright < Q.dark) issues.push('dark'); else if (sharp < Q.blur) issues.push('blurry');
    return { sharp: Math.round(sharp), bright: Math.round(bright), short, issues };
  }
  const SAY = { blurry: 'looks blurry', dark: 'is too dark', small: 'is too small', glare: 'has glare on the cards', far: 'has the cards too far away', cut: 'has cards cut off at the edge', unreadable: 'couldn’t be read' };
  const FIX = { blurry: 'Hold steady and tap the screen to focus on the cards.', dark: 'Try brighter light, or turn on the flash with the cards out of their sleeves.', small: 'Use the camera’s full-size photo rather than a screenshot or thumbnail.', glare: 'Tilt the cards or the phone a little so the light doesn’t reflect on them.', far: 'Move closer so the cards fill most of the photo.', cut: 'Step back a little so every card is fully in the photo.', unreadable: 'Try closer, in good light, with the card numbers in focus.' };
  const LABEL = { blurry: 'Blurry', dark: 'Too dark', small: 'Too small', glare: 'Glare', far: 'Too far', cut: 'Cut off', unreadable: 'Unreadable' };
  function issueText(list, n) {
    // list: [{photo, problem}] ; n photos in the batch
    const p = list[0], who = n > 1 ? 'Photo ' + p.photo : 'That photo';
    const more = list.length > 1 ? ' ' + list.slice(1).map(x => 'Photo ' + x.photo + ' ' + SAY[x.problem] + '.').join(' ') : '';
    return who + ' ' + SAY[p.problem] + '. ' + FIX[p.problem] + more;
  }
  const WHY = { limit: 'limit', busy: 'Card reading is busy right now. Try again in a minute.', key: 'Card reading isn’t available right now.', billing: 'Card reading isn’t available right now.', setup: 'Card reading isn’t set up yet.', offline: 'You look offline. Connect and try again.', failed: 'Those photos couldn’t be read. Try again, or try a clearer photo.' };
  async function run(files, adding, force) {
    files = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || '')).slice(0, MAX);
    if (!files.length) return;
    build(); if (!dlg.open) show();
    const tok = ++st.tok;
    if (!adding) { sendAll(0); st.rows = []; st.gone = []; st.fixing = -1; }
    step(adding && st.rows.length ? 2 : 1);
    $('scan-err').hidden = true; $('scan-retry').hidden = true; $('scan-up').hidden = true; $('scan-chk').hidden = true; $('scan-wait').hidden = false; $('scan-shots').classList.remove('done'); $('scan-wait').textContent = files.length > 1 ? 'Reading ' + files.length + ' photos…' : 'Reading your cards…';
    if (adding && st.rows.length) { $('scan-sub').textContent = 'Reading the new photo…'; $('scan-go').disabled = true; }
    let shots = [];
    try { shots = await Promise.all(files.map(shrink)); } catch (e) { return fail('That photo couldn’t be opened. Try a JPEG or PNG.', tok); }
    if (tok !== st.tok) return;
    const imgs = shots.map(s => s.url);
    if (window.CT_SCAN_DEBUG) console.log('photo check', JSON.stringify(shots.map(s => s.q)));
    // the photo check: stop clearly bad photos before they use a scan (Retake, or Use anyway)
    const bad = shots.map((s, i) => ({ photo: i + 1, problem: s.q.issues[0] })).filter(x => x.problem);
    if (bad.length && !force) {
      step(1); $('scan-wait').hidden = true; $('scan-tip1').hidden = true;
      $('scan-shots').classList.add('done');
      $('scan-shots').innerHTML = shots.map((s, i) => '<span class="scan-shot' + (s.q.issues.length ? ' bad' : '') + '"><img src="' + s.url + '" alt="" draggable="false"><i></i>' + (s.q.issues.length ? '<b>' + LABEL[s.q.issues[0]] + '</b>' : '') + '</span>').join('');
      const e = $('scan-err'); e.textContent = issueText(bad, shots.length) + ' A clear photo gets better matches and doesn’t waste a scan.'; e.hidden = false;
      st.pending = { files, adding }; $('scan-chk').hidden = false; $('scan-chk').querySelector('[data-scan-file]').dataset.add = adding ? '1' : '';
      return;
    }
    $('scan-tip1').hidden = false;
    if (!adding || !st.rows.length) $('scan-shots').innerHTML = imgs.map(u => '<span class="scan-shot"><img src="' + u + '" alt="" draggable="false"><i></i></span>').join('');
    const url = URL_();
    if (!url) return fail('Add from photo works once you’re signed in.', tok);
    // already known to be out of scans this month: say so before sending anything
    if (st.info && st.info.left != null && st.info.left < imgs.length && !st.info.admin) { if (st.info.left > 0) return fail('You have ' + st.info.left + (st.info.left === 1 ? ' photo scan' : ' photo scans') + ' left this month. Pick fewer photos.', tok, true); st.info.left = 0; return limitFail(tok); }
    // v52.99: streamed. Each card shows as soon as it's read (a placeholder row first, filled in when it's matched)
    const batch = { scan: null, sent: false }, startN = st.rows.length;
    let r, j = null, n = 0;
    try { r = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ images: imgs, stream: true }) }); }
    catch (e) { return fail(WHY.offline, tok); }
    if (tok !== st.tok) return;
    const fills = [];
    const add = it => {
      const row = { it, card: null, list: [], check: true, price: '', idx: n++, batch, loading: true };
      st.rows.push(row);
      if (st.rows.length === startN + 1) { step(2); st.streaming = true; }
      fills.push(match(it).then(m => { if (tok !== st.tok) return; Object.assign(row, m, { idx: row.idx, batch, loading: false, price: row.price }); row.orig = row.card; row.auto = !!row.card && !row.check; paint(); }));
      paint();
    };
    if (r.ok && /ndjson/.test(r.headers.get('content-type') || '') && r.body && r.body.getReader) {
      st.streaming = true;
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      try {
        for (;;) {
          const { value, done } = await rd.read(); if (done) break;
          if (tok !== st.tok) { try { rd.cancel(); } catch (e) {} return; }
          buf += dec.decode(value, { stream: true });
          let nl; while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue;
            let o; try { o = JSON.parse(line); } catch (e) { continue; }
            if (o.item) add(o.item); else if (o.done) j = o.done; else if (o.error) j = { error: o.error };
          }
        }
      } catch (e) { if (!j) j = { error: 'offline' }; }
    } else {
      j = await r.json().catch(() => ({}));
      if (r.ok) (j.items || []).forEach(add);
      else j.status = r.status;
    }
    st.streaming = false;
    if (tok !== st.tok) return;
    j = j || { error: 'failed' };
    if (j.limit != null) st.info = { left: j.left, limit: j.limit, resets: j.resets, plan: j.plan };
    if (j.error) {
      if (n) { paint(); }
      if (j.error === 'limit') return limitFail(tok);
      return fail(WHY[j.error] || (j.status ? j.error : '') || WHY.failed, tok);
    }
    batch.scan = j.scan || null;
    // the final list is the server's: add anything the stream didn't deliver
    const items = j.items || [];
    for (let k = n; k < items.length; k++) add(items[k]);
    await Promise.all(fills);
    if (tok !== st.tok) return;
    // what earlier scans learned: when people keep fixing this exact read to one card, start on that card
    await Promise.all(items.map(async (it, k) => {
      if (!it.learned) return; const row = st.rows.find(x => x.batch === batch && x.idx === k); if (!row) return;
      row.it.learned = it.learned;
      if (row.card && listName(row.card) === it.learned) { row.check = false; row.auto = true; row.orig = row.card; return; }
      const p = window.CardParser ? window.CardParser.parse(it.learned.replace(/ - /g, ' ')) : { name: it.learned };
      const res = window.CardLookup ? await window.CardLookup.remote(p) : { list: [] };
      const hit = (res.list || []).find(c => listName(c) === it.learned);
      if (hit) { row.card = hit; row.orig = hit; row.check = false; row.auto = true; row.list = [hit].concat((row.list || []).filter(c => c !== hit)).slice(0, 6); }
    }));
    if (tok !== st.tok) return;
    const issues = (j.issues || []).filter(x => SAY[x.problem]);
    st.crowded = (j.crowded || []).length;
    const free = j.uncounted ? ' ' + (j.uncounted === imgs.length ? (imgs.length > 1 ? 'They didn’t' : 'It didn’t') : j.uncounted + (j.uncounted === 1 ? ' photo didn’t' : ' photos didn’t')) + ' count toward your scans.' : '';
    if (!items.length && st.rows.length === startN) { sendFeedback(batch, 0); if (!st.rows.length) return fail((issues.length ? issueText(issues, imgs.length) : 'No cards found in ' + (imgs.length > 1 ? 'those photos' : 'that photo') + '. Try closer, with the card numbers in focus and no glare.') + free, tok, true); }
    step(2); paint();
    const notes = [];
    if (st.crowded) notes.push((st.crowded > 1 ? 'Some photos had' : 'That photo had') + ' more than 4 cards, so the first 4 were read. Add another photo for the rest.');
    if (issues.length) notes.push(issueText(issues, imgs.length) + ' Some cards may be missing or need a check.' + free);
    if (notes.length) { const e2 = $('scan-err2'); e2.textContent = notes.join(' '); e2.hidden = false; e2.classList.add('note'); }
    window.CTTrack && window.CTTrack.ev && window.CTTrack.ev('scan', String(items.length));
  }
  // v52.99 learning: how the list was used goes back to the server (never the photo): which matches were kept, changed,
  // removed or typed in, and whether the lot was added. Repeated fixes are used to pick the right card on later scans.
  function outcome(r) { if (r.gone) return 'removed'; if (r.typed) return 'typed'; if (r.card && r.card !== r.orig) return 'changed'; if (r.card) return 'kept'; return 'unmatched'; }
  function sendFeedback(batch, added) {
    if (!batch || batch.sent || !batch.scan) return; batch.sent = true;
    const url = URL_(); if (!url) return;
    const rows = st.rows.concat(st.gone || []).filter(r => r.batch === batch && !r.loading).map(r => ({ i: r.idx, outcome: outcome(r), auto: !!r.auto, final: r.card ? listName(r.card) : r.typed ? [r.it.name, r.it.number, r.it.set].filter(Boolean).join(' - ') : '' }));
    try { fetch(url, { method: 'POST', credentials: 'include', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ feedback: { scan: batch.scan, added: added || 0, rows } }) }).catch(() => {}); } catch (e) {}
  }
  function sendAll(added) { const seen = new Set(); st.rows.concat(st.gone || []).forEach(r => { if (r.batch && !seen.has(r.batch)) { seen.add(r.batch); sendFeedback(r.batch, added ? st.rows.filter(x => x.batch === r.batch).length : 0); } }); }
  function fail(text, tok, retry) {
    if (tok !== st.tok) return;
    if (st.rows.length) { step(2); paint(); const e2 = $('scan-err2'); e2.textContent = text; e2.hidden = false; return; }
    step(1); $('scan-wait').hidden = true; $('scan-shots').classList.add('done'); const e = $('scan-err'); e.textContent = text; e.hidden = false; $('scan-retry').hidden = false;
  }
  function limitFail(tok) { fail(limitText(), tok, false); if (tok !== st.tok) return; $('scan-retry').hidden = true; $('scan-up').hidden = !(st.info && st.info.plan !== 'premium'); }
  function limitText() {
    const i = st.info || {}, when = i.resets ? new Date(i.resets + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' }) : 'next month';
    return i.plan === 'premium' ? 'You’ve used all ' + i.limit + ' photo scans this month. More on ' + when + '.' : 'You’ve used your ' + (i.limit || 5) + ' free photo scans this month. More on ' + when + ', or get 50 a month with Premium.';
  }
  // one recognized item -> a row: the catalog's printing when it's a confident match, else what was read (marked to check)
  // v52.97: a printing is only chosen when the set or the number read from the photo backs it up. A slab label often prints
  // just "#4", so a bare number is checked against the first part of each printing's number (4 matches 4/102).
  const nrm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const firstNum = s => (String(s || '').match(/\d+/) || [''])[0].replace(/^0+(?=\d)/, '');
  const fullNum = s => /[\/-]|[a-z]/i.test(String(s || ''));
  function confirm(c, it) {
    let sc = 0;
    if (it.number) { if (fullNum(it.number) && nrm(c.num).replace(/\b0+(?=\d)/g, '') === nrm(it.number).replace(/\b0+(?=\d)/g, '')) sc += 3; else if (firstNum(it.number) && firstNum(c.num) === firstNum(it.number)) sc += 2; }
    const sw = nrm(it.set).split(' ').filter(w => w.length > 1 && !/^(pokemon|tcg|the|of|and)$/.test(w));
    if (sw.length && sw.every(w => nrm(c.s).indexOf(w) > -1)) sc += 2;
    return sc;
  }
  async function match(it) {
    const row = { it, card: null, list: [], check: true, price: '' };
    const game = /pok/i.test(it.game) ? 'Pokémon' : /dragon ball/i.test(it.game) ? 'Dragon Ball Super' : '';
    // a bare "4" would rule out "4/102" in the lookup, so only a full number goes into the search; the bare one is used to choose
    const p = { name: it.name, number: fullNum(it.number) ? it.number : '', set: it.set, game };
    try {
      let res = window.CardLookup ? await window.CardLookup.remote(p) : { list: [], pick: -1 };
      if (!(res.list || []).length && p.number) res = await window.CardLookup.remote(Object.assign({}, p, { number: '' }));
      const list = (res.list || []).slice(0, 12), sc = list.map(c => confirm(c, it)), best = Math.max(0, ...sc), tops = list.filter((c, i) => sc[i] === best);
      row.list = list.slice().sort((a, b) => confirm(b, it) - confirm(a, it)).slice(0, 6);
      if (best >= 2) row.card = tops[0];
      else if (res.pick >= 0 && !it.set && !it.number) row.card = list[res.pick];
      // sure: the set and the number both agree (or a full number does), it's the only such printing, and the reading was clear
      row.check = !row.card || best < 3 || tops.length > 1 || it.sure < 0.6;
    } catch (e) { row.check = true; }
    return row;
  }

  // ---------- the review list ----------
  const graded = r => r.it.kind === 'graded' && r.it.grader && r.it.grade;
  const sealed = r => r.it.kind === 'sealed' || !!(r.card && window.CTSealed && window.CTSealed.is(r.card));
  function nameOf(r) { return r.card ? r.card.n : r.it.name; }
  const setName = s => String(s || '').replace(/^[A-Za-z0-9]{1,8}(\.[0-9]+)?\s*:\s*/, '').trim() || String(s || '');
  function metaOf(r) {
    const c = r.card, bits = [];
    if (graded(r)) bits.push(r.it.grader + ' ' + r.it.grade);
    if (sealed(r)) bits.push('Sealed');
    if (c) { if (c.s) bits.push(setName(c.s)); if (c.num) bits.push('No. ' + c.num); }
    else { if (r.it.set) bits.push(r.it.set); if (r.it.number) bits.push('No. ' + r.it.number); }
    return bits.join(' · ');
  }
  function artOf(r) {
    const c = r.card;
    if (c && c.art) return '<button type="button" class="scan-art zoom' + (sealed(r) ? ' sl' : '') + '" data-zoom="' + esc(c.art.detail || c.art.list) + '" aria-label="See ' + esc(c.n) + ' bigger"><img src="' + esc(c.art.list) + '" alt="" draggable="false" loading="lazy"' + (sealed(r) ? ' class="ct-sealed"' : '') + '></button>';
    return '<span class="scan-art ph" aria-hidden="true"></span>';
  }
  function shares() {
    const n = st.rows.length; if (!n) return [];
    if (st.mode === 'each') return st.rows.map(r => S.toCents(r.price));
    const t = S.toCents($('scan-total').value); if (t == null || t < 0) return st.rows.map(() => null);
    const base = Math.floor(t / n), extra = t - base * n;
    return st.rows.map((r, i) => base + (i < extra ? 1 : 0));
  }
  // fees and shipping on a sale follow each item's share of the price (the last item takes any leftover cent)
  function spread(total, sh) {
    const sum = sh.reduce((a, v) => a + (v || 0), 0); if (!total || !sum) return sh.map(() => 0);
    let used = 0; return sh.map((v, i) => { if (i === sh.length - 1) return total - used; const x = Math.round(total * (v || 0) / sum); used += x; return x; });
  }
  function paintRows() {
    const each = st.mode === 'each', sh = shares();
    const SK = (t, m) => '<div class="scan-r sk" aria-hidden="true"><span class="scan-art ph sk"></span><div class="tx"><div class="n">' + esc(t) + '</div><div class="m">' + esc(m) + '</div></div></div>';
    $('scan-rows').innerHTML = st.rows.map((r, i) => {
      if (r.loading) return SK(r.it.name, 'Finding the card…');
      const fix = st.fixing === i;
      return '<div class="scan-r' + (r.check ? ' chk' : '') + (fix ? ' fixing' : '') + '" data-i="' + i + '"><button type="button" class="scan-del" data-del="' + i + '" tabindex="-1" aria-hidden="true">Remove</button><div class="scan-rin">' + artOf(r) +
        '<div class="tx"><div class="n">' + esc(nameOf(r)) + '</div><div class="m">' + esc(metaOf(r) || 'Not matched to a card yet') + '</div>' +
        (r.check && !fix ? '<button type="button" class="scan-chk" data-fix="' + i + '">' + (r.card ? 'Check this one' : 'Not found, find it') + '</button>' : '') + '</div>' +
        (each ? '<span class="scan-in sm"><i>$</i><input type="text" inputmode="decimal" data-price="' + i + '" value="' + esc(r.price) + '" placeholder="0.00" aria-label="Price for ' + esc(nameOf(r)) + '"></span>' : '<span class="scan-share">' + (sh[i] != null ? money(sh[i]) : '') + '</span>') +
        '<div class="scan-ra"><button type="button" class="scan-ic" data-fix="' + i + '" aria-label="Change ' + esc(nameOf(r)) + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>' +
        '<button type="button" class="scan-ic" data-rm="' + i + '" aria-label="Remove ' + esc(nameOf(r)) + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        (fix ? fixHTML(r, i) : '') + '</div></div>';
    }).join('') + (st.streaming ? SK('Reading…', 'Looking for more cards') : '');
    if (st.fixing >= 0) { const q = $('scan-rows').querySelector('[data-q]'); if (q && document.activeElement !== q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }
  function fixHTML(r, i) {
    const q = r.q != null ? r.q : [r.it.name, r.it.number].filter(Boolean).join(' ');
    return '<div class="scan-fix"><input type="search" data-q="' + i + '" value="' + esc(q) + '" placeholder="Card name and number" aria-label="Search for the right card" autocomplete="off" enterkeyhint="search">' +
      '<div class="scan-opts">' + (r.list.length ? r.list.map((c, k) => '<button type="button" class="scan-opt' + (r.card === c ? ' on' : '') + '" data-pick="' + i + ':' + k + '">' +
        (c.art ? '<img src="' + esc(c.art.list) + '" alt="" draggable="false" loading="lazy">' : '<span class="ph"></span>') + '<span><b>' + esc(c.n) + '</b><small>' + esc([setName(c.s), c.num ? 'No. ' + c.num : ''].filter(Boolean).join(' · ')) + '</small></span></button>').join('') : '<p class="scan-none">' + (r.searching ? 'Searching…' : 'No matches yet. Try the name and number as printed.') + '</p>') + '</div>' +
      '<div class="scan-fixa"><button type="button" data-keep="' + i + '">Keep it as typed</button><button type="button" data-done="' + i + '">Done</button></div></div>';
  }
  let ft = 0;
  function findSoon(i, q) { const r = st.rows[i]; if (!r) return; r.q = q; clearTimeout(ft); ft = setTimeout(() => find(i, q), 320); }
  async function find(i, q) {
    const r = st.rows[i]; if (!r || !q.trim()) return;
    const p = window.CardParser ? window.CardParser.parse(q) : { name: q };
    r.searching = true; const tok = ++r.qt;
    const res = window.CardLookup ? await window.CardLookup.remote(p) : { list: [] };
    if (tok !== r.qt || st.fixing !== i) return;
    r.searching = false; r.list = (res.list || []).slice(0, 6);
    const box = $('scan-rows').querySelector('.scan-r[data-i="' + i + '"] .scan-opts');
    if (box) { const tmp = document.createElement('div'); tmp.innerHTML = fixHTML(r, i); box.replaceWith(tmp.querySelector('.scan-opts')); }
  }
  function onRow(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.zoom) { const im = b.querySelector('img'); if (window.CTZoom) window.CTZoom.open(b.dataset.zoom, im); return; }
    if (b.dataset.del != null) { swipeRemove(+b.dataset.del); return; }
    if (b.dataset.rm != null) { const gone = st.rows.splice(+b.dataset.rm, 1)[0]; if (gone) { gone.gone = true; (st.gone = st.gone || []).push(gone); } st.fixing = -1; paint(); return; }
    if (b.dataset.fix != null) { const i = +b.dataset.fix; st.fixing = st.fixing === i ? -1 : i; const r = st.rows[i]; r.qt = r.qt || 0; paintRows(); return; }
    if (b.dataset.pick) { const [i, k] = b.dataset.pick.split(':').map(Number), r = st.rows[i]; r.card = r.list[k]; r.check = false; r.typed = false; st.fixing = -1; paint(); return; }
    if (b.dataset.keep != null) { const i = +b.dataset.keep, r = st.rows[i], q = (r.q != null ? r.q : r.it.name).trim(); if (q) { const p = window.CardParser ? window.CardParser.parse(q) : { name: q }; r.it = Object.assign({}, r.it, { name: p.name || q, number: p.number || '', set: p.set || '' }); } r.card = null; r.check = false; r.typed = true; st.fixing = -1; paint(); return; }
    if (b.dataset.done != null) { st.fixing = -1; paintRows(); }
  }
  function swipeRemove(i) {
    const row = $('scan-rows').querySelector('.scan-r[data-i="' + i + '"]'), done = () => { const gone = st.rows.splice(i, 1)[0]; if (gone) { gone.gone = true; (st.gone = st.gone || []).push(gone); } st.fixing = -1; paint(); };
    if (!row || matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    row.style.height = row.offsetHeight + 'px'; row.classList.add('out');
    requestAnimationFrame(() => { row.style.height = '0px'; }); setTimeout(done, 260);
  }
  // swipe a row left: past a third of the width it's removed; a short swipe leaves the Remove button showing
  function swipe(box) {
    let row = null, inn = null, x0 = 0, y0 = 0, dx = 0, on = false, open = null, w = 0;
    const set = (el, x, anim) => { el.style.transition = anim ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none'; el.style.transform = x ? 'translateX(' + x + 'px)' : ''; };
    const shut = () => { if (open) { set(open, 0, true); open.closest('.scan-r').classList.remove('open'); open = null; } };
    box.addEventListener('touchstart', e => {
      const t = e.target; if (t.closest('input,select,.scan-fix,.scan-del')) return;
      const r = t.closest('.scan-r'); if (!r || r.classList.contains('sk') || r.classList.contains('fixing')) return;
      if (open && open !== r.querySelector('.scan-rin')) shut();
      row = r; inn = r.querySelector('.scan-rin'); w = r.offsetWidth; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; on = false;
    }, { passive: true });
    box.addEventListener('touchmove', e => {
      if (!row) return; const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!on) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; if (Math.abs(my) > Math.abs(mx) || mx > 0 && !row.classList.contains('open')) { row = null; return; } on = true; row.classList.add('swiping'); }
      e.preventDefault(); dx = Math.min(0, mx + (row.classList.contains('open') ? -92 : 0)); set(inn, dx, false);
    }, { passive: false });
    const end = () => {
      if (!row) return; const r = row; row = null; if (!on) return; r.classList.remove('swiping');
      const i = +r.dataset.i;
      if (dx < -w / 3) { set(inn, -w, true); setTimeout(() => swipeRemove(i), 160); open = null; }
      else if (dx < -46) { set(inn, -92, true); r.classList.add('open'); open = inn; }
      else { set(inn, 0, true); r.classList.remove('open'); if (open === inn) open = null; }
    };
    box.addEventListener('touchend', end); box.addEventListener('touchcancel', end);
    dlg.addEventListener('pointerdown', e => { if (open && !e.target.closest('.scan-r.open')) shut(); });
  }
  function paint() {
    const n = st.rows.length, sale = st.type === 'sale';
    $('scan-h').textContent = n ? (st.streaming ? 'Found ' + n + ' so far' : 'Found ' + n + (n === 1 ? ' item' : ' items')) : st.streaming ? 'Reading your cards…' : 'Add from photo';
    const chk = st.rows.filter(r => r.check && !r.loading).length;
    $('scan-sub').textContent = st.streaming ? 'Cards appear as they’re read. You can start checking them now.' : !n ? 'Nothing left to add. Add another photo, or close.' : chk ? chk + (chk === 1 ? ' needs' : ' need') + ' a quick check. Tap it to pick the right card.' : 'Check the list, then fill in the details once for all of them.';
    $('scan-tlab').textContent = sale ? 'Total sold for' : 'Total paid';
    $('scan-salew').hidden = !sale;
    $('scan-lotw').hidden = st.mode === 'each';
    $('scan-err2').hidden = true; $('scan-err2').classList.remove('note');
    paintRows(); sums();
    const i = st.info; $('scan-left').textContent = i && i.plan !== 'premium' && i.left != null ? i.left + (i.left === 1 ? ' free photo scan' : ' free photo scans') + ' left this month' : '';
  }
  function sums() {
    const sh = shares(), n = st.rows.length, ok = n && sh.every(v => v != null && v >= 0), sale = st.type === 'sale';
    if (st.mode === 'lot') $('scan-rows').querySelectorAll('.scan-share').forEach((el, i) => { el.textContent = sh[i] != null ? money(sh[i]) : ''; });
    const total = sh.reduce((a, v) => a + (v || 0), 0), fe = S.toCents($('scan-fees').value) || 0, sp = S.toCents($('scan-ship').value) || 0;
    $('scan-sum').innerHTML = !n ? '' : ok ? (sale ? 'You keep <b>' + money(total - fe - sp) + '</b> from ' + money(total) : n + (n === 1 ? ' item' : ' items') + ' · <b>' + money(total) + '</b>' + (st.mode === 'lot' && n > 1 ? ' · about ' + money(Math.round(total / n)) + ' each' : '')) : (st.mode === 'each' ? 'Enter a price for each item' : 'Enter what you ' + (sale ? 'sold them for' : 'paid for all of them'));
    const go = $('scan-go'), u = S.usage(), room = u.plan === 'premium' ? Infinity : u.left;
    const wait = st.streaming || st.rows.some(r => r.loading);
    go.disabled = !ok || st.busy || n > room || wait;
    go.textContent = n > room ? (room ? 'Only ' + room + ' free ' + (room === 1 ? 'entry' : 'entries') + ' left this month' : 'Free entries used up this month') : 'Add ' + n + (n === 1 ? ' item' : ' items');
  }
  async function addAll() {
    if (st.busy) return;
    const sh = shares(), sale = st.type === 'sale', plat = $('scan-plat').value, date = $('scan-date').value;
    const fees = sale ? spread(S.toCents($('scan-fees').value) || 0, sh) : null, ship = sale ? spread(S.toCents($('scan-ship').value) || 0, sh) : null;
    st.busy = true; $('scan-go').disabled = true; let added = 0; const ids = [];
    try { localStorage.setItem('ct.scan', JSON.stringify({ mode: st.mode, plat, type: st.type })); } catch (e) {}
    try {
      for (let i = 0; i < st.rows.length; i++) {
        const r = st.rows[i], c = r.card, g = graded(r) && window.CTGrade ? window.CTGrade.norm({ co: r.it.grader, g: r.it.grade, cert: r.it.cert }) : null, sl = sealed(r);
        const name = c ? listName(c) : [r.it.name, r.it.number, r.it.set].filter(Boolean).join(' - ');
        await S.add({ type: st.type, name, platform: plat, date, qty: 1, amount: sh[i], fees: sale ? fees[i] : null, ship: sale ? ship[i] : null,
          condition: sl ? 'Sealed' : g ? 'Graded' : 'Near Mint', sealed: sl ? true : undefined, grade: g || undefined, art: (c && c.art) || null, unmatched: !c }, { label: 'Photo entries added' }).then(e => { if (e && e.id) ids.push(e.id); });
        added++;
      }
    } catch (err) {
      st.busy = false; const e2 = $('scan-err2');
      e2.textContent = err.code === 'limit' ? 'Added ' + added + '. You’ve used all your free entries this month.' : 'Something went wrong after ' + added + ' of ' + st.rows.length + '. The rest weren’t added.';
      e2.hidden = false; if (added) sendAll(true); st.rows.splice(0, added); paintRows(); sums(); return;
    }
    st.busy = false; window.ctBuzz && window.ctBuzz();
    sendAll(true); st.done = true;
    close(); if (window.CTAddSheet && window.CTAddSheet.isOpen) window.CTAddSheet.close();
    // Added 4 items · Undo (takes them all back out, and gives the free entries back)
    const t = $('app-toasts'); if (t) {
      const d = document.createElement('div'); d.className = 'app-toast scan-toast'; d.setAttribute('role', 'status');
      d.innerHTML = '<span>Added ' + added + (added === 1 ? ' item' : ' items') + ' from your photo</span><button type="button">Undo</button>';
      t.innerHTML = ''; t.appendChild(d); const tm = setTimeout(() => d.remove(), 6500);
      d.querySelector('button').addEventListener('click', async () => { clearTimeout(tm); for (const id of ids) { try { await S.remove(id); } catch (e) {} } d.querySelector('span').textContent = 'Removed ' + ids.length + (ids.length === 1 ? ' item' : ' items'); d.querySelector('button').remove(); setTimeout(() => d.remove(), 2500); });
    }
  }

  // ---------- open / close ----------
  function show() {
    build();
    const plats = S.pickerPlatforms ? S.pickerPlatforms() : ['TCGplayer', 'eBay'], df = (S.meta && S.meta('addDefaults')) || {};
    let last = ''; try { last = (JSON.parse(localStorage.getItem('ct.addsheet') || '{}') || {}).plat || ''; } catch (e) {}
    const sel = $('scan-plat'); sel.innerHTML = plats.map(p => '<option>' + esc(p) + '</option>').join('');
    const want = df.plat || last; if (want && plats.includes(want)) sel.value = want;
    $('scan-date').value = S.today ? S.today() : new Date().toISOString().slice(0, 10);
    ['scan-total', 'scan-fees', 'scan-ship'].forEach(id => { $(id).value = ''; });
    let mem = {}; try { mem = JSON.parse(localStorage.getItem('ct.scan') || '{}') || {}; } catch (e) {}
    if (mem.plat && plats.includes(mem.plat)) sel.value = mem.plat;   // the last platform used for a photo lot
    st.type = mem.type === 'sale' ? 'sale' : 'purchase'; st.mode = mem.mode === 'each' ? 'each' : 'lot'; st.done = false;
    [['scan-type', st.type], ['scan-mode', st.mode]].forEach(([id, v]) => $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))));
    dlg.classList.remove('closing'); dlg.showModal();
    const f = $('scan-form'); f.tabIndex = -1; f.style.outline = 'none'; f.focus({ preventScroll: true });
  }
  function close() {
    if (!dlg || !dlg.open) return; st.tok++; st.streaming = false;
    if (!st.done) sendAll(0);   // closed without adding: still tells the reader which matches were right
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) { dlg.close(); return; }
    dlg.classList.add('closing'); setTimeout(() => { dlg.classList.remove('closing'); dlg.close(); }, 230);
  }
  // pick photos straight away (inside the tap, so the phone offers camera or library), then the sheet opens on its own
  function check() { const url = URL_(); if (!url) return; fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{"check":true}' }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.limit != null) st.info = { left: j.left, limit: j.limit, resets: j.resets, plan: j.plan }; }).catch(() => {}); }
  function open() {
    check();
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
    inp.addEventListener('change', () => { const files = [...(inp.files || [])]; inp.remove(); if (files.length) run(files, false); });
    document.body.appendChild(inp); inp.click();
    setTimeout(() => { if (inp.isConnected && !inp.files.length) inp.remove(); }, 120000);
  }
  window.CTScan = { open, run, close, _assess: assess };
})();
