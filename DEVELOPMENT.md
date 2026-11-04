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
- Refunds (decided 2026-11-03, matching Nick's Cash Flow sheet): a refund is money paid back to a buyer on a sale, so it comes out of After fees. A refund received on a purchase is handled by editing that purchase.
- Sales store "after fees and shipping" as typed by the user, so fees shown are exact (sale minus what reached you). No estimated fee is used anywhere in Drop 1.
- Free: tiles, chart caption and fees cover this month; the monthly chart shows the last 3 months; the list always shows every entry with all filters. Premium: everything follows the date range (all time chart shows up to the latest 12 months).
- Free first run leads with Add New; the Premium-tagged Import link appears after 3 different sign-in days or when at 17+ entries on/after the 20th. Premium first run leads with Import (wired in Drop 2).
- Ask and full-screen Card Board show Premium notes (Free) or "coming in a later update" (Premium).
- Add New opens a simple form for now (type, card, amount, after fees for sales, qty, date, platform, condition, note). Drop 2 swaps in the free-text add-card sheet for adding; Edit keeps this form.
- Local mode (auth.js LOCAL_MODE): either sign-in button signs in on this device. Real auth after the Cloudflare move.

## Open questions for Nick
- Free chart: last 3 months (matches the 3-month report history) or this month only?

## Drop 2, step 1: add-card sheet connected (2026-11-03)
- + Add New opens the approved free-text sheet (app/js/addsheet.js, css/addsheet.css; parser.js and lookup.js copied into app/js). Saves through the store, so Free limits, undo and the dashboard all apply. The sheet stays open for the next card with one running session total.
- Changed from the approved prototype: sales ask for "After fees and shipping" (what reached you) instead of showing the 13.25% + $0.30 estimate, and the shipping choice is gone (it only fed that estimate). Added "Add as typed" for cards the catalog doesn't know, and a "Refund or something else? Use the full form" link. Names save in the "Name - number - set" format; graded cards note the grade.
- Card lookup still uses the 12-card sample catalog with colored placeholders for art. Real lookups and art switch on by setting window.CARDTAB_API in index.html once the Worker is deployed (after the Cloudflare move).
- The prototype's standalone page stays in app/add-sheet/ for reference.
- Next in Drop 2: Import (Premium), nudges.

## Sales breakdown, delete animation, smoothness (2026-11-03)
- Sales now record sale price, transaction fees and the seller's shipping cost separately (cents); what you keep is worked out from them, shown live as "You keep $X". "Sold for" includes any shipping the buyer paid. Shipping is remembered from the last sale. Older sales with only "after fees" still work. Export has fees and shipping columns. Purchases are labeled "Total paid".
- Delete folds the entry away (and its month heading if it was the last one), then removes it; Undo slides it back in.
- Smoothness: entries are contained and off-screen entries are skipped (content-visibility). With 200 entries at 4x CPU slowdown, dropped frames per open/close went from 9 to about 1-3 on desktop. Placeholder art scales with its tile. Tap handling matches the site (touch-action: manipulation, no grey tap flash).
- Dark mode: the add sheet's search box, segments and fields use a lighter fill and a quiet outline so they're visible without focus.
- Not testable here: real Safari/iPhone. If open/close still feels off on a device, note which device and browser.

## Roadmap (agreed 2026-11-03)
1. Thursday Nov 5: Cloudflare domain move; app online (Pages), app.cardtab.app attached.
2. Real sign-in (Google + emailed link) and online saving across devices.
3. **Payments: remind Nick here.** Leaning Stripe (Checkout + Billing + Customer Portal); decide on sales tax handling: plain Stripe, Stripe Managed Payments (+3.5%, confirm US eligibility) or Paddle (5% + 50c). Push the yearly plan (fixed per-charge fees hurt $4/mo most).
4. Launch.
Meanwhile (no Cloudflare needed): Import (CSV/Excel, Premium) DONE; next Card Board on real data.

**Don't forget (Nick asked): art for imported entries.** When the Worker is live, run an art pass over entries: exact match via entry.ref (TCGplayer id / TCGdex id) first, else entry.artSource (the sheet's own image link), else keep the letter placeholder. The Worker fetches, converts to WebP (AVIF later), list ~240px wide and detail ~640px, renames, strips metadata, stores in R2. Fill existing entries automatically, no re-import. Google thumbnail links (encrypted-tbn) are low quality; prefer a match.

