# AGENTS.md — Deck Monsters

`CLAUDE.md` is a symlink to this file. Edit this file only.

## Standing Instructions

These apply to every task in this repo, not just the one you were asked to do.

1. **Fix what you find.** While working, watch for small bugs, dead branches, missing guards,
   and copy-paste drift in the code you touch or read. Roll the fix into the same change
   rather than leaving it — the codebase gets better incrementally. Anything too big to
   absorb goes in `docs/roadmap/10-bug-fixes.md` with a root-cause note.
2. **Update the docs as you go.** A behaviour change that isn't reflected in the architecture
   docs is half-finished. Update the relevant doc in the same change, and add a new one under
   `docs/` when you build a subsystem that future work will need context on. Record fixed
   bugs (with root causes, not just symptoms) in `docs/roadmap/10b-bugs-fixed.md`, and keep
   `docs/roadmap/README.md`'s status table current.
3. **Link new docs from here.** Add them to the Architecture Docs table below so they are
   discoverable without a search.
4. **Explain the "why".** Comments and docs in this repo lean toward recording *why* a
   constraint exists — several were written after a production bug. Preserve that; when you
   fix something subtle, leave a note saying what broke, so nobody re-introduces it.
5. **Checkpoint after each task.** On multi-step or subagent-driven work, commit (and push
   the feature branch) as soon as each discrete task lands — for example after a subagent
   finishes an implementation task, after a review-fix round, or after a verification
   pass updates docs. Do not batch an entire roadmap into one late commit. Small, reviewable
   commits keep progress recoverable if a later step fails or the session ends early.
6. **Plan in the roadmap, in the same commits.** A multi-task pass gets a planning doc under
   `docs/roadmap/NN-<pass>.md` (task table with status and commit SHAs, decisions made,
   process rules being tried). Update it in the checkpoint commit for each task, not in a
   separate housekeeping commit, so `git log` of the plan is the history of the work. When
   the pass is finished, fold its decisions into the owning area docs and move the plan to
   `docs/archive/roadmap/`.

## Working with subagents

- Delegate whenever a piece of work can be isolated behind a brief and a report — the
  orchestrator's context is the scarce resource, and a saturated orchestrator forgets the
  plan it is supposed to be holding.
- Pick the cheapest tier that can do the job, but treat turn count as part of the price: a
  cheap model on a multi-step prose spec often burns 2–3x the turns. Tier 2 is the floor for
  anything implemented from prose.
- Always set the model explicitly. An omitted model inherits the orchestrator's, which is
  usually the most expensive one available.
- Never run two implementers on overlapping files; docs-only work can run beside code work.
  Two tasks that both edit `docs/roadmap/README.md` or `10b-bugs-fixed.md` are overlapping.
- **Implementers in a shared worktree never create or switch branches**, `git add` only the
  files they changed, and never push — the orchestrator owns the branch. Put those three rules
  in every implementer brief; one implementer here silently moved the whole worktree onto a
  new branch and the orchestrator's next commit landed there.
- **Verify the artifact before you trust the report.** A subagent can return "success" having
  written nothing — this has happened here. Check the file exists and reads correctly, and
  re-dispatch on a different model rather than retrying the same one unchanged.
- **Every code task gets an independent, read-only review** (spec compliance, then quality)
  with the diff handed over as a file, and a fix round is sent back to the *same* implementer
  with the review file. `DONE_WITH_CONCERNS` is a finding, not a footnote — the concern that
  "frames reuse the base map" meant nothing animated.
