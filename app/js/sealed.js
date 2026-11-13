/* Sealed products (v52.75): packs, boxes, ETBs, UPCs, tins, bundles, decks. An entry is sealed when it was saved as sealed,
   or when its name or catalog details say so (older entries: the card number is "N/A" or the name names a sealed product).
   Sealed pictures are shown whole (never cropped to a card, never turned upright) and sealed entries skip Condition. */
(function () {
  'use strict';
  const RX = /\b(booster (pack|box|bundle|display|case)|sleeved booster|blister|elite trainer box|\bETB\b|ultra[- ]premium collection|\bUPC\b|premium collection|special collection|collection box|collection\b.*\bbox|gift box|\btin\b|mini tin|build ?(&|and) ?battle|starter (deck|set)|structure deck|theme deck|preconstructed|commander deck|battle deck|league battle deck|deck box|prerelease (kit|pack)|bundle|display box|sealed case|booster$)\b/i;
  function is(x) {
    if (!x) return false;
    if (x.sealed === true) return true; if (x.sealed === false) return false;
    const num = String(x.num || x.number || '').trim(), r = String(x.r || x.rarity || '').trim(), n = String(x.n || x.name || '');
    if (/^(sealed|sealed product)$/i.test(r)) return true;
    if (/\d/.test(num) && !/^n\/?a$/i.test(num)) return false;                 // a real card number means a card
    if (/ - [A-Z]*[0-9][\w-]*\/\d+( - |$)/i.test(n) || / - [A-Z]{2,5}\d*-\d{2,3}( - |$)/.test(n)) return false;
    if (/^n\/?a$/i.test(num) && RX.test(n)) return true;
    if (/ - N\/A( - |$)/.test(n) && RX.test(n)) return true;
    return RX.test(n.split(' - ')[0]);
  }
  window.CTSealed = { is };
})();
