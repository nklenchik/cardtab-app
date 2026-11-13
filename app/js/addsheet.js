/* Add-a-card sheet (Drop 2), wired to the store.
   Type a listing-style title -> chips show what was understood -> one match, or "Which one is your card?" ->
   price -> save. The sheet stays open for the next card and keeps one running total for the session.
   Sales ask for what actually reached you (exact fees), never an estimate. */
(function () {
  'use strict';
  const S = window.CTStore;
  const $ = id => document.getElementById(id);
  const dlg = $('as'), inp = $('as-in'), chips = $('as-chips'), res = $('as-res'), go = $('as-go'), price = $('as-price'), fees = $('as-fees'), ship = $('as-ship'), sv = $('as-save');
  const KEY = 'ct.addsheet';
  const CONDS = ['NM', 'LP', 'MP', 'HP'], COND_FULL = { NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played' };
  const st = { kind: 'all', tok: 0, busy: false, type: 'purchase', cond: 0, qty: 1, sel: -1, list: [], sig: '', why: '', card: null, parsed: null, rows: [], total: 0, shown: 0, onDone: null };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = c => '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const grad = h => 'linear-gradient(155deg,hsl(' + h + ' 62% 50%),hsl(' + ((h + 40) % 360) + ' 55% 22%))';
  const isSealed = c => !!(c && window.CTSealed && window.CTSealed.is(c));   // v52.75 packs, boxes, ETBs, UPCs
  const slBg = c => c.art ? 'url(' + c.art.list + ') center/contain no-repeat' : artBg(c);   // sealed: the whole picture, no card backdrop
  const artBg = c => (c.art ? 'url(' + c.art.list + ') center/cover no-repeat, ' : '') + grad(c.h == null ? 220 : c.h);
  const CK = '<span class="tick"><svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg></span>';
  const mem = { get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }, set(extra) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(mem.get(), { type: st.type, plat: $('as-plat').value }, extra || {}))); } catch (e) {} } };

  const PHN = matchMedia('(max-width:760px)');
  function chipsFor(p) {
    const c = [];
    if (p.name) c.push(['Item', p.name]); if (p.number) c.push(['No.', p.number]); if (p.set) c.push(['Set', p.set]);
    if (p.rarity) c.push(['Rarity', p.rarity]); if (p.variant) c.push(['Variant', p.variant]);
    if (p.finishes && p.finishes.length) c.push(['Finish', p.finishes[0]]);
    if (p.grade) c.push(['Graded', p.grade]); if (p.condition) c.push(['Cond.', p.condition]);
    if (p.sealed) c.push(['Type', 'Sealed']); if (p.qty) c.push(['Qty', '×' + p.qty]);
    return c;
  }

  // Session list: what was added since the sheet opened, with one running total (sales +, purchases −)
  function sessionHTML() {
    let h = '<div class="tot"><span class="lab" id="as-tl">This session</span><b id="as-tt"></b></div>';
    if (!st.rows.length) return h + '<div class="none" style="margin-top:14px">Nothing yet. Your first item will show up here.</div>';
    st.rows.forEach(r => {
      h += '<div class="row' + (r.isNew ? ' new' : '') + '"><span class="art' + (r.sl ? ' sl' : '') + '" style="background:' + (r.sl ? slBg(r) : artBg(r)) + '"></span><div class="tx"><div class="n">' + esc(r.n) + '</div><div class="m">' + esc(r.m) + '</div></div><div class="amt' + (r.sale ? ' in' : '') + '">' + (r.sale ? '+' : '−') + money(r.amt) + '</div></div>';
      r.isNew = false;
    });
    return h;
  }
  function totals() {
    const el = $('as-tt'); if (!el) return;
    const n = st.rows.reduce((a, r) => a + r.qty, 0); $('as-tl').textContent = 'This session · ' + n + (n === 1 ? ' item' : ' items');
    const v = Math.round(st.shown); el.textContent = st.rows.length ? (v < 0 ? '−' : '+') + money(v) : ''; el.style.color = v > 0 ? 'var(--green)' : '';
  }
  function tween() {
    const t0 = performance.now(), from = st.shown;
    (function step(n) { let k = Math.min(1, (n - t0) / 450); k = 1 - Math.pow(1 - k, 3); st.shown = from + (st.total - from) * k; totals(); if (k < 1) requestAnimationFrame(step); })(t0);
  }

  function setGo(enabled, label) { go.disabled = !enabled; go.textContent = label; }
  function render() {
    const t = inp.value.trim(), p = window.CardParser.parse(t);
    // phones: the first chip says Bought or Sold and flips it (the Purchase/Sale switch is hidden while searching, to keep the matches above the keyboard)
    const tchip = PHN.matches ? '<button type="button" class="chip tchip" data-tchip aria-label="' + (st.type === 'sale' ? 'Sale' : 'Purchase') + ', tap to switch"><i>' + (st.type === 'sale' ? 'Sold' : 'Bought') + '</i>tap to switch</button>' : '';
    chips.innerHTML = tchip + (t ? chipsFor(p).map((c, i) => '<span class="chip" style="animation-delay:' + i * 45 + 'ms"><i>' + c[0] + '</i>' + esc(c[1]) + '</span>').join('') : '');
    const sig = [p.name, p.number, p.set, p.rarity].join('|');
    if (sig !== st.sig) {
      st.sig = sig; st.kind = 'all';
      // v42.6: ask the card database only once there's something worth asking: 3+ letters of a name, or a card number
      const worth = !!p.number || String(p.name || '').replace(/[^a-z0-9]/gi, '').length >= 3;
      if (window.CARDTAB_API && worth) {
        st.busy = true; const tok = ++st.tok; clearTimeout(st.dt);
        st.dt = setTimeout(() => window.CardLookup.remote(p).then(r => { if (tok !== st.tok) return; st.busy = false; st.list = r.list; st.sel = r.pick; st.why = r.why || ''; render(); }), 450);
        st.list = []; st.sel = -1;
      } else { const r = window.CardLookup.search(p); st.list = r.list; st.sel = r.pick; st.why = r.why || ''; }
      // nothing matched: offer the closest spellings ("Did you mean") before adding it as typed
      st.dym = false;
      if (!st.list.length && !st.busy && window.CardLookup.suggest) { const sg = window.CardLookup.suggest(p); if (sg.length) { st.list = sg; st.sel = -1; st.why = ''; st.dym = true; } }
    }
    st.parsed = p;
    const typed = '<button type="button" class="addtyped" data-typed>Add “' + esc(t.length > 40 ? t.slice(0, 40) + '…' : t) + '” as typed</button>';
    if (!t) { res.innerHTML = sessionHTML(); totals(); setGo(false, 'Pick one'); return; }
    if (!st.list.length && st.busy) { res.innerHTML = '<div class="none">Looking it up…</div>'; setGo(false, 'Pick one'); return; }
    if (!st.list.length) { res.innerHTML = '<div class="none">No match yet. Keep typing, or add the number.</div>' + typed; setGo(false, 'Pick one'); return; }
    // Results are a short list: tap the one that's yours and go straight to price ("Change" on the price step undoes a wrong tap)
    const pre = st.list.length === 1 || (st.why && st.why !== 'one');
    if (st.list.length === 1 && !st.dym) st.sel = 0;
    // v52.75: when the results mix cards and sealed products, All · Cards · Sealed narrows them; sealed ones carry a tag
    const sl = st.list.map(isSealed), mixed = sl.some(Boolean) && sl.some(x => !x);
    if (!mixed) st.kind = 'all';
    const vis = st.list.map((c, i) => i).filter(i => st.kind === 'all' || (st.kind === 'sealed') === sl[i]);
    const kinds = mixed ? '<div class="kinds" role="group" aria-label="Show">' + [['all', 'All'], ['cards', 'Cards'], ['sealed', 'Sealed']].map(k => '<button type="button" data-kind="' + k[0] + '" aria-pressed="' + (st.kind === k[0]) + '">' + k[1] + '</button>').join('') + '</div>' : '';
    const n = vis.length, allSealed = vis.every(i => sl[i]);
    let h = kinds + '<div class="lsl">' + (st.dym ? 'No exact match · did you mean' : n === 1 ? 'One match · tap it or press Enter' : n + (allSealed ? ' products' : mixed && st.kind === 'all' ? ' results' : ' printings') + ' · tap yours') + '</div><div class="lst">';
    vis.forEach((i, k) => { const c = st.list[i], y = sl[i];
      h += '<button type="button" class="li" data-i="' + i + '"><span class="art' + (y ? ' sl' : '') + '" style="background:' + (y ? slBg(c) : artBg(c)) + '"></span><span class="t"><span class="n">' + esc(c.n) + (c.r && !y ? ' · ' + esc(c.r) : '') + '</span><span class="m">' + (y ? '<b class="slt">Sealed</b>' : '') + esc([c.s, y ? '' : c.num].filter(Boolean).join(' · ')) + (pre && !st.dym && k === 0 ? '<b class="bm">' + (n === 1 ? 'Match' : 'Best match') + '</b>' : '') + '</span></span><span class="go" aria-hidden="true"></span></button>';
    });
    h += '</div>' + typed;
    res.innerHTML = h; setGo(st.sel > -1, st.sel < 0 ? 'Pick one' : 'Continue to price');
  }
  res.addEventListener('click', e => {
    const kb = e.target.closest('[data-kind]'); if (kb) { st.kind = kb.dataset.kind; st.sel = -1; render(); return; }
    const li = e.target.closest('.li');
    if (li) { st.sel = +li.dataset.i; li.classList.add('on'); window.ctBuzz && window.ctBuzz(); toPrice(); return; }
    if (e.target.closest('[data-typed]')) toPrice(true);
  });
  // Dragging the results drops the keyboard so the whole list is in view
  res.addEventListener('touchmove', () => { if (document.activeElement === inp) inp.blur(); }, { passive: true });
  // Keep the sheet above the on-screen keyboard: size the dialog to the visible part of the screen
  const vv = window.visualViewport;
  // While the sheet is sliding in or out, nothing resizes it: the keyboard rises (or drops) under the moving sheet, and the
  // sheet settles above the keyboard once, after the slide. Resizing on every keyboard step is what made it stutter.
  let moving = false, settle = 0;
  function fit() { if (!dlg.open || !vv || moving) return;
    // phones search full screen: the keyboard just covers the bottom, nothing resizes. Only the price step follows the keyboard, so Save stays in reach.
    if (dlg.classList.contains('nm') && !dlg.classList.contains('st2')) { dlg.style.height = ''; dlg.style.top = ''; dlg.classList.remove('kb'); return; }
    // only follow the visible area while the keyboard is up; otherwise sit at the top of the screen. (Inside some app
    // viewers the visible area reports an offset even with no keyboard, which pushed the sheet down.)
    const kb = vv.height < innerHeight * .85;
    dlg.style.height = kb ? vv.height + 'px' : ''; dlg.style.top = kb ? Math.max(0, vv.offsetTop) + 'px' : '';
    // v42.5 phones: with the keyboard up the price step goes compact (smaller card row and price, condition waits until the
    // keyboard drops), so the field you're typing in, the "You keep" line and Save all stay in view
    const was = dlg.classList.contains('kb'); dlg.classList.toggle('kb', kb && dlg.classList.contains('nm'));
    if (kb) reveal(); else if (was) dlg.querySelector('#as-s2 .body').scrollTop = 0; }
  // the field you're typing in stays in the middle of what you can see
  function reveal() { const a = document.activeElement, body = dlg.querySelector('#as-s2 .body'); if (!a || !body || !body.contains(a)) return;
    requestAnimationFrame(() => { const box = a.closest('.mini, .pr, .field') || a, br = body.getBoundingClientRect(), r = box.getBoundingClientRect();
      if (r.top < br.top + 8 || r.bottom > br.bottom - 8) body.scrollBy({ top: r.top - br.top - Math.max(8, (br.height - r.height) / 2), behavior: 'smooth' }); }); }
  dlg.addEventListener('focusin', () => setTimeout(() => { if (dlg.classList.contains('kb')) reveal(); }, 60));
  const bd = document.createElement('div'); bd.className = 'as-bd'; bd.setAttribute('aria-hidden', 'true'); document.body.appendChild(bd);
  dlg.addEventListener('closing', () => { moving = true; clearTimeout(settle); bd.classList.remove('on'); });
  dlg.addEventListener('close', () => bd.classList.remove('on'));
  dlg.addEventListener('close', () => { dlg.classList.remove('go'); moving = false; clearTimeout(settle); dlg.style.height = ''; dlg.style.top = ''; dlg.classList.remove('moving'); });
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }

  function show(step) { $('as-s1').style.display = step === 1 ? 'flex' : 'none'; $('as-s2').style.display = step === 2 ? 'flex' : 'none'; dlg.classList.toggle('st1', step === 1); dlg.classList.toggle('st2', step === 2); if (step === 1) { dlg.style.height = ''; dlg.style.top = ''; } else fit(); }
  function setSeg(id, i) { const el = $(id); el.setAttribute('data-i', i); el.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', k === i)); }
  function seg(id, fn) { $(id).querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => { setSeg(id, i); fn(b, i); })); }

  // Card name in the list format: "Name - number - set"
  const listName = c => [c.n, c.num, c.s].filter(Boolean).join(' - ');

  function toPrice(asTyped) {
    const p = st.parsed || {};
    if (asTyped) { const t = inp.value.trim(); if (!t) return; st.card = { n: t, s: '', num: '', r: '', h: 220, typed: true }; }
    else { if (st.sel < 0 || !st.list[st.sel]) return; st.card = st.list[st.sel]; }
    st.qty = p.qty || 1; st.grade = p.grade || '';
    const ci = p.condition ? CONDS.indexOf(p.condition) : -1; if (ci > -1) { setSeg('as-cond', ci); st.cond = ci; }
    const c = st.card;
    st.sealed = c.typed ? !!p.sealed : isSealed(c); $('as-pa').classList.toggle('sl', st.sealed); $('as-cond').closest('.sec').hidden = st.sealed;   // sealed: no condition
    $('as-pa').style.background = st.sealed ? slBg(c) : artBg(c); $('as-pn').textContent = c.n;
    if (st.sealed) $('as-pm').innerHTML = '<b class="slt">Sealed</b>' + esc(c.s || ''); else
    $('as-pm').textContent = c.typed ? 'Added as typed' : c.s + ' · ' + c.num + (st.grade ? ' · ' + st.grade : '');
    $('as-q').textContent = st.qty;
    show(2); price.value = ''; fees.value = ''; const ls = mem.get().ship; ship.value = ls != null ? S.fromCents(ls) : ''; $('as-err').textContent = ''; upd(); price.focus();
  }
  // Sales: sale price minus transaction fees minus your shipping = what you keep, to the cent
  function upd() {
    const sale = st.type === 'sale', v = S.toCents(price.value), fe = S.toCents(fees.value), sh = S.toCents(ship.value);
    $('as-plab').textContent = sale ? 'Sold for' : 'Total paid';
    $('as-keptw').hidden = !sale;
    price.setAttribute('enterkeyhint', sale ? 'next' : 'done');
    const bad = sale && ((fees.value.trim() && (fe == null || fe < 0)) || (ship.value.trim() && (sh == null || sh < 0)));
    const ok = v != null && v > 0 && !bad;
    sv.disabled = !ok;
    if (sale) { const k = v > 0 ? v - (fe || 0) - (sh || 0) : null; $('as-keep').innerHTML = k == null ? 'Sold for includes any shipping the buyer paid.' : 'You keep <b' + (k < 0 ? ' class="neg"' : '') + '>' + (k < 0 ? '−' : '') + money(k) + '</b> · Sold for includes any shipping the buyer paid.'; }
    sv.textContent = !(v > 0) ? 'Enter a price' : (sale ? 'Save sale · ' : 'Save purchase · ') + money(v);
  }
  async function save() {
    if (sv.disabled) return;
    const sale = st.type === 'sale', c = st.card, v = S.toCents(price.value), fe = S.toCents(fees.value) || 0, sh = S.toCents(ship.value) || 0, k = v - fe - sh;
    const name = c.typed ? c.n : listName(c);
    try {
      const e = await S.add({ type: st.type, name, platform: $('as-plat').value, qty: st.qty, amount: v, fees: sale ? fe : null, ship: sale ? sh : null, condition: st.sealed ? 'Sealed' : st.grade ? 'Graded' : COND_FULL[CONDS[st.cond]], sealed: st.sealed ? true : undefined, grade: st.grade && window.CTGrade ? window.CTGrade.parse(st.grade) : undefined, art: c.art || null, note: st.grade && !window.CTGrade ? 'Graded ' + st.grade : '', unmatched: !!c.typed });
      const amt = sale ? k : v;
      st.rows.unshift({ n: c.n, m: (c.typed ? '' : c.s + ' · ') + (st.qty > 1 ? '×' + st.qty + ' · ' : '') + (st.sealed ? 'Sealed' : CONDS[st.cond]), h: c.h, art: c.art, sale, amt, qty: st.qty, isNew: true, id: e.id, sl: st.sealed });
      st.total += sale ? amt : -amt; window.ctBuzz && window.ctBuzz();
      show(1); inp.value = ''; st.sig = '~'; render(); tween(); inp.focus(); mem.set(sale ? { ship: sh } : null);
      const u = S.usage();
      flash(u.plan === 'free' && u.blocked ? 'Saved · that was your last free entry this month' : u.plan === 'free' && u.warn ? 'Saved · ' + u.left + (u.left === 1 ? ' free entry' : ' free entries') + ' left' : 'Saved · ready for the next one');
      if (u.plan === 'free' && u.blocked) { setGo(false, 'Free entries used up this month'); inp.disabled = true; }
    } catch (err) {
      if (err.code === 'limit') { $('as-err').textContent = 'You’ve used all 20 free entries this month. More on ' + S.usage().resetsOn + '.'; sv.disabled = true; }
      else if (err.code === 'invalid') $('as-err').textContent = Object.values(err.errors)[0];
      else console.error(err);
    }
  }
  function flash(t) { const el = $('as-toast'); el.textContent = t; el.classList.add('on'); clearTimeout(flash.t); flash.t = setTimeout(() => el.classList.remove('on'), 1900); }

  seg('as-type', b => { st.type = b.dataset.v; upd(); mem.set(); });
  // phones: the Bought/Sold chip flips the type without dropping the keyboard
  chips.addEventListener('pointerdown', e => { if (e.target.closest('[data-tchip]')) e.preventDefault(); });
  chips.addEventListener('click', e => { if (!e.target.closest('[data-tchip]')) return; const b = $('as-type').querySelectorAll('button')[st.type === 'sale' ? 0 : 1]; if (b) b.click(); render(); if (window.CTHaptic) try { CTHaptic('tap'); } catch (er) {} });
  seg('as-cond', (b, i) => { st.cond = i; });
  $('as-plat').addEventListener('change', e => { if (e.target.value !== '__add') mem.set(); });
  $('as-qm').addEventListener('click', () => { st.qty = Math.max(1, st.qty - 1); $('as-q').textContent = st.qty; });
  $('as-qp').addEventListener('click', () => { st.qty = Math.min(9999, st.qty + 1); $('as-q').textContent = st.qty; });
  $('as-back').addEventListener('click', () => { show(1); inp.focus(); });
  inp.addEventListener('input', render);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!go.disabled) toPrice(); } });
  go.addEventListener('click', () => toPrice());
  sv.addEventListener('click', save);
  price.addEventListener('input', upd); fees.addEventListener('input', upd); ship.addEventListener('input', upd);
  price.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (st.type === 'sale') fees.focus(); else save(); } });
  fees.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ship.focus(); ship.select(); } });
  ship.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  [price, fees, ship].forEach(f => f.addEventListener('blur', () => { const c = S.toCents(f.value); if (c != null && c >= 0) f.value = S.fromCents(c); }));
  $('as-other').addEventListener('click', () => { const done = st.onDone; close(); window.CTEditor.open(null, done); });
  dlg.querySelector('[data-as-close]').addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => { const n = st.rows.length, done = st.onDone; st.onDone = null; if (done && n) done('session', n); });

  // Platform picker, with "Other…" at the end to type your own. Your own platforms are saved in your account only.
  function fillPlatforms(pick) {
    const plats = S.pickerPlatforms(), sel = $('as-plat');
    sel.innerHTML = plats.map(p => '<option>' + esc(p) + '</option>').join('') + '<option value="__add">Other…</option>';
    sel.value = pick && plats.includes(pick) ? pick : plats[0];
    sel.dataset.prev = sel.value; $('as-addplat').hidden = true;
  }
  $('as-plat').addEventListener('change', e => {
    if (e.target.value === '__add') { e.target.value = e.target.dataset.prev || ''; $('as-addplat').hidden = false; $('as-newplat').value = ''; $('as-newplat').focus(); }
    else e.target.dataset.prev = e.target.value;
  });
  async function savePlat() { const n = await S.addPlatform($('as-newplat').value); if (!n) { $('as-newplat').focus(); return; } fillPlatforms(n); mem.set(); (st.card ? price : inp).focus(); }
  $('as-saveplat').addEventListener('click', savePlat);
  $('as-newplat').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); savePlat(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); $('as-addplat').hidden = true; } });
  $('as-cancelplat').addEventListener('click', () => { $('as-addplat').hidden = true; });

  // The visible height with the keyboard up, remembered per screen height, so the next open starts at the right size
  function kbMem() { try { const m = JSON.parse(localStorage.getItem('ct.kbh') || 'null'); return m && m.ih === innerHeight ? m.h : 0; } catch (e) { return 0; } }
  function kbSave() { if (!vv || vv.height > innerHeight * .85) return; try { localStorage.setItem('ct.kbh', JSON.stringify({ ih: innerHeight, h: Math.round(vv.height) })); } catch (e) {} }
  if (vv) vv.addEventListener('resize', () => { if (dlg.open && !moving) kbSave(); });
  function open(onDone) {
    st.onDone = onDone || null; st.rows = []; st.total = 0; st.shown = 0; st.sig = '~'; st.sel = -1;
    const d = mem.get(), df = (S.meta && S.meta('addDefaults')) || {};
    // Settings → Adding entries: a chosen platform wins; otherwise the last one used
    fillPlatforms(df.plat || d.plat);
    st.type = d.type === 'sale' ? 'sale' : 'purchase'; setSeg('as-type', st.type === 'sale' ? 1 : 0);
    st.cond = Math.max(0, CONDS.indexOf(df.cond || 'NM')); setSeg('as-cond', st.cond);
    inp.value = ''; inp.disabled = false; $('as-toast').classList.remove('on'); show(1); render();
    // Phones default to 'after' (Nick's call, Nov 4): the sheet slides up untouched and you tap search to type.
    // 'together' stays available behind ct.kbmode in case the extra tap becomes a hurdle:
    //  'together': focus inside the tap so the keyboard rises with the sheet. The sheet starts at the height it will have
    //              above the keyboard (remembered from last time), so nothing resizes after the slide.
    //  'after':    the sheet slides up on its own, untouched; tap the search to type.
    const touch = matchMedia('(hover:none)').matches;
    let mode = 'after'; try { mode = localStorage.getItem('ct.kbmode') || 'after'; } catch (e) {}
    dlg.style.top = ''; dlg.style.height = '';
    const phone = PHN.matches; if (phone) mode = 'together';   // v41: full-screen search on phones, so the keyboard can rise with it
    if (touch && mode === 'together' && !phone) { const k = kbMem(); if (k) dlg.style.height = k + 'px'; }
    moving = true; dlg.classList.remove('go'); dlg.classList.add('moving');
    const tOpen = performance.now();
    // phones: opens as a normal layer over the page with its own blurred backdrop, like the profile menu (the browser's
    // pop-up layer misbehaves inside some phone app viewers). Desktop keeps the standard pop-up window.
    if (PHN.matches) { dlg.classList.add('nm'); bd.classList.add('on'); dlg.show(); } else { dlg.classList.remove('nm'); dlg.showModal(); }
    diag.run(tOpen, performance.now());
    // phones: the sheet waits one painted frame off screen before it slides, so iPhone has it drawn before the slide's
    // first frame (otherwise the opening of the slide is skipped and it looks like a hang)
    const go = () => { if (dlg.open && !dlg.classList.contains('go')) { dlg.classList.add('go'); diag.go && diag.go(); } };
    requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 50);
    if (!touch || mode === 'together') inp.focus({ preventScroll: true });
    else { const sh = dlg.querySelector('.sheet'); sh.tabIndex = -1; sh.focus({ preventScroll: true }); } // no stray focus ring on the close button
    clearTimeout(settle); settle = setTimeout(() => { moving = false; dlg.classList.remove('moving'); fit(); kbSave(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 480);
  }
  function close() { if (dlg.open) dlg.close(); }
  // phones open it as a plain layer (not a pop-up), so Escape on a hardware keyboard closes it here
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && dlg.open && dlg.classList.contains('nm')) { e.preventDefault(); close(); } });

  // ---------- testing tool: a timing readout for opening Add New (Profile › testing tools). Shows where the wait goes on a real phone. ----------
  const diagOn = () => { try { return localStorage.getItem('ct.diag') === '1'; } catch (e) { return false; } };
  const diagPaint = () => document.querySelectorAll('[data-dev="diag"]').forEach(b => b.setAttribute('aria-checked', String((b.dataset.v === '1') === diagOn())));   // v52.26: an Off / On switch in Admin
  diagPaint();
  document.addEventListener('click', e => { const db = e.target.closest('[data-dev="diag"]'); if (!db) return; e.stopPropagation(); const want = db.dataset.v ? db.dataset.v === '1' : !diagOn(); if (want === diagOn()) return; try { localStorage.setItem('ct.diag', want ? '1' : '0'); } catch (er) {} diagPaint(); if (window.CTDash) window.CTDash.toast('Timing readout ' + (diagOn() ? 'on: tap + to see it' : 'off')); });
  let tTap = 0;
  document.addEventListener('pointerdown', e => { if (e.target.closest('#ct-fab,#ct-add')) tTap = performance.now(); }, true);
  const diag = { run(tOpen, tShown) {
    if (!diagOn()) return;
    const ph = dlg.querySelector('.phone'), t0 = tTap && tOpen - tTap < 3000 ? tTap : tOpen, m = { tap: t0, open: tOpen, shown: tShown };
    requestAnimationFrame(() => { m.shown = performance.now(); }); // the first frame drawn with the window open
    let box = dlg.querySelector('.as-diag'); if (!box) { box = document.createElement('div'); box.className = 'as-diag'; dlg.appendChild(box); }
    box.innerHTML = '<b>Add New timing</b><span>Waiting for the slide to start…</span>';
    diag.go = () => { m.go = performance.now(); };
    let last = performance.now(), gap = 0, frames = 0, live = true;
    (function f() { const n = performance.now(); gap = Math.max(gap, n - last); last = n; frames++; if (live) requestAnimationFrame(f); })();
    const ms = v => Math.round(v) + ' ms';
    ph.addEventListener('animationstart', () => { m.start = performance.now(); frames = 0; }, { once: true });
    ph.addEventListener('animationend', () => { m.end = performance.now(); live = false;
      box.innerHTML = '<b>Add New timing</b>' +
        '<span>Tap → open: ' + ms(m.open - m.tap) + '</span>' +
        '<span>Open → first frame: ' + ms(m.shown - m.open) + '</span>' +
        '<span>First frame → slide starts: ' + ms((m.start || m.end) - m.shown) + '</span>' +
        '<span>Slide asked to start: ' + (m.go ? ms(m.go - m.tap) + ' after tap' : 'never') + '</span>' +
        '<span>Slide: ' + ms(m.end - (m.start || m.end)) + ' · ' + frames + ' frames</span>' +
        '<span>Longest freeze: ' + ms(gap) + '</span>' +
        '<span><b>Total: ' + ms(m.end - m.tap) + '</b></span>';
    }, { once: true });
  } };

  window.CTAddSheet = { open, close, get isOpen() { return dlg.open; } };
})();