- **Re-check live after a fix round touches timing or UI.** Unit tests with fake timers passed
  while the real browser still misbehaved (#162).

See [`docs/agents/subagents.md`](docs/agents/subagents.md) for the tier table, harness notes,
and the full dispatch procedure.

## Architecture Docs

Read the relevant doc *before* changing code in its area — each one exists because something
non-obvious bit us before.

| Doc | Read before touching |
|-----|----------------------|
| [`docs/agents/game-primer.md`](docs/agents/game-primer.md) | Anything, if you have never played the game — how the loop, pacing, healing, bosses, prompts, and the web feeds actually behave |
| [`docs/agents/working-in-this-repo.md`](docs/agents/working-in-this-repo.md) | Opening a PR, numbering a bug, running the verification gate, or doing live verification |
| [`docs/agents/subagents.md`](docs/agents/subagents.md) | Delegating any part of a task to another agent |
| [`docs/voice-and-wording.md`](docs/voice-and-wording.md) | Any player-facing string: prompts, help text, announcements, button labels, Discord descriptions |
| [`docs/archive/README.md`](docs/archive/README.md) | Looking for the reasoning behind something that already shipped (archived roadmap plans, retired subsystems) |
| [`docs/room-scoping.md`](docs/room-scoping.md) | Any game state, DB query, tRPC procedure, or event subscription. **Hard constraint, not a guideline.** |
| [`docs/engine-concurrency-and-timing.md`](docs/engine-concurrency-and-timing.md) | `helpers/delay-times.ts`, `ring/index.ts` pacing, `events/room-event-bus.ts` prompts, the server command pipeline, or **any** `game.on(...)` listener or new timer |
| [`docs/boss-encounters.md`](docs/boss-encounters.md) | Bosses, boss summoning, ring events, teams, or targeting strategies |
| [`docs/observability.md`](docs/observability.md) | Metrics, logging, or Grafana dashboards |
| [`docs/prompt-answer-contract.md`](docs/prompt-answer-contract.md) | Any `channel({ question, choices })` call site, or connector code that answers one — **what a connector sends back is not a free-form string; get this wrong and a menu silently routes to the wrong option** |
| [`docs/local-testing-guidelines.md`](docs/local-testing-guidelines.md) | Manual end-to-end verification (includes reusable local test rooms) |
| [`docs/deployment.md`](docs/deployment.md) | Railway/Supabase deployment or environment configuration |
| [`docs/devcontainer-auth.md`](docs/devcontainer-auth.md) | Devcontainer setup, or GitHub credentials that must stay inside the container instead of on the host |
| [`docs/pixel-art-animations-in-js.md`](docs/pixel-art-animations-in-js.md) | Sprite, canvas, or CSS pixel-art work in the web app (crisp rendering, sprite sheets, common pitfalls) |
| [`docs/archive/roadmap/18-live-ring-roster.md`](docs/archive/roadmap/18-live-ring-roster.md) | The ring roster panel, `ring.state` payload, or `Ring.publishState()` call sites |
| [`docs/roadmap/19-player-agency-and-items.md`](docs/roadmap/19-player-agency-and-items.md) | Items, targeting scrolls, deck-building agency, or any "should the player control this?" question |
| [`ITEMS.md`](ITEMS.md) | Player-facing item use, inventory, targeting scroll and shop rules |
| [`docs/roadmap/20-workspace-layout.md`](docs/roadmap/20-workspace-layout.md) | `Terminal.tsx` panes, the 1024px breakpoint, tabs, the pane divider, or moving a surface between a route and a pane |
| [`docs/roadmap/23-pixel-fight-stage.md`](docs/roadmap/23-pixel-fight-stage.md) | The pixel fight stage, the Ring roster's sprites, or the `pixel-art` theme feature — why it is opt-in and off by default, and what to decide before building more |
| [`docs/roadmap/README.md`](docs/roadmap/README.md) | Planning work — the authoritative status index |

## Project Overview

Deck Monsters is a turn-based monster-battling RPG game engine (think Pokémon meets deck-building). Players train monsters, equip them with action card decks, and send them into an auto-battling ring. The engine is platform-agnostic and driven by external connector adapters (Discord, web, and others).

Originally built to run inside a private Slack workspace (via a Hubot bot named Jane). The project has been revived with a modern TypeScript monorepo, Supabase + Railway hosting, Discord and web connectors, auth, and multi-room support.

## Repository Layout

pnpm monorepo managed by Turborepo. See `README.md` for the full command reference.

```
packages/
  engine/          # @deck-monsters/engine — core game logic (TypeScript, ESM)
  server/          # @deck-monsters/server — Fastify + tRPC API, RoomManager, event persistence
  connector-discord/  # @deck-monsters/connector-discord — Discord.js v14 slash commands
  harness/         # @deck-monsters/harness — CLI battle harness and integration test scenarios

apps/
  web/             # @deck-monsters/web — Vite + React (TS) web app (terminal aesthetic)

supabase/          # Supabase migrations and local dev config
scripts/           # Repo-level setup scripts (setup:local, etc.)
docs/              # Architecture docs, roadmap, archive
  agents/          # Reference docs written for coding agents (game primer, repo operations, subagents)
  roadmap/         # Remaining work + README.md index; 10b is the stable bug ledger
  archive/roadmap/ # Shipped plans and their reasoning
  superpowers/     # Plans and specs produced during agent-driven work
  room-scoping.md  # Critical architectural rule — read this
```

| Package | Path | Test runner |
|---|---|---|
| `@deck-monsters/engine` | `packages/engine` | Mocha |
| `@deck-monsters/server` | `packages/server` | Mocha |
| `@deck-monsters/connector-discord` | `packages/connector-discord` | Mocha |
| `@deck-monsters/harness` | `packages/harness` | Mocha |
| `@deck-monsters/web` | `apps/web` | Vitest |

### Engine source layout (`packages/engine/src/`)

```
index.ts           # Public API: Game, restoreGame, resetGame, getOptions
browser.ts         # Browser-safe subset (pure data, no node: imports); Vite aliases the engine to it
game.ts            # Main Game class (orchestrator, state serialization)
game.test.ts       # Game-level suite: state round-trips, reward handlers, listener guards
commands/          # Text command parser: monster, character, look-at, store, presets, history, help
cards/             # ~55 action card types; base class in cards/base.ts
monsters/          # 5 monster types (Basilisk, Gladiator, Jinn, Minotaur, Weeping Angel)
creatures/base.ts  # BaseCreature — core combat/stat logic (stats/health/encounter/items/edit/types extracted into sibling modules)
characters/        # Beastmaster player character + hydration helpers
items/             # 25+ items: potions, scrolls, store inventory
ring/              # Battle arena (2–12 monsters, fight countdown 60s)
channel/           # ChannelManager: message queue + batching for adapters
helpers/           # XP, leveling, targeting, timing, prompt choices
constants/         # Stats, coin values, creature types, card classes, timing, ring lore
announcements/     # Message generation for game events
events/            # GameEvent types, RoomEventBus, prompt lifecycle
schemas/           # Zod schemas for state deserialization and validation
shared/            # BaseClass (EventEmitter + options store) behind Game, Ring, creatures, and items; mocha test-setup
testing/           # createTestGame and friends — drive a Game with no HTTP/DB, used by tests and the harness
types/             # Shared TypeScript types plus vendor.d.ts
build/             # Generators for CARDS.md / DMG.md / the handbook (`pnpm run build:docs`)
card-odds.json     # Pre-computed per-card hit/heal/damage odds, rendered into card stat blocks
vendor/roll/       # Vendored dice-roll library
exploration/       # Archived expedition system — still in the tree, not wired into the revival
```

## Tech Stack

- **Runtime**: Node.js v22 LTS
- **Language**: TypeScript (strict mode, ESM throughout)
- **Monorepo**: pnpm workspaces + Turborepo
- **Database**: Supabase (Postgres) + Drizzle ORM
- **API**: Fastify + tRPC (type-safe end-to-end)
- **Auth**: Supabase Auth — JWT validation, Discord OAuth, web email/password
- **Hosting**: Railway (server + Discord connector), Supabase (DB + Auth + Realtime)
- **Testing**: Mocha (engine, server, discord, harness) + Vitest (web)
- **Linting**: `@typescript-eslint` + Prettier
- **CI**: GitHub Actions — typecheck + lint + tests on every push and PR

## Development Commands

```bash
# Build all packages (required before first test run on a fresh checkout)
pnpm build

# Test everything
pnpm test

# Per-package
pnpm --filter @deck-monsters/engine test
pnpm --filter @deck-monsters/server test
pnpm --filter @deck-monsters/web test       # Vitest

# Watch mode (web)
pnpm --filter @deck-monsters/web test:watch

# Type-check all packages
pnpm typecheck

# Lint (pnpm lint:fix applies the auto-fixable ones)
pnpm lint
pnpm lint:fix

# Local Supabase stack (requires Docker)
pnpm setup:local --skip-install   # starts Supabase, runs migrations, seeds test user, writes .env.local files

# Start server + web app (after sourcing env)
set -a && source .env.local && set +a
pnpm --filter @deck-monsters/server dev   # port 3000
pnpm --filter @deck-monsters/web dev      # port 5173

# Regenerate CARDS.md / DMG.md / probability docs (builds engine first)
pnpm run build:docs
```

> **Important**: `pnpm build` must run before `pnpm test` on a fresh checkout. The `server`,
> `connector-discord`, and `web` packages import from `@deck-monsters/engine` via its `dist/`
> output; without the build, their tests fail with `ERR_MODULE_NOT_FOUND`.

> Root `pnpm dev` is `turbo run build --watch` — it rebuilds packages, it does **not** start the
> API or web dev servers. Start those per-package, as above.

All test suites mock their external dependencies (database, Discord API, Supabase), so
`pnpm test` needs no running services.

## Environment Variables

### Server (`packages/server`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable API key |
| `SUPABASE_SECRET_KEY` | Supabase service role key |
| `CONNECTOR_SERVICE_TOKEN` | Inter-service auth token (Discord connector → server) |
| `PORT` | Server port (default: 3000) |
| `CORS_ORIGINS` | Comma-separated allowed origins (default: `http://localhost:5173`) |

### Web app (`apps/web`)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` but Vite-prefixed |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_PUBLISHABLE_KEY` but Vite-prefixed |
| `VITE_SERVER_URL` | tRPC server URL (blank = same origin via Vite proxy) |

### Engine (optional)

| Variable | Purpose |
|----------|---------|
| `DECK_MONSTERS_SKIP_DELAYS` | Zeroes every pacing delay (tests, harness). Also switches `hitLogTimestamp()` to a monotonic counter |

> The S3 backup (`helpers/aws.ts`, `DECK_MONSTERS_AWS_*` / `HUBOT_DECK_MONSTERS_AWS_*`) was removed in the stack modernisation (`docs/archive/roadmap/01-modernize-stack.md`); Postgres is the only store.

## Cursor Cloud specific instructions

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

Sign in at `http://localhost:5173` using `$TEST_USERNAME` / `$TEST_PASSWORD`. Use the test
account's existing scratch rooms (`Test Room A` / `Test Room B`, listed with their current
contents in [`docs/local-testing-guidelines.md`](docs/local-testing-guidelines.md) under
"Reusable rooms") rather than creating new ones; keep that list current, and delete any
throwaway room you create before finishing (instructions in the same section).

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

