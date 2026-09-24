# AGENTS.md — Deck Monsters

`CLAUDE.md` is a symlink to this file. Edit this file only.

The human-facing project entry point, ESM connector example, and command list are in
[`README.md`](README.md). [`docs/README.md`](docs/README.md) is the documentation map.
This file routes; it does not copy those contracts.

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
3. **Link new docs from here.** Add them to the table below and to
   [`docs/README.md`](docs/README.md) so they are discoverable without a search.
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
7. **Maintain documentation lifecycle.** For any change that adds, edits, moves, invalidates,
   or should update documentation, use
   `.cursor/skills/maintaining-repository-docs/SKILL.md` before editing docs. This includes
   behavior changes, roadmap status, generated references, runbooks, and durable findings.

## Working with subagents

- Delegate whenever a piece of work can be isolated behind a brief and a report — the
  orchestrator's context is the scarce resource, and a saturated orchestrator forgets the
  plan it is supposed to be holding.
- **Default shape for roadmap work:** a Tier 3 orchestrator triages with a read-only
  explorer, makes the judgment calls, briefs Tier 2 implementers (parallel code tasks each
  in their own worktree), reviews every diff, and owns the branch and roadmap files. See
  [the orchestrated pass](docs/agents/subagents.md#the-orchestrated-pass).
- **Budget the pass.** Usage limits apply per time window, so keep a PR to four or five
  tasks, run no more than two or three agents at once, and scale review to risk. See
  [budget](docs/agents/subagents.md#budget).
- Pick the cheapest tier that can do the job, but treat turn count as part of the price: a
  cheap model on a multi-step prose spec often burns 2–3x the turns. Tier 2 is the floor for
  anything implemented from prose.
- Always set the model explicitly. An omitted model inherits the orchestrator's, which is
  usually the most expensive one available. The top models and effort levels (the
  owner-initiated tier in the [tier table](docs/agents/subagents.md#tiers)) are started by
  the owner, never by an agent.
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

See [`docs/agents/subagents.md`](docs/agents/subagents.md) for the tier criteria, harness
notes, and the full dispatch procedure.

## Current documentation

Read the relevant current document *before* changing code in its area. The map at
[`docs/README.md`](docs/README.md) is the complete index; this table is the trigger list.
Open work is indexed at `docs/roadmap/README.md`. Historical reasoning is indexed from
[`docs/archive/README.md`](docs/archive/README.md) and is not required to understand a
current contract.

| Doc | Read before touching |
|-----|----------------------|
| [`docs/agents/game-primer.md`](docs/agents/game-primer.md) | Anything, if you have never played the game — how the loop, pacing, healing, bosses, prompts, and the web feeds actually behave |
| [`docs/agents/working-in-this-repo.md`](docs/agents/working-in-this-repo.md) | Opening a PR, numbering a bug, running the verification gate, or doing live verification |
| [`docs/agents/subagents.md`](docs/agents/subagents.md) | Delegating any part of a task to another agent |
| [`docs/reference/voice-and-wording.md`](docs/reference/voice-and-wording.md) | Any player-facing string: prompts, help text, announcements, button labels, Discord descriptions |
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
| [`docs/operations/local-testing.md`](docs/operations/local-testing.md) | Manual end-to-end verification, including reusable local test rooms |
| [`docs/operations/deployment.md`](docs/operations/deployment.md) | Railway/Supabase deployment or production environment configuration |
| [`docs/operations/cloud-development.md`](docs/operations/cloud-development.md) | Cursor Cloud setup, Docker, or remote/local Supabase in Cloud |
| [`docs/operations/devcontainer-auth.md`](docs/operations/devcontainer-auth.md) | Devcontainer setup, or GitHub credentials that must stay inside the container |
| [`docs/reference/pixel-art.md`](docs/reference/pixel-art.md) | Sprite, canvas, or CSS pixel-art work |
| [`docs/reference/player-agency.md`](docs/reference/player-agency.md) | Player agency, bounded items, or live-combat-control proposals |
| [`docs/reference/simulation-harness.md`](docs/reference/simulation-harness.md) | A `sim:*` script, a `SimResult` field, or any balance claim that needs simulation evidence |
| [`ITEMS.md`](ITEMS.md) | Player-facing item use, inventory, targeting scrolls, and shop rules |

## Generated player references

`PLAYER_HANDBOOK.md`, `MONSTERS.md`, `CARDS.md`, and `DMG.md` are generated from
`packages/engine/src/build`. Edit the generator and run `pnpm run build:docs`. Do not
hand-edit those files. `ITEMS.md` is the authored item guide.

The root `.md` files are rendered by `packages/engine/src/build/markdown.ts` (its header
comment has the two-renderer design); `root-docs.test.ts` guards their Markdown stays
clean.

## Commands and setup

Run `pnpm build` before the first `pnpm test` on a fresh checkout. `server`,
`connector-discord`, and `web` import `@deck-monsters/engine` from `dist/`. Root `pnpm dev`
rebuilds packages; it does not start the API or the web app. Start those from
[`README.md`](README.md). `DECK_MONSTERS_SKIP_DELAYS` zeroes pacing delays for tests and the
harness. Verification commands are in
[`docs/agents/working-in-this-repo.md`](docs/agents/working-in-this-repo.md). After a
documentation edit, run `pnpm docs:check`.

## Critical Architecture Rule: Room-Level Scoping

**All game state, events, database queries, and API calls must be scoped to a room.**

Every DB query on game data needs a `where room_id = ?` clause. Every tRPC procedure must validate room membership before returning data. Every event emission carries a `roomId`; every subscriber filters by it. WebSocket/SSE subscriptions must be gated to the current room and torn down when navigating away.

See [`docs/architecture/rooms-and-identity.md`](docs/architecture/rooms-and-identity.md) for the full rule with code examples, a code-review checklist, and a table of common failure patterns. Past bugs have been caused by missing room filters — treat this as a hard constraint, not a guideline.

## Critical Architecture Rule: Concurrency, Timing, and Prompt Flows

Fight pacing, the serialized engine lanes, `activeFlows`, and the interactive prompt lifecycle interact in non-obvious ways and have caused the most persistent production bugs (fights flying by, commands appearing ignored, multi-step flows crashing). Before touching `helpers/delay-times.ts`, `ring/index.ts` pacing, `events/room-event-bus.ts` prompts, or the server command pipeline in `trpc/router.ts`, read [`docs/architecture/engine-concurrency-and-timing.md`](docs/architecture/engine-concurrency-and-timing.md). Key invariants: interactive command actions run fire-and-forget in a per-`roomId:userId` lane (never room-wide — that starves other users); awaited workshop mutations must stay prompt-free on the per-room workshop lane; the `PROMPT_CANCELLED` sentinel must be translated to `PromptCancelledError` before reaching game code; creature timers belong to the creature's owner, so only transient (boss/harness) contestants are disposed when the ring clears.

## Connectors

The engine has no Discord, HTTP, or database code. Construct a room game with
`new Game({ roomId }, log)` or `restoreGame(gameJSON, log)`. In-process connectors share one
`RoomManager`, then bridge that room's bus with `ConnectorAdapter`. The current ESM example
is in [`README.md`](README.md). Prompt answers follow
[`docs/reference/prompt-answer-contract.md`](docs/reference/prompt-answer-contract.md).
Room mapping is in
[`docs/architecture/rooms-and-identity.md`](docs/architecture/rooms-and-identity.md);
delivery is in
[`docs/architecture/events-prompts-and-replay.md`](docs/architecture/events-prompts-and-replay.md).
