# Deployment Guide

Deck Monsters runs on two hosted services:

- **Supabase Cloud** — PostgreSQL database, Auth (JWT issuance), and Storage
- **Railway** — Node.js application runtime (API server, game engine, WebSocket ring feed)

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

### Create the Railway project

1. Go to [railway.app](https://railway.app) and create a new project
2. Choose **Deploy from GitHub repo** and connect your `deck-monsters` repository
3. Railway will detect the `Dockerfile` at the root and build from it automatically

### Configure environment variables

In Railway, go to the service → **Variables** and add:

| Variable | Value |
|---|---|
| `PORT` | `3000` (Railway may set this automatically) |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Transaction pooler URL from Supabase → Settings → Database → Connection string |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Your Supabase Publishable key |
| `SUPABASE_SECRET_KEY` | Your Supabase Secret key (required for connector user auto-creation) |
| `CONNECTOR_SERVICE_TOKEN` | A secret token you generate (e.g., `openssl rand -hex 32`) used by connectors to authenticate server-to-server calls |

### Verify the deployment

Once the build completes, Railway provides a public URL. Check the health endpoint:

```bash
curl https://<your-railway-url>/health
# {"status":"ok","timestamp":"..."}
```

---

## 3. Discord Bot Setup

The Discord connector runs as a separate process (or a second Railway service) alongside the API server.

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

Add a second service in your Railway project:

1. In the same Railway project, add a new service from the same GitHub repo
2. Override the start command to: `node packages/connector-discord/dist/index.js`
3. Add the following environment variables:

| Variable | Value |
|---|---|
| `DISCORD_TOKEN` | Your bot token from the Discord developer portal |
| `DISCORD_CLIENT_ID` | Your application's client ID |
| `DATABASE_URL` | Same Supabase database connection string as the server |
| `SERVER_URL` | The Railway URL of the API server (e.g., `https://<server>.railway.app`) |
| `CONNECTOR_SERVICE_TOKEN` | Same token set on the API server |

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
