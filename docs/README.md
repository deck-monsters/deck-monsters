---
type: Documentation Map
title: Documentation map
description: Index of current contracts, procedures, references, and their authority.
status: stable
audience: internal
tags: [documentation, index, authority]
---
# Documentation map

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
| Writing or changing a card or monster, card play resolution, fight-scoped card state, holds | [Cards and encounter effects](architecture/cards-and-encounter-effects.md) |
| Boss creation/summoning, ring events, teams, targeting, boss timers | [Boss encounters](architecture/boss-encounters.md) |
| `Terminal`, surfaces, pane slots, routes, 1024px breakpoint, divider, navigation reveal | [Web workspace](architecture/web-workspace.md) |
| Workshop inventory, item use, lifecycle actions, prompt-free mutations, room shop | [Workshop and items](architecture/workshop-and-items.md) |
| Leaderboards, event history, fight summaries, catch-up, reward projections, retention | [Analytics and history](architecture/analytics-and-history.md) |
| `ring.state`, roster rows/order, pixel sprites, appearance palettes, feed portraits | [Ring roster and pixel monsters](architecture/ring-roster-and-pixel-monsters.md) |

### Operations

| Trigger | Canonical document |
|---|---|
| Railway/Supabase deployment, production auth URLs, service configuration, production env vars | [Deployment](operations/deployment.md) |
| The `rooms.state_blob` column drop (step B): its guard, lock note and rollback | [State blob drop](operations/state-blob-drop.md) |
| Metrics endpoint, metrics variables, Grafana scrape, metric names, alerts | [Observability](operations/observability.md) |
| Cursor Cloud setup, remote/local Supabase in Cloud, Docker/start scripts | [Cloud development](operations/cloud-development.md) |
| Manual end-to-end testing, service startup, reusable test rooms, throwaway cleanup | [Local testing](operations/local-testing.md) |
| Devcontainer public-GitHub credential isolation | [Devcontainer auth](operations/devcontainer-auth.md) |

### Reference

| Trigger | Canonical document |
|---|---|
| Player-facing prompt, help, announcement, label, description, or game term | [Voice and wording](reference/voice-and-wording.md) |
| What a new player can see in the web app, and what explains it | [New-player help inventory](reference/help-inventory.md) |
| Whether roadmap 39's Workshop fixes and in-game Help match the shipped text | [Live check of Workshop fixes and in-game Help](reference/help-check.md) |
| Whether roadmap 39 batch 2 matches the shipped text | [Live check of roadmap 39 batch 2](reference/help-check-batch2.md) |
| Whether roadmap 39 batch 3 matches the shipped text | [Live check of roadmap 39 batch 3](reference/help-check-batch3.md) |
| Reviewing monster flavour strings or signature-card narration (generated inventories) | [Monster and card strings](reference/strings/README.md) |
| `channel({ question, choices })` call site or connector answer encoding | [Prompt/answer contract](reference/prompt-answer-contract.md) |
| Sprite maps, Canvas/CSS pixel art, scaling, palettes, animation construction | [Pixel art](reference/pixel-art.md) |
| Player agency, bounded live items, motivation evidence, or combat-control proposals | [Player agency](reference/player-agency.md) |
| Seeded fight simulations, `SimResult` fields, or a `sim:*` script | [Simulation harness](reference/simulation-harness.md) |
| Balance measurements that informed a decision (class curves, catalogues, matrices) | [Balance reports](reference/balance-reports/README.md) |

### Agent work

| Trigger | Canonical document |
|---|---|
| First task in the game or unfamiliar gameplay behavior | [Game primer](agents/game-primer.md) |
| Definition of done, bug numbering, verification, live checks, repository workflow | [Working in this repo](agents/working-in-this-repo.md) |
| Delegating, choosing a model tier, shared-worktree rules, independent review | [Subagents](agents/subagents.md) |

## Planning and history

- Start planning work at [`roadmap/README.md`](roadmap/README.md). Active roadmap files
  contain actionable work and current status, not shipped implementation diaries.
- The Dragon shipped in September 2026; its follow-ups are in
  [`roadmap/12-new-content-backlog.md`](roadmap/12-new-content-backlog.md#dragon-follow-ups).
- Use [`archive/README.md`](archive/README.md) only to recover historical reasoning.
  Archived plans are not live contracts.
- `superpowers/specs/` and `superpowers/plans/` hold only an active pass's temporary design
  and implementation artifacts. Extract durable facts before deleting them. There is no
  active pass in those directories right now.

When a change adds, edits, moves, or invalidates documentation, follow
[maintaining repository docs](../.cursor/skills/maintaining-repository-docs/SKILL.md)
before editing. That skill is the closeout procedure; this map remains the index.
`.claude/skills/maintaining-repository-docs` is a symlink to the same directory so Claude
Code discovers the skill too. Edit the `.cursor/` copy only.
