# Card Tab app: development notes (paused 2026-11-02, revisit after Nick's next request)

## Decisions (Nick approved)
- Entry is free text, parsed (like his Cash Flow sheet). Chips show what was understood.
- Art: TCGplayer image via JustTCG tcgplayerId (https://tcgplayer-cdn.tcgplayer.com/product/{id}_in_1000x1000.jpg). Save our own copy, rename, strip metadata, WebP (list 240w, detail 640w), AVIF later. Fallbacks: TCGdex (old Pokemon), own uploads. Nick accepts the TCGplayer art risk.
- Test result: 15/15 cards found, 15/15 images loaded, ~125 KB originals, real card proportions (no padding). Old cards low-res (Base Set Raichu 322x450, 5th Anniv Broly 260x363).
- "Which one is your card?" picker: 2 columns. Pre-select only when confident (clear winner via typed hints, e.g. "5th Anniv."); otherwise ask. Remember answers.
- Bulk entry: sheet stays open after Save, search box refocused, platform/type/shipping remembered, one running net total (sales +, purchases -).
- Price step uses the phone's own keyboard (no in-app keypad); sale shows "you keep $X" (assumes 13.25% + $0.30 fee + shipping).

## Built (in /home/claude, zip: cardtab-app.zip)
- app/parser.js: 198/198 sheet lines get a name; number 110, set 169, grade 28, qty 112. Leftovers: multi-card lines, sealed packs, double-colon set names (to go to a small cached AI step later).
- app/lookup.js: built-in sample catalog + ranking + remote() to the Worker (falls back to sample).
- app/app.js, app/index.html: the sheet. window.CARDTAB_API empty = sample mode.
- api/: Cloudflare Worker (D1 cache, R2 art, JustTCG key as secret JUSTTCG_API_KEY). Offline tests pass (node api/test.mjs). NOT deployed or tested against real JustTCG.

## Open / next
- Nick deploys the Worker (api/README.md): D1, R2, secret, deploy, enable image resizing; then test Raichu, BT29-086, Broly.
- Unverified: JustTCG game ids for Dragon Ball/Fusion World (guessed regex in gameId()); Cloudflare image resizing availability; real iPhone check.
- Rotate the JustTCG key before launch (it was pasted in chat). JustTCG: free 1K/month 100/day; paid $19 = 10K/month, 1K/day, 50/min, 100 cards/request.
- Later: AI step for parser leftovers, picks table use, AVIF, empty search state, signup gate etc.

## Previews (artifacts)
Search step https://claude.ai/artifact/54GP2em6K97QyeEGvsdBdU ; bulk flow https://claude.ai/artifact/PjkiHXthEZZskdkoe9erMi ; price step https://claude.ai/artifact/LTp9MVby5Hs6CUVUcTg8JX

## Fee accuracy (added 2026-11-03)
- Nick's promise: fees and shipping are exact to the cent, never an estimate. The prototype's 13.25% + $0.30 is only a placeholder.
- Before the app (or the site) claims exact fees: build verified per-platform fee tables (eBay, TCGplayer, Mercari, Whatnot, etc.) from each platform's own published pages, including per-order fixed fees that change by order size (third-party source says eBay is $0.30 up to $10, $0.40 over; trading-card category rate unconfirmed, 13.25% vs 13.6%). Take real shipping from the user's entry.
- Site copy meanwhile (step 2 on the site): "Add your fees and shipping, and Card Tab does the math to the cent." Upgrade to "Fees and shipping are calculated to the cent" only after the tables exist.
- Same idea as the monthly shipping-rate check Nick approved earlier: re-check fee tables regularly and flag changes before applying.

## Main screen + sign-in decisions (added 2026-11-03)
- Preview: https://claude.ai/artifact/WcVYii598QZ4nSWrXcyFuw (Free/Premium switch; Sign in, Dashboard, First run, Nearing limit, Limit reached).
- Post-login landing = the dashboard (stats, Insights Monthly/Fees/Ask, search, filters, list), modeled on the site demo and the Apps Script app.
- Auth: Google + emailed sign-in link, no passwords (single-use, ~15 min expiry, long-lived device session ~30 days). Sender e.g. login@cardtab.app set up after the Cloudflare move. Sign-in page reached from the marketing site; early-access emails get the $4/mo lock-in.
- Usage meter hidden in avatar menu (plan, bar, Upgrade, Settings, Fees & shipping, Export, Sign out). Avatar dot + "N entries left" at 17/20; at 20/20 banner + Add New disabled; resets 1st of month.
- First run: Premium leads with Import; Free leads with Add New and shows Import as a Premium-tagged link (import is Premium per the pricing).
- Decided: Free users do NOT see Import at first. Premium-tagged Import appears later (after a few sign-ins, or when nearing the limit late in the month). No Apple sign-in at launch (needs a paid Apple developer account, about $99/year; revisit if a native iOS app happens).
- Next: build real screens local-first (device storage, no backend), attach the Add-card sheet; real auth waits for the Cloudflare move.

## Drop 1 built (2026-11-03)
Local-first store, dashboard and sign-in, all in app/ (see README.md). Tested in Chromium at desktop and iPhone size, light and dark.
- Store: IndexedDB, one database per signed-in email; money in whole cents; ids, timestamps and soft deletes so sync can be added later. Undo stack (30 steps). Other open tabs refresh automatically.
- Usage counts entries added this month (adds and duplicates). Edits are free. Counted by when an entry was added, not its date. Deleting an entry added this month gives the slot back (Nick agreed 2026-11-03); deleting one from an earlier month doesn't. Sample entries from Testing tools don't count.
- Refunds are treated as money back on a purchase: Spent = purchases minus refunds.
- Sales store "after fees and shipping" as typed by the user, so fees shown are exact (sale minus what reached you). No estimated fee is used anywhere in Drop 1.
- Free: tiles, chart caption and fees cover this month; the monthly chart shows the last 3 months; the list always shows every entry with all filters. Premium: everything follows the date range (all time chart shows up to the latest 12 months).
- Free first run leads with Add New; the Premium-tagged Import link appears after 3 different sign-in days or when at 17+ entries on/after the 20th. Premium first run leads with Import (wired in Drop 2).
- Ask and full-screen Card Board show Premium notes (Free) or "coming in a later update" (Premium).
- Add New opens a simple form for now (type, card, amount, after fees for sales, qty, date, platform, condition, note). Drop 2 swaps in the free-text add-card sheet for adding; Edit keeps this form.
- Local mode (auth.js LOCAL_MODE): either sign-in button signs in on this device. Real auth after the Cloudflare move.

## Open questions for Nick
- Free chart: last 3 months (matches the 3-month report history) or this month only?
- Refund meaning: always money back on a purchase, or can it also be a refund you gave a buyer?

## Drop 2, step 1: add-card sheet connected (2026-11-03)
- + Add New opens the approved free-text sheet (app/js/addsheet.js, css/addsheet.css; parser.js and lookup.js copied into app/js). Saves through the store, so Free limits, undo and the dashboard all apply. The sheet stays open for the next card with one running session total.
- Changed from the approved prototype: sales ask for "After fees and shipping" (what reached you) instead of showing the 13.25% + $0.30 estimate, and the shipping choice is gone (it only fed that estimate). Added "Add as typed" for cards the catalog doesn't know, and a "Refund or something else? Use the full form" link. Names save in the "Name - number - set" format; graded cards note the grade.
- Card lookup still uses the 12-card sample catalog with colored placeholders for art. Real lookups and art switch on by setting window.CARDTAB_API in index.html once the Worker is deployed (after the Cloudflare move).
- The prototype's standalone page stays in app/add-sheet/ for reference.
- Next in Drop 2: Import (Premium), nudges.
