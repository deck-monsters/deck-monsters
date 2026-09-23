# Documentation map

Status: Current

Repository documentation follows one rule: **one fact, one canonical home; link rather
than restate**. When history and a current document disagree, current code and current
documents win.

## Locations and authority

| Location | Content | Authority |
|---|---|---|
| `architecture/` | Current subsystem behavior, boundaries, invariants, and rationale | Current |
| `operations/` | Executable setup, deployment, testing, and incident procedures | Current, with verification date |
| `reference/` | Authoring/protocol conventions consulted at a boundary | Current |
| `agents/` | How agents work in this repository and the gameplay primer | Current |
| `roadmap/` | Open work and status only | Current planning |
| `archive/` | Historical reasoning; current docs/code win | Historical |
| `superpowers/` | Active specs/plans only | Temporary |

Generated and authored player references remain at the repository root:
`PLAYER_HANDBOOK.md`, `MONSTERS.md`, `CARDS.md`, and `DMG.md` are generated;
`ITEMS.md` is authored.

## Read before changing a subsystem

### Architecture

| Trigger | Canonical document |
|---|---|
| Game state, room DB queries, membership, identity, invites, connector room mappings, subscriptions | [Rooms and identity](architecture/rooms-and-identity.md) |
| Events, visibility, prompts, persistence, reconnect, cursors, feed/history delivery | [Events, prompts, and replay](architecture/events-prompts-and-replay.md) |
| Fight pacing, server lanes, global semaphore listeners, timers, prompt concurrency | [Engine concurrency and timing](architecture/engine-concurrency-and-timing.md) |
| Boss creation/summoning, ring events, teams, targeting, boss timers | [Boss encounters](architecture/boss-encounters.md) |
| `Terminal`, surfaces, pane slots, routes, 1024px breakpoint, divider, navigation reveal | [Web workspace](architecture/web-workspace.md) |
| Workshop inventory, item use, lifecycle actions, prompt-free mutations, room shop | [Workshop and items](architecture/workshop-and-items.md) |
| Leaderboards, event history, fight summaries, catch-up, reward projections, retention | [Analytics and history](architecture/analytics-and-history.md) |
| `ring.state`, roster rows/order, pixel sprites, appearance palettes, feed portraits | [Ring roster and pixel monsters](architecture/ring-roster-and-pixel-monsters.md) |

### Operations

| Trigger | Canonical document |
|---|---|
| Railway/Supabase deployment, production auth URLs, service configuration, production env vars | [Deployment](operations/deployment.md) |
| Metrics endpoint, metrics variables, Grafana scrape, metric names, alerts | [Observability](operations/observability.md) |
| Cursor Cloud setup, remote/local Supabase in Cloud, Docker/start scripts | [Cloud development](operations/cloud-development.md) |
| Manual end-to-end testing, service startup, reusable test rooms, throwaway cleanup | [Local testing](operations/local-testing.md) |
| Devcontainer public-GitHub credential isolation | [Devcontainer auth](operations/devcontainer-auth.md) |

### Reference

| Trigger | Canonical document |
|---|---|
| Player-facing prompt, help, announcement, label, description, or game term | [Voice and wording](reference/voice-and-wording.md) |
| `channel({ question, choices })` call site or connector answer encoding | [Prompt/answer contract](reference/prompt-answer-contract.md) |
| Sprite maps, Canvas/CSS pixel art, scaling, palettes, animation construction | [Pixel art](reference/pixel-art.md) |
| Player agency, bounded live items, motivation evidence, or combat-control proposals | [Player agency](reference/player-agency.md) |

### Agent work

| Trigger | Canonical document |
|---|---|
| First task in the game or unfamiliar gameplay behavior | [Game primer](agents/game-primer.md) |
| Definition of done, bug numbering, verification, live checks, repository workflow | [Working in this repo](agents/working-in-this-repo.md) |
| Delegating, choosing a model tier, shared-worktree rules, independent review | [Subagents](agents/subagents.md) |

## Planning and history

- Start planning work at [`roadmap/README.md`](roadmap/README.md). Active roadmap files
  contain actionable work and current status, not shipped implementation diaries.
- Use [`archive/README.md`](archive/README.md) only to recover historical reasoning.
  Archived plans are not live contracts.
- `superpowers/specs/` and `superpowers/plans/` hold only the active pass's temporary design
  and implementation artifacts. Extract durable facts before deleting or archiving them.
