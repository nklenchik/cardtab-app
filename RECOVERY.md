# Card Tab recovery sheet

What to do if something breaks or goes missing. This file holds names and steps only, never secret values: this repo is public.

## Where everything lives

| Piece | Lives in | Backed up |
|---|---|---|
| App code (app.cardtab.app) | GitHub `nklenchik/cardtab-app`, deployed by Cloudflare Pages from `main` | Git history + Nick's Mac clone |
| Site code (cardtab.app) | GitHub `nklenchik/cardtab-site`, deployed by Cloudflare Pages from `main` | Git history + Nick's Mac clone |
| Worker (api.cardtab.app) | `api/` in this repo, deployed with `npx wrangler deploy` from `api/` | Git history |
| Database | D1 `card-tab` | Nightly (`.github/workflows/backup.yml`) + Cloudflare Time Travel (7 days, any minute) |
| Card art and uploaded photos | R2 `card-tab-art` (`art/`, `up/`) | Nightly to R2 `card-tab-backup` + encrypted Google Drive |
| Worker secrets | Inside Cloudflare only | **Not backed up.** Get them again from each provider (below) |
| DNS records | Cloudflare dashboard | Exported file in Nick's Google Drive (not in this repo) |

## Worker secrets

Cloudflare never shows a secret again after it's set. If one is lost, get a new one from its provider, then from `api/` run `npx wrangler secret put NAME` and paste it when asked. `npx wrangler secret list` shows which ones are set.

| Secret | What it does | Where to get a new one |
|---|---|---|
| `GOOGLE_CLIENT_SECRET` | Google sign-in | Google Cloud Console → APIs & Services → Credentials → the OAuth client (ID is in `api/wrangler.toml`) → Add secret |
| `JUSTTCG_API_KEY` | Card lookups and prices | JustTCG dashboard → API keys |
| `RESEND_API_KEY` | Sign-in emails and notices (if Resend is used) | resend.com → API Keys |
| `ANTHROPIC_API_KEY` | Ask Card Tab | console.anthropic.com → API Keys |
| `ANTHROPIC_WORKSPACE_ID` | Ask Card Tab spending check | console.anthropic.com → Settings → Workspaces |
| Stripe keys (once payments are added) | Payments | Stripe dashboard → Developers → API keys |

Everything else the Worker needs is in `api/wrangler.toml` and comes back with a deploy.

GitHub Actions secrets for the backup (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `GDRIVE_TOKEN`, `BACKUP_PASSPHRASE`. The passphrase must be kept in a password manager: without it the Google Drive copy can't be opened.

## Cloudflare settings to recreate

- **DNS:** Cloudflare → cardtab.app → DNS → Records → Import and Export → Import the saved file.
- **Pages, app:** project connected to `nklenchik/cardtab-app`, branch `main`, no build command, output folder `app`, custom domain `app.cardtab.app`.
- **Pages, site:** project connected to `nklenchik/cardtab-site`, branch `main`, no build command, output folder `/`, custom domain `cardtab.app`.
- **Worker:** `npx wrangler deploy` from `api/` brings back the route (`api.cardtab.app`), the D1, R2 and AI bindings, and the cron schedule. Then set the secrets above.
- **R2 buckets:** `card-tab-art` (live) and `card-tab-backup` (copies).

## Getting data back

- **A mistake in the last 7 days** (a bad deploy, deleted rows): rewind the database to just before it.
  `npx wrangler d1 time-travel info card-tab` shows the current state, then
  `npx wrangler d1 time-travel restore card-tab --timestamp=2026-11-08T14:00:00-05:00` (use the time just before the problem).
- **Older, or the database is gone:** take the night's file from R2 `card-tab-backup/db/` (or the admin dashboard's Download backup button for the latest), unzip it, and load it into an empty database:
  `gunzip db-YYYY-MM-DD.sql.gz` then `npx wrangler d1 execute card-tab --remote --file=db-YYYY-MM-DD.sql`
- **Card art or photos:** copy `art/` and `up/` from `card-tab-backup` back into `card-tab-art` (rclone, set up the same way as in the backup workflow).
- **Code:** any earlier version is in GitHub history. Redeploy by pushing it to `main`.
