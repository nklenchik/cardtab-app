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

### Card Board v7: haptics, account menu, avatar, export (Nov 4)
- Haptics (`buzz()` in `tools/board5.js`), touch devices only, with a switch in the account menu:
  - tick (6ms): grab a resize corner, each snap to a new size, hovering a new drop spot, picking a color
  - tap (12ms): enter Customize, pick a widget up to move it
  - firm (20ms): a widget lands at a new size or place, a widget is added, a save or export finishes
  - warn (14·70·14ms): remove a widget
  - Nothing while scrolling or between snaps; ticks are spaced at least 45ms apart.
  - Android uses `navigator.vibrate`. iPhone Safari can't vibrate from web pages, so it clicks a hidden `<input type="checkbox" switch>`, which gives the system's light tick on iOS 18+ (unofficial, may change). The native app should use real haptics later.
- Account menu with line icons:
  - Edit profile, Plan and billing
  - Import entries, Export
  - Platforms and fees, Budget and goals
  - Appearance (Light / Dark / Auto), Haptics switch (touch devices only)
  - Help and feedback, Sign out
  - Items that need the real app show a toast in the preview.
- Avatar: your first initial on one of 8 colors, or a photo uploaded or taken with the camera (Take photo shows on touch devices only). Photos are shrunk to 1024px on the way in, positioned with drag plus a zoom slider or the scroll wheel, and saved as a 256px WebP (JPEG fallback).
- Export:
  - entries as CSV, or Excel (SheetJS, loaded only when needed)
  - the board as a PDF (html-to-image + jsPDF, loaded only when needed)
  - the board as PNG, JPG or WebP (html-to-image, loaded only when needed)
- Escape no longer closes the whole board when a dialog is open.
- In the claude.ai preview, files go through the viewer's save prompt (`downloads` capability). Elsewhere a normal download link is used. The real app will use normal downloads.

### Card Board v8: motion pass (Nov 4)
- Decisions (Nick): add Banner 4×1; no spacers; keep the desktop top bar; names now, usernames later with Stories.
- Open/close: the board is built ahead of time while you're on the dashboard (idle callback) and kept invisible (`.cbx.off`, opacity 0, inert). A background panel grows from the Insights panel using transform only (GPU), then the content fades in. Close reverses this. No clip-path animation any more.
  - At 4× CPU slowdown, worst open frame went from 467ms to about 33–50ms.
- Move: a floating copy follows the pointer and the widget's own spot becomes a dashed landing slot. Other widgets slide out of the way live (FLIP), and a widget can't swap back until the pointer has left it. On release the copy glides into the slot.
- Resize: the widget itself is the landing slot. On each snap, the board makes room live (only on snap, not every pixel). The ghost moves with transform and is size-contained.
- `flip()` cancels in-progress moves before measuring, so a reshuffle mid-animation starts from where things are on screen.
- Wiggle in Edit mode: rotate-only keyframes, smaller on bigger widgets, each widget out of step. Off while dragging or resizing, and for reduced motion.
- Headless tests have no GPU, so composited rotation shows up as slower there than it will on real hardware.

### Card Board v9: time ranges, Banner, toolbar, profile (Nov 4)
- Time ranges, shortest to longest: Last 7 days, Last 30 days, This year, Last 12 months, Last year, All time, then Custom dates…
  - "2025" became "Last year".
  - Custom dates go back to the account start, or the first entry if older entries were imported.
  - Ranges work in days. Up to 31 days charts by day, up to about 4 months by week, longer by month. Titles and labels follow ("Profit by week", "Best day").
  - "vs previous period" compares against the same number of days just before.
