---
type: Roadmap
title: Roadmap Sweep Pass
description: Active pass plan for a batch of roadmap fixes, delegated to subagents under orchestrator review.
status: draft
audience: internal
tags: [roadmap, pass, subagents]
---
# 25 — Roadmap Sweep Pass

**Status:** Active. This plan is the resumable record of the pass. Update the task table in
the same commit that lands each task. When the pass closes, fold its decisions into the area
docs and move this file to `docs/archive/roadmap/`.

## Process being tried

- The orchestrator (Tier 3) triages, writes one brief per task, reviews every diff, and owns
  the branch, the roadmap files, and `10b-bugs-fixed.md`. Implementers put draft ledger text
  in their report instead of editing shared roadmap files, so parallel tasks do not collide.
- Implementers run at Tier 2. Code tasks that run in parallel each get their **own git
  worktree**, so concurrent `pnpm build` runs cannot rewrite one shared `dist/`. The
  orchestrator cherry-picks each reviewed commit onto the pass branch.
- Every code task gets an independent, read-only Tier 2 review before it lands. A fix round
  goes back to the same implementer.

## Tasks

| # | Task | Source | Tier | Status | Commit |
|---|---|---|---|---|---|
| T0 | Triage candidate roadmap items against the code | all roadmap files | 2 (read-only) | Done | — |
| T1 | Clean Markdown for generated player docs, plus a structural test | user report | 2 | In progress | — |
| T2 | Real-fight coin/XP reward test, including after `restoreGame` | 10 §J | 2 | In progress | — |
| T3 | Coin/XP distributions in the simulation harness; fix the stale harness bullet | 11 | 2 | In progress | — |
| T4 | Sub-event gap for two-roll cards; paced fight opening | 10 §2, §3 | 2 | Planned (after T2) | — |
| T5 | Show the engine's item-use narration in the web Workshop | item follow-ups | 2 | Planned | — |
| T6 | Room-scoped web selling | item follow-ups | 2 | Planned (after T5) | — |
| T7 | Mobile Workshop header rule and tier-2 reason copy | 10 §6, 22 | 2 | In progress | — |
| T8 | Encode the orchestrator/subagent pattern in the agent docs; ignore agent worktrees | user request | 3 | Done | this commit |

## Decisions

- **Room reset keeps `room_events`.** The reset contract in
  [rooms and identity](../architecture/rooms-and-identity.md) clears projections and
  summaries, not the raw log. Triage confirmed the code matches that contract. Whether
  pre-reset narration should stay visible is a retention decision, which stays open in
  [small leftovers](22-small-leftovers.md).
- **Deferred:** prompt step and flow labels (they need per-flow design across about 30
  prompt call sites), crit ticks (they need a deferred-choice design that respects the prompt
  concurrency rules), `notable_cards` (needs a product definition, and nothing reads the
  field), and display-name locking (needs a multi-instance proof).
- **Tier-2 reason copy.** Each reason says what would make the item usable, not only that it
  is unusable (orchestrator voice pass, T7).
