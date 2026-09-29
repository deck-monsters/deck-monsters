---
type: Roadmap
title: Pins, the Dragon against Blast, and the hold cards
description: Plan for the balance pass carried from roadmap 35, covering advantage against pinned monsters, the level 7 Dragon folding to Blast, Mesmerize and Enthrall, and a per-fight split in the harness.
status: draft
audience: internal
tags: [roadmap, balance, cards, harness]
---
# 36 — Pins, the Dragon against Blast, and the hold cards

**Status:** In progress (2026-09-29) on branch `claude/unicorn-monster-cards-cigpmw`. This
pass takes over the work that
[11's next balance pass](11-balance-and-mechanics.md#next-balance-pass-carried-from-roadmap-35)
carried from [35](../archive/roadmap/35-balance-fixes.md).

It keeps 35's method: variants behind class settings, searched hands, duels, crowds and team
battles, and the per-fight split for all-or-nothing effects. The worked examples are the
[Gloaming Rest](../archive/studies/2026-09-gloaming-rest.md) and
[Helm of Awe and Dissonant Voice](../archive/studies/2026-09-helm-of-awe-and-dissonant-voice.md)
studies. The standing rules are in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).

## The owner's direction (2026-09-29)

- **The pin rule goes first.** It changes what every hold is worth, so the hold cards come
  after it.
- **Blast stays essentially as it is.** A change or cap at higher levels is acceptable. If the
  finding holds up, the preferred fix is something Dragons can do to balance it, such as a
  resistance.
- **Proceed with the carried work now.**

## Tasks

| # | Task | Acceptance | Status | Commit |
|---|---|---|---|---|
| 1 | **Pinned monsters are easier to hit.** Every attack roll against a pinned monster has advantage, as against a restrained creature in D&D. Pinned means held by any `ImmobilizeEffect`, or awed by Helm of Awe. One shared roll-mode helper makes advantage and disadvantage cancel, and Dissonant Voice moves onto it. | Tests; a whole-field before and after on the same searched hands and seeds shows the band and guardrails hold; the owner's run confirms | Built (a8bdc97c). A local before and after on PR D's searched hands (400 fights a pair, levels 1–7): no field average moved more than 2.8 points (the Basilisk most, +2.8 at level 3 and +2.4 at level 5, since Coil now sets up easier hits); every field average is in band; the guardrails moved ±2%. The owner's run confirms | a8bdc97c |
| 2 | **The level 7 Dragon against Blast.** Validate the finding (3% against the Unicorn), then find its cause in the Dragon's body or hand before changing anything. If it holds, measure Dragon-side fixes first (a resistance), then a Blast cap at high levels | The matchup under the 85% cap, the Dragon's field average in band, no other monster moved out of band | Done: **Take Wing now also dodges the first area attack**, a tsunami included. At level 7 the Dragon went from 37% to 49% field average and from 2% to 37% against the Unicorn; levels 1–5 did not move. Blast is unchanged. The owner's run confirms | this commit |
| 3 | **Mesmerize and Enthrall**, after task 1 changes what holds are worth. Candidate first fix: Mesmerize catches its caster only on a natural 1 | Each at least 0.8 in its best context; the Weeping Angel's field average does not rise | Done: **Mesmerize catches its caster only on a natural 1** (a Curse of Loki moment); Enthrall needs no change. With the pin rule on, both are level with the card they replace one-on-one and ahead in crowds; the Weeping Angel's field average does not rise | this commit |
| 4 | **Harness: a per-fight split.** A runner option that tags each fight with whether an effect happened, so all-or-nothing cards get the check routinely | Tests; the Gloaming Rest split reproduces | Built: units take `probes` (rest-completed, awed, rattled, held), results carry `split`, and `sim-split-report` prints it. Tests show the split sums to the totals and an unknown probe is refused | |
| 5 | **Confirmation and close-out.** The owner's run, then Harden (only if trivial) and the Faceswap watch against production data | Report checked in; this plan archived | Planned | |

## Decisions

- **The advantage comes from the pin's own effect.** The hold's encounter effect already runs
  whenever another monster plays a card. In `DEFENSE_PHASE` it wraps that card's effect, so
  attacks aimed at the pinned monster roll with advantage for that target only. Faceswap,
  Blink, and Take Wing already wrap cards this way. A card's own "roll twice and keep the
  better" (Lucky Strike) already is advantage, and does not stack.
- **Advantage and disadvantage cancel,** as in D&D, through one helper. Dissonant Voice's
  rattle and a pin can both touch the same attack, so each one counting in its own wrapper
  would make the result depend on which effect ran first.

## Task 2 diagnosis: the level 7 Dragon against the Unicorn

A trace of 200 fights on the searched level 7 hands (Dragon 0.5%) shows it is how the two hands
meet, not the Dragon's body. At level 7 the Dragon has 59 hp and AC 15, against the Unicorn's
50 hp and AC 14.

- **Blast needs no roll.** The Unicorn's four Blasts deal 10 each, 40 damage a fight. A Blast
  also knocks a flying Dragon out of the sky.
- **The Dragon's typical level 7 hand does little damage.** Five of its nine cards deal none:
  three Take Wings, Fight or Flight, and Scotch. Take Wing only dodges the first melee blow, so
  against a Blast-heavy hand it is a wasted turn.
