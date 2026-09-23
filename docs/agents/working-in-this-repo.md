---
type: Agent Guide
title: Working in this repo
description: Verification commands, bug numbering, and the definition of done.
status: stable
audience: internal
tags: [agents, workflow, verification]
---
# Working in this repo

House rules for agents doing work here: what "done" means, how bugs are numbered, how to
verify, and where things are written down. The standing instructions themselves live in
[`AGENTS.md`](../../AGENTS.md); this file is the operational detail behind them.

## Definition of done

A change is finished when all of these are true, in the same branch:

1. **Code + tests.** New behaviour has a test; a fixed bug has a test that fails without the
   fix. The whole gate below passes.
2. **`docs/roadmap/10b-bugs-fixed.md` entry** for anything that was a bug, written with the
   **root cause**, not the symptom — why the code was wrong, what it did instead, and which
   test now covers it. Entries here are the repo's institutional memory; several code
   comments exist only because someone re-introduced a bug the archive already explained.
3. **`docs/roadmap/10-bug-fixes.md`** summary line updated (status paragraph at the top, plus
   the item itself if it was tracked there).
4. **`docs/roadmap/README.md`** status table current — it is the authoritative index.
5. **The architecture doc for the area** updated if behaviour changed (see the trigger table
   in `AGENTS.md` and [`docs/README.md`](../README.md)). A behaviour change not reflected in
   its doc is half-finished.

## Bug numbering is a global sequence

Numbers in `10b-bugs-fixed.md` are one global sequence across the whole repo, not per-area.
Two branches in flight will happily claim the same number, and **the PR that merges first
wins** — the other renumbers on merge. That is not hypothetical: this branch's #154–#157
became #156–#159 when PRs #383/#384 landed first.

Before opening a PR: `git fetch origin main`, read the highest `### <n>.` heading on main
(`rg -n '^### ' docs/roadmap/10b-bugs-fixed.md | tail -5`), number from there, and expect to
renumber on conflict. Renumbering means the heading, every cross-reference in the roadmap
docs, and any code comment citing the number.

## Checkpoint commits

Commit and push after each discrete task — implementation green, review-fix landed, docs
updated, final verification — rather than batching a whole plan into one late commit. If the
session is interrupted (and long agent sessions are), everything up to the last checkpoint
survives and the PR stays reviewable.

## The verification gate

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test
```

Build **first**: `server`, `connector-discord`, and `web` import `@deck-monsters/engine`
through its `dist/` output, so a fresh checkout fails with `ERR_MODULE_NOT_FOUND` otherwise.
The suites mock their external dependencies — no database, Discord, or Supabase needs to be
running. A complete run is the one whose runner prints its final summary.

After any Markdown edit, also run `pnpm docs:check` (links, lifecycle placement, and OKF
frontmatter). CI runs it, and runs `pnpm test:docs` for the checker's own tests; neither is
part of the turbo `pnpm test`.

## Live verification

Automated tests do not catch pacing, scroll, or narration problems; most of the bugs in the
archive were found by playing. [Local testing](../operations/local-testing.md) owns the
setup and reusable-room state; [Cloud development](../operations/cloud-development.md)
owns the two Cursor Cloud env paths. Specifics worth knowing before you start:

- **Stage a fight in a few commands** using the one-shot equip form in
  [Local testing](../operations/local-testing.md#staging-a-fight-quickly). The interactive
  `equip` flow is a multi-prompt loop that strands browser-driving agents.
- **Scope Playwright selectors to `.terminal-pane.active`.** Hidden panes have identical DOM
  (`apps/web/src/components/ConsolePane.tsx` sets `terminal-pane active` on the live one), so
  an unscoped selector silently drives the pane nobody is looking at.
- **Prove what the engine emitted** by reading Postgres directly rather than inferring from
  the UI: `select type, text, created_at from room_events where room_id = '<uuid>' order by
  id` (`packages/server/src/db/schema.ts`). The difference between "the engine never emitted
  it" and "the UI dropped it" is most of the diagnosis in any feed bug.
- **Reuse the scratch rooms; do not leave new ones behind.** Reusable-room contents, ids,
  and invite codes live only in
  [Local testing](../operations/local-testing.md#reusable-rooms-remote-test-account).
  Do not copy that state into this guide.

## How the docs are organised

| Location | What lives there |
|---|---|
| `AGENTS.md` (root) | Standing instructions and trigger-based documentation router. `CLAUDE.md` is a symlink to it |
| `docs/README.md` | Complete current-document index and authority map |
| `docs/architecture/` | Current subsystem behavior, boundaries, invariants, and rationale |
| `docs/operations/` | Verified setup, deployment, testing, and incident procedures |
| `docs/reference/` | Current authoring and protocol conventions |
| `docs/agents/*.md` | Reference docs for coding agents: this file, the game primer, the subagent guide |
| `docs/roadmap/` | Remaining work; `README.md` is the status index, `10-bug-fixes.md` is open, and `10b-bugs-fixed.md` stays here as the fixed-bug ledger because code cites its path |
| `docs/superpowers/plans`, `docs/superpowers/specs` | Plans and specs produced during agent-driven work — working documents, not the source of truth |
| `docs/archive/` | Retired subsystems and shipped plans worth remembering; `archive/roadmap/` holds completed roadmap plans |

If you build a subsystem future work will need context on, add a current doc in the right
category and link it from `docs/README.md` and the router in `AGENTS.md` — undiscoverable
docs get rewritten from scratch by the next agent.

When a roadmap plan ships, update its status and the roadmap index in the same PR, carry each
actionable leftover into `docs/roadmap/22-small-leftovers.md`, then move the plan under
`docs/archive/roadmap/`. Fixed bugs move from `10-bug-fixes.md` to `10b-bugs-fixed.md` with
their root cause; do not move the ledger itself.

## The house voice

Player-facing strings are written in a consistent voice, and it carries meaning. The ring
arrival lines are a deliberate minimal pair: a player's monster **answers the call of** its
beastmaster (it came willingly; the beastmaster is a companion, not an owner), while a boss
**enters the ring at the behest of** `👑 The Editor`, the house that commands
(`packages/engine/src/announcements/contestant.ts`, `constants/lore.ts`). Departures pair
with the same verbs. Keep new strings consistent with this: no invented owners for bosses,
no possessive framing for players' monsters, singular *they* rather than *it* for creatures
(#149).

[`docs/reference/voice-and-wording.md`](../reference/voice-and-wording.md) is the complete lexicon and
player-facing wording contract. The announcement modules and their comments remain the
reference for the consent distinction it records.
