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

In **Project Settings → API**, copy:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Project URL (e.g., `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_JWT_SECRET` | **Settings → API → JWT Settings → JWT Secret** |

In **Project Settings → Database**, copy the connection string and set it as:

| Variable | Value |
|---|---|
| `SUPABASE_DB_URL` | `postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres` |

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
| `SUPABASE_DB_URL` | Your Supabase database connection string |
| `SUPABASE_JWT_SECRET` | Your Supabase JWT secret |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |

### Verify the deployment

Once the build completes, Railway provides a public URL. Check the health endpoint:

```bash
curl https://<your-railway-url>/health
# {"status":"ok","timestamp":"..."}
```

---

## 3. Local Development

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
```

Create a `.env.local` file at the repo root (git-ignored):

```env
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJ...
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
| `SUPABASE_DB_URL` | Yes | PostgreSQL connection string for Drizzle ORM |
| `SUPABASE_JWT_SECRET` | Yes | Used to verify Supabase-issued JWTs on the server |
| `SUPABASE_URL` | Yes | Supabase project URL (used by client-side SDK) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (used by client-side SDK) |
| `PORT` | No | HTTP port, defaults to `3000` |
| `HOST` | No | Bind address, defaults to `0.0.0.0` |
| `NODE_ENV` | No | `production` or `development` |

---

## Troubleshooting

**`SUPABASE_DB_URL environment variable is required`**
The server refuses to start without a database URL. Check your Railway environment variables.

**JWT verification failures**
Ensure `SUPABASE_JWT_SECRET` on Railway matches the value in **Supabase → Settings → API → JWT Settings**.

**Migrations not applied**
Run `supabase db push --linked` (production) or `supabase db reset` (local) to apply pending migrations.

**Docker build fails on `pnpm install --frozen-lockfile`**
The `pnpm-lock.yaml` is out of sync with package manifests. Run `pnpm install` locally and commit the updated lockfile.