- All bars are one color; hover darkens the bar. No special color for the best month (its label stays).
- Banner size (4×1, desktop/tablet; shows as Wide on phones), with a layout for each metric.
- "Show trend" switch per number widget in the ⋯ menu. Hiding it gives the number more room.
- ⋯ menu: size picker with small shape icons that fit in one row, Show trend, Move up / Move down, Remove. Available in Edit mode too.
- Resize precision: the corner follows the pointer 1:1 from where you grabbed it (no more amplification near the right edge). Widgets touching the right edge put their grip on the bottom-left and grow leftward. Stronger hysteresis (0.3 cell), so small trackpad wobbles don't change the size.
- Toolbar: Edit (pencil) first, then time range, then platforms. Reset is at the far end (far right on phones, scroll the row) and asks "Reset the board?" with No / Yes, reset. Add widget is a bar at the top of the board in Edit mode.
- Edit profile: first and last name, "Show my name as" First name / Full name, 8 colors plus a full color picker (native) and a hex field. The letter switches between dark and white for readability.
- Real app: the dashboard's account menu (app/js/main.js) should be replaced by this same menu when Card Board moves into the app, so it's identical everywhere.

### Card Board v10: add gallery, range calendar, compare, Share, Ask (Nov 4)
- Add widgets (Nick picked option 3 of 6 from `tools/add-widget-options.html`, plus search):
  - search box, All / Numbers / Charts / Lists, and a gallery of real small widgets
  - tap adds the widget to the top of the board at its usual size; tap again removes it; the badge changes from + to a rounded ✓
  - thumbs are `div role=button`, because widgets contain buttons and buttons can't be nested
- Custom dates:
  - a range calendar: From and To fields, month grid with 42px days, rounded selection, the range in a soft cranberry band, limited to the account start through today
  - Compare to: Previous period, Last year or Off. It applies to every range and is also in the time-range menu. KPI deltas read "vs previous period" or "vs last year".
- Share (preview; needs the Worker to be real):
  - link on/off with copy and "make a new link"
  - email invites (chips)
  - privacy switches: dollar amounts (off shows $•••), card names, details on hover and tap
  - Live or Today's snapshot; link stops working Never / 7 days / 30 days
  - "See what they'll see" shows the board with those choices applied and a banner to return
  - Real app: an unguessable ID per board, served read-only by the Worker, with masking done on the server (never send hidden values to viewers)
- Ask: a side panel on desktop, a tall sheet on phones; starter questions plus free text; streams answers
  - In the preview it uses Claude through the artifact `sample` capability, sending a compact text summary of the board: totals, comparison, per bucket, per platform, the last 40 entries
  - Real app: an Anthropic API call from the Worker with the same data shape. Premium-only with a monthly cap, because each question costs money.
- Google Drive import (Nick, when ready): use Google Picker with the drive.file scope (access only to the file the user picks). Avoid drive.readonly (a restricted scope with a yearly security assessment). Export the Sheet as .xlsx through the Drive API, then run it through CTImport. Ask for the permission only when they tap "Import from Google Drive".

