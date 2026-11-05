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

### Stories v2.8
- Theme dots match the site: each theme shows its three most distinct colors (story backgrounds, then accents), skipping pale creams/whites. Jewel = green, crimson, navy; Voltage = blue, yellow, navy.
- Phones fit as many theme chips as one line allows (at least two), then All themes; slightly tighter chips under 600px.

### v17 — smoother sheets
- Cause of the jank: (1) the Stories page was preloading (about 100ms of parsing at 4x slowdown) right when people tapped Share or Ask; (2) a sheet's first layout landed in the middle of its animation; (3) Ask focused its input, so the iPhone keyboard popped up mid-slide.
- Fixes: sheets open held on their first frame (class prep, animations paused) and start moving on the next frame; Stories preloads only when idle and no sheet is open; Ask focuses its input only on desktop, after the drawer settles; the phone thumb bar hides while a sheet is open.
- Phones: every sheet rises on the same soft curve, cubic-bezier(.32,.72,0,1), .48s; closes in .24s.
- Measured (tools/t74.js, 4x CPU slowdown): Share/Ask/dates/profile move with no frames over 33ms; the one heavier frame happens before motion starts.

### v18 — tap for a quick answer (option B)
- Touch devices (hover:none): bar charts scrub. Tap or slide across bars; the bar lights up, the others fade, and a two-line readout covers the widget header (month in bold, details under it) with a "See entries ›" button. Tap the same bar again, or anywhere else, to clear. Vertical scrolling still works (touch-action: pan-y; scrub starts after an 8px sideways move).
- Number tiles (profit, sales, spent, fees) flip to show how the number adds up, with "See entries ›". Tap again or anywhere else to flip back.
- List rows on touch open entries directly, without the tooltip flash.
- The Profit by month tooltip leads with Profit (desktop too).
- Phones: the entries list is a full-width bottom sheet (min(82dvh,720px)) with its header visible.
- Desktop unchanged: hover tooltips, and clicking opens entries.
- Test: tools/t76.js. Options preview: tools/tap-options.html.

### v18.1 — flip panel fits its tile
- iPhone Safari was enlarging the panel text (text autosizing), so it spilled out of the tile. Added html{-webkit-text-size-adjust:100%}.
- The panel now sizes to its tile: padding, gaps and text scale with the tile width (cqi, 11–13px), labels never wrap (ellipsis), centred with safe center, overflow hidden. Shorter labels: Fees, Avg per card, Of sales.
- Checked at 320/375/390/430 widths: every element stays inside the tile.

### v19 — flip panel per size, long-press to edit
- fitFlip() lays the flip panel out from the tile's real size. Squares and tall tiles (kv): two label/value lines, then the total big (up to 48px); wide tiles, ratio over 1.6 (kh): columns with label over value, the total on the right with a divider. Text sizes come from the tile width and height and from the longest value, clamped. "See entries" is a quiet link in small tiles and a pill when the short side is 230px or more.
- Checked on phone (390, 375) and iPad (1024), sizes S/M/L/X/B: everything fits; small tiles fill about 82% of their height.
- Long-press a widget for 480ms on touch (no more than 10px of movement, cancelled by scrolling) to enter Edit; it suppresses the click that follows and blocks the iPhone callout and text selection on widgets.
- Test: tools/t77.js.

### v20 — one motion language + consistency pass
- Recorded the sheets frame by frame (and at 12x slow-motion): Ask on desktop jumped about 60% of the way in the first two frames (springy curve .18,.89,.32,1.05), and on phones the contents of Share/Ask faded in piece by piece while the panel was still moving.
- Now every sheet moves as one solid piece on cubic-bezier(.2,.8,.2,1) with no bounce. Desktop: centered sheets fade and settle from 96% (.32s), Ask slides in from the right (.42s). Phones: everything rises from the bottom (.42s). Closing .18–.22s. The staggered item fade-in is gone. Traced at 4x slowdown: even steps, no jumps.
- List rows: straight hairline dividers inset to the content (they were row borders with rounded ends that poked past the padding).
- What each platform kept: names in one column so the bars line up, and each bar uses its platform's chip color (it was blue for all). Banner and Extra large now mirror Where you buy: the overall % on the left, the platforms on the right.
- Banners list in one column; Large and Extra large list tiles start at the top instead of floating mid-tile; Biggest win art in banners is full size (it was a 24px sliver); the How much of it sold caption may use two lines.
- Tests: tools/t78.js (video), t79.js (slow-motion frames), t80.js (every widget × every size, overflow check).

