# Card Tab app

The real app for app.cardtab.app. Plain HTML, CSS and JavaScript, no build step.

```
app/            the app (open app/index.html through any static server)
  index.html    sign-in page + dashboard + account menu + add/edit sheet
  css/demo.css  dashboard styles carried over from the cardtab.app demo (generated, see tools/)
  css/app.css   app-only styles
  js/store.js   local-first data store (IndexedDB, one database per account, money in cents)
  js/auth.js    session + sign-in page (local mode until real auth is set up)
  js/editor.js  add / edit entry sheet
  js/dash.js    dashboard (totals, insights, filters, entries list)
  js/main.js    boot, account menu, testing tools
  add-sheet/    Drop 2 prototype: free-text add-card sheet (parser, lookup, picker)
api/            Cloudflare Worker for card lookup and art (not deployed yet)
tools/          extract-demo-css.py: regenerates app/css/demo.css from the site's index.html
```

Run locally: `cd app && python3 -m http.server 8765`, then open http://localhost:8765.

## Drop 1 (this version)
- Local-first store: add, edit, delete, duplicate, undo (toast button or Cmd/Ctrl+Z). Entries stay on the device.
- Plan rules: Free gets 20 new entries a month (warning from 17, blocked at 20, resets on the 1st). Premium is unlimited.
- Dashboard modeled on the site demo. Free: totals, chart and fees for this month (chart shows the last 3 months). Premium: all time or any date range. Every entry stays visible on both plans.
- Sign-in page (Google + emailed link, no passwords) and avatar menu with plan and usage. Local mode signs in on this device only.
- Testing tools in the account menu (local mode only): switch Free/Premium, load sample entries, set usage, clear data.

See DEVELOPMENT.md for decisions and what's next.
