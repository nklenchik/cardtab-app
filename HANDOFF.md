# Card Tab handoff (written 2026-11-03)
Read DEVELOPMENT.md first (decisions, status, previews). Then this.

## Where things stand
- Marketing site cardtab.app: finished and polished. Source /home/claude/site (lost with the session; the copy that survives is GitHub repo nklenchik/cardtab-site, main). Deploy is manual zip upload to Cloudflare (wife's account) until Nick's domain moves to his account (~Thu Nov 5).
- App code (this folder's app/ and api/): add-card prototype + Worker, offline-tested only, Worker not deployed.
- Main-screen/sign-in preview (approved direction): https://claude.ai/artifact/WcVYii598QZ4nSWrXcyFuw
- Site demo = reference for dashboard layout/CSS; Apps Script app (Cash Flow sheet) = reference for data fields: date, type (Sale/Purchase/Refund), platform, items, gross, net, purchase, note.

## Drop 1: built 2026-11-03 (see DEVELOPMENT.md "Drop 1 built")

## Drop 1 plan (for reference)
1. Data store on device: entries add/edit/delete/undo; plan rules (Free 20 entries/month, warn at 17, block at 20, reset 1st of month; Premium unlimited).
2. Dashboard from the preview, wired to real entries (Free: current-month insights; Premium: all-time/date ranges).
3. Sign-in page + avatar menu (usage lives in menu). Local-mode session for now; real auth = Google + emailed link, no passwords, later.
Drop 2: attach Add-card sheet (sample catalog until Worker deployed), Import (Premium; Free sees Premium-tagged Import only later), nudges.

## Rules from Nick
Preview/talk through before building; keep short updates; pills never wrap on mobile; "Click" desktop / "Tap" mobile; fees exact to the cent (verified tables needed); clean, minimal.

## Blocked / waiting
Cloudflare move (Thu Nov 5): then GitHub deploy, SIGNUPS binding, app.cardtab.app, Worker deploy, D1/R2, email sender (login@cardtab.app). Rotate JustTCG key before launch.
GitHub: the Claude integration cannot create repos. Nick creates an empty private repo `cardtab-app`, then Claude can push.