## Import built (2026-11-03)
- app/js/xlsx-lite.js: reads .xlsx (rows, dates, cell notes) and CSV on the device with the browser's DecompressionStream; no outside library. Old .xls asks to resave.
- app/js/importer.js: finds the sheet and header row, maps columns by name (Date, Transaction/Type, Platform, Items/Card, Gross, Net, Purchase, Fees, Shipping, Qty, Condition, Notes, Image), reads dates and money in many formats, infers type when missing. Sales: Gross and Net are the source of truth; note text ("fees", "stamp", "tracking", "shipping", typos like "shupping") splits the difference into fees and shipping only when it adds up exactly, else kept as one combined amount and listed. Image links keep TCGplayer product ids and TCGdex ids (entry.ref) for exact matching later; parser fields saved in entry.parsed; entry.match = exact | name | typed.
- app/js/import-ui.js (simplified 2026-11-03 at Nick's request): Pick a file -> one Review screen ("We read the X tab", totals, first rows with fees/shipping "from your note", cell notes read count, optional rows-to-check). Columns are matched automatically; "Fix columns" (5 core fields, more on request) opens only on request or when no date/amount column is found. Re-importing skips entries already there (fingerprint). One Undo removes the whole import. Imports don't use Free slots (Import is Premium).
- Tested on Nick's Card_Collection.xlsx (Cash Flow): 199 rows; After fees $3,876.57, Spent $2,812.53, Profit $1,064.04 match his sheet to the cent. Sales shows $4,724.37 vs his $4,599.37 because two gift-card rows have only Net; they count as sold for that amount with no fees. 135 rows exact-match ready, 50 by name, 14 typed (multi-card lines, slabs without set). 56 sales split, 42 combined.
- Platforms: "TCGPlayer" -> TCGplayer, "Marketplace" -> Facebook Marketplace (Nick confirmed). Custom platforms: "+ Add your own…" in the add sheet, or typing a new one in the full form; saved per account (meta.customPlatforms), never shared. Managing/removing them belongs in Settings later.
- Next for Import, once the Worker is live: a matching pass over entries with entry.ref / entry.parsed to fill art and canonical names, plus a "Which one is your card?" queue for ambiguous ones (respect JustTCG daily limits; batch and cache).
- Import screens simplified again (2026-11-03, Nick: "as simple as an Apple sign-up"): 1 Choose file (one sentence, one button, drop anywhere) -> 2 "199 entries found", date range, tab picker only for multi-tab files, 3 rows styled like dashboard entries, Profit, one Import button, quiet "Fix columns" -> checkmark "199 entries imported" -> dashboard. No step pills, counts of notes/fees/matching, or rows-to-check list on screen (notes still read and fees split silently). Missing date/amount, and Fix columns, ask one question at a time with tappable column pills.

## Card Board preview (2026-11-03)
- Interactive preview: https://claude.ai/artifact/9LyjnNkSAY5zDYUbMZM1QY (Nick's real 199 entries). Nick's requirement: clicking the Insights full-screen button must smoothly grow the panel into a full-page Card Board (clip-path morph from the panel's rectangle, ~0.5s, site easing), widgets settle in one after another, bars grow; closing shrinks it back into the panel. Reduced motion: instant.
- Widgets in the preview: period pills (3M / 6M / 1Y / All), Profit, Sales, Spent, Fees and shipping (% of sales), Profit by month (hover details), Where your money went (spent by platform), What each platform kept (fees + shipping as % of sales), Biggest sales (top 5), Best and worst month. Not yet: resizing/rearranging widgets, drill-down, filters.
- Card Board preview v2 (same link): rebuilt in the site's Card Board design (styles extracted from the site build, cardtab-site_48: rounded cards, kpi, sell-through, SVG profit bars with "best month" callout, Where you buy chips, Your biggest win with card art, Spend vs budget) plus the four money cards on top, which Nick liked. Period menu like the site's (Last 12 months, This year, 2025, All time). Sell-through counts everything bought/sold up to the period's end. Budget is an example ($150/mo) until the budget feature exists. Biggest win uses a placeholder card until card art is live. Sources in tools/ (board-part.*, build-cb.py, site-cb.css).
- Card Board preview v3 (same link, 2026-11-03): customizable board. Title at 70% size (20px). Customize mode: per-widget toolbar (drag handle and S/M/L/W/F sizes on desktop; up/down on phones; remove), "Add widget" tile, Reset to default; widget ⋯ menu (size, change metric, duplicate, remove). Grid is 12 columns with dense packing; layout changes animate (FLIP). Add a widget: metric (Profit, Sales, Spent, Fees and shipping, Entries, Average sale, Profit margin, Return on spend) x view (Number with ▲/▼ vs previous period and sparkline, By month, By platform, Top list) x allowed sizes, with live preview. Board-wide platform filter next to the period menu. Layout saved per browser (localStorage) in the preview; in the app it belongs in the account (synced). Sources: tools/board3.js, board3.css, build-cb.py.
- Card Board preview v4 (same link, 2026-11-03), agreed direction: a fixed set of ten widgets (Profit, Sales, Spent, Fees and shipping, Profit by month, How much of it sold, Where you buy, What each platform kept, Your biggest win, Spend vs budget), each once per board, in Small / Medium / Large = a quarter / half / full width of 12 columns (30 designed layouts). Widgets lay out from their own width (CSS container queries), so they stay clean while resizing and on phones (phones: number widgets two across, others full width). Resize by dragging a corner grip in Customize mode; it snaps between the three sizes with a size label and the board re-packs live (keyboard: arrow keys on the grip). Toolbar: drag handle and remove (phones: up/down and remove). ⋯ menu: size and remove. Add widget lists the widgets not on the board, with size and live preview. Hover and tap behavior copied from the site: bars widen (scaleX 1.07) with the site's .cb-tip tooltip; list rows highlight and open a detail line, one at a time. More metrics can be added later once the design and behavior are right (Nick).
- Live corner resize (Nick: resizing must be live): while dragging the grip the widget's width follows the drag continuously (faster near the screen's right edge so Large stays reachable), its contents re-lay out through container queries, and neighbors re-pack with FLIP whenever it needs another column (it takes a temporary column span during the drag). On release it glides (width transition) to the nearest of S/M/L; a label shows which size it will land on. In narrow windows S and M share half width.
- Agreed next (Nick said all sounds right): start new boards with four widgets (Profit M, Profit by month M, Where you buy S, Spend vs budget S) plus a "Make it yours" tile suggesting one widget at a time; every widget gets a second action (numbers and months click through to the filtered entries list; rows open details; bars show tooltips); Card Stories live as a second tab inside Card Board (Card Board | Card Stories, like the site), with doorways: "Your October story is ready" card in Insights, Year in Cards banner in December, "Make a story" in Card Board. Free: basic monthly story, last 3 months; Premium: any range and design, Year in Cards. Ideas for later: data-light empty states, blurred own-data Card Board for Free, saved boards.