### Checkpoint commits in Cloud Agent runs

Standing Instruction 5 applies verbatim here: commit and push to the feature branch after each
completed task (implementation green, review-fix landed, docs/roadmap updated, final
verification), not once at the end. It keeps the PR reviewable if the session is interrupted.

## How the Game Engine Works

### Adapter Pattern

The engine has no Discord/HTTP/database code. Connectors instantiate the game and provide two callbacks:

1. `publicChannel` — broadcasts ring events to the whole room
2. `privateChannel` — sends a DM to a specific player; also handles interactive prompts

Both share the same signature: `({ announce, question?, choices?, delay? }) => Promise<string | void>`

- `{ announce }` — fire-and-forget message
- `{ question, choices }` — interactive prompt; the connector must present choices to the user and resolve with their answer

```ts
import { Game, restoreGame } from '@deck-monsters/engine'

const publicChannel = ({ announce }) => postToChannel(roomChannel, announce)

const privateChannel = ({ announce, question, choices }) => {
  if (announce) return sendDM(userId, announce)
  if (question) return promptUser(userId, question, choices) // resolves with user's answer
}

const game = savedState
  ? restoreGame(publicChannel, savedState, log)
  : new Game(publicChannel, {}, log)

game.saveState = (state) => db.save(state) // engine calls this on every stateChange

// Dispatch a text command
const action = game.handleCommand({ command: 'send a monster to the ring' })
if (action) await action({ channel: privateChannel, channelName, isAdmin, isDM, user })
```

