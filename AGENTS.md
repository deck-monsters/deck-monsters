# AGENTS.md

## Cursor Cloud specific instructions

### Project structure

pnpm monorepo with Turborepo. See `README.md` for the full command reference.

| Package | Path | Test runner |
|---|---|---|
| `@deck-monsters/engine` | `packages/engine` | Mocha |
| `@deck-monsters/server` | `packages/server` | Mocha |
| `@deck-monsters/connector-discord` | `packages/connector-discord` | Mocha |
| `@deck-monsters/web` | `apps/web` | Vitest |
| `@deck-monsters/shared-ui` | `packages/shared-ui` | (no tests) |

### Build before test (important)

`pnpm build` **must** run before `pnpm test` on a fresh checkout. The `server`, `connector-discord`, and `web` packages import from `@deck-monsters/engine` via its `dist/` output. Without the build, tests fail with `ERR_MODULE_NOT_FOUND`.

### All tests are self-contained

All test suites mock external dependencies (database, Discord API, Supabase). No running services are needed to run `pnpm test`.

### Two paths for running the full app

#### Path A — Remote DB (preferred in Cursor Cloud when secrets are available)

If the following secrets are injected as environment variables, write `.env.local` files and run the server + web app against the remote staging/production Supabase:

| Secret | Used by |
|---|---|
| `DATABASE_URL` | Server — Postgres connection string |
| `SUPABASE_URL` | Server — Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server + Web — publishable API key |
| `SUPABASE_SECRET_KEY` | Server — service role key |
| `CONNECTOR_SERVICE_TOKEN` | Server — inter-service auth token |
| `VITE_SUPABASE_URL` | Web — same as SUPABASE_URL but Vite-prefixed |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Web — same as SUPABASE_PUBLISHABLE_KEY but Vite-prefixed |
| `TEST_USERNAME` | Test account email for sign-in |
| `TEST_PASSWORD` | Test account password for sign-in |

To wire up the remote path:

```bash
# Root .env.local (server reads from here via docker-compose or source)
cat > .env.local <<EOF
DATABASE_URL=${DATABASE_URL}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}
SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY}
CONNECTOR_SERVICE_TOKEN=${CONNECTOR_SERVICE_TOKEN}
EOF

# Web .env.local
cat > apps/web/.env.local <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
VITE_SERVER_URL=
EOF

# Start server (loads env from process environment or .env.local)
set -a && source .env.local && set +a
pnpm --filter @deck-monsters/server dev   # port 3000

# Start web
pnpm --filter @deck-monsters/web dev      # port 5173, proxies /trpc to :3000
```

Sign in at `http://localhost:5173` using `$TEST_USERNAME` / `$TEST_PASSWORD`.

**Important**: The server does **not** auto-load `.env.local` — you must `source` it into the shell before starting `pnpm --filter @deck-monsters/server dev`. The web app (Vite) does auto-load `apps/web/.env.local`.

#### Path B — Local Supabase (requires Docker)

Runs a full local Supabase stack (Postgres, Auth, Studio) in Docker containers.

```bash
pnpm setup:local --skip-install   # Docker must be running; skips pnpm install
```

This starts Supabase, applies migrations, seeds a test user (`localtester@example.com` / `deck-monsters-local`), writes all `.env.local` files, and builds the engine.

Then start the server and web app:

```bash
set -a && source .env.local && set +a
pnpm --filter @deck-monsters/server dev   # port 3000
pnpm --filter @deck-monsters/web dev      # port 5173
```

### Docker in Cursor Cloud

Docker is installed in the update script. The VM runs inside a Firecracker container, requiring:
- `fuse-overlayfs` storage driver (configured in `/etc/docker/daemon.json`)
- `iptables-legacy` (set via `update-alternatives`)

The dockerd is started by the update script. After VM boot, verify with `docker info`.

### Railway CLI

`railway` is installed globally. Use it to view logs and manage deployments:

```bash
railway logs                    # view recent deploy logs
railway logs --build            # view build logs
railway run <command>           # run command with Railway env vars
```

Note: Railway CLI requires authentication (`railway login`) which needs a token set up externally.

### Supabase JWT issuer gotcha

The local Supabase auth server issues JWTs with `iss: "http://127.0.0.1:54321/auth/v1"`. The API server validates the issuer against `$SUPABASE_URL + "/auth/v1"`. If the env file uses `localhost` instead of `127.0.0.1`, JWT verification fails with "unexpected iss claim value". The `setup:local` script reads the URL from `supabase status --output json` to avoid this mismatch.

### Engine demo (no services needed)

```bash
node --input-type=module -e "import { Game } from './packages/engine/dist/index.js'; const g = new Game({}, console.log); console.log('Engine OK'); g.dispose(); process.exit(0);"
```
