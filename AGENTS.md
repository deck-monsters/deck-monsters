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

## Current documentation

Read the relevant doc *before* changing code in its area — each one exists because something
non-obvious bit us before.

| Doc | Read before touching |
|-----|----------------------|
| [`docs/agents/game-primer.md`](docs/agents/game-primer.md) | Anything, if you have never played the game — how the loop, pacing, healing, bosses, prompts, and the web feeds actually behave |
| [`docs/agents/working-in-this-repo.md`](docs/agents/working-in-this-repo.md) | Opening a PR, numbering a bug, running the verification gate, or doing live verification |
| [`docs/agents/subagents.md`](docs/agents/subagents.md) | Delegating any part of a task to another agent |
| [`docs/README.md`](docs/README.md) | Finding the canonical current document for any subsystem or procedure |
| [`docs/reference/voice-and-wording.md`](docs/reference/voice-and-wording.md) | Any player-facing string: prompts, help text, announcements, button labels, Discord descriptions |
| `docs/archive/README.md` | Looking for the reasoning behind something that already shipped (archived roadmap plans, retired subsystems) |
| [`docs/architecture/rooms-and-identity.md`](docs/architecture/rooms-and-identity.md) | Any game state, DB query, membership, identity, connector mapping, or event subscription. **Hard constraint, not a guideline.** |
| [`docs/architecture/events-prompts-and-replay.md`](docs/architecture/events-prompts-and-replay.md) | `GameEvent`, visibility, persistence, prompts, reconnect, cursors, or history delivery |
| [`docs/architecture/engine-concurrency-and-timing.md`](docs/architecture/engine-concurrency-and-timing.md) | `helpers/delay-times.ts`, `ring/index.ts` pacing, prompts, the server command pipeline, or **any** `game.on(...)` listener or new timer |
| [`docs/architecture/boss-encounters.md`](docs/architecture/boss-encounters.md) | Bosses, boss summoning, ring events, teams, or targeting strategies |
| [`docs/architecture/web-workspace.md`](docs/architecture/web-workspace.md) | `Terminal`, workspace surfaces, pane slots, routes, divider, or navigation reveal |
| [`docs/architecture/workshop-and-items.md`](docs/architecture/workshop-and-items.md) | Workshop inventory, item use, prompt-free mutations, first-run training, or room shop |
| [`docs/architecture/analytics-and-history.md`](docs/architecture/analytics-and-history.md) | Analytics projections, leaderboards, fight summaries, catch-up, or retention |
| [`docs/architecture/ring-roster-and-pixel-monsters.md`](docs/architecture/ring-roster-and-pixel-monsters.md) | The Ring roster, `ring.state`, pixel sprites, appearance colours, or feed portraits |
| [`docs/operations/observability.md`](docs/operations/observability.md) | Metrics, logging, or Grafana dashboards |
| [`docs/reference/prompt-answer-contract.md`](docs/reference/prompt-answer-contract.md) | Any `channel({ question, choices })` call site or connector answer encoding |
| [`docs/operations/local-testing.md`](docs/operations/local-testing.md) | Manual end-to-end verification (includes reusable local test rooms) |
| [`docs/operations/deployment.md`](docs/operations/deployment.md) | Railway/Supabase deployment or production environment configuration |
| [`docs/operations/cloud-development.md`](docs/operations/cloud-development.md) | Cursor Cloud setup, Docker, or remote/local Supabase in Cloud |
| [`docs/operations/devcontainer-auth.md`](docs/operations/devcontainer-auth.md) | Devcontainer setup, or GitHub credentials that must stay inside the container instead of on the host |
| [`docs/reference/pixel-art.md`](docs/reference/pixel-art.md) | Sprite, canvas, or CSS pixel-art work (crisp rendering, sprite sheets, common pitfalls) |
| [`docs/reference/player-agency.md`](docs/reference/player-agency.md) | Player agency, bounded items, motivation evidence, or live-combat-control proposals |
| [`ITEMS.md`](ITEMS.md) | Player-facing item use, inventory, targeting scroll and shop rules |
| `docs/roadmap/README.md` | Planning work — the authoritative status index |

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
docs/              # Current docs, planning, and history; start at docs/README.md
  architecture/    # Current subsystem contracts and invariants
  operations/      # Verified setup, deployment, testing, and incident procedures
  reference/       # Authoring and protocol conventions
  agents/          # Reference docs written for coding agents (game primer, repo operations, subagents)
  roadmap/         # Remaining work + README.md index; 10b is the stable bug ledger
  archive/roadmap/ # Shipped plans and their reasoning
  superpowers/     # Plans and specs produced during agent-driven work
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