### v21 — sheets pinned to the visible screen; tap away to finish editing
- From Nick's iPhone recording (Claude app): the date sheet opened with its bottom mid-screen, its top cut off under the app bar, and its list already scrolled down. Inside the app, a full-height dialog does not match the visible area, and focus jumped to a row partway down the list.
- fitDialog(): every sheet is sized in pixels to window.visualViewport (top, width, height) when it opens and on resize; phone sheets cap at --vvh. settleDialog(): lists open scrolled to the top, and on touch nothing keeps focus (no jump, no ring).
- Edit mode: tapping anywhere that is not a widget or a control (gaps, margins, the area around Reset) finishes editing, like Done. Ignores clicks on elements replaced mid-click (the Edit button rewrites itself).
- Test: tools/t81.js.

### v22
- Desktop Ask is a panel under the Ask button that grows out of it (scale from .18 at the button, .46s, cubic-bezier(.2,.8,.2,1)); it shrinks back on close; lighter backdrop. Phones keep the bottom sheet.
- Close buttons are SVG icons in true 34px circles (box-sizing, padding 0, aspect-ratio 1) on every device. New chat is a matching 34px pill that never wraps; the Ask subtitle truncates.
- Best month label: 40px headroom, value 25px above the bar, the "best month" label 9.5px, 12px above the bar.

### Soft skin (test copy)
- python3 build-cb.py soft -> card-board-soft.html. Adds board14-soft.css only: nothing else changes.
- Page #f8f7f4 (dark #121110), white cards (dark #1f1d1b) with a hairline 1px border (same width, so nothing moves) and a faint shadow; buttons and the bottom bar get hairline edges; fine dotted row dividers; chart guide lines quieter; bars unchanged from the main board.
- tools/t82.js proves every widget and every child element sits at the same position and size as the main board, for all 10 kinds x 5 sizes on desktop and phone. Sheet timing matches the main board.
- Design preview: tools/soft-style.html.

### v23
- Share icon: an outlined, compact curved arrow (2px stroke, like the other icons) everywhere, including Stories.
- Add widgets previews: the mini widget's own border is hidden inside its tile, so the tile edge is clean (no second border, no clipped right edge).
- Soft skin: a little more shade (card fades to a hint of warm cream at the bottom, shadow .17), and Add widgets uses the same look (hairline tiles, same shade, softer badges, search, footer fade). Layout still identical (t82).