### `handleCommand`

`game.handleCommand({ command })` parses a natural language string and returns an action function, or `null`. Command handlers live in `packages/engine/src/commands/`:

- `monster.ts` — train/spawn, equip, ring, dismiss, revive, look at monster(s)
- `character.ts` — look at character, rankings, edit character
- `look-at.ts` — look at card, item, handbook, ring
- `store.ts` — buy, sell
- `presets.ts` — save/load/delete deck presets
- `history.ts` — catch-up fight history text command
- `help.ts` — in-game help
- `catalog.ts` — card catalog lookup

Admin alias feature: `"<command> as <name>"` runs a command as another character (admin-only). New connectors can register additional commands via `registerHandler(matcher, action)`.

### Game Loop

1. Monsters join ring → `ring.addMonster()`
2. ≥2 monsters (`MIN_MONSTERS`) triggers `startFightTimer()`, which announces a 60s countdown (`FIGHT_DELAY`) and then fights
3. Each encounter: monsters play next card in their deck (wraps when exhausted)
4. Cards resolve: 1d20 + modifiers vs AC for hit check, then damage/effects
5. Victory/Loss/Flee events → XP + coins awarded, possible card drop
6. Ring loops; players can swap/update decks between fights

### State Serialization

Game state is gzip+base64 encoded JSON, stored in Postgres. `game.saveState` is a getter/setter:

```ts
// Store the save function
game.saveState = (base64GzipString) => db.save(base64GzipString)
// Engine calls this.saveState() automatically on every 'stateChange' event

// Restore
restoreGame(publicChannel, base64GzipString, logger)
// Hydrates: characters → monsters → cards → items (recursive)
```

### Channel Manager

The engine batches outgoing messages (3000-char max per batch) to respect platform rate limits. Connectors should implement appropriate pacing — Discord uses interaction followups; the original Slack connector used 1200ms delays between messages.

### Event Bus

The server maintains a `GameEvent` stream per room. Events flow:

```
Game (engine) → publicChannel callback → server subscriber → Supabase Realtime / tRPC subscription → web/Discord clients
```

`FightSummaryWriter` persists fight results to `fight_summaries`. `FightStatsSubscriber` updates `room_player_stats` and `room_monster_stats` for the leaderboard.

## Critical Architecture Rule: Room-Level Scoping

**All game state, events, database queries, and API calls must be scoped to a room.**

Every DB query on game data needs a `where room_id = ?` clause. Every tRPC procedure must validate room membership before returning data. Every event emission carries a `roomId`; every subscriber filters by it. WebSocket/SSE subscriptions must be gated to the current room and torn down when navigating away.

See [`docs/room-scoping.md`](docs/room-scoping.md) for the full rule with code examples, a code-review checklist, and a table of common failure patterns. Past bugs have been caused by missing room filters — treat this as a hard constraint, not a guideline.

## Critical Architecture Rule: Concurrency, Timing, and Prompt Flows

Fight pacing, the serialized engine lanes, `activeFlows`, and the interactive prompt lifecycle interact in non-obvious ways and have caused the most persistent production bugs (fights flying by, commands appearing ignored, multi-step flows crashing). Before touching `helpers/delay-times.ts`, `ring/index.ts` pacing, `events/room-event-bus.ts` prompts, or the server command pipeline in `trpc/router.ts`, read [`docs/engine-concurrency-and-timing.md`](docs/engine-concurrency-and-timing.md). Key invariants: interactive command actions run fire-and-forget in a per-`roomId:userId` lane (never room-wide — that starves other users); awaited workshop mutations must stay prompt-free; the `PROMPT_CANCELLED` sentinel must be translated to `PromptCancelledError` before reaching game code; creature timers belong to the creature's owner, so only transient (boss/harness) contestants are disposed when the ring clears.

## Architecture Notes for New Connectors

1. Implement the channel callback: `({ announce, question?, choices?, delay? }) => Promise`
   - `announce` — post to channel/DM; return after sending
   - `question` + `choices` — prompt the user; resolve with their text answer (timeout ~2 min).
     **The answer must be either the 0-based index of the chosen option (as a string) or
     the option's label text.** See [`docs/prompt-answer-contract.md`](docs/prompt-answer-contract.md)
     for the full contract — a connector that sends something else (a 1-based number, a
     truncated label, etc.) will make the engine silently dispatch to the wrong option
     rather than error, which is exactly what happened in `docs/roadmap/10b-bugs-fixed.md` #143.
2. Initialize: `restoreGame(publicChannel, savedState, log)` or `new Game(publicChannel, {}, log)`
3. Set the save function: `game.saveState = (state) => db.save(state)`
4. For chat-style connectors: strip bot prefix → `game.handleCommand({ command })` → call returned action with `{ channel, channelName, isAdmin, isDM, user }`
5. For slash command / REST connectors: call `game.getCharacter({ channel, id, name })` directly, then invoke specific action methods
6. Connect to the server's event bus (via `CONNECTOR_SERVICE_TOKEN`) to receive and forward `GameEvent` objects to platform channels

## Known Issues

Open work is tracked in [`docs/roadmap/10-bug-fixes.md`](docs/roadmap/10-bug-fixes.md) — read its
status line rather than trusting a list here, which goes stale within a pass. As of this
writing the one high-priority open item is J (fight rewards — coins and xp — may never be
credited, superseding the incorrect closure recorded as #145), alongside two open pacing
items and a dead mobile CSS rule. Everything already fixed, with root causes, is archived in
[`docs/roadmap/10b-bugs-fixed.md`](docs/roadmap/10b-bugs-fixed.md), which currently runs to #163.

## Archived / Deferred

- **Exploration system** (`exploration/`) — monster expeditions (find loot, hazards, death cards). Archived for the revival; the core game is ring combat. See `docs/archive/exploration-system.md`.
- **Mobile app** — React Native + Expo. Deferred indefinitely. The tRPC API is mobile-compatible when the time comes. See `docs/roadmap/07-mobile-app.md`.
- **Slack connector** — Bolt SDK modernization of Jane/Hubot. Deferred indefinitely. See `docs/roadmap/08-modernize-slack-connector.md`.

## Roadmap

See [`docs/roadmap/README.md`](docs/roadmap/README.md) for remaining work, priorities, and
deferred product boundaries. Shipped plans are in [`docs/archive/roadmap/`](docs/archive/roadmap/);
the stable fixed-bug ledger intentionally remains at
[`docs/roadmap/10b-bugs-fixed.md`](docs/roadmap/10b-bugs-fixed.md) because code cites it.