### Card Board resize v2 (Nov 3)
- Corner grab has a large hit area (34px grip + 18px slop; 40px on touch).
- While dragging: the widget's content hides, a clean "ghost" card follows the pointer, a dashed outline shows the S/M/L width it will snap to, and faint grid columns appear behind the board (2 columns on phones). The rest of the board does not reflow mid-drag.
- On release: ghost glides into its final spot, other widgets move once (FLIP), content fades back in.
- No dimming of other widgets during resize; it caused dropped frames on throttled CPUs.
- Top bar: "‹ Dashboard" back button and the account avatar menu.

### Card Board v6: every widget at every size (Nov 3)
- Grid of squares: 4 across on desktop and tablet, 2 across on phones. Rows are fixed height (184px; phones about a square).
- Sizes: Small 1×1, Wide 2×1, Large 2×2, Extra large full width × 2 (desktop/tablet only; on phones it shows as Large).
- All 10 metrics have a hand-made layout for each size (`body(k, ctx, size)` in `tools/board5.js`). Small sizes use short titles (Fees, Best month, Sold, Buy from, Top fees, Biggest win, Budget).
- Big numbers size themselves to their box (`.bn`, font from container width ÷ character count), so they never clip.
- Charts are drawn at the exact pixel size of their box after layout (`cv()` + `fillCharts()`).
- Corner resize now changes width and height together and snaps to the nearest size, measured in cells, with a small bias toward the current size to prevent flicker. The page scrolls when you drag near the top or bottom edge.
- Customize: remove badge on the top-left corner, drag the card itself to move (mouse: after 5px; touch: press and hold for 280ms so the page still scrolls), grip to resize. The ⋯ menu has sizes, move earlier/later and remove for keyboard users. Arrow keys on the grip step through the sizes.
- Layout entries now have ids (`{id,k,size}`, key `cb.layout.v3`), so the same metric can appear more than once.
- The Add widget panel lists all 10 metrics at any size, with a preview at the real size.