### Card Board v11 (Nov 4)
- Rename widgets: ⋯ → Rename turns the title into a text field. Enter or click away saves, Escape cancels, and an empty name goes back to the suggested one. Stored as `w.name`.
- Edit profile color: a card like the calendar, with 8 swatches plus a rainbow swatch that opens our own picker (color square, hue slider, hex field). It replaces the browser's color dialog.
- Fixes: the Ask and search fields showed a second focus outline inside their frame; the Compare row in the time menu wrapped "Last year"; Share and Import had the same icon. Share is now a paper plane, Import a document with a plus.
- PINNED for later (Nick): a monthly budget setting for the app, and maybe the site demo. Suggested home: set it from the Spend vs budget widget itself ("Set your monthly budget") and from Budget and goals in the account menu, rather than in the toolbar, which holds filters.
- Proposed, awaiting Nick: card-art widgets, previewed with Card Stories. Ideas: Recent sales (a fanned stack), Top sellers (a row of card tops), Still holding (an art grid of unsold cards with cost), Biggest losses, Recent buys.
- Ask shows a monthly allowance under the box ("38 of 50 questions left this month"). At 5 or fewer it turns cranberry with the reset date, and at 0 the box is disabled. The preview counts per month in browser storage; the real app counts on the server. The 50 is a placeholder until pricing is set. The Ask header has the sparkle in a cranberry badge, like Premium.
- Edit profile picture is 25% smaller (135px); the photo crop math follows it (AVC).
- Card-art widgets (Recent sales, Top sellers, Still holding, Biggest losses, Recent buys): Nick likes them only if they're as clean as Apple or Google would make them. Preview them alongside Card Stories before building.
- Number widgets: the change % (for example "▲ 494%") sits beside the widget name, wrapping under it on narrow widgets, and "vs previous period" is gone from the widget. The comparison is still in its tooltip and screen-reader label. With Compare off, the count (for example "75 entries") shows under the number instead.
- Phone top bar: back, name and your picture on the first row; the toolbar (Edit, time range, platforms) on the second row, with Ask and Share held to the right. In Edit mode, Ask and Share step aside and the toolbar takes the full row, with Reset at its end.
- Hiding the trend on a Small number widget centers the number vertically. It stays left-aligned, to line up with the name above it.
- Audit fixes:
  - Number widgets crashed when there was nothing to compare against (Compare off, or a platform with no earlier data). Fixed.
  - Phone time and platform menus were cut off inside the scrolling toolbar. They now float under their button (`placeMenu`).
  - Edit-mode resize handles covered widget text. They're now small round handles on each widget's bottom edge, just inside its corner.
  - `tools/t57.js` sweeps every widget × size × Compare mode × range on phone and desktop for errors and overflow; it's clean.
