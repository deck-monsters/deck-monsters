# AGENTS.md

## Cursor Cloud specific instructions

### Project structure

pnpm monorepo with Turborepo. Four packages:

| Package | Path | Test runner |
|---|---|---|
| `@deck-monsters/engine` | `packages/engine` | Mocha (`pnpm --filter @deck-monsters/engine test`) |
| `@deck-monsters/server` | `packages/server` | Mocha (`pnpm --filter @deck-monsters/server test`) |
| `@deck-monsters/connector-discord` | `packages/connector-discord` | Mocha (`pnpm --filter @deck-monsters/connector-discord test`) |
| `@deck-monsters/web` | `apps/web` | Vitest (`pnpm --filter @deck-monsters/web test`) |

### Commands

See `README.md` for the full command reference. Key commands:

- `pnpm test` — runs all test suites via Turborepo
- `pnpm lint` — ESLint across all packages
- `pnpm build` — TypeScript build for all packages
- `pnpm --filter @deck-monsters/web dev` — Vite dev server (port 5173)
- `pnpm --filter @deck-monsters/server dev` — API server with tsx watch (port 3000)

### Build before test (important)

The `server`, `connector-discord`, and `web` packages import from `@deck-monsters/engine` via its `dist/` output. You **must** run `pnpm build` before `pnpm test` on a fresh checkout, or server/discord/web tests will fail with `ERR_MODULE_NOT_FOUND` for the engine dist.

### Web app env vars

The web app (`apps/web`) requires Supabase credentials to render. Without a valid `.env.local` (copied from `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`), the app throws on startup and shows a blank page. For local dev without a real Supabase instance, placeholder values will let the UI render (auth/login won't work).

### All tests are self-contained

All test suites mock external dependencies (database, Discord API, Supabase). No running services (Postgres, Supabase, Docker) are needed to run tests.

### Engine demo

To exercise the core game engine without any services:

```bash
node --input-type=module -e "import { Game } from './packages/engine/dist/index.js'; const g = new Game(() => {}, {}, console.log); console.log('Engine OK'); g.dispose(); process.exit(0);"
```
