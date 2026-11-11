# Card Tab API (Cloudflare Worker)

One-time setup, from the `api` folder:

1. `npx wrangler login`
2. `npx wrangler d1 create card-tab`  -> copy the database_id into wrangler.toml
3. `npx wrangler d1 execute card-tab --remote --file=schema.sql`
4. `npx wrangler r2 bucket create card-tab-art`
5. `npx wrangler secret put JUSTTCG_API_KEY`  -> paste your key when asked (never put it in a file)
6. `npx wrangler deploy`

Then open `app/index.html` and set `window.CARDTAB_API` to the Worker URL it prints.

Image resizing (the WebP copies) needs Cloudflare Image Resizing / Transformations enabled on the account.
Run `node test.mjs` for the offline tests.

## Deploys
This Worker deploys itself: Cloudflare Workers Builds runs `npx wrangler deploy` from `api/` on every push to main that changes it. Tables are kept up to date by the Worker (src/schema.js), so no database commands are needed. Secrets are set in the Cloudflare dashboard (Settings → Variables and Secrets).
Root directory for Workers Builds must be `api` (not the repo root), or the build publishes the repo as static files with no bindings.
