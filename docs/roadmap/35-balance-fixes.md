---
type: Roadmap
title: Balance Fixes — First Pass on Measured Evidence
description: Plan for the first balance changes made from roadmap 34's measurements, covering the Dragon, the Gladiator, and making the unique cards that sit unused usable, with guardrails for the band, excitement, and hope.
status: draft
audience: internal
tags: [roadmap, balance, cards, monsters]
---
# 35 — Balance Fixes: First Pass on Measured Evidence

**Status:** In progress (2026-09-28): PR C on branch `claude/balance-fixes-c`. Started after the measurement PR from
[34](34-balance-methodology.md) (tasks 6, 6b, 7, and the lean task 9) merges. Two PRs, each
within the budget rule in `AGENTS.md`.

## Why this pass, and what it rests on

Roadmap 34 measured before tuning. Its reports are in
[balance reports](../reference/balance-reports/README.md):

- the [catalogue](../reference/balance-reports/2026-09-28-catalogue.md), with its
  [contexts](../reference/balance-reports/2026-09-28-contexts.md);
- [chassis, collections, and holders](../reference/balance-reports/2026-09-28-layer3.md);
- the [best-hand search](../reference/balance-reports/2026-09-28-search.md).

They agree on this:

- **The Dragon is low at every primary level** with searched hands: 23%, 34%, and 33% at
  levels 1, 3, and 5.
  - Its body is 1-2.5 Hits below the reference.
  - Its epic, Tsunami, is worth about nothing in every context.
  - At level 1 the search swapped both Fire Breaths for Delayed Hits.
- **The Gladiator is low at every primary level:** 37%, 37%, and 32%. Its body is 0.5-1.2
  Hits below the reference at every level, against the owner's goal of brutes being strong
  early.
- **The Weeping Angel is the strongest** (65-72%), with two matchups over 85%. It is watched
  here, not trimmed: its field average is in band, and the confirmation run decides.
- **Some unique cards are weak in every context**, so players ignore them. That runs against
  the owner's aim below.

## The owner's direction (2026-09-28)

- **Unique cards should be usable.** "I want these fun cards that are unique and interesting
  to be actually usable, useful, and not just ignored." A card may stay situational, but a
  player who builds around it should find it worth its slot.
- **The Unicorn's cards: definitely tweak.** Unconquerable Horn, Dissonant Voice, and
  Gloaming Rest (and Horn of Proof, which is weak outside crowds).
- **Tsunami: tweak slightly.** It needs only a small boost and must not become overpowered.
- **Mesmerize and Enthrall: optional.** They are probably fine, since the Weeping Angel has
  many good cards, but simple fixes would be welcome.
- **Harden: fine if a bit weak.** Leave it unless a fix is trivial.
- **Prion Disease is a joke card. No change.**
- **Standing rules from 34 apply:**
  - the band (35-75% field average; single matchups 20-80%, none over 85%);
  - levels 0-7 first;
  - the smallest change;
  - hope and excitement kept (the "please get a Loki" moments);
  - counter cards preferred to nerfing the big swing cards;
  - weak cards allowed unless a monster has no competitive picks.

## Targets for a card fix

A tweaked unique card should, at levels 1-7:

- be worth **at least 0.8 Hit-equivalents in its best context** (the
  [context](../reference/balance-reports/2026-09-28-contexts.md) measure), so it earns a slot
  in the hand it is built for;
- stay **at most its class median times the rarity premium** (1.5× for epic and very rare,
  1.25× for rare), so it does not become the new default;
- **keep its identity:**
  - same role, same fantasy, one readable line of card text, voice per
    [voice and wording](../reference/voice-and-wording.md);
  - **read like a roll where it can**, rather than a flat number (the Sandstorm-roll
    principle);
- **leave its monster in band:** a card fix must not push its monster's field average above
  75% or any matchup over 85%.

## Candidate changes (to measure, not decisions)

Each change is tried as one or two variants. The smallest variant that meets the targets
wins, measured before and after on the same seeds.