- Haptics: Nick can't feel them on his phone. iPhone web pages can't vibrate, and the switch workaround is unreliable (it needs iOS 18+, System Haptics on, and seems to fire only on taps, not drags). Real haptics need the native app wrapper (for example Capacitor).
- Sheets (Add widgets, Edit profile, Custom dates, Share, Reset): the title stays pinned at the top and the main button (Done / Save / Show these dates / See what they'll see / Yes, reset) at the bottom, so only the middle scrolls and the action never needs scrolling to reach. `tools/t59.js` checks every main button is on screen at 1280×720 and 390×700.
- Sheet scrolling, revised: the sheet itself never scrolls. A script wraps everything between the title and the main button in `.awbody`, which scrolls on its own, with its own scrollbar and soft edge shadows. Pinned headers had clipped the gallery's + badges.
- Edit mode top bar holds only "Card Board", a quiet "Drag to move · drag a corner to resize" under it, and a solid cranberry Done on the right. Back, the time range, platforms, Ask, Share and your picture hide until Done. Reset moved to the bottom of the board ("Reset to the starting layout"), far from Done, and still asks first.
- The board is titled with the first name ("Nick's Card Board"), updating live when the profile name changes; long names shorten with an ellipsis. The Premium pill left the title (it stays in the account menu). Usernames can replace the first name later.

### Card Board v12: starter board, entries, undo, remembered view, motion (Nov 4)
- New accounts start with four widgets: Profit, Sales, Spent (Small) and Profit by month (Banner). A dashed "Make it yours" tile (it opens Edit plus Add widgets) shows until the first change (`cb.custom`); Reset brings it back.
- See the entries behind a number (not in Edit mode or viewer mode):
  - Number widgets: click the number to see the matching entries (Profit: all; Sales: sales; Spent: purchases; Fees: sales with fees).
  - Any bar (number widgets, Profit by month, Budget): that day, week or month.
  - Where you buy, What each platform kept and How much of it sold: "See entries ›" in an opened row, or tapping a compact row.
  - Biggest win: every entry for that card.
  - The sheet groups entries by month, newest first, with type pills, "you kept", and a net total; it shows up to 300 entries.
- Undo: removing a widget shows "[Name] removed · Undo" for 5 seconds and puts it back where it was.
- The time range (including custom dates) and platform are remembered between visits (`cb.view`).
- Motion, all transform and opacity:
  - menus pop from their button, with the account menu items staggered
  - sheets spring in on desktop and slide up on phones, with their contents fading up in sequence
  - the backdrop fades in and out; closing animates (dialog.close is wrapped; Escape is handled through "cancel")
  - the profile picture pops in, the Ask sparkle gives a little spin, and Copy link turns green with "Copied ✓"
  - at a 4× slowed CPU, Share, Profile and Ask open with 1–2 slow frames out of about 40
- Empty-board hints are on hold until Card Board moves into the app (they depend on how adding entries works there).

### Card Stories preview (Nov 4)
- Nick: keep Card Board and Stories clean and simple. No customization in Stories.
- `tools/stories.tpl.html` (data injected from cb-data2.json) has four working mocks:
  1. A Board | Stories switch with month covers; tap one for a full-screen recap: tap right or left, hold to pause, Escape or ✕ to close. Five slides written from the month's numbers: cover, money (positive "You came out ahead" or kind "A building month"), best flip (tap for its journey) or biggest buy, where you sold with fees, then a wrap-up vs last month with See entries / Share story.
  2. Card journeys: each bought-and-sold card as a 3-slide story (bought → sold → fees → result).
  3. Milestones (could come later).
  4. Card-art widgets: Recent sales (fan), Top sales (card tops), Still holding (art grid plus total paid), Biggest loss, Recent buys.

### Card Board v13: room to breathe (Nov 4)
- Back to the site's proportions:
  - padding 22/24px (Small 18/20; phones 18 and 15/16)
  - rows 206px with 16px gaps (phones 14px)
  - titles 18px, bold, in the main text color (Small 15.5px; phones 16 and 14)
- Quieter: the ⋯ button appears on hover on computers (always shown while editing and on touch screens); count captions on number widgets are hidden in normal view (they're in the entries sheet); trend lines are soft grey, so the number carries the color.
- Phone Wide lists show 2 rows instead of 3.
- `tools/t57.js` sweep: no overflow at any size, compare mode or range.
- Next: rebuild the Card Stories preview to match the original site design: 4–5 story cards, a Showing switch per card, 20+ themes, tap to enlarge, save or share as an image, Year in Cards. The month-recap player is retired; its best parts become card options.
- Add gallery: the confirmation ("Sales added to the top of your board") now replaces the tip line in place for 1.8 seconds instead of floating over it (it overlapped on phones and desktop).

### Card Stories preview v2: the original design (Nov 4)
- Rebuilt to match the site's original Card Stories (`tools/stories2.tpl.html`). The month-recap player is retired.
- A Board | Stories switch, a time range (Last 12 months, this year, last year as the Year in Cards, All time), and a theme row with 24 themes. Themes give each story its own colors and are remembered (`cs.theme`).
- Five 9:16 story cards, all sized in container units, so they read the same small or enlarged. Each has a "Showing" switch with three choices:
  1. The money: Profit / Sales / ROI (area line of cumulative profit)
  2. Your biggest win: Biggest win / Its journey / Biggest sale (card art with a sticker)
  3. Where you buy: Top platform / Per card / Runner-up (bars)
  4. Staying accountable: Months under / Avg spend / Lightest month (budget bars)
  5. Your collection: Sold % / Still holding / Busiest month (fan of cards)
- Tap a story to enlarge it, with Save image / Share (preview notes say these work in the app). Headlines use short card names (text before the first comma).
- Themes: Jewel, Voltage, Dusk, Cranberry, Mint, Ocean, Sunset, Mono, Paper, Neon, Forest, Grape, Citrus, Rose, Slate, Midnight, Sand, Lava, Ice, Bubblegum, Gold, Holo, Matcha, Retro.
- Stories v2.1 (Nick):
  - No Board | Stories switch. Stories is its own page ("Nick's Card Stories", with "‹ Card Board" back); the board gets a "Stories" button next to Ask and Share.
  - The time range is a dropdown: Last 12 months, This year, Last year, All time, then "Custom range…" (pick a first and last month).
  - Themes: five chips plus "All 24 themes ›", which opens a two-column list with color strips. A picked theme outside the first five takes the last chip's place.

### Stories v2.2 — phones
- Range menu anchors left on phones and flips back on screen if it would overflow.
- Theme chips are one swipeable row on phones (All themes at the end).
- Enlarged story is full-screen on phones with a bottom bar: round ✕, Save image, Share (never wraps, 48px).
- Test: tools/t69.js at 375/390/430.

### Stories v2.3
- Fixed: enlarged story was invisible on phones (0 width); now sized to its space with container units.
- Themes sheet mirrors Card Board sheets: title + hint line that confirms the pick, own scroll, Done pinned. Same circle swatches as the chips, roomier 64px tiles. Picking no longer closes the sheet.

### Card Board v14 + Stories v2.4 — linked
- Own screens say "Card Board" / "Card Stories"; shared views ("See what they’ll see") keep "Nick’s Card Board"; story images keep the name in the footer ("Nick · Card Tab").
- Stories button (two-card icon) sits before Ask and Share; same icon-only rules; hidden while editing and in the shared view.
- Stories is its own page in an iframe (srcdoc, built from stories2.tpl.html), preloaded in the background, sliding in with a GPU transform. Back arrow or Escape returns to the board.
- Shared: name (parent.cbName), light/dark (cb.theme), time range (cb.view; 7/30 days fall back to Last 12 months, custom dates become months). Range changes inside Stories stay in Stories.
- Sources stay separate: edit stories2.tpl.html or board files independently; build-cb.py bundles Stories in.
- Test: tools/t70.js.

### v15 phone layouts A and B (separate previews; main board unchanged except the new Stories icon)
- Build: python3 build-cb.py A|B -> card-board-a.html / card-board-b.html (sets html[data-cbv], adds board13.css/js, Stories gets html.vA/vB).
- Both: bare ‹ back on phones; Stories/Ask/Share move into a floating thumb bar (hides while editing, in the shared view and when Stories is open; tucks away while scrolling down).
- A: Edit as a word top right, big "Card Board" title, range and platform as text under it; slim bar with the range appears after the title scrolls away.
- B: title row with ••• (sheet: Edit board + platform list) and avatar; range row 7D/30D/12M/YTD/All plus a calendar segment that opens the full range menu.
- Stories on phones (both): bottom bar to Save or Share the story in view; A also gets the big title.
- Stories icon is now the story card with progress bars (main board too).
- Test: tools/t71.js.

### v16 + Stories v2.6
- Main board uses phone layout A (build-cb.py with no argument). B kept as a build option only.
- Phone dates: tapping the range opens #cr as one bottom sheet (class pre): quick picks, Custom dates expands the calendar inside it, Compare applies right away. Desktop keeps the dropdown.
- Phone and desktop arrangements are separate: cb.layout.v3 (desktop) and cb.layout.phone.v1 (phone, starts as a copy of desktop). Added widgets go to both; remove/move/resize/reset only touch the current screen. Switch point is the 600px phone grid.
- Share icon is the filled curved arrow everywhere.
- Add widgets: the selected kind (All/Numbers/Charts/Lists) is a solid pill.
- Desktop Stories entrance: board eases back (scale .97, fades), Stories fades and settles from 1.03, header then cards rise one by one (csEnter). Phones keep the slide.
- Stories dates: same menu as the board; custom dates are month tiles (tap start, tap end; From/To to change one). On phones the range opens one sheet with quick picks + month tiles.
- Stories on phones shows 2 themes + All 24 themes.
- Test: tools/t72.js.

### Stories v2.7
- "All themes" chip: rainbow circle (conic gradient) and no count.
- Last month added: Last month · This year · Last 12 months · Last year · All time · Custom dates (months only).
- Any single-month range (Last month or one custom month): money line by day; Staying accountable becomes Budget (to spare/over) · Avg week · Lightest week; Busiest month becomes Busiest week (weeks are 1–7, 8–14, 15–21, 22–28, 29–end). If a month has no flips, Biggest win shows the biggest sale.
- Test: tools/t73.js.
