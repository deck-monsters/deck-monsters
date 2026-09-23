---
type: Runbook
title: Cloud development
description: Cursor Cloud setup for the remote database path and the local Supabase path.
status: stable
audience: internal
tags: [cloud, setup, supabase]
---
# Cloud development

Read before: configuring or debugging Cursor Cloud, selecting remote versus local
Supabase, starting the full app, or changing `.cursor/environment.json`.
Verified: 2026-09-23 against `.cursor/environment.json`, its install/start scripts, and
the current server/web environment consumers.

## Environment build

Cursor Cloud uses:

```json
{
  "install": "bash .cursor/cloud-agent-install.sh",
  "start": "bash .cursor/cloud-agent-start.sh"
}
```

The install phase installs Docker with `fuse-overlayfs` and legacy iptables, installs the
Railway CLI, runs `pnpm install --frozen-lockfile`, and builds the monorepo. The start phase
starts Docker and waits for a usable socket. A daemon started during the build does not
survive the snapshot, which is why Docker startup belongs in `start`.

Before relying on dependencies, inspect `/tmp/cursor/async-install/install-user.status`
when present (`0` is success). Before relying on services launched by environment startup,
inspect `/tmp/cursor/start-user/start-user.log` and its status file when present.

## Full app: remote Supabase

Use this path when the injected environment contains:

- server/database: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`;
- web: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`;
- manual sign-in: `TEST_USERNAME`, `TEST_PASSWORD`.

`CONNECTOR_SERVICE_TOKEN` is needed only when exercising service-authenticated tRPC calls.

Create the ignored local files without printing their values:

```bash
cat > .env.local <<EOF
DATABASE_URL=${DATABASE_URL}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY}
CONNECTOR_SERVICE_TOKEN=${CONNECTOR_SERVICE_TOKEN:-}
EOF

cat > apps/web/.env.local <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
VITE_SERVER_URL=
EOF
```

The server does not auto-load the root `.env.local`; source it before starting:

```bash
set -a && source .env.local && set +a
pnpm --filter @deck-monsters/server dev
```

Start the web app in another persistent terminal:

```bash
pnpm --filter @deck-monsters/web dev -- --host 0.0.0.0 --port 5173
```

Vite proxies local tRPC requests to port 3000 when `VITE_SERVER_URL` is empty.

Sign in with the injected test credentials and follow
[local testing](local-testing.md). Reuse the documented test rooms, keep their state row
current, and delete throwaway rooms before finishing.

## Full app: local Supabase

This path requires a working Docker daemon:

```bash
docker info
pnpm setup:local --skip-install
```

The setup starts the local Supabase stack, applies migrations, seeds
`localtester@example.com` / `deck-monsters-local`, writes ignored env files, and builds the
engine. Then source and start the server and web app exactly as above.

The local auth issuer uses `http://127.0.0.1:54321/auth/v1`. Keep `SUPABASE_URL` on
`127.0.0.1`, not `localhost`, or JWT verification rejects the issuer. The setup script
reads the URL from `supabase status` to keep this consistent.

## Docker in Cursor Cloud

The VM needs:

- `fuse-overlayfs` in `/etc/docker/daemon.json`;
- `iptables-legacy` and `ip6tables-legacy`;
- the Docker socket made usable after each boot.

The checked-in install/start scripts own that setup. If Docker is unavailable, diagnose
those scripts and the startup log before changing application code.

## No-service engine check

After the build, the engine can be verified without database or web services:

```bash
node --input-type=module -e \
  "import { Game } from './packages/engine/dist/index.js'; const g = new Game({ roomId: 'cloud-engine-check' }, console.error); console.log('Engine OK:', g.roomId); g.dispose(); process.exit(0);"
```

## Railway CLI

The environment installs Railway CLI for read/diagnostic operations:

```bash
railway logs
railway logs --build
railway run <command>
```

It requires an externally configured Railway login/token. Production setup and the
canonical environment-variable table live in [deployment](deployment.md).
