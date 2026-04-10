# Deployment Guide

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

Verify the tables exist in **Table Editor**.

---

## 2. Railway Deployment

The project deploys as three separate Railway services from the same GitHub repository:

| Service | Source | What it is |
|---|---|---|
| **Web** | `apps/web/` | React SPA served as a static site |
| **Server** | repo root `Dockerfile` | Fastify API server + WebSocket ring feed |
| **Discord bot** | `packages/connector-discord/` | Discord connector (covered in section 3) |

### 2a. Create the Railway project

1. Go to [railway.app](https://railway.app) and click **New Project**
2. Choose **Deploy from GitHub repo** and connect your `deck-monsters` repository
3. Railway will create the project and add an initial service — this will become the **Web** service

### 2b. Service: Web (static SPA)

The web service is configured via `apps/web/railway.toml` (checked into the repo), which tells Railway to use Nixpacks and the correct monorepo build command. You just need to point Railway at that config file.

Go to the service → **Settings → Config-as-code** and set:

| Setting | Value |
|---|---|
| **Config file path** | `apps/web/railway.toml` |

That's it — no Dockerfile, no manual build command entry. Railway will read the config and build the SPA with Nixpacks, then serve it via [`serve`](https://github.com/vercel/serve).

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

Go to **Settings → Networking** and generate a public domain. Copy that URL — you will need it for the Web service and the Discord connector.

Then go to **Variables** and add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Transaction pooler URL from Supabase → **Settings → Database → Connection string** |
| `SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxx.supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | Your Supabase Publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Your Supabase Secret key (`sb_secret_...`) — bypasses RLS, keep secret |
| `CONNECTOR_SERVICE_TOKEN` | A secret token shared with all connectors — generate with `openssl rand -hex 32` |
| `CORS_ORIGINS` | Comma-separated allowed origins. Once custom domains are set up (see 2e): `https://deck-monsters.com,https://www.deck-monsters.com,http://localhost:5173`. Before custom domains, use your Railway web URL, e.g. `https://<web>.up.railway.app,http://localhost:5173` |

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

**Discord connector → Variables:**

| Variable | New value |
|---|---|
| `SERVER_URL` | `https://server.deck-monsters.com` |

**Supabase → Authentication → URL Configuration:**

| Setting | New value |
|---|---|
| **Site URL** | `https://deck-monsters.com` |
| **Redirect URLs** | Add `https://deck-monsters.com/**` and `https://www.deck-monsters.com/**` (keep the Railway URL and localhost entries too) |

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
| **Build command** | `pnpm install && pnpm --filter @deck-monsters/engine build && pnpm --filter @deck-monsters/connector-discord build` |
| **Start command** | `node packages/connector-discord/dist/index.js` |

This service does not need a public domain — it connects outbound to Discord and the Server.

Go to **Variables** and add:

| Variable | Value |
|---|---|
| `DISCORD_TOKEN` | Your bot token from the Discord developer portal |
| `DISCORD_CLIENT_ID` | Your application's client ID |
| `DATABASE_URL` | Same Supabase transaction pooler URL as the server |
| `SERVER_URL` | `https://server.deck-monsters.com` (or the Railway-generated URL before custom domains are set up) |
| `CONNECTOR_SERVICE_TOKEN` | Same token set on the Server service |

---

## 4. Local Development (Server)

### Start the Supabase local stack

```bash
supabase start
```

This starts a local Postgres, Auth, and Studio in Docker. The output includes your local credentials:

```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJ...
service_role key: eyJ...
```

> The local CLI still uses the legacy key names. Map them to the current env vars:
> - `anon key` → `SUPABASE_PUBLISHABLE_KEY`
> - `service_role key` → `SUPABASE_SECRET_KEY`
> - The `JWT secret` line is not needed — local JWT verification uses the same JWKS endpoint at `http://localhost:54321/auth/v1/jwks`

Create a `.env.local` file at the repo root (git-ignored):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_PUBLISHABLE_KEY=eyJ...   # "anon key" from supabase start output
SUPABASE_SECRET_KEY=eyJ...        # "service_role key" from supabase start output
CONNECTOR_SERVICE_TOKEN=dev-service-token

# Discord connector (only needed when running the bot locally)
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
SERVER_URL=http://localhost:3000
```

### Apply migrations to local Postgres

```bash
supabase db reset
```

### Start the server

```bash
cd packages/server
pnpm dev
# Server listening at http://0.0.0.0:3000
```

Or with Docker Compose (after `supabase start`):

```bash
docker-compose up
```

### Run the Supabase Studio

The local Supabase Studio is at `http://localhost:54323` — use it to inspect the database, test queries, and manage auth users.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string for Drizzle ORM (use Transaction pooler URL on Railway) |
| `SUPABASE_URL` | Yes | Supabase project URL — used to construct the JWKS endpoint for JWT verification and for admin auth calls |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase Publishable key (`sb_publishable_...`) — safe for client-side use with RLS enabled |
| `SUPABASE_SECRET_KEY` | Yes | Supabase Secret key (`sb_secret_...`) — used by `ensureConnectorUser` to create auth users; bypasses RLS, never expose publicly |
| `CONNECTOR_SERVICE_TOKEN` | Yes | Shared secret for authenticating connector-to-server service calls (set in both the server and each connector's env) |
| `CORS_ORIGINS` | No | Comma-separated list of allowed CORS origins for the server. Defaults to `http://localhost:5173`. Production example: `https://deck-monsters.com,https://www.deck-monsters.com,http://localhost:5173` |
| `PORT` | No | HTTP port, defaults to `3000` (server only) |
| `HOST` | No | Bind address, defaults to `0.0.0.0` (server only) |
| `NODE_ENV` | No | `production` or `development` |
| `DISCORD_TOKEN` | Connector | Discord bot token (Discord connector only) |
| `DISCORD_CLIENT_ID` | Connector | Discord application client ID (Discord connector only) |
| `SERVER_URL` | Connector | Base URL of the API server, used by the Discord connector for service calls. Production: `https://server.deck-monsters.com` |
| `VITE_SERVER_URL` | Web | Base URL of the API server, baked in at build time by Vite. Production: `https://server.deck-monsters.com`. Leave empty in dev (Vite proxy handles `/trpc` locally) |

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