## Environment and Cloud development

Production environment variables are owned by
[`docs/operations/deployment.md`](docs/operations/deployment.md); metrics variables are
owned by [`docs/operations/observability.md`](docs/operations/observability.md). The
optional engine-only `DECK_MONSTERS_SKIP_DELAYS` variable zeroes pacing delays for tests
and the harness and makes hit-log timestamps monotonic.

Before configuring Cursor Cloud, remote or local Supabase, Docker startup, ignored env
files, or the no-service engine check, read
[`docs/operations/cloud-development.md`](docs/operations/cloud-development.md). Manual
sessions and reusable-room state are owned only by
[`docs/operations/local-testing.md`](docs/operations/local-testing.md).

## How the Game Engine Works

### Room-scoped connector boundary

The engine has no Discord/HTTP/database code. A `Game` owns one `roomId` and emits
`GameEvent`s through its `RoomEventBus`; it does not accept public/private callbacks in its
constructor.

The current Discord connector runs in-process with the server modules. One long-lived
`RoomManager` owns room lifecycle and persistence. After `GuildRoomManager` resolves and
validates the guild/user's `roomId`, the bot obtains that room's game and bus, then creates
a room-specific `ConnectorAdapter`:

```ts
import { ConnectorAdapter } from '@deck-monsters/engine'
import { RoomManager } from '@deck-monsters/server/room-manager'

const roomManager = new RoomManager(db, log)
const game = await roomManager.getGame(roomId)
const eventBus = await roomManager.getEventBus(roomId)
const adapter = new ConnectorAdapter(eventBus, publicChannel, `discord:${guildId}:${roomId}`, log)
adapter.registerUser(userId, privateChannel)

const action = game.handleCommand({ command: 'send a monster to the ring' })
if (action) await action({ channel: privateChannel, channelName, isAdmin, isDM, user })
```

`ConnectorAdapter` routes public events to the room channel, private events to the
registered user, and prompt requests through the private channel. Dispose the adapter when
the room/platform subscription ends.

At the lower engine boundary, fresh state is `new Game({ roomId }, log)` and persisted state
is `restoreGame(gameJSON, log)`. `RoomManager` selects the blob by `roomId`, verifies the
room exists, attaches the room-keyed `StateStore`, and owns unload/reset/delete behavior.
Do not recreate that with a global blob or an unscoped save callback.

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

Game state is gzip+base64 encoded JSON and stored per room in Postgres. A direct engine
embedding must scope both load and save:

```ts
const stateBlob = await postgresStateStore.load(roomId)
const game = stateBlob
  ? restoreGame(stateBlob, roomLog)
  : new Game({ roomId }, roomLog)

if (game.roomId !== roomId) throw new Error('Stored game belongs to a different room')
game.stateStore = postgresStateStore // save(roomId, state), load(roomId)
```

State changes schedule a debounced room-keyed save. Restore hydrates characters, monsters,
cards, and items recursively. Application code should go through `RoomManager`, which also
attaches event persistence and analytics subscribers.

### Channel and prompt callbacks

The callback shape used by `ConnectorAdapter` and command actions is
`({ announce, question?, choices?, delay? }) => Promise<string | void>`. Connectors
implement platform pacing and must obey the
[prompt answer contract](docs/reference/prompt-answer-contract.md).

### Event Bus

The server maintains a `GameEvent` stream per room. Events flow:

