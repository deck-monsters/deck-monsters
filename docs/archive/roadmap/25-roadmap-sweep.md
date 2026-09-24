---
type: Archive
title: Roadmap Sweep Pass
description: Active pass plan for a batch of roadmap fixes, delegated to subagents under orchestrator review.
status: deprecated
audience: internal
tags: [roadmap, pass, subagents]
---
# 25 — Roadmap Sweep Pass

**Status:** Closed. Historical record of the pass. The process rules now live in
[subagents](../../agents/subagents.md#the-orchestrated-pass), and deferred items have homes
in the active roadmap files.

## Process being tried

- The orchestrator (Tier 3) triages, writes one brief per task, reviews every diff, and owns
  the branch, the roadmap files, and `10b-bugs-fixed.md`. Implementers put draft ledger text
  in their report instead of editing shared roadmap files, so parallel tasks do not collide.
- Implementers run at Tier 2. Code tasks that run in parallel each get their **own git
  worktree**, so concurrent `pnpm build` runs cannot rewrite one shared `dist/`. The
  orchestrator cherry-picks each reviewed commit onto the pass branch.
- Every code task gets an independent, read-only Tier 2 review before it lands. A fix round
  goes back to the same implementer.
- **Amended mid-pass:** after two usage-limit stops, the owner asked to wrap up. Tasks still
  in flight at that point (T3's fix round, T4, T6) land on the implementer's verification plus
  an orchestrator read, and their independent review moves to PR review. T1's reviewer
  confirmed that `pnpm run build:docs` reproduces the committed files byte for byte before
  it stopped.

## Tasks

| # | Task | Source | Tier | Status | Commit |
|---|---|---|---|---|---|
| T0 | Triage candidate roadmap items against the code | all roadmap files | 2 (read-only) | Done | — |
| T1 | Clean Markdown for generated player docs, plus a structural test | user report | 2 | Done | 8681a50, f043395 |
| T2 | Real-fight coin/XP reward test, including after `restoreGame` (in-process path proven; production cause still open) | 10 §J | 2 | Done | 11c0cc9 |
| T3 | Coin/XP distributions in the simulation harness; fix the stale harness bullet (#181) | 11 | 2 | Done | c46568e, 6f6f81c |
| T4 | Sub-event gap for two-roll cards; paced fight opening (#178, #179); lucky-strike test fix (#180) | 10 §2, §3 | 2 | Done | 3a4dfa4, 316b5ee |
| T5 | Show the engine's item-use narration in the web Workshop | item follow-ups | 2 | Done | 0251484 |
| T6 | Room-scoped web selling | item follow-ups | 2 | Done | a94d230 |
| T7 | Mobile Workshop header rule and tier-2 reason copy (#177) | 10 §6, 22 | 2 | Done | 079069b |
| T8 | Encode the orchestrator/subagent pattern in the agent docs; ignore agent worktrees | user request | 3 | Done | ef7e377, 1e44333 |

## Decisions

- **Room reset keeps `room_events`.** The reset contract in
  [rooms and identity](../../architecture/rooms-and-identity.md) clears projections and
  summaries, not the raw log. Triage confirmed the code matches that contract. Whether
  pre-reset narration should stay visible is a retention decision, which stays open in
  [small leftovers](../../roadmap/22-small-leftovers.md).
- **Deferred:** prompt step and flow labels (they need per-flow design across about 30
  prompt call sites), crit ticks (they need a deferred-choice design that respects the prompt
  concurrency rules), `notable_cards` (needs a product definition, and nothing reads the
  field), and display-name locking (needs a multi-instance proof).
- **Tier-2 reason copy.** Each reason says what would make the item usable, not only that it
  is unusable (orchestrator voice pass, T7).
