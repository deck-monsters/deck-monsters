---
type: Archive
title: Helm of Awe and Dissonant Voice study
description: How the Dragon's Helm of Awe and the Unicorn's Dissonant Voice were reshaped in September 2026, with the owner's rules, 13 measured variations, and team-battle results.
status: deprecated
audience: internal
tags: [balance, cards, dragon, unicorn, simulation]
---
# Helm of Awe and Dissonant Voice study (September 2026)

**Status:** Closed. It shipped on `claude/balance-fixes-d` as part of
[roadmap 35](../roadmap/35-balance-fixes.md), tasks 5 and 8. This is a historical record. The
current rules are in
[cards and encounter effects](../../architecture/cards-and-encounter-effects.md#fear-and-song-helm-of-awe-and-dissonant-voice)
and in the two card files. The companion study,
[Gloaming Rest](2026-09-gloaming-rest.md), set the method used here.

**Outcome:**

- **Helm of Awe (Dragon)** is a pin. Every opponent saves (1d20 + int vs 10 + the dragon's int
  modifier). One that fails is awed and loses its next card. At the start of each later turn it
  saves again, 3 easier each time: a failure loses that card, and a success recovers. On a
  natural 1, an opponent that is not bloodied tries to flee (1d20 + dex, 10 or more), and a
  bloodied one cowers. A second helm never refreshes the first. The awe ends if the dragon dies.
- **Dissonant Voice (Unicorn, Bard)** has no save. Every opponent's next attack rolls at
  disadvantage. It waits for a card that rolls to hit, so a Blast or a Heal does not spend it.

## The owner's direction and rules

- Build high-quality, balanced, exciting versions. Try several variations and hone in on the
  best one (2026-09-29).
- **Helm of Awe is a pin.** "If there's a save and we do it per turn rather than a hard set of
  two cards it's really not all that different than a coil or other 'pinned' effect card which
  we know work."
- **The flee.** A natural 1 triggers a roll to flee, never an automatic flee. The mechanic is
  reversed from the Flee card's: "an injured opponent cowers on the ground and a healthy
  opponent takes off running while they still have the strength". The owner compared it to
  fear effects in D&D, with a twist.
- **Bosses may be frightened away.** The rule that bosses never flee is about the Flee cards
  they carry, not about fear.
- **Natural 1 and natural 20 are fixed.** Only a natural 1 is a Curse of Loki. Advantage and
  disadvantage fit that precedent; widening the range (a natural 1 or 2) does not, even when it
  measures well.
- **Complexity must earn its place.** A rule that does not move the numbers is dropped. The
  Gloaming Rest study set this precedent when it dropped the wrath.
- **Dissonant Voice's intent:** "not *that* powerful one on one but could be really powerful
  in a large team battle".

## How it was measured

This is the Gloaming Rest method, with one addition.

- **Hands.** The monster's searched hand from
  `docs/reference/balance-reports/2026-09-28-search-35.json`, with the card swapped into one slot.
  - Dragon: Hit at L3, Pick Pocket at L5, and Take Wing at L7.
  - Unicorn: Hit at L1 and L3, Fight or Flight at L5, and Rehit at L7.
  - Fight or Flight is strong, so every Unicorn row reads about 8 points low at L5.
- **Duels.** Against each other monster's searched hand, 200 fights per turn order, both
  orders. That is about 2,400 fights per cell, roughly ±1 point.
- **Crowds.** Four-monster free-for-alls over eight random opponent sets at L3 and L5, with
  every rotation played. A fair share is 25%.
- **Team battles (new).** The batch runner gained team support for this study: a side wins when
  its team wins, including a member that died during the fight. 2v2 and 3v3 at L3 and L5 ran
  over six random line-ups each, with every variant on the same seeds. The free-for-all crowd
  was the wrong test for a support card. There, disadvantage on everyone also protects the
  Unicorn's rivals from each other.
- **Stacking.** For Helm, 1, 2, and 4 copies in the Dragon's hand, one-on-one.

## Helm of Awe

Dragon win rate:

| Variation | Duel L3 / L5 / L7 | Crowd L3 / L5 | 2v2 L3 / L5 | 3v3 L3 / L5 |
|---|---|---|---|---|
| *Card it replaced* | *45.7 / 50.9 / 42.3* | *31.2 / 59.2* | *61.0 / 69.4* | *58.1 / 48.2* |
| Lose the next 2 cards (the earlier shape) | 49.4 / 49.2 / 40.0 | 37.4 / 53.6 | 63.4 / 67.9 | 58.6 / 48.2 |
| Pin: lose the next card, then save each turn, 3 easier per turn | 47.6 / 49.0 / 40.7 | 34.1 / 57.0 | 62.4 / 70.1 | 58.3 / 48.6 |
| Pin, the save never eases | 49.1 / 49.0 / 42.2 | 34.2 / 57.7 | | |
| Pin, even the first card needs a failed save | 39.8 / 46.7 / 36.3 | 31.5 / 54.4 | | |
| Pin + a natural 1 flees outright | 48.1 / 49.1 / 39.9 | 34.3 / 57.8 | | |
| Pin + a natural 1 tries to flee | 47.6 / 50.8 / 40.5 | 35.1 / 56.0 | | |
| **Shipped: pin + on a natural 1 the healthy try to flee, the bloodied cower** | 48.4 / 49.3 / 40.1 | 36.3 / 57.5 | 62.5 / 69.7 | 58.4 / 48.5 |

Earlier shapes, a −2 attack penalty for 3 cards, −5, or −2 for a whole round, were 5–8 points
below the replaced card. See roadmap 35's finding that attack-roll penalties barely matter.

Stacking the shipped Helm, one-on-one:

| Helms in hand | L3 | L5 | L7 |
|---|---|---|---|
| 0 | 45.5 | 50.6 | 42.3 |
| 1 | 47.0 | 49.4 | 40.4 |
| 2 | 41.6 | 44.8 | 38.5 |
| 4 | 31.7 | 30.5 | — |

Why the shipped shape:

- **The pin plays as the owner described,** and it matches the replaced card in every format.
- **Losing the first card outright matters.** Needing two failed saves to lose anything cost 6–8
  points.
- **The easing (3 per turn, as Immobilize's fatigue) costs about a point.** It is within noise,
  and it keeps a pin from lasting a whole fight.
- **The flee barely moves win rates.** It needs a natural 1 on a recovery save, so it is rare.
  That is the right profile for an exciting moment: memorable when it lands, not a balance
  lever. The owner's healthy/bloodied split measured the same as the plain versions.
- **No refresh.** A second helm on an awed opponent does nothing. Refreshing would reset the
  easing and let a hand of Helms chain the pin. With the rule, more Helms make the Dragon
  weaker (above), because every Helm is a turn without an attack.

## Dissonant Voice

Unicorn win rate:

| Variation | Duel L1 / L3 / L5 / L7 | Crowd L3 / L5 | 2v2 L3 / L5 | 3v3 L3 / L5 |
|---|---|---|---|---|
| *Card it replaced* | *59.4 / 49.8 / 49.1 / 57.0* | *17.6 / 39.9* | *42.9 / 58.0* | *56.1 / 49.3* |
| −2 penalty on a failed save (the earlier shape) | 52.2 / 41.7 / 38.1 / 53.3 | 16.5 / 39.3 | 41.3 / 60.1 | 53.2 / 51.4 |
| Disadvantage on everyone's next card | 58.0 / 46.2 / 40.4 / 53.3 | 18.6 / 37.5 | 41.8 / 58.6 | 54.5 / 49.7 |
| **Shipped: disadvantage that waits for an attack** | 55.1 / 44.2 / 40.9 / 54.9 | 17.7 / 42.1 | 42.1 / 58.0 | 54.7 / 49.9 |
| Waits, and lasts until an attack lands (cap 2) | 57.0 / 44.1 / 39.6 / 55.1 | 18.9 / 40.4 | 41.9 / 56.8 | 54.1 / 49.9 |
| Waits, and lasts until an attack lands (cap 3) | 58.2 / 44.9 / 41.1 / 55.0 | 18.7 / 40.7 | 42.6 / 57.4 | 55.0 / 50.6 |
| Waits, and a natural 1 or 2 is a Curse of Loki | 58.5 / 43.7 / 42.1 / 54.8 | 20.5 / 40.0 | | |
| One roll, waits, and a natural 1–3 is a Curse of Loki | 55.8 / 42.0 / 40.2 / 54.0 | 17.3 / 40.4 | | |
| Waits, and a natural 1–3 is a Curse of Loki | 57.7 / 47.5 / 42.8 / 55.1 | 19.2 / 41.3 | | |

Why the shipped shape:

- **Disadvantage in any form beats the old penalty clearly.** It sits 1–5 points below the
  replaced card one-on-one (L5 aside), and at par in crowds and team battles.
- **The differences between disadvantage forms are within noise.** The shipped one is the
  owner's own wording, "their next attack". It adds one fix: a Blast or a Heal no longer
  wastes the card, which reads as a bug to a player.
- **"Until an attack lands" gained nothing measurable,** so it was dropped as complexity.
- **The Loki-range forms broke the natural 1 and 20 rule,** so they were not candidates,
  whatever they measured.
- **Team battles did not make any version powerful.** In 2v2 and 3v3, every variation of both
  cards and the replaced card sat within about ±2 points. Line-up decides team fights, and no
  single support card swings them. The owner's hope for a strong group-fight card is met as
  "at par in groups, modest alone", not "powerful in groups". Stronger would need a different
  kind of effect, not a bigger roll change.

## Lessons for next time

- **Test a support card in team battles, not only free-for-alls.** A free-for-all makes everyone
  everyone's enemy, so a debuff on all opponents helps the caster's rivals too. The runner now
  supports teams (`SideSpec.team`; see the
  [simulation harness](../../reference/simulation-harness.md#team-fights)).
- **Team fights flatten card differences.** Expect ±2 points there, and do not tune a card for
  team power by roll changes alone.
- **A pin needs three guards:** the first card lost outright, an easing save so it ends, and no
  refresh.
- **Put exciting rare outcomes on natural 1s and 20s.** They cost almost nothing in balance
  (the flee) and fit the game's precedent.
- **Complexity must earn its place in the numbers.** Until-hit, wrath, and deepening all
  measured as noise and were cut.