```
Game → room-owned RoomEventBus
  ├─ EventPersister / analytics subscribers
  ├─ membership-checked tRPC subscription → web
  └─ ConnectorAdapter / structured subscriber → Discord
```

`FightSummaryWriter` persists fight results to `fight_summaries`. `FightStatsSubscriber` updates `room_player_stats` and `room_monster_stats` for the leaderboard.

## Critical Architecture Rule: Room-Level Scoping

**All game state, events, database queries, and API calls must be scoped to a room.**

Every DB query on game data needs a `where room_id = ?` clause. Every tRPC procedure must validate room membership before returning data. Every event emission carries a `roomId`; every subscriber filters by it. WebSocket/SSE subscriptions must be gated to the current room and torn down when navigating away.

See [`docs/architecture/rooms-and-identity.md`](docs/architecture/rooms-and-identity.md) for the full rule with code examples, a code-review checklist, and a table of common failure patterns. Past bugs have been caused by missing room filters — treat this as a hard constraint, not a guideline.

## Critical Architecture Rule: Concurrency, Timing, and Prompt Flows

Fight pacing, the serialized engine lanes, `activeFlows`, and the interactive prompt lifecycle interact in non-obvious ways and have caused the most persistent production bugs (fights flying by, commands appearing ignored, multi-step flows crashing). Before touching `helpers/delay-times.ts`, `ring/index.ts` pacing, `events/room-event-bus.ts` prompts, or the server command pipeline in `trpc/router.ts`, read [`docs/architecture/engine-concurrency-and-timing.md`](docs/architecture/engine-concurrency-and-timing.md). Key invariants: interactive command actions run fire-and-forget in a per-`roomId:userId` lane (never room-wide — that starves other users); awaited workshop mutations must stay prompt-free; the `PROMPT_CANCELLED` sentinel must be translated to `PromptCancelledError` before reaching game code; creature timers belong to the creature's owner, so only transient (boss/harness) contestants are disposed when the ring clears.

## Architecture Notes for New Connectors

1. Define and validate the platform-to-`roomId` mapping before loading state or subscribing.
2. For an in-process connector, share one `RoomManager`; use `getGame(roomId)` and
   `getEventBus(roomId)`. For an external client, use authenticated, membership-checked
   tRPC procedures rather than bypassing the server boundary.
3. Create one `ConnectorAdapter` per platform/room subscription. Register each canonical
   user id with that user's private channel and dispose subscriptions when the mapping ends.
4. For chat input, call the room game's `handleCommand({ command })`, then invoke the action
   with the registered private channel and canonical user. Slash commands may call room
   game methods directly after the same room/user resolution.
5. Prompt answers must be the zero-based choice index as a string or the full option label.
   See [`docs/reference/prompt-answer-contract.md`](docs/reference/prompt-answer-contract.md).

`CONNECTOR_SERVICE_TOKEN` authenticates only the server's
`auth.registerConnectorUser` service procedure. There is no service-token event stream;
the current Discord connector reads the room bus in-process.

## Known Issues

Open work is tracked in `docs/roadmap/10-bug-fixes.md` — read its
status line rather than trusting a list here, which goes stale within a pass. As of this
writing the one high-priority open item is J (fight rewards — coins and xp — may never be
credited, superseding the incorrect closure recorded as #145), alongside two open pacing
items and a dead mobile CSS rule. Everything already fixed, with root causes, is archived in
`docs/roadmap/10b-bugs-fixed.md`, which currently runs to #173.

## Archived / Deferred

- **Exploration system** (`exploration/`) — monster expeditions (find loot, hazards, death cards). Archived for the revival; the core game is ring combat.
- **Mobile app** — React Native + Expo. Deferred pending player demand.
- **Slack connector** — Bolt SDK modernization of Jane/Hubot. Deferred pending player demand.

## Roadmap

See `docs/roadmap/README.md` for remaining work, priorities, and
deferred product boundaries. Shipped plans are in `docs/archive/roadmap/`;
the stable fixed-bug ledger intentionally remains at
`docs/roadmap/10b-bugs-fixed.md` because code cites it.
