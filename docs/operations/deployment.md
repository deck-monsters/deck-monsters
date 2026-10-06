---
type: Runbook
title: Deployment Guide
description: Production deployment, auth URLs, and environment variables for Railway and Supabase.
status: stable
audience: internal
tags: [deployment, railway, supabase]
---
# Deployment Guide

Read before: creating or changing Supabase/Railway production services, auth redirect
URLs, custom domains, deployment commands, or production environment variables.
Verified: 2026-09-23 against the checked-in Railway configs, server Dockerfile, and current
environment consumers.

Deck Monsters runs on two hosted services:

- **Supabase Cloud** — PostgreSQL database, Auth (JWT issuance), and Storage
- **Railway** — three services from the same repo: the React web app (static SPA), the Fastify API server, and the Discord bot connector

This guide covers setting up both from scratch and connecting them.

---

## Prerequisites

- [Supabase account](https://supabase.com)
- [Railway account](https://railway.app)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) installed locally
- Repository cloned locally

---

## 1. Supabase Project Setup

### Create the project

1. Log in at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New project"
3. Choose an organization, set a project name (e.g., `deck-monsters`), and pick the region closest to your Railway deployment
4. Save the database password somewhere secure — you will not be shown it again

### Configure Auth URLs

Supabase redirects users back to your app after OAuth sign-in. You need to tell it which URLs are allowed.

If you have **custom domains set up** (see section 2e), use those. If you're deploying for the first time and only have Railway-generated URLs, use those for now — you can update these later.

In **Authentication → URL Configuration**, set:

| Setting | Value |
|---|---|
| **Site URL** | `https://deck-monsters.com` (or your Railway web URL if no custom domain yet) |
| **Redirect URLs** | Add each allowed origin, e.g.:<br>`https://deck-monsters.com/**`<br>`https://www.deck-monsters.com/**`<br>`https://<web>.up.railway.app/**`<br>`http://localhost:5173/**` |

The Site URL is where Supabase redirects users after OAuth. If left as `localhost`, production OAuth flows will send users to your local machine.

#### Email password reset (forgot password)

The web app calls **`resetPasswordForEmail`** with **`redirectTo: {origin}/reset-password`** (`apps/web/src/lib/auth-context.tsx`). Register that path on each public origin the user might open the email link from.

In **Authentication → URL Configuration → Redirect URLs**, add the exact reset path for every environment users might open the link from, for example:

| Environment | Example redirect URL entry |
|---|---|
| Production | `https://deck-monsters.com/reset-password` |
| Production `www` | `https://www.deck-monsters.com/reset-password` |
| Railway web (pre–custom domain) | `https://<web>.up.railway.app/reset-password` |
| Local Vite | `http://localhost:5173/reset-password` |

You can use a wildcard on the path if your Supabase project allows it (e.g. `https://deck-monsters.com/**` already covers `/reset-password`). If reset emails fail or the link lands on an error from Supabase, the redirect URL is almost always missing from this list.

### Enable Auth providers

In the project dashboard, go to **Authentication → Providers**:

- **Email** — enable, disable "Confirm email" for now (enable later for production)
- **Discord** — enable; set the Redirect URL shown to your Discord OAuth application
- **Google** — enable; paste the Client ID and Client Secret from your Google Cloud project
- **Apple** — enable; paste the Services ID, Key ID, Team ID, and `.p8` key contents from Apple Developer

#### Discord OAuth application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Create a new application, then go to **OAuth2**
3. Add the redirect URL from Supabase (looks like `https://<project>.supabase.co/auth/v1/callback`)
4. Copy the Client ID and Client Secret back into Supabase's Discord provider settings

#### Google OAuth application

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create (or select) a project
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
3. Set application type to **Web application**
4. Add the Supabase callback as an authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
5. Also add `http://localhost:54321/auth/v1/callback` for local dev
6. Copy the **Client ID** and **Client Secret** back into Supabase's Google provider settings

#### Apple OAuth application

Requires an [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year).

1. In [Apple Developer Portal](https://developer.apple.com/account/), register an **App ID** with "Sign in with Apple" capability enabled
2. Register a **Services ID** — this is your OAuth client ID; set the return URL to `https://<project-ref>.supabase.co/auth/v1/callback`
3. Create a **Key** with "Sign in with Apple" enabled and download the `.p8` key file
4. In Supabase's Apple provider settings, fill in: **Services ID** (client ID), **Key ID**, **Team ID**, and the contents of the `.p8` file

### Collect Supabase credentials

In **Project Settings → API Keys**, copy:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Project URL (e.g., `https://xxxx.supabase.co`) — shown at the top of the API Keys page |
| `SUPABASE_PUBLISHABLE_KEY` | **Publishable key** (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | **Secret key** (`sb_secret_...`) — keep this secret; it bypasses RLS and has full DB access |

> The server verifies user JWTs by fetching Supabase's public JWKS endpoint (`/auth/v1/jwks`) — no JWT secret needs to be copied.

In **Project Settings → Database**, copy the connection string:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Use the **Transaction pooler** URL (e.g., `postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`) |

### Apply the database schema

Link your local Supabase CLI to the project:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Push the migrations:

```bash
supabase db push
```

**After the first setup, deploys apply migrations themselves.** The server's Railway service
runs `node packages/server/dist/migrate-cli.js` as a pre-deploy command (`preDeployCommand` in
`packages/server/railway.toml`), before the new release takes traffic. It applies every file
in `supabase/migrations/` (copied into the image at `/app/supabase/migrations`) that is not yet
recorded in `supabase_migrations.schema_migrations`.

- **One at a time.** Each pending file runs in its own transaction under a
  `pg_advisory_xact_lock`, so two deploys cannot migrate at once. A transaction-level lock is
  the one that holds through the Supabase transaction-mode pooler (port 6543).
- **Never twice.** A file also counts as applied when a row with the same name is recorded
  under another version (a hand-applied migration); the runner logs a warning and does not
  re-run it.
- **A failure stops the deploy.** The failing file's transaction rolls back, the runner exits
  non-zero, and Railway keeps the previous release serving. Earlier files in the same run stay
  applied. Fix the migration and redeploy.
- **Nothing waits forever.** Each migration's transaction has a 10 s lock timeout and a 120 s
  statement timeout (`MIGRATE_LOCK_TIMEOUT_MS`, `MIGRATE_STATEMENT_TIMEOUT_MS`), and a connection
  attempt gives up after 15 s. A timeout fails the deploy like any other migration failure; a
  migration that must wait on a table the live app is using needs a quieter moment.
- **Files must not manage their own transactions.** The runner wraps each file in one, so a file
  containing a top-level `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `START TRANSACTION`, or
  `CONCURRENTLY` is refused before anything runs. A plpgsql `begin` inside a `$$` body is fine.
- **It says what it did.** The deploy log starts with `migrate: N files in <dir>, M recorded`
  and ends with `migration run finished`, with the count applied and skipped.
- **Removing a column takes three deploys.** Stop writing it, then stop referencing it (code
  *and* the Drizzle schema, because a Drizzle `insert` lists every schema column), then drop it.
  The runner applies a migration while the previous release still serves, so a drop that ships
  with the code change breaks that release's queries during the overlap, or for good if the new
  release fails its healthcheck. Found while dropping `rooms.state_blob` (roadmap 37).
- A change under `supabase/migrations/**` triggers a deploy (`watchPatterns`).
- `supabase db push` still works for local or manual use: both write the same history table.
  `MIGRATIONS_DIR` points the runner at another directory.

Why: on 2026-09-29 a release that needed new columns went live before anyone ran
`supabase db push`, and a privacy migration from 2026-09-17 had never reached production at
all. Five hand-applied migrations were recorded under versions that did not match their files,
which also made `supabase db push` try to re-run them; that history was repaired the same day.

Verify the tables exist in **Table Editor**.

---

## 2. Railway Deployment

The project deploys as three separate Railway services from the same GitHub repository:

| Service | Source | What it is |
|---|---|---|
| **Web** | `apps/web/` | React SPA served as a static site |
| **Server** | `packages/server/Dockerfile` | Fastify API server + WebSocket ring feed |
| **Discord bot** | `packages/connector-discord/` | Discord connector (covered in section 3) |

### 2a. Create the Railway project

1. Go to [railway.app](https://railway.app) and click **New Project**
2. Choose **Deploy from GitHub repo** and connect your `deck-monsters` repository
3. Railway will create the project and add an initial service — this will become the **Web** service

### 2b. Service: Web (static SPA)

The web service is configured via `apps/web/railway.toml` (checked into the repo), which
tells Railway to use Railpack and the correct monorepo build/start commands. Point Railway
at that config file rather than duplicating those commands in the dashboard.

Go to the service → **Settings → Config-as-code** and set:

| Setting | Value |
|---|---|
| **Config file path** | `apps/web/railway.toml` |

That's it — no Dockerfile, no manual build command entry. Railway will read the config,
build the SPA with Railpack, then serve it via
[`serve`](https://github.com/vercel/serve).

`pnpm start` runs `serve dist -s -c ../serve.json`. `serve` looks for its config inside the
folder it serves (`dist`), so the `-c ../serve.json` flag is what points it at
`apps/web/serve.json` in the package directory. Vite fingerprints everything under
`dist/assets/` (scripts, styles, fonts, images). Those responses send
`Cache-Control: public, max-age=31536000, immutable`. `index.html` is not fingerprinted, and
the SPA fallback (`-s`) serves that same file for client routes, so it sends
`Cache-Control: public, max-age=0, must-revalidate`. `serve` still adds ETags. Before
`serve.json`, responses had ETags and no `Cache-Control`, so browsers only guessed how long
to keep a hashed file. The dev server (`vite`) does not send these headers. Checked against
`serve` 14.2.6 on 2026-10-06.

Go to **Settings → Networking** and generate a public domain so you have a URL for the web app.

Then go to **Variables** and add:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase Publishable key (`sb_publishable_...`) |
| `VITE_SERVER_URL` | `https://server.deck-monsters.com` once custom domains are set up (see 2e); otherwise the Server service's Railway URL |

### 2c. Service: Server (API)

In the same Railway project, click **New Service → GitHub Repo** and select the same `deck-monsters` repository again.

The server service is configured via `packages/server/railway.toml`. Go to the new service → **Settings → Config-as-code** and set:

| Setting | Value |
|---|---|
| **Config file path** | `packages/server/railway.toml` |

Go to **Settings → Networking** and generate a public domain. Copy that URL for the Web
service's `VITE_SERVER_URL`.

Then go to **Variables** and add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Transaction pooler URL from Supabase → **Settings → Database → Connection string** |
| `SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxx.supabase.co`) |
| `SUPABASE_SECRET_KEY` | Your Supabase Secret key (`sb_secret_...`) — bypasses RLS, keep secret |
| `CORS_ORIGINS` | Comma-separated allowed origins. Once custom domains are set up (see 2e): `https://deck-monsters.com,https://www.deck-monsters.com,http://localhost:5173`. Before custom domains, use your Railway web URL, e.g. `https://<web>.up.railway.app,http://localhost:5173` |

`CONNECTOR_SERVICE_TOKEN` is required only for a separately deployed client that calls the
server's service-authenticated tRPC procedures. The current Discord connector imports the
server/RoomManager packages and connects to Postgres directly; it does not call the API
service.

Once the build completes, verify the server is running:

```bash
curl https://<your-server-railway-url>/health
# {"status":"ok","timestamp":"..."}
```

### 2d. Wire the URLs

Now that both services are deployed and have public URLs:

1. Go to the **Web** service → **Variables**
2. Set `VITE_SERVER_URL` to the Server service's public Railway URL (e.g., `https://<server>.up.railway.app`)
3. Redeploy the Web service (Railway will trigger this automatically when you save the variable)

If you have custom domains (see 2e), set `VITE_SERVER_URL` to `https://server.deck-monsters.com` instead.

### 2e. Custom Domains

Railway assigns each service a `*.up.railway.app` subdomain by default. The production deployment uses custom domains:

| Service | Custom domain |
|---|---|
| **Web** | `deck-monsters.com` |
| **Server** | `server.deck-monsters.com` |

Optional Web aliases (assign all to the same Web service): `www.deck-monsters.com`, `web.deck-monsters.com`. Railway serves all of them without further config — there is no automatic redirect between them, so if you care about canonical URLs, handle that at the DNS/CDN layer (e.g., a Cloudflare redirect rule from `www.` → apex).

#### Assign custom domains in Railway

For each domain you want to add:

1. Go to the service in the Railway dashboard → **Settings → Networking**
2. Click **Add Custom Domain** and type the domain (e.g., `server.deck-monsters.com`)
3. Railway shows the **CNAME target** to set at your DNS provider (e.g., `<region>.railway.app`)
4. Add that CNAME record at your DNS registrar/provider
5. Railway will automatically provision a TLS certificate via Let's Encrypt once the DNS propagates (usually within a few minutes)

Repeat for each domain: `deck-monsters.com`, and any aliases.

> **Apex domain (`deck-monsters.com`) note:** Some DNS providers don't support CNAME records at the apex. If yours doesn't, use their proprietary equivalent — Cloudflare's CNAME-flattening, Route 53's ALIAS record, or similar. Railway's domain setup page will note if a different record type is needed.

#### Update configuration after adding custom domains

Once both custom domains are live, update these values across your services:

**Web service → Variables:**

| Variable | New value |
|---|---|
| `VITE_SERVER_URL` | `https://server.deck-monsters.com` |

Redeploy the Web service after saving.

**Server service → Variables:**

| Variable | New value |
|---|---|
| `CORS_ORIGINS` | `https://deck-monsters.com,https://www.deck-monsters.com,http://localhost:5173` |

Add `https://web.deck-monsters.com` to `CORS_ORIGINS` if you're using that alias too. The server picks up the new value on next deploy or restart — no code change needed.

**Supabase → Authentication → URL Configuration:**

| Setting | New value |
|---|---|
| **Site URL** | `https://deck-monsters.com` |
| **Redirect URLs** | Add `https://deck-monsters.com/**` and `https://www.deck-monsters.com/**` (keep the Railway URL and localhost entries too). Ensure **email password reset** paths are covered (see [Email password reset](#email-password-reset-forgot-password) above). |

---

## 3. Discord Bot Setup

The Discord connector runs as a third Railway service alongside the API server.

### Create the Discord application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** and give it a name (e.g., `Deck Monsters`)
3. Go to **Bot** → click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it — this is your `DISCORD_TOKEN`
5. Enable the following **Privileged Gateway Intents**: `Message Content Intent`
6. Go to **OAuth2 → General** and copy the **Client ID** — this is your `DISCORD_CLIENT_ID`

### Set the redirect URI (for OAuth login via Supabase)

In the Discord application's **OAuth2 → Redirects**, add the Supabase callback URL:
`https://<project>.supabase.co/auth/v1/callback`

This is the same URL you added when enabling Discord OAuth in Supabase (step 1).

### Invite the bot to your server

Build an invite URL with the required permissions:

```
https://discord.com/api/oauth2/authorize?client_id=<DISCORD_CLIENT_ID>&permissions=137439266816&scope=bot+applications.commands
```

Required permissions: Send Messages, Read Message History, Use Slash Commands, Send Messages in Threads, Embed Links, Add Reactions.

### Deploy the Discord connector on Railway

In the same Railway project, click **New Service → GitHub Repo** and select the `deck-monsters` repository again.

Go to the new service → **Settings → Build** and set:

| Setting | Value |
|---|---|
| **Root directory** | _(leave blank — build runs from the repo root)_ |
| **Build command** | `pnpm install --frozen-lockfile && pnpm --filter @deck-monsters/connector-discord... build` |
| **Start command** | `node packages/connector-discord/dist/index.js` |

This service does not need a public domain — it connects outbound to Discord, Postgres, and
Supabase Auth.

Go to **Variables** and add:

| Variable | Value |
|---|---|
| `DISCORD_TOKEN` | Your bot token from the Discord developer portal |
| `DISCORD_CLIENT_ID` | Your application's client ID |
| `DATABASE_URL` | Same Supabase transaction pooler URL as the server |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | Your Supabase Secret key; required for first-contact Discord user creation |

---

## Shutdown

On `SIGTERM` or `SIGINT` the server, and the Discord connector the same way (it closes the
Discord client first), stops accepting connections, saves every active room with
`RoomManager.flushAll(8000)` (rooms in a fight too, without unloading them), ends the database
pool, and exits 0. Repeated signals are ignored. The whole shutdown has a 9.5 s budget, under
Railway's default 10 s grace period: the flush gets 8 s, and closing the pool gets what is left
(a write abandoned at the flush deadline can still hold a connection, so `pool.end()` is raced
against the budget too). A save the store refused counts as failed, not flushed. The log line
`flushed rooms` reports how many flushed, failed, and timed out. Before roadmap 37 there was
no handler, and each deploy lost up to 30 s of unsaved changes in every active room.

## Room state migration to jsonb (roadmap 37)

Room state moved from `rooms.state_blob` (base64 gzip JSON) to `rooms.state` (`jsonb`) in
phases, each its own deploy, because the migration runner applies migrations while the
previous release is still serving:

1. **Release 1 (expand)** wrote both columns.
2. **Release 2 (stop writing)** wrote `state` only, but still *used* the column: it selected
   `state_blob` on load and reset, set it to null on reset and quarantine, and fell back to it
   on load for an unconverted room.
3. **Step A (stop referencing)**, #417, live on both services 2026-09-30: no code or Drizzle schema names `state_blob`
   any more (no fallback, no nulling, the room-state backfill script is deleted, the
   leaderboard backfill reads `state` only). The column is still in the database and simply
   untouched. The engine's `restoreGame` still decodes a legacy blob string (public API).
   `dm_room_state_source_total` only reports `source="state"`.
4. **Step B (drop)**, `20260930150000_drop_state_blob.sql`: removes the column. It ships only
   after step A runs on **both** services. Details: [state-blob-drop.md](state-blob-drop.md).

Why step B cannot ship with step A: release 2 names the column, and Drizzle lists *every*
schema column in an `insert` (as `default`), so even release-2 code that never mentions it
fails with `column "state_blob" does not exist` on room load, create, reset and quarantine
once it is dropped. A failed healthcheck after the migration committed would leave release 2
serving against that schema. The plan is in [roadmap 37](../archive/roadmap/37-room-state-in-postgres.md).

**Two services write room state:** the server and the Discord connector. Each runs its own
`RoomManager` over the same `rooms` table. Every deploy or rollback here means both, on the
same release.

### Step A (#417)

One data migration, `20260930140000_clear_stale_state_blobs.sql`: it empties `state_blob`
wherever `state` is set, which is every production room. It must, because step A's resets no
longer touch the blob (Codex review of #417): a reset would otherwise leave `state` null beside
a stale blob, and a release-2 process (a rollback, or the old release during the deploy
overlap) would fall back to that blob and bring the reset room back; the step-B guard could
then never pass either. With the stale blobs gone, neither can happen. Release 2 writes no
blobs, so none reappear while it still serves. A room with `state` null and a blob present
(never converted) keeps its blob and would start fresh under step A; none exist in
production, and the step-B guard refuses the drop while one does. Deploy to both services.

### Step B (the drop)

Ship only when both services run step A and `schema.ts` has no `stateBlob`. Pre-ship check,
which must return no rows:

```sql
select id from rooms where state is null and state_blob is not null;
```

The migration holds a guard that raises `rooms still unconverted (state null, state_blob
present)` while that query returns rows, then `alter table rooms drop column if exists
state_blob`; `quarantined_blob` stays. Both run in one transaction. The alter takes
`ACCESS EXCLUSIVE` on `rooms`: if it queues behind a long transaction it blocks new `rooms`
queries for up to the 10 s `lock_timeout`, then rolls back cleanly, fails the deploy and is
safe to retry. What to do if the guard trips is in [state-blob-drop.md](state-blob-drop.md).

### Rollback

- **Before step B:** rolling back to release 2 is safe, because the column is still there and
  step A's migration cleared every stale blob, so release 2's fallback finds nothing to
  resurrect after a step-A reset.
  Rolling back past release 2 is not (release 2 stopped writing the blob, so an older
  release would read stale blobs); do not go back further.
- **After step B:** only step-A code and later are compatible. Release 2 and earlier break
  room load, create, reset and quarantine. Going back needs the column and its contents
  restored from a backup (Supabase daily backups), discarding every room save since. Roll
  **forward** instead.
- If the guard or a lock timeout fails the step-B deploy, nothing changed; the previous
  release keeps serving.

## 4. Local development

Local service startup, reusable test rooms, and throwaway cleanup are owned by
[local testing](local-testing.md). Cursor Cloud's remote/local Supabase paths and Docker
setup are owned by [cloud development](cloud-development.md).

---

## Production environment variables

This is the canonical production table. Do not copy it into another setup guide.

### Server

| Variable | Requirement | Purpose |
|---|---|---|
| `DATABASE_URL` | Required | Supabase Postgres transaction-pooler URL used by Drizzle |
| `SUPABASE_URL` | Required | Supabase project URL used for JWT issuer/JWKS validation and auth admin calls |
| `SUPABASE_SECRET_KEY` | Required for connector-user creation | Server-only Supabase secret key; bypasses RLS |
| `CORS_ORIGINS` | Optional | Comma-separated web origins; defaults to `http://localhost:5173` |
| `CONNECTOR_SERVICE_TOKEN` | Required only for service tRPC clients | Bearer-equivalent shared secret accepted on service procedures |
| `PORT` | Optional | HTTP/WS port; defaults to `3000` and Railway may inject it |
| `HOST` | Optional | Bind address; defaults to `0.0.0.0` |
| `LOG_LEVEL` | Optional | Structured/Fastify log level; defaults to `info` |
| `NODE_ENV` | Production | Set to `production` |
| `METRICS_TOKEN` | Recommended | Protects `/metrics`; details belong to [observability](observability.md) |

The server does not consume a Supabase publishable key.

### Web build/runtime

| Variable | Requirement | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Required | Supabase project URL baked into the web build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Required | Browser-safe publishable key baked into the web build |
| `VITE_SERVER_URL` | Production | Public API origin; leave empty only in local Vite development so the proxy handles `/trpc` |
| `VITE_BUILD_VERSION` | Optional | Build identifier used by handshake update notices |

### Discord connector

| Variable | Requirement | Purpose |
|---|---|---|
| `DATABASE_URL` | Required | Same Supabase transaction-pooler URL; the connector runs its own `RoomManager` |
| `SUPABASE_URL` | Required | Supabase Auth endpoint for connector-user creation |
| `SUPABASE_SECRET_KEY` | Required | Server-only key used to create/resolve connector users |
| `DISCORD_TOKEN` | Required | Discord bot token |
| `DISCORD_CLIENT_ID` | Required | Discord application id used for command registration |
| `LOG_LEVEL` | Optional | Logging inherited from the server package |

The current connector does not consume `SERVER_URL` or `CONNECTOR_SERVICE_TOKEN`; it imports
the server room/database modules directly.

---

## Troubleshooting

**`DATABASE_URL environment variable is required`**
The server refuses to start without a database URL. Check your Railway environment variables — the variable is named `DATABASE_URL`, not `SUPABASE_DB_URL`.

**JWT verification failures**
The server verifies JWTs by fetching `<SUPABASE_URL>/auth/v1/jwks`. Check that:
- `SUPABASE_URL` is set correctly on Railway
- The Railway service has outbound HTTPS access to your Supabase project
- Locally, `supabase start` is running before you start the server

**Migrations not applied**
Run `supabase db push --linked` (production) or `supabase db reset` (local) to apply pending migrations.

**Docker build fails on `pnpm install --frozen-lockfile`**
The `pnpm-lock.yaml` is out of sync with package manifests. Run `pnpm install` locally and commit the updated lockfile.

**Room page loads but HTTP tRPC batches 404 (`Route GET:/trpc/room.info,game.…`)**
Fastify defaults to `maxParamLength: 100`. tRPC `httpBatchLink` puts comma-joined procedure names in that path param; the Terminal room mount’s 7-query batch is ~114 characters, so Fastify 404s the whole batch before tRPC runs (WebSocket subscriptions can still connect). The server sets `routerOptions.maxParamLength: 5000` via `createFastifyOptions` — do not remove it. See `docs/roadmap/10b-bugs-fixed.md` (#86).