### v24 — soft look is the main look; navigation
- build-cb.py now includes board14-soft.css by default (pass nosoft for the old look).
- Share icon: Nick's outlined arrowshape (1.9 stroke) everywhere, Stories included.
- Add widgets keeps one height whatever the filter: min(860px, visible height - 40) on desktop, visible height - 12 on phones.
- Phones: menus (profile, platforms, widget ...) open centered over a dimmed screen (#mbd); the bottom bar hides while one is open; tapping the dim closes it.
- Back gesture / Android back / browser Back: a small history stack (navPush/navDone) in both the board and Stories. Opening the board, Stories, any sheet, any menu or an enlarged story adds a step; Back closes the newest; closing with a button removes its step (no stale history). Order checked: story, then Stories, then the board.
- Stories: tapping anywhere outside the enlarged story closes it.
- Test: tools/t84.js.

### v24.1
- Stories "Your collection / Sold": same rule as the board's How much of it sold (every card bought up to the end of the period, and how many have sold); it showed 100% with "36 bought, 71 sold" before. The fanned card letters sit in each card's top-left corner, so none hide behind the next card.
- Board: while a phone menu or any sheet is open, the board underneath is locked (no scrolling behind it).
- Profile menu: Light / Dark / Auto are equal-width pills with padding on both ends (the menu's full-width button rule was stretching them).
- tools/t86.js sweeps every period x every story option for text that runs out of a story.

### v24.2 — entries list in batches
- The entries sheet shows the newest 50 at once and adds 50 more whenever you get within about 800px of the end of the sheet's scroll area (it finds the element that actually scrolls). There is no cap (it used to stop silently at 300); the summary line always counts every entry. Month headers stay pinned while you scroll.

### v25 — the main app in the soft look, one profile menu, smoother everywhere
Look (app/css/soft.css; layout and behavior untouched):
- Same ground, cards and edges as the board: #f8f7f4 page (dark #121110), white tiles with a real 1px hairline border and the board's whisper shadow, 22px corners, bold dark tile titles, pill segmented controls (Insights tabs, the type tabs All / Sales / Purchases / Refunds), white hairline fields and pills with 14px inner padding, crimson primary buttons and links, round icon buttons on phones.
- Entries read as a receipt: white rows, dotted dividers, a torn edge under each month's last row (the row gets .ct-last while the list is built; no :has() selectors, which made every dialog open slower).
New pieces (app/css/new.css, js changes):
- Add a card: the sheet sizes itself to the space above the keyboard (visualViewport), results are a short list (tap one to go straight to price; "Change" undoes it), dragging the list drops the keyboard, slim white search, the board's close button, soft fade at the top of the results. text-size-adjust:100% stops iPhone enlarging text on its own.
- Open entry: stays white; fees / shipping / condition as small labeled stats, the fee % on its own line, Edit and Duplicate as pills, Delete as red text.
- Profile menu: the same menu as the board and Stories (header, Go to: Entries / Card Board / Card Stories with "You're here", the window's own middle group, Plan and billing, Platforms and fees, Appearance, Haptics, Help, Sign out). Appearance and haptics share the board's keys (cb.theme, cb.haptics). Centered with a backdrop on phones. Premium shows just the badge; Free keeps the usage bar.
- js/motion.js: sheets (#as, #ed, #imp) open and close with the board's exact motion (phones shUp .42s cubic-bezier(.2,.8,.2,1) / shDown .22s; desktop sheetIn .32s / sheetOut .18s), and one history stack makes Back close the top layer. A layer opened while a back step is still settling (menu -> Import) waits for it, so Back never skips a layer or leaves the app. Same fix applied to the board and Stories.
Speed (measured at 4x slower CPU with 240 entries, tools/perf-app.js and tools/perf-board.js):
- Changing a filter: 405ms -> 128ms. The list built a new number formatter for every amount and every month label; one shared formatter now (identical output, checked across 2 million amounts).
- Rows off screen skip layout and paint (content-visibility:auto).
- Board Add widgets: ~390ms -> ~145ms. The gallery measured and resized tiles one at a time (a layout per tile); it now measures once, and it's built in idle time when editing starts and reused.
- Board and Stories reuse their formatters too.
Board and Stories:
- Stories has its own avatar; it opens the board's menu (moved into a top-level holder above the Stories layer) with Save all stories and Story themes in the middle. Account rows chosen from Stories slide back to the board first.
- The board always covers the page beneath it (its background fills any gap when the phone's view grows or bounces), and the page beneath can't scroll while it's open.
Tests: tools/t87-app-nav.js, tools/t88-board-nav.js, tools/t84.js (still passes).

### v25.1 — phone header
- Phones: the profile sits alone in the top right (logo left), matching the board and Stories. Search, Export and a round crimson + (Add New, aria-label kept) share the row under it. Desktop unchanged. Search and Export keep the soft look in dark mode.

### v25.2 — Add New, buttery on phones
- The keyboard, the sheet's slide and the sheet's fit-above-keyboard used to fight: the sheet resized on every step of the keyboard animation while sliding. Now the search field is focused inside the tap (keyboard rises with the slide), nothing resizes the sheet while it moves, and it settles above the keyboard once after the slide (440ms). The sheet is anchored to the top on phones, so that settle only changes its hidden bottom edge.
- Closing drops the keyboard as the sheet starts to leave and slides it fully off (100vh, .26s), even when it was shortened above the keyboard.
- The page under any sheet is locked (html.ct-lock), so the keyboard can't nudge it.
- Older months behind "Show ..." are only built when opened (and dropped again after closing), so the page stays light: opening a sheet re-checks far fewer elements (showModal 114 -> 67ms at 4x slower CPU, 240 entries) and filters redraw faster (~85ms).

### v25.3 — rounded everywhere, softer desktop sheets, phone header
- The phone's rounded look leads on every screen: search, Export, Add New, filters, sort, "Show earlier", Ask input and the expand button are all pills; light shadows only.
- Phones: logo left, profile alone top right; under it a long search pill and a round crimson + (44px) on the same center line as the profile. Export lives in the profile menu on phones.
- Desktop sheets (app and board): a slower, softer rise, .52s cubic-bezier(.16,1,.3,1), 22px up from 97% scale, opacity done by 45%; close .24s; backdrop .45s.
- Add a card on phones: no page lock on open (switching the page's overflow forced a full relayout on iPhone). Two keyboard modes behind ct.kbmode for testing: 'together' (focus in the tap; the sheet starts at the remembered height above the keyboard, ct.kbh) and 'after' (sheet slides up untouched; tap search to type). The sheet enters from 100vh.

### v25.4 — breathing room in every pill, matching icons, Tap to type
- Every pill, switch and tag keeps clear space either side of its words (tools/tpad.js measures it at 320, 390 and 1280 wide, with the menu, Add a card and the editor open). Tags 10px; the Add a card Purchase / Sale switch sizes itself to its longest word (equal halves) and the platform pill gives way; editor buttons never squeeze (Save drops to its own row under 360px).
- Header icons: Export and Add New use drawn icons at 17px with a 1.9 stroke, the same weight as the board's; the search icon too. On phones the + is the same drawn plus at 20px.
- Add a card on phones opens without the keyboard (Tap to type). Focus goes to the sheet itself, so no ring appears on the close button. 'together' stays behind ct.kbmode.

### v26 — Stage 1: Card Board inside the app, on real entries, with card-art widgets
How it fits together:
- python3 tools/build-cb.py app -> app/board/board.css + app/board/board.js (copy sources next to it; it reads dash-parts.json, cb-data2.json, stories2.tpl.html like the main build). The bundle puts the board inside one div.cbroot; every :root token rule is rewritten to .cbroot, so the board can't change the app's look. The four profile-menu ids the app also uses get cb- prefixes.
- js/board-loader.js: CTBoardData() maps app entries (cents) to board entries (name split from "Name - number - set", art kept). The board files load in idle time after start for Premium, or on the first open. CTBoard.refresh() on every store change keeps it live. Back gesture: the board uses the app's CTNav, so app, board and Stories share one history.
- Insights ⤢ (Premium) and the profile menu's Go to rows open it (Go to Card Stories opens the board, then Stories). The board's Go to Entries closes it. Free still gets the Premium note until stage 2.
- TODAY is the real date. Stories still run on the sample data (stage 3).
New widgets (tools/board15.js / board15.css, slotted in before board5.js in both builds):
- One cost matching for all: purchases up to the end of the period are a card's cost; sales inside the period (net of fees and shipping) are what came back. Profit only counts for cards with a known cost.
- Featured card (feat): full-art wallpaper (art.wall if present, else the whole card with a layout-guess crop and zoom; art.focus = framing point). Treatment A: art darkened 12% plus a deep fade behind the words; the depth (--shade) is set per picture from its measured brightness, decoded first and remembered. If the picture has too few pixels for its tile it shows the card-and-details layout instead; no art or nothing to feature gets the regular widget look. Eight metrics from the ••• menu (Biggest win, Best return, Priciest card, Best seller = most copies sold, Biggest loss, Fastest flip, Held the longest, Most money in) and Show: Both / $ / %.
- Best sellers (best): podium of the top three by profit, top halves of the cards. Priciest card (pricey): card and details with chips. Biggest win (win) redesigned: bigger whole card, name as a heading, Bought / Sold labels, profit hero, Also up with thumbnails.
- Default board now leads with Featured card (Large). Add widgets previews use small thumbnails; the frosted pills go flat while editing and in the gallery (blur on moving tiles cost frames).
- Sample entries include three HD cards (Mega Gengar ex, Articuno ex, Magby) with -sm, full and -wall copies.
Speed (4x slower CPU, 250 entries): opening the board ~115–165ms when prefetched; scrolling clean; Add widgets 4 slow frames (was 13), closing a sheet 1 (was 10).
Tests: tools/t89-board-in-app.js, tools/t90-board-nav.js, tools/perf-board-in-app.js; t87 still passes.
- v26.1: Featured card at Small shows the card name above the number; the label pill is dark glass at every size (the light one vanished on bright art), with a slightly deeper top shade; Small gets a touch more shade overall. The label color now wins over the board's Small-title rule.
- v26.2: pictures inside widgets ignore presses (pointer-events:none, no callout/drag), so on iPhone a long-press on art-heavy widgets starts editing instead of the phone's image gesture cancelling it and the release opening the card's entries. tools/t91-longpress-art.js.

## v26.3: long-press on phones
- Widgets, the dock and the slim bar take no text selection or callout on touch screens (CSS + selectstart), so iOS can't take over a long press and scroll the board away.
- The slim "‹ Card Board" bar shows only when the board itself has scrolled past its title (measured against the board, not the window).
- Preview helper: `?preview` in local mode shows a "Load sample entries (Premium)" chip.

## v26.4: edit mode blank screen (found from Nick's screen recording)
- Cause: the slim bar's edit-mode class was `ed`, which is also the app's editor dialog class (`.ed{width:100%;height:100%}`), so in the app build the bar stretched over the whole screen whenever you entered edit mode after scrolling. Renamed to `sedit`.
- Resize grip is now an arc hugging the tile's corner instead of a circle straddling the border.

## v26.5: Featured edit controls
- Featured no longer clips its own edit controls: the art layer clips to the rounded corners instead of the tile, so the remove ✕ and the resize corner show in full.
- Board files load with `?v=` (board-loader.js `V`); bump it whenever board.css/board.js change so phones don't reuse an old copy.

## v26.6: Done from anywhere
- In edit mode on phones, once the top Done scrolls away, the slim bar shows a crimson Done pill in place of the time-range pill.

## v27: free Card Board (stage 2)
- Free opens Card Board from Insights ⤢ too (the old "part of Premium" note is gone). Free gets Profit, Sales, Spent and Profit by month on the last 3 months, with its own saved arrangement (`cb.layout.*.free`), so switching plans never scrambles either board. Free can move and resize its 4.
- Time range: Last 7 days, Last 30 days and the new Last 3 months; everything else sits under "With Premium" with a lock (desktop menu and the phone Dates sheet). Compare is off on Free.
- Locks open one Premium sheet (board16.js/.css; markup in build-cb.py): Stories, Ask, Share, locked widgets in Add widgets, Import/Export/Plan in the board menu, locked ranges, and the quiet line's See Premium.
- Premium sheet: art header (the user's own `art.wall` images first, then `window.CTPremiumArt`), rotating headlines (3 general ones in turn from a random start per device) plus matching headlines for specific locks (range, stories, ask, share, import). Views and Get Premium taps per headline are counted in `cb.pm`; `CTPremiumStats()` prints the tap rates. Move these counts to the server after the Cloudflare move.
- Get Premium calls `window.CTBoardUpgrade` (for now it switches the plan; checkout comes with payments). Price pill shows $4 founding / $6.
- Quiet line ("Free shows your last 3 months · See Premium") shows the first 3 times a free user opens the board.
- Fixes found on the way: the sheet's art class clashed with the board's `.art`; CSS custom-property URLs resolved against board/ (404), so the art is set inline with an absolute URL.
- v27.1: locked widgets in Add widgets are softly blurred (names stay sharp) instead of faded; Featured card's preview now shows its art in the gallery (it waited for a fade-in that never ran there).
- v27.2: Premium sheet art now starts flush at the top (the shared sheet scroll wrapper was adding space; the Premium sheet opts out), no border line over the art, and no focus ring on ✕ when it opens.
- v27.3: locked gallery widgets use a light blur (1.6px) plus a soft 30% veil, so they read clearly but still look locked.
- v27.4: Premium sheet art comes from the account's own cards: their 3 priciest purchases (per copy, one per card), rotating; if they have none, cards they sold; only with neither does it use the app's picks (`CTPremiumArt`). Uses the artwork-only copy (`art.wall`) when there is one, else the regular card image zoomed to its artwork window (120%, 50% 21%).
- TODO after the Cloudflare move (art service): make artwork-only copies for every free user's top 3 purchases (not only Featured cards), refreshed as they buy pricier cards; frame full-art cards (e.g. Greninja ex SIR, where the whole-card fallback shows attack text) with the layout template + subject crop.
- v27.5: default Premium art is now Mega Gengar, Magby and Dragonair (181/165, MEW; artwork band cropped below the name strip and above the attacks, 660×388 WebP, 47 KB) in place of Articuno.
- v27.6: Sign in / Create account switch rebuilt: two equal halves (grid), a fully round thumb inset 4px on every side, raised (lighter, `--s-raise`) in dark mode instead of darker than the track; labels fit down to 320px. The app build drops the standalone board preview's "Preview with your real entries" note, which had started showing on the sign-in screen once the board preloaded for free users.
- v27.7: Stories headlines get room for descenders (line-height 1.1, .14em bottom padding inside the 4-line clamp, which was clipping g/y/p) and a little more space above.

## Decided for stage 3 (Stories on real data + image saving)
- Save all: desktop gets a "Save all 5" pill in the Stories top bar, left of the time range (preview D1). Phones keep the bottom Save/Share bar; tapping Save opens a small sheet: "This story" / "All 5 stories" (preview P2).
- Saves all 5 in order with the current theme and time range. iPhone: the share sheet with all 5 images ("Save 5 Images"); desktop: one zip of 5 numbered PNGs ("Card Stories 1 – The money.png" …). Free users get the Premium sheet (export context).

## v28: Card Stories on real entries (stage 3, part 1)
- Inside the app, Stories reads the account's own entries (`parent.cbEntries()`, the board's cents data) and today's date instead of the built-in sample; it re-reads them whenever the board refreshes (adding, editing, deleting an entry updates open Stories).
- Card drawings use the entry's real card art (detail image, resolved against the app's URL since the Stories frame is a srcdoc); cards without art keep the lettered placeholder.
- Next in stage 3: saving images (one story, and Save all as decided), then free-plan locks on Stories saving.

## v28.1: dark mode levels
- Dark mode now has clear steps: page #121110 → cards/widgets/rows #252320 (was #1f1d1b) → controls (search, selects, Export, entry Edit/Duplicate/Delete, add-sheet search and platform, editor inputs, segmented tracks) #302d2a with a 12% white edge → menus #2b2926 with a stronger shadow → selected thumbs #423e3a. Hairlines 6% → 9%. Sheets (add, editor, import, board sheets) sit at #1c1a18 above the page.
- Tokens: `--s-ctl`, `--s-ctl-line`, `--s-pop`, `--s-raise` in soft.css (light values unchanged; dark-only rules at the end of soft.css and board16.css). Board widgets follow (board14-soft.css).
- v28.2: Appearance (Light / Dark / Auto) sits on its own line under its label in the app and board menus (class `amth`), both menus are locked against sideways scrolling, and the selected option in board switches is the lightest in dark mode. Checked at 320, 390 and desktop, light and dark: no overflow.
- v28.3: entry rows are separated by thin solid lines (`--s-rowline`, #e6e3dc light / #36332f dark) instead of dotted. Checked: every month's first row keeps its 18px rounded top on phone and desktop, expanded or not, with earlier months open.
- v28.4: Profit tile is soft green again (red when profit is negative), light and dark, on the paper-card look. Desktop entries darken slightly on hover (`--s-rowhover`), only with a mouse or trackpad. Desktop filters stay joined (Nick prefers them).
- v28.5: desktop widget dragging (4-column board) rebuilt: `packGrid` lays widgets out exactly as the grid does (first spot from the top where each fits), every position for the held widget is tried, and the landing spot (the dashed slot) moves to the one whose result sits closest to the widget's center, with a small penalty for moving other widgets. It only moves when the new spot is clearly closer and after a 90 ms pause, so passing over widgets doesn't shuffle them; what you see while dragging is exactly where it lands. Auto-scroll on desktop waits 380 ms at the top/bottom edge and scrolls at most 8 px/frame. Phones keep their own drag.
- Known limit: the board is order-based, so the spot a widget leaves is filled by the next widgets (they can slide up/over). If that still feels jumpy, the next step is pinned desktop positions (each widget keeps its square; others move only when pushed).
- v28.6: grabbing a widget no longer shows the lifted copy sliding in from the left edge (it inherited the tiles' 0.38s transform transition; `.floating` now has no transition).
- v28.7: the widget ••• menu's divider is a 1px line again; the free plan's "With Premium" label had reused its class name (`msep`) and gave it padding. The label is now `mprem`. Desktop dragging from v28.5/28.6 is locked in.
- v28.8: desktop Card Board has 34px between the top bar and the widgets (was 18; phones unchanged), 20px under the quiet line. On free, when Stories / Ask / Share are icon-only (761–1340px) the lock shows as a small badge on each button's corner.
- v28.9: desktop gap under the Card Board top bar locked at 60px (Nick's call: few widgets, keep it simple and calm).
- v28.10: every card image (list and detail) now has transparent rounded corners, so no white or gray shows outside the card edge on any background. tools/card-corners.py: flood-fills whatever surrounds the card from each corner (threshold 40), pulls the edge in 1–2px to drop the light fringe, smooths it, and adds a rounded-corner mask (4.6% of the width). The art service should run the same step on every image it saves (TODO after the Cloudflare move). Sample entries load the images with `?v=2` so browsers fetch the fixed copies.
- v28.11: card corners redone as clean geometric curves. The flood fill is now only used to find the card's edges; the corner itself is a perfect rounded rectangle (5.6% of the width, a touch rounder than a real card so no scan's own corner pokes out), inset 1px and drawn 8x larger then scaled down, so it's smooth instead of following the old jagged background edge. Sample art loads with `?v=3`.

## v29: saving Card Stories as images (stage 3, part 2)
- Each story saves as a 1080 × 1920 PNG (Instagram/TikTok story size), drawn from the live story with html-to-image 1.11.11 (MIT, `app/js/vendor/`, loaded on first save). The app's own Manrope is built into every image (`fontEmbedCSS` from fonts/manrope-latin.woff2), so text looks right offline; card art is preloaded first, and Safari gets a second pass (it can drop images on the first).
- Desktop: "Save all 5" pill left of the time range → one zip ("Card Stories - Last 12 months.zip", files "Card Stories 1 - The money.png" …) made by a tiny built-in zip writer (stored, no compression). The enlarged story's Save image / Share save or share just that one.
- Phones: Save in the bottom bar opens "Save to Photos" → This story / All 5 stories; uses the phone's share sheet with the image(s) when available ("Save 5 Images"), otherwise downloads. Share this story shares one image. The profile menu's "Save all stories" saves all 5.
- Progress shows in the toast ("Making image 2 of 5…"). Measured in Chromium: all 5 in about 0.7–2.5 s.
- v29.1: phones never get a zip. With the share sheet they save the 5 images straight to Photos; without it, the 5 images download one by one. The zip is desktop only.
- v29.2: on desktop the first three rows of Card Board always fit in the window (`fitRows`): rows grow up to 206px; on short windows the gap under the top bar shrinks first (60px down to 28px) so widgets stay ~180px tall, then rows shrink to no less than 168px, and the Profit by month side summary tightens (`rowtight`). Re-fits when the window height changes. Checked 1920×1080, 1440×900, 1470×820, 1280×720, 1280×640: all fit.
- v29.3: the 60px gap no longer shrinks after editing. `fitRows` measured from the top of the widgets, which in edit mode sits under the Add widget bar, so adding or resizing a widget re-fit the board as if the window were shorter. It now measures from the top bar (plus the quiet line) and keeps its fit while editing.

## v29.4: monthly budget (both plans)
- A budget card sits under the four totals (js/budget.js): "November budget", a progress bar, "$64.80 of $150", "$85.20 left · 27 days". Green under 80%, amber with "83% used" from 80%, red with "$10.80 over" past the budget. Spending = this month's purchases, exact to the cent.
- Before a budget is set, a dashed "Set a monthly budget" card (can be dismissed; Monthly budget stays in the profile menu, which shows the current amount).
- The sheet: type any amount (decimal keyboard) or tap $50 / $100 / $150 / $250, "Heads-up at 80%" switch, Save, and Turn off budget.
- Heads-up: a quiet note once when you cross 80% and once when you go over, each month; never on app launch.
- Stored in the store's meta (`budget`, `budgetFlags`), ready to sync after the Cloudflare move. Card Board's Budget widget and the "months under budget" Story now use the real budget (`window.CTBudgetCents`); they still fall back to $150 when none is set (TODO: show "set a budget" there instead).
- Free users can open Card Board from the profile menu's Go to row too.
- v29.5: budget card has more room (18px padding, 14–15px between rows on phones) and a soft press when tapped. The budget window is now a centered card on every screen, kept in the visible part of the screen (visualViewport, so the keyboard doesn't push it off), with the page locked behind it; it grows out of the budget card (and shrinks back into it) like Card Board grows out of Insights. It opens straight into typing: the amount is focused and selected, with a soft brand-tint selection.
- v29.6: the phone slim top bar ("‹ Card Board") slides exactly like the marketing site's header: in over 0.8s with cubic-bezier(.22,.61,.36,1) easing to a soft stop, away over 0.8s with cubic-bezier(.4,0,.2,1), no fade, soft shadow while shown; reduced-motion respected.
- v29.7: phones: the search bar runs the full width and the round + sits over its right end (search text stops 56px short so it never runs under the button).
- v29.8: phones: once the header has scrolled away, a small scroll up slides in a slim bar with the search and the round + (js/stickbar.js), and scrolling down tucks it away; same 0.8s curves as the site header. Its search is the same search (typing in either updates the list), + opens Add New, it stays while you're typing, and it never shows while the real header is on screen, while Card Board is open, or on desktop.
- v29.9: the phone search bar docks into the header instead of being a second bar. While it's out, the header's own search and + step aside (hidden), so there's only ever one of each on screen. Scrolling back to the top, the bar's frosted background melts away over the last 70px as the header comes down to meet it, and the moment the header's search lines up with the bar's they swap in place.
- v29.10: budget card and Insights no longer touch: 16px between them (same as above the budget), and a little more room under the budget's bottom line on phones.
- v30: the budget window uses a ruler instead of quick-amount chips. Swipe a ruler under a fixed needle ($5 per tick, labels every $50); it always stops at the next $50, with a haptic tick at each. Swipe the same way again and again and it speeds up: the 3rd swipe in a row stops only at $100s, the 5th at $500s, the 7th spins free (a small "$100 steps" chip says so). Range $0–$5,000. The window opens with the ruler already on the current amount (no jump) and, on phones, with the keyboard down; tap the amount to type, and the ruler glides to the typed amount and lands exactly on it, even between ticks. On desktop the amount is focused for typing, the ruler drags with the mouse, scrolls with the wheel, and arrow keys move it ($5, or $50 with Shift). A dot on the ruler and a line under it show what you spent last month. Tests: tools/t119, t120.
- v30.1: the ruler's end fades are overlays in the window's own color instead of a mask on the scrolling area (iPhone can blank out a masked scroller when you touch it).
- v30.2: the budget card can't be taken down by the budget window: the window's setup is fenced off (if it ever fails, the card still shows), and the ruler code steps aside if an older cached page has no ruler in it. Every stylesheet and script in index.html now carries ?v=30.2 so phones fetch fresh copies after an update (bump it with each release). Test: tools/t121.
- v30.3: turning the budget off no longer hides the card for good: it takes a second tap ("Tap again to turn off", resets after 3s) and the card goes back to "Set a monthly budget". Only the ✕ on that card hides it (with a toast saying the profile menu brings it back). One-time migration on load un-hides the card for anyone who hid it under the old rules. Cache tag now ?v=30.3. Test: tools/t122.
- v30.4: the app behind the budget window is blurred (10px, slight saturation boost, lighter dim), the same frosted feel as the locked Premium widgets; it fades in with the window and fades out as it shrinks away. Falls back to a plain dim when the phone asks for reduced transparency. Cache tag ?v=30.4.
- v30.5: budget window blur eased to 6px; the window gets a barely-there 1px hairline (10% ink in light, 10% white in dark). Cache tag ?v=30.5.
- v31: one window style everywhere. Shared tokens (--win-veil, --win-edge, --win-blur) in new.css, board16.css and the Stories page give every window the same frosted background (6px blur, a light veil in light mode and a deeper one in dark) and a barely-there 1px hairline: budget, Add New, edit entry, import, the profile menu's edge, every Card Board sheet (gallery, Premium, Ask, share, export, entries, dates, customize) and the Stories sheets (themes, Save to Photos, custom dates). Same on phones and desktop. Reduced-transparency phones get a plain dim. Cache tags ?v=31 and board V=31. Tests: tools/t123, t124.
- v31.1: phones: the profile menu (in the app and in Card Board) has a round ✕ in its top-right corner to close it, and the dim behind phone menus gets the same frosted blur as windows. Cache tags v31.1. Test: tools/t125.
- v32: the budget card is now 90px, the same as the Spent and Profit tiles. Left: "November budget · 26 days to go" and the big number is what's left ("$85.20 left of $150"), or in red "$4.80 over $60". Right: a ring that fills with what you've used, with "43%" and a small "used" in its middle ("Over" once you pass it); green, amber from 80%, red when over; it animates when the amount changes. Cache tag ?v=32. Test: tools/t126.
- v32.1: budget card is two halves at tile height: Used (big $64.80, small "of $150 · 43%" underneath) whose half fills from the bottom with a soft tint as you spend (green, amber from 80%, red when over, where it reads "Over budget $4.80, over $60 · 108%"), and Days left (big 26, small "of 30 in November"), which stays plain. Numbers are the tiles' 24px. Cache tag ?v=32.1. Test: tools/t126.
- v33: the main screen gets one job, logging cards and a glance at the month ("Concept 2", Google Health-style purpose per screen).
  - Tiles: each of the four gets one small line: "3 sales", "$75.56 in fees", the budget in the Spent tile, and Profit vs last month ("▼ $51.62 vs Oct", or "% of sales" when the tiles cover a longer range). js/home.js paints them from dash.js's stats().
  - Budget lives in the Spent tile: the tile fills from the bottom with this month's use (green, amber from 80%, red over), its line says "On track · 43% of $150" / "Getting close · …" / "Over by $X" ("Nov · 93% of $70" when Premium shows a longer range), "Set a monthly budget" when none. Tapping the tile opens the ruler, growing out of the tile. The old budget card, the Insights card and the "Totals show…" line are off the main screen (Insights code still runs hidden; charts live in Card Board).
  - Phones: a frosted bottom bar, Entries · Board · Stories (toasts and the preview chip sit above it).
  - Desktop: one centered column (920px) with the four tiles in a row, icon tabs (Entries · Board · Stories) beside the logo, 60px under the top bar like Card Board; Export moved to the profile menu ("Export everything").
  - Card Board now grows out of whatever opened it (the Board tab, or the avatar when opened from the menu) and shrinks back into it (fromEl() in board5.js; window.CTBoardFrom).
  - Cache tags ?v=33, board V=33. Tests: tools/t127, t128 (t119/t120/t122 updated for the Spent tile; t121/t126 removed).
- v33.1: one bar on every page, highlight B, floating Add.
  - Phones: the Entries · Board · Stories bar stays at the bottom over Card Board and Stories too (z 55, above the board, below menus and windows), and its highlight follows the page you're on (home.js syncTabs, watching .cbx and #csx). Tapping Entries from Board/Stories closes them; Board from Stories goes back to the board; Stories from the board opens Stories.
  - Board's floating Stories · Ask · Share bar is gone on phones: Ask and Share are two round icons just left of Edit (they forward to the original buttons, so the Premium locks still apply). Stories ends just above the bar; its Save/Share dock is replaced by two round icons left of your avatar.
  - Highlight B: brand-tinted pill with the icon and label in brand; in dark mode a soft rose (#ff8db0 on rgba(255,128,165,.17)) so it reads pink, not maroon (tokens --tab-on / --tab-onbg). Same style on the desktop tabs.
  - Add New moves to a floating pink + above the bar on the right (phones); the header + and the floating search bar's + are gone, so search runs full width.
  - Desktop: the same tabs sit beside the title on Board and Stories (Board's own Stories button hides when they're there).
  - Cache tags ?v=33.1, board V=33.1. Test: tools/t129.
- v33.2: on Free, tapping Stories in the bottom bar opens the Premium window right over the entries screen instead of opening Card Board and then popping Premium on top mid-animation (that overlap made it jump on iPhone). window.CTPremiumOpen() makes the board's window reachable while the board stays closed (inert/aria-hidden lifted just while it's up; .cbx.pmonly gives it pointer events back). Cache tags ?v=33.2, board V=33.2. Test: tools/t130.
