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
| 2 | Monster shell: `Unicorn` type, Cleric class, appearance variants, registry, spawn prompt, names, web sprite, harness roster | Done | 73e04d1 |
| 3 | `Sticketh` vertical slice with self-stick via the immobilize machinery | Done | ce3b048 |
| 4 | Support cards: Horn of Proof, Unconquerable Horn, Dissonant Voice, Gloaming Rest | Done | 862762b |
| 5 | Distribution and generated references (`pnpm run build:docs`) | Done | 16ae4c2 |
| 6 | Balance pass (`sim:winrates` plus the new `sim:unicorn`) | Done; exceptions need owner approval | 71c3d9d, c72b2e0 |
| 7 | Live copy and pacing check (feed level; browser check open) | Done | 6e0d53f |

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
- **Sticketh.** Extends `ImmobilizeCard` only to reuse `ImmobilizeEffect`, freedom rolls,
  fatigue, and cleanup. Charge: 1d20 + DEX + 1 vs AC for 1d10 + STR. A natural 1 on the
  charge is a miss (no fling-back self-damage). After any miss the Unicorn makes a
  1d20 + STR save against the target's DEX (a nimbler foe sells the feint better); on a
  failure they hold themself with freedom 1d20 + STR vs their own STR − 3 per turn stuck.
  The self-hold bypasses `immobilize()`, so Unconquerable Horn never cancels it. Two
  `ImmobilizeCard` hooks, `emitHeldEffect` and `getFreedomCommentary`, let it narrate
  "horn stuck in the timber" instead of "X is stuck by X"; the default text is unchanged.
  It is seeded in the starting deck beside the other monster signatures, rare in drops,
  and back-room only in the shop.
- **Unconquerable Horn.** Unicorn-only, uncommon, level 1. Arms
  `encounterModifiers.unconquerableWard` (`cards/helpers/control-ward.ts`). The next
  successful hold an opponent lands through `immobilize()` is cancelled and the ward is
  spent; attached damage (Coil, Forked Stick) still lands. It does not re-arm in the same
  fight and does not stack.
- **Horn of Proof.** Unicorn or Cleric, rare, level 2. Removes the first of: a hold, the
  harshest negative encounter stat, or a ring Bad Batch; then heals a fixed 3 (below Heal's
  1d4 + INT, which also scales with level). Self-targeted like Heal; ally targeting waits
  for a team-heal targeting rule, which no card has today. A held monster's own card never
  plays, so the hold case only applies when confusion turns the card on someone else; the
  stats text says that instead of promising a self-cleanse.
- **Dissonant Voice.** Unicorn or Bard, uncommon, level 1. Each opponent (team-aware via
  `getTarget`) rolls 1d20 + INT vs the singer's INT; a failure takes 2 off that monster's
  next attack roll. The penalty is spent on the next card either way, never stacks, and
  deals no damage. Saves resolve serially with a sub-event beat each.
- **Gloaming Rest.** Unicorn or Cleric, rare, level 3. −2 AC until the Unicorn's next card;
  if no hit with damage is logged after the rest began (same `hitLogTimestamp` clock as
  Delayed Hit), heal 3d4 as that card begins. The AC give-back is clamped to what is still
  missing so a spent brace never turns into free AC.
- **Distribution.** Sticketh: rare drop, seeded in the starting deck, back-room only.
  Unconquerable Horn (uncommon), Dissonant Voice (uncommon), Horn of Proof (rare), and
  Gloaming Rest (rare) are ordinary drops and sold in the front shop. The four support
  cards sit alphabetically in `cards/helpers/all.ts`, which is also the order of the
  generated card lists.
- **Citation.** The anthology is *A Book of Unicorns* (Star & Elephant Book, The Green
  Tiger Press, La Jolla, California), from the owner's cover photographs. Still open: the
  compiler, year, and edition from the copyright page. Card and monster source comments cite
  the primary texts (Ctesias, Pliny, Aelian, Solinus, Topsell, Spenser), which are public
  domain; the only anthology-only source used is Edwin Julian's poem behind Gloaming Rest,
  whose card copy is original.

## Balance evidence (slice 6)

`sim:winrates` (level 5, 200 fights per pair) and `sim:unicorn` (100 fights per row, levels
1/5/10/15/20, random legal decks and the thematic fixture, plus a mirror and a 2v2 team
fight). Numbers below are the Unicorn's share of **decisive** fights; the fixture carries
Flee and three heals, so 20–60% of its fights end without a winner.