- **Fire Breath** averages 5.5 a hit including burns, and the Unicorn has the highest DEX at
  level 7 (+9), which dodges some breaths for half.
- **The Unicorn also holds the Dragon down** with two Sticketh and two Rehits.

The result is that the Dragon deals about 28 damage a fight to the Unicorn's 67.

Earlier probes, on the same hands:

| Change | Dragon wins |
|---|---|
| None | 1.7% |
| The Unicorn's Blasts replaced by Hits | 26% |
| The Dragon holding nine Hits | 8% |
| The Dragon's Take Wings replaced by Hits | 9% |

So Blast is the biggest single lever, but the Dragon's hand shape and the Unicorn's holds add
to it.

The candidates are variants on the harness, each off in play:

- **Dragon scales against the Blast family**, in three versions:
  - `dragon-spell-half`: half damage;
  - `dragon-spell-age`: less half the dragon's level;
  - `dragon-spell-save`: a save for half.
- **`take-wing-spells`**: a flying dragon also dodges the first area spell.
- **`blast-cap-5`**: Blast stops scaling at level 5 for every caster. This is the fallback,
  since the owner prefers not to change Blast.

### Task 2 results and decision

Measured on PR D's searched hands with the pin rule on, 400 fights a pair at levels 1–7,
against the same seeds without the change. Each row shows the Dragon's level 7 field average
and its matchup against the Unicorn, before → after.

| Candidate | Level 7 Dragon | Level 7 vs Unicorn | Levels 1–5 |
|---|---|---|---|
| **Take Wing also dodges the first area attack (chosen)** | 37 → **49%** | 2 → **37%** | no change at 1–3, +0.1 at 5 |
| Half damage from the Blast family | 37 → 43% | 2 → 24% | Dragon +7.6 at 3 and +10.3 at 5; the Unicorn 11–16% against it |
| Blast damage less half the dragon's level | 37 → 40% | 2 → 10% | +6.4 at 5 (the Unicorn 14%) |
| A save for half | 37 → 40% | 2 → 13% | +4.3 at 3, +5.7 at 5 |
| Blast stops scaling at level 5 (every caster) | 37 → 40% | 2 → 8% | small |

- **Why the Take Wing change was chosen:**
  - It fixes the matchup where the problem was.
  - It moves nothing where the Dragon's new cards had already lifted it (levels 1–5).
  - It is Dragon-side, as the owner preferred, and leaves Blast as it is.
  - A dragon rising above the blast reads naturally.
- **What else moved at level 7:** the Unicorn fell from 56% to 51% and the Weeping Angel from 54%
  to 48%, both in band. The guardrails moved ±2%.
- **The losers were removed** as complexity for nothing: the three resistances and the Blast cap.
- **A tsunami no longer reaches a flier either** (owner, 2026-09-29: a wave catching a dragon in
  the air was odd, and nothing required it). The rule was only the pack's early "an area card
  knocks a flier down". Only Dragons hold Tsunami and only Dragons fly, so it matters only in
  Dragon mirrors. A first version kept Tsunami as an exception; that exception is removed.

### Task 3 results and decision

The Weeping Angel's win rate, with Mesmerize or Enthrall swapped into its PR D searched hand.
The pin rule and Take Wing's change are both on, and the `held` probe ran. One-on-one is 400
fights a pair at levels 1–7; crowds are four-monster free-for-alls at levels 3 and 5; teams are
2v2 and 3v3.

| Version | One-on-one L1 / L3 / L5 / L7 | Crowd L3 / L5 | 2v2 L3 / L5 | 3v3 L3 / L5 |
|---|---|---|---|---|
| *Card it replaced* | *67.2 / 61.7 / 65.2 / 47.9* | *55.3 / 53.3* | *56.3 / 71.4* | *55.3 / 59.8* |
| Mesmerize, catching itself every time (before) | 60.0 / 57.3 / 61.1 / 44.5 | 55.0 / 56.3 | 54.5 / 73.1 | 54.1 / 59.6 |
| **Mesmerize, itself only on a natural 1 (chosen)** | 68.5 / 61.1 / 64.5 / 44.8 | 56.5 / 59.0 | 55.7 / 71.2 | 54.8 / 60.3 |
| Mesmerize, never itself | 68.6 / 60.9 / 61.6 / 46.3 | 58.0 / 58.8 | 57.6 / 72.6 | 54.9 / 59.1 |
| Enthrall, unchanged | — / 61.8 / 64.5 / 45.9 | 57.7 / 58.0 | 56.5 / 72.6 | 55.7 / 59.0 |

Enthrall is a level 2 card, so it has no level 1 figure.

- **Why Mesmerize was weak:** it held its own caster. The `held` probe shows the Angel was held
  in 8,111 of 9,600 one-on-one fights with the old rule, against 2,996 with the natural-1 rule.
- **Mesmerize:** the natural-1 version measured the same as sparing the caster. It keeps the card's
  joke ("even yourself") as a rare Curse of Loki moment, on the owner's natural-1 precedent.
- **Enthrall** was already level with the card it replaced once the pin rule made holds worth more,
  so it is unchanged.
- **The Angel is not pushed up.** One-on-one it stays within noise of the card replaced (Mesmerize
  +1.3 at level 1, −3.1 at level 7). In crowds holds are worth more, as they should be.