| Card or monster | What is wrong (measured) | Candidates |
|---|---|---|
| **Dragon body** | 1-2.5 Hits below the reference at every level | A small HP or AC variance raise, or a stat offset. Find what the other bodies have that the Dragon lacks before choosing |
| **Fire Breath at level 1** | The search preferred a Delayed Hit on the real Dragon at level 1 | Diagnose first: the dodge difficulty at low INT, the winded give-back, and base damage at level 1. Fix only what the diagnosis shows, and keep the dodge roll (it is the card's excitement) |
| **Tsunami** (owner: slight) | About 0 everywhere. 5 damage to everyone, the Dragon included, so a duel is a wash | Let the Dragon ride its own wave: a DEX roll to take half or none. Or the wave sparing allies. Keep the damage and the self-risk; ceiling at the area class median |
| **Gladiator body** | 0.5-1.2 Hits below the reference; low at every primary level | A small early boost that fades by level 7 (brutes strong early, per the owner), or a flat offset if it is low late too |
| **Unconquerable Horn** (owner's redesign, 2026-09-28) | About 0.2; it wards only against holds, which Hit and field opponents rarely play | **A one-shot counterspell** (owner): until the end of the round, or until it fires, it stops the next negative action aimed at you **that is not damage**. Damage still lands; everything else is warded. See the ward's scope below |
| **Dissonant Voice** | About 0.2: −2 to one attack roll for each opponent who fails an INT save | A larger penalty (−4), or the penalty lasting until the end of the opponent's next card, or a small sting (1d4) on a failed save |
| **Gloaming Rest** | About 0-0.4: any damage before your next card cancels the whole heal, and in a duel damage almost always comes | Damage reduces the heal instead of cancelling it; or a smaller heal that always lands, plus the full rest if undisturbed |
| **Horn of Proof** | 0.3-0.6 in duels (fine in a crowd) | Measure after the others; tweak only if the Unicorn still lacks a usable heal |
| **Mesmerize, Enthrall** (optional) | About 0.2 in every context; self-mesmerize and the type rules often waste them | Only a simple fix, e.g. less self-mesmerize. It must not raise the Weeping Angel's field average |
| **Harden** (optional) | 0.4 | Leave unless trivial |

### Unconquerable Horn as a counterspell (owner, 2026-09-28)

The owner's direction: "like a counterspell that lasts for one round or until some sort of
negative action that is not a damage action is attempted. So a hit or a blast lands but a
blink may not, or a coil may not, or a soften may not." Once used it is gone, and it does not
block everything.

**What the ward stops.** The next negative, non-damage effect an opponent aims at the Unicorn:
- **holds:** Coil, Constrict, Entrance, Enthrall, Mesmerize, and immobilize generally;
- **stat curses:** the curse part of Soften, Molasses, Concussion, and Brain Drain;
- **poison and tampering:** Bad Batch's spoiled drink;
- **removal:** Blink's time-shift;
- **confusion:** Sandstorm's and Enchanted Faceswap's target redraw.

**What still lands:** damage. A Hit, a Blast, Fire Breath, and the damage part of a
curse-strike still land. Only the curse, hold, or redirect that comes with them is warded.

**What it does not touch:** Curse of Loki. That is the attacker's own natural 1 turning back
on them. It is a roll outcome, not an action aimed at the Unicorn, and it is a "please get a
Loki" hope moment worth keeping (34, Hope). If the owner meant something else by "loki", the
scope is easy to extend.

**Duration and count.**
- It lasts until the end of the round, or until it fires, whichever comes first. One block,
  then it is spent.
- It keeps the current rule: no second ward in the same fight.
- A second block at high levels is **not planned**. The owner expects one block to scale
  naturally, since what it blocks grows stronger with level. Measure the single block at
  levels 7-12 before adding one.

**The engine work.** Today the ward hooks only `immobilize()`. The counterspell needs one
generic check before any negative non-damage effect lands on a target, for example
`target.consumeWard(effect)`. That means a shared tag or hook on the curse, poison, removal,
and redirect paths. Each warded effect gets a narration line in the Unicorn's voice, from the
[strings inventory](../reference/strings/unicorn.md).

**Why it matters beyond the Unicorn.** It is the first card of the counter family in
[12](12-new-content-backlog.md#cards): it answers Sandstorm, Faceswap, and Blink by
bending them, not by nerfing them. Measure it the way counters are judged (34's rule 5):
against opponents who play those cards, in the holds context (task 1) and against the
searched field.

The candidates come from reading each card's code (2026-09-28). Numbers are starting points
for the measurement.

## Guardrails every change is checked against

- **The band, on searched hands:** the lean search's matrix at levels 1, 3, and 5, before
  and after, on the same validation seeds. Level 7 is added for the final check.
- **The card's own value:** the context catalogue for the changed card, before and after.
- **Excitement and hope** (34, Layer 6): fight length, comebacks, and turnarounds from below
  20% win chance, and the rate and size of Curse of Loki, natural 20s, and strokes of luck.
  Per the working targets in 34, no drop over 20% without the owner's agreement.
- **Bosses:** `sim:bosses` and the mega boss stay at their own targets. The changes here must
  not make bosses easier or harder beyond noise.

## Harness prerequisites (task 1 of PR C)

The lean search had two limits (see the
[search report](../reference/balance-reports/2026-09-28-search.md)). Fix them before measuring
changes:

1. **Heals do not stack.** The collection model's typical hand caps heals (Heal, Whiskey
   Shot, Scotch) at 2 instead of adding values one card at a time.
2. **Search power.** Add a `--confirm-fights` setting and a before/after mode. That mode
   replays two fixed sets of hands, current and changed, on the same validation seeds, with
   enough fights to see 3-5 points. The owner's machine runs the heavy confirmation.
3. **A holds context** for the catalogue (an opponent whose hand is holds: Coil, Constrict,
   Entrance, Horn Gore), so counters to holds such as Unconquerable Horn are judged where
   their target is played.
4. **Minimal excitement and hope metrics** (34's task 8a, reduced): per fight, rounds,
   comebacks, rare-event counts (Loki, natural 20, stroke of luck), and turnarounds by a
   simple HP-lead proxy. The calibrated win-probability model stays in 34.

## Tasks

| # | PR | Task | Acceptance | Status | Commit |
|---|---|---|---|---|---|
| 1 | C | Harness prerequisites (above) | Tests; the heal cap shows in the collection JSON; before/after mode reproduces a known result | Done: the heal cap and context-ranked typical hands landed in #409 (Codex review); excitement tally in `simulate()` and the runner; a holds context; `plan:matrix` and `sim:matrix-report` for before/after on fixed hands and seeds, with the guardrails | this commit |
| 2 | C | Dragon: diagnose Fire Breath at level 1; choose the smallest body or card change; Tsunami's slight tweak | The Dragon in band at levels 1, 3, 5 on searched hands; Tsunami 0.8+ in its best context and at most the area median; no Dragon matchup under 20%; guardrails hold | Planned | |
| 3 | C | Gladiator: early body change | The Gladiator in band at levels 1, 3, 5; brutes stronger early than late; guardrails hold | Planned | |
| 4 | C | Confirmation run on the owner's machine, docs (card architecture doc, generated references via `build:docs`, bugs and roadmap tables) | Before/after report checked in | Planned | |
| 5 | D | Unicorn cards: Unconquerable Horn, Dissonant Voice, Gloaming Rest (Horn of Proof if still needed) | Each 0.8+ in its best context and within the class ceiling; the Unicorn stays in band; the card text is readable and in voice | Planned | |
| 6 | D | Optional simple fixes: Mesmerize, Enthrall, Harden | Only if a one-line change meets the targets without raising the Weeping Angel | Planned | |
| 7 | D | Confirmation run and close-out: fold decisions into [cards and encounter effects](../architecture/cards-and-encounter-effects.md) and the balance method doc; archive this plan | Checked-in report; plan archived | Planned | |

Later, not in this pass: the counter cards to the big swing effects
([12](12-new-content-backlog.md#cards)), the roll for initiative, the Sandstorm roll, rarity
copy limits, and a trim for the Weeping Angel if the confirmation run shows one is needed.
All are in [34's candidate list](34-balance-methodology.md#candidate-changes-to-evaluate-in-the-next-pass-not-this-one).

## Process

- One commit per task, with this table updated in the same commit (AGENTS.md rules 5 and 6).
- **Every card or monster change is measured before and after on the same seeds,** and the
  numbers go into the task's report. No change lands on intuition.
- **Player-facing text changes** follow [voice and wording](../reference/voice-and-wording.md),
  and the generated `CARDS.md` and `MONSTERS.md` are rebuilt, never hand-edited.
- The owner runs the heavy confirmation runs; the agent session runs quick checks.
