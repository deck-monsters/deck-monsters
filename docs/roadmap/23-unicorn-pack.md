---
type: Roadmap
title: Unicorn Content Pack Pass
description: Task table, decisions, and evidence for implementing the Unicorn monster and its five cards.
status: draft
audience: internal
tags: [content, cards, monsters, unicorn]
---
# Unicorn Content Pack Pass

**Status:** In progress. The design brief is the Unicorn section of
[12 — New content](12-new-content-backlog.md#unicorn-content-pack); this file tracks the
implementation pass against it. Fold the decisions into the owning area docs and move this
file to `docs/archive/roadmap/` when the pass closes.

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 1 | Source and mechanic spike (decision note below) | Done | this file |
| 2 | Monster shell: `Unicorn` type, Cleric class, appearance variants, registry, spawn prompt, names, web sprite, harness roster | Done | _pending_ |
| 3 | `Sticketh` vertical slice with self-stick via the immobilize machinery | Planned | |
| 4 | Support cards: Horn of Proof, Unconquerable Horn, Dissonant Voice, Gloaming Rest | Planned | |
| 5 | Distribution and generated references (`pnpm run build:docs`) | Planned | |
| 6 | Balance pass (`sim:winrates` plus the thematic fixture) | Planned | |
| 7 | Live copy and pacing check | Planned | |

## Decisions from the spike

- **Class.** Cleric, as the brief proposes. The Cleric pool adds Iocane, Revive, Lucky
  Strike, Brain Drain, Rehit, Blast, Cloak of Invisibility, Enchanted Faceswap, and Feline
  Companion. None of those combine with the Unicorn cards into unconditional immunity or
  unavoidable burst, so no new class was added. `Horn Gore` stays Minotaur-only.
- **Stats.** DEX +2, STR +1, INT −1 (the same +2 budget as every monster), `acVariance` 2
  (ties the best existing spawn offset rather than exceeding it), `hpVariance` 1 (one below
  the roster midpoint of 2).
- **Roster order.** `Unicorn` is appended after `WeepingAngel` in `allMonsters`. The spawn
  prompt answers with an index into that array, so inserting alphabetically would have
  shifted the Weeping Angel's index for tests and saved harness configs.
- **Description.** At most three variant clauses: build with coat, horn, and one "witness"
  detail (eyes, retreat, or voice). All six fields are still generated and persisted.
- **Control boundary.** Every current control effect (Immobilize, Horn Gore, Coil,
  Constrict, Entrance, Enthrall, Mesmerize, Forked Stick, Forked Metal Rod) applies through
  `ImmobilizeCard.immobilize()`, which is the shared predicate the Unconquerable Horn ward
  hooks. Sandstorm's confusion is not control for v1 and is not cancelled.
- **Cleanse list.** Horn of Proof names exactly what it removes, in priority order: an
  immobilize hold on the target, the target's harshest negative encounter stat penalty
  (Soften and similar curses), then a Bad Batch poison waiting in the ring. It removes one.
- **State.** Every new state lives on `creature.encounter` (modifiers or effects), which
  `endEncounter()` deletes, so nothing survives fight end, flee, death, or cancellation,
  and nothing is serialized. No new `game.on(...)` listener or timer is added.
- **Citation gap.** The supplied anthology's title, editor, edition, and pages were not
  available in this environment. Card and monster source comments cite the primary texts
  (Ctesias, Pliny, Aelian, Topsell, Spenser), which are public domain. Recording the
  anthology citation from the physical book remains open for the owner.
