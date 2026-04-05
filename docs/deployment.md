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

In **Authentication → URL Configuration**, set:

| Setting | Value |
|---|---|
| **Site URL** | `https://<your-web-service>.up.railway.app` (your Railway web domain) |
| **Redirect URLs** | Add `https://<your-web-service>.up.railway.app/**` and `http://localhost:5173/**` |

The Site URL is where Supabase redirects users after OAuth. If left as `localhost`, production OAuth flows will send users to your local machine.

### Enable Auth providers

In the project dashboard, go to **Authentication → Providers**:

- **Email** — enable, disable "Confirm email" for now (enable later for production)
- **Discord** — enable; set the Redirect URL shown to your Discord OAuth application

#### Discord OAuth application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Create a new application, then go to **OAuth2**
3. Add the redirect URL from Supabase (looks like `https://<project>.supabase.co/auth/v1/callback`)
4. Copy the Client ID and Client Secret back into Supabase's Discord provider settings

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
| `VITE_SERVER_URL` | _(leave blank for now — fill in after deploying the Server service)_ |

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
| `SERVER_URL` | The Server service's public Railway URL (e.g., `https://<server>.up.railway.app`) |
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
| `PORT` | No | HTTP port, defaults to `3000` (server only) |
| `HOST` | No | Bind address, defaults to `0.0.0.0` (server only) |
| `NODE_ENV` | No | `production` or `development` |
| `DISCORD_TOKEN` | Connector | Discord bot token (Discord connector only) |
| `DISCORD_CLIENT_ID` | Connector | Discord application client ID (Discord connector only) |
| `SERVER_URL` | Connector | Base URL of the API server, used by the Discord connector for service calls |

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