| Opponent | Fixture L1 | L5 | L10 | L15 | L20 | Random deck L5 |
|---|---|---|---|---|---|---|
| Basilisk | 75 | 52 | 41 | 31 | 25 | 99 |
| Gladiator | 85 | 64 | 75 | 57 | 49 | 97 |
| Jinn | 100 | 85 | 78 | 79 | 64 | 96 |
| Minotaur | 76 | 63 | 52 | 48 | 31 | 92 |
| Weeping Angel | 27 | 9 | 0 | 0 | 0 | 64 |

Card rates (fixture, all rows): Sticketh hits 68% and sticks the Unicorn on 15% of plays
(47% of misses); the Unconquerable Horn ward triggers in 23% of fights where it is armed
(55% in the team fight); Horn of Proof finds something to cleanse 38% of the time;
Dissonant Voice rattles 19% of saves; Gloaming Rest completes 77% of the time for an
average 7.5 hp and is interrupted 20% of the time. Mirror (fixture vs fixture): 84% draws,
because both decks run in step, so each rest resolves before the other side attacks and
both play Flee on the same turn. Team fight (Unicorn + Gladiator vs Minotaur + Basilisk):
member win rates 31 / 26 / 30 / 33%, 4% draws.

### Exceptions for owner approval

The brief's gate is 35–65% against every monster with the fixture deck. The owner has since
said the target is a class power curve across levels, not 50/50 everywhere (see
[11 — Balance](11-balance-and-mechanics.md#combat-design)); read these rows against that.
They miss the band, and none is caused by the Unicorn cards themselves:

1. **Weeping Angel (0–27%) and every random-deck row (89–100% against non-Clerics).**
   Pre-existing: Blast is Cleric-only, `ABUNDANT`, never misses, and hits every opponent for
   3 + caster level. On `main` the Weeping Angel already wins 94–98.5% against the other
   four at levels 1 and 5. The Unicorn's random decks inherit the same pool, so they look
   like the Angel's (and edge it, 56–68%). Tracked in
   [11 — Balance](11-balance-and-mechanics.md#combat-design). Fixing Blast fixes both; the
   alternative is moving the Unicorn off Cleric.
2. **Jinn (64–100%).** Pre-existing: the Jinn wins only 27–46% against the rest of the
   roster in `sim:winrates` on `main`.
3. **Level drift (Basilisk and Minotaur fall to 25–31% at levels 15–20; 75–85% at level 1).**
   The fixture is assigned directly, so at level 1 it skips the level gate (Horn of Proof is
   level 2, Gloaming Rest level 3). At high levels it has three damage cards and nothing
   that scales with level, while the opponents' random decks do. For a Cleric, being strong
   early and fading late is the wrong curve. Revisit it after the Blast fix, since the
   random-deck Unicorn gets its high-level strength from Blast.

## Live copy and pacing check (slice 7)

Seeded single fights through `simulate()` with the public feed captured (ordinary, mirror,
control-heavy Basilisk with Coil and Constrict, poison-heavy Jinn with Bad Batch, and a
four-monster crowd). Checked the order of turn banner, card box, rolls, narration, and
state lines; pronoun agreement for he, she, and they; and that 🦄 🏺 💎 🔔 🌙 render as
single-width emoji in the card boxes. Two fixes came out of it:

- "Sim 1 kneel among the laurel and close their eyes": Gloaming Rest ran `agree()` on a
  sentence whose subject is the monster's name, which is always singular. Fixed, with a
  regression test.
- Horn of Proof's stats promised to free a hold on the player, which cannot happen on their
  own turn. The text now says what it does.

Also observed, working as designed: a Unicorn stuck by Sticketh counts as already held, so
an opponent's Coil or Constrict turns into a plain hit ("shows no mercy") and does not spend
the Unconquerable Horn ward. That free hit is the "opening" the card narrates.

An independent read-only review of the whole diff found no blockers. Its two nits, that the
single-line branches of Unconquerable Horn and Gloaming Rest take no sub-event beat, match
the other one-line self-buffs (Boost, Thick Skin, Battle Focus, Basic Shield), which rely on
the ring's card-to-card gap. They were left as they are.

Still open before this pass is archived: a browser check of the workshop and ring with a
real Unicorn (sprite, roster portrait, card text wrapping), and owner approval of the
matchup exceptions above.
