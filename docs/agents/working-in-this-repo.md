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
5. **The architecture doc for the area** updated if behaviour changed (see the Architecture
   Docs table in `AGENTS.md`). A behaviour change not reflected in its doc is half-finished.

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

Approximate suite sizes, so you can tell a truncated run from a complete one (measured on
this branch): engine ~832 mocha tests, server ~198, connector-discord ~85, harness 4,
web ~321 vitest. All of them mock their external dependencies — no database, Discord, or
Supabase needs to be running.

## Live verification

Automated tests do not catch pacing, scroll, or narration problems; most of the bugs in the
archive were found by playing. [`docs/local-testing-guidelines.md`](../local-testing-guidelines.md)
has the setup, and `AGENTS.md` has the two env paths (remote Supabase vs. local Docker
stack). Specifics worth knowing before you start:

- **Stage a fight in a few commands** — the guide's "Staging a fight quickly" section. Use
  the one-shot equip form, `equip <monster> with "Hit", "Hit", "Heal", …` (exact card names,
  double-quoted, comma-separated); the interactive `equip` flow is a multi-prompt loop that
  strands browser-driving agents. Then `send <monster> to the ring` plus `summon a boss` for
  a second contestant, and the 60s countdown starts.
- **Scope Playwright selectors to `.terminal-pane.active`.** Hidden panes have identical DOM
  (`apps/web/src/components/ConsolePane.tsx` sets `terminal-pane active` on the live one), so
  an unscoped selector silently drives the pane nobody is looking at.
- **Prove what the engine emitted** by reading Postgres directly rather than inferring from
  the UI: `select type, text, created_at from room_events where room_id = '<uuid>' order by
  id` (`packages/server/src/db/schema.ts`). The difference between "the engine never emitted
  it" and "the UI dropped it" is most of the diagnosis in any feed bug.
- **Reuse the scratch rooms; do not leave new ones behind.** The remote test account owns
  two long-lived rooms (ids, invite codes, and what lives in them are in the local-testing
  doc's "Reusable rooms" section — keep that section current when you change them):
  `Test Room A` for anything that needs an existing character with trained monsters, and
  `Test Room B`, kept **without** a character for the test account so first-run flows
  (character creation from the console or workshop) can be exercised. If you need a room
  you are going to trash — flood it with bosses, test deletion, break its state — create a
  throwaway named `Scratch <purpose> <date>` and **delete it before you finish** (owner-only
  `room.delete`; the local-testing doc has a one-liner). A room the test account merely
  belongs to (`Game Night` at the time of writing) is somebody's real room: never spawn,
  fight, or rename anything in it.

## How the docs are organised

| Location | What lives there |
|---|---|
| `AGENTS.md` (root) | Standing instructions, architecture doc index, commands, env, cloud setup. `CLAUDE.md` is a symlink to it |
| `docs/*.md` | Architecture docs — one per subsystem, each written after something non-obvious bit us |
| `docs/agents/*.md` | Reference docs for coding agents: this file, the game primer, the subagent guide |
| `docs/roadmap/` | Planned and completed work, `README.md` is the status index; `10-bug-fixes.md` open, `10b-bugs-fixed.md` archive |
| `docs/superpowers/plans`, `docs/superpowers/specs` | Plans and specs produced during agent-driven work — working documents, not the source of truth |
| `docs/archive/` | Subsystems removed from the live game but worth remembering (the exploration system) |

If you build a subsystem future work will need context on, add a doc under `docs/` and link
it from the Architecture Docs table in `AGENTS.md` — undiscoverable docs get rewritten from
scratch by the next agent.

## The house voice

Player-facing strings are written in a consistent voice, and it carries meaning. The ring
arrival lines are a deliberate minimal pair: a player's monster **answers the call of** its
beastmaster (it came willingly; the beastmaster is a companion, not an owner), while a boss
**enters the ring at the behest of** `👑 The Editor`, the house that commands
(`packages/engine/src/announcements/contestant.ts`, `constants/lore.ts`). Departures pair
with the same verbs. Keep new strings consistent with this: no invented owners for bosses,
no possessive framing for players' monsters, singular *they* rather than *it* for creatures
(#149).

A dedicated `docs/voice-and-wording.md` is forthcoming; until it exists, the announcement
modules and their comments are the reference.
