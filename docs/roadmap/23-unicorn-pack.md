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
| 6 | Balance pass (`sim:winrates` plus the new `sim:unicorn`) | Done (rerun after harness fix #183) | 71c3d9d, c72b2e0, 9d31af0 |
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
  spent; attached damage (Coil, Forked Stick) still lands. A teammate's area hold
  (Mesmerize catches allies) does not spend it; allegiance uses the ring's team precedence,
  and a free-for-all ring event makes everyone an opponent. It does not re-arm in the same
  fight and does not stack.
- **Horn of Proof.** Unicorn or Cleric, rare, level 2. Removes the first of: a hold, the
  harshest negative encounter stat (not counting a Gloaming Rest's own temporary −2 AC,
  which the rest gives back itself), or one queued ring Bad Batch (others stay queued); then heals a fixed 3 (below Heal's
  1d4 + INT, which also scales with level). Self-targeted like Heal; ally targeting waits
  for a team-heal targeting rule, which no card has today. A held monster's own card never
  plays, so the hold case only applies when confusion turns the card on someone else; the
  stats text says that instead of promising a self-cleanse.
- **Dissonant Voice.** Unicorn or Bard, uncommon, level 1. Each opponent (team-aware via
  `getTarget`) rolls 1d20 + INT vs the singer's INT; a failure takes 2 off that monster's
  next attack roll. The penalty is spent on the next card either way, never stacks, and
  deals no damage. Saves resolve serially with a sub-event beat each.
- **Gloaming Rest.** Unicorn or Cleric, rare, level 3. −2 AC until the Unicorn's next card;
  if no hit that took HP is logged after the rest began (same `hitLogTimestamp` clock as
  Delayed Hit; hit-log entries now record `dealt`, so a blow the brace absorbs in full does
  not break the rest), heal 3d4 as that card begins. The full −2 is given back: a brace
  raised during the rest was only reduced by the penalty, so whatever the hits did not
  spend returns whole. (A first version clamped the give-back and lost the 2 AC for the
  rest of the fight whenever a brace was already up.)
- **Distribution.** Sticketh: rare drop, seeded in the starting deck, back-room only.
  Unconquerable Horn (uncommon), Dissonant Voice (uncommon), Horn of Proof (rare), and
  Gloaming Rest (rare) are ordinary drops and sold in the front shop. The four support
  cards sit alphabetically in `cards/helpers/all.ts`, which is also the order of the
  generated card lists.
- **Citation.** The anthology is *A Book of Unicorns* (Star & Elephant Book, The Green
  Tiger Press, La Jolla, California; introduction by Welleran Poltarnees). The owner's copy
  has no copyright page; its newest dated artwork is from 1976. A final content pass checked
  every source comment and the lore against the photographed pages and corrected four
  things: stag's head, elephant's feet, and boar's tail are Pliny's (ancient), not "later
  bestiaries"; the cloven hooves, black eyes, long straight horn, and lonely wilderness are
  Dapper's (1673), not Marco Polo's; Ctesias says a horn cup makes the drinker immune to
  poison, not that it betrays poison; and Edwin Julian's poem is comic verse illustrated by
  Reginald Birch, which the first comment called "modern". The Topsell, Spenser, and Brothers
  Grimm page confirms Sticketh's sources word for word; the Grimm tailor's tree feint is now
  cited too. Card and monster copy remains original prose.

## Balance evidence (slice 6)

The first run of this section measured harness bugs: alphabetical card draws stacked
Cleric decks with Blast (fixed-bug #183), team fights used a team-blind boss strategy, and
the card counters included other monsters' plays. These numbers are from the rerun after
those fixes, with Flee kept out of harness decks: `sim:winrates` at level 5 (200 fights per
pair) and `sim:unicorn` (100 fights per row). Values are the Unicorn's share of decisive
fights; draws are now 0–10%.

| Opponent | Random deck L1 | L5 | L10 | L15 | L20 | Test deck L1 | L5 | L10 | L15 | L20 |
|---|---|---|---|---|---|---|---|---|---|---|
| Basilisk | 59 | 62 | 80 | 71 | 87 | 42 | 44 | 40 | 38 | 33 |
| Gladiator | 68 | 70 | 78 | 94 | 89 | 53 | 53 | 44 | 45 | 30 |
| Jinn | 81 | 62 | 67 | 67 | 70 | 63 | 43 | 35 | 29 | 28 |
| Minotaur | 58 | 52 | 76 | 85 | 77 | 45 | 54 | 40 | 42 | 39 |
| Weeping Angel | 65 | 72 | 70 | 60 | 58 | 59 | 42 | 38 | 20 | 9 |

In the level 5 `sim:winrates` matrix every pair lands in 39.5–65.5%; the Unicorn wins
51.5–64% as the first contestant and its opponents 39.5–47.5% against it.

Card rates (test deck, Unicorn plays only): Sticketh hits 74% and sticks the Unicorn on 11%
of plays; the Unconquerable Horn ward triggers in 44% of fights where it is armed (65% in
the team fight); Horn of Proof finds something to cleanse 39% of the time; Dissonant Voice
rattles 16% of saves; Gloaming Rest completes 61% of the time for an average 7.5 hp and is
interrupted 36% of the time. Mirror match: 55 / 45%, no draws; both test decks run in
step, so each rest resolves before the other side attacks. Team fight (Unicorn + Gladiator
vs Minotaur + Basilisk, team-aware targeting): member win rates 36 / 54 / 12 / 42%, 3% draws.

### Findings

The balance target is a class power curve across levels, not 50/50 everywhere (see
[11 — Balance](11-balance-and-mechanics.md#combat-design)), so none of these blocks merge:

1. **The random-deck Unicorn is on the strong side, and its curve rises with level** (about
   52–81% at levels 1–5, 58–94% at 15–20). The rising curve is right for a Cleric; the early
   strength is a little high. Watch it in real play. If it proves too strong early, the first
   levers are Sticketh's +1 to hit or `hpVariance` 1 → 0.
2. **The 9-card test deck is even early and fades late** (42–63% at levels 1–5, 9–45% at
   15–20). Six of its nine cards are utility with no level scaling, so this is the deck, not
   the monster. It is a design demonstration, not a starter deck, so no change.

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
real Unicorn (sprite, roster portrait, card text wrapping).
