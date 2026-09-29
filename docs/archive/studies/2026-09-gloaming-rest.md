---
type: Archive
title: Gloaming Rest heal study
description: How Gloaming Rest's heal was chosen in September 2026, with the seven shapes tried, the numbers, the owner's reasoning, and why averages hid the problem.
status: deprecated
audience: internal
tags: [balance, cards, unicorn, simulation]
---
# Gloaming Rest heal study (September 2026)

**Status:** Closed. It shipped on `claude/balance-fixes-d` as part of
[roadmap 35](../roadmap/35-balance-fixes.md), task 5. This is a historical record. The
current rule is in [cards and encounter effects](../../architecture/cards-and-encounter-effects.md#risky-heals-gloaming-rest)
and in `packages/engine/src/cards/gloaming-rest.ts`.

**Outcome:** The Unicorn (or Cleric) kneels at −2 AC until its next card. If nothing damages it
before that card, it heals a random amount from 4 (or less, if less is missing) up to all the
hp it is missing. Any damage breaks the rest, and it heals nothing. Bosses rest the same way.

Read this study before designing any heal that is conditional or risky. The trap it records is
general: **an average win rate can look fine while each single fight is decided by one coin
flip.**

## The starting point

Before the study, an undisturbed rest healed 3d4. The balance catalogue rated the card about 0 to
0.4 of a useful card. In a duel, the opponent's next card nearly always deals damage, and any
damage cancels the whole heal. The owner framed the card as "a huge risk", so the reward should
be huge too.

## The owner's constraints, in order

1. **No partial heal for a broken rest.** A broken rest heals nothing (2026-09-29). An earlier
   harness variant, `partialRest`, shrank the heal by the damage taken instead. It was removed.
2. **Bosses rest like everyone else.** One step gave bosses only 3d4, so a boss's large pool
   could not be restored at once. The owner rejected it: a card should not behave differently
   for bosses.
3. **Only damage from the monster you face breaking the rest** was also rejected, as too
   complicated. In a crowd the monster you attack is often not the one attacking you, and that
   is normal.
4. **Complexity must earn its place.** A mechanic that does not move the numbers is dropped (see
   the wrath below).
5. **The rule that decided it:** *no shape may heal to full every time.* The owner's argument,
   before any data backed it: "you play it, the next card isn't a hit at all, and you basically
   can win any battle where you can survive a single round". The same holds when the next card
   is a hit that misses.

## How it was measured

- **Hands.** The Unicorn's searched hands from `docs/reference/balance-reports/2026-09-28-search-35.json`,
  with Gloaming Rest swapped into one slot: Hit at L3, Fight or Flight at L5, and Rehit at L7.
  Fight or Flight is strong, so every version reads low at L5.
- **Duels.** Against each other monster's searched hand, 400 fights per turn order, both turn
  orders played (`sim:batch`, variants in `packages/harness/src/balance/variants.ts`).
- **Crowds.** Four-monster free-for-alls: the Unicorn and three opponents, over eight random
  opponent sets at L3 and L5, with every rotation played. A fair share is 25%.
- **Per-fight split (the measurement that mattered).** A one-off script played fights one at a
  time at L3, with 40 seeds against each of the six opponents, 240 fights in all. It sorted
  fights by whether a rest completed, and hooked `restHealAmount` to count completions. It lived
  in the scratchpad and is not checked in. See the gap noted at the end.

## What the instrumentation showed

With the full heal at L3, the Unicorn played the card 561 times over 600 duels. The rest
completed 57% of the time and broke 40% of the time; the rest were still pending when the
fight ended. The Unicorn played the card at 43% of its hp on average. A completed rest healed
24 hp on average, which was 59% of its maximum. So a completed rest is usually a large swing,
and it completes more often than not.

## Shapes tried

Unicorn win rate, one-on-one and in four-monster crowds, with the card it replaced as the
baseline. Numbers are per cent; duel cells are 4,800 fights, crowd cells 3,200.

| Shape | Duel L3 / L5 / L7 | Crowd L3 / L5 |
|---|---|---|
| *Card it replaced (no Gloaming Rest)* | *50.3 / 48.8 / 57.8* | *21.2 / 42.2* |
| Full heal | 52.7 / 39.6 / 55.5 | 33.1 / 40.6 |
| Deepening: half to all missing; −2, −3, −4 AC per rest this fight | 49.5 / 38.4 / 56.3 | 31.4 / 40.9 |
| **Shipped: 4 to all missing** | 47.8 / 38.8 / 55.1 | 27.8 / 41.7 |
| Half the missing hp | 46.9 / 39.2 / 55.2 | 27.3 / 40.4 |
| 4 to half max hp, never more than missing | 47.7 / 39.6 / 54.1 | 24.7 / 41.6 |
| Growing: 3d4, 6d4, 9d4 per undisturbed card, kept if broken | 43.7 / 40.1 / 52.1 | 22.4 / 41.0 |
| Two turns asleep, then full | 39.3 / 38.8 / 50.9 | 18.1 / 41.0 |
| Old 3d4 | 45.0 / 37.2 / 53.0 | 23.0 / 40.0 |

On averages alone, the full heal looked best and not too strong. That was the wrong conclusion.

## Why the averages misled: the per-fight split

At L3, fights were sorted by whether any rest completed:

| Shape | Rest completed: win / draw / loss | No rest completed: win / draw / loss |
|---|---|---|
| Full heal | 66 / 26 / 9 | 23 / 30 / 48 |
| Deepening | 60 / 28 / 11 | 23 / 30 / 48 |
| 4 to all missing | 56 / 29 / 15 | 23 / 30 / 48 |
| 4 to half max hp | 53 / 31 / 16 | 23 / 30 / 48 |
| Half the missing hp | 52 / 34 / 15 | 23 / 30 / 48 |
| Old 3d4 (bias baseline) | 39 / 38 / 23 | 23 / 30 / 48 |

- **The split is biased, so calibrate it.** A fight where the rest completed is also one where the
  Unicorn lived long enough and the opponent missed or did not attack. It was already going better.
  The 3d4 row measures that bias: 39% wins with a heal too small to matter much. Read each shape
  against that row, not against the no-rest column.
- **The full heal decided fights.** When a rest completed, the Unicorn lost only 9% of the
  time, against 23% at baseline. The owner's objection was right: the result turned on
  whether one card missed.
- **Half-sized heals move fights without deciding them.** They sit about 13 points of wins above
  baseline, against 27 for the full heal.
- **Each split row is about 116 fights, so it is noisy (±5 points).** "4 to all" and "half" are
  indistinguishable, and so are deepening and full. The clear gap is between full-heal-like shapes
  and half-heal-like ones.

## Why each shape was kept or dropped

- **Full heal:** decides fights (above). Dropped under rule 5.
- **Deepening:** few fights last long enough for a second rest, so the growing AC penalty rarely
  applies. It behaves like the full heal. Dropped.
- **Two turns asleep:** too hard to complete; well below the replaced card everywhere. Dropped.
- **Growing:** no better than the old 3d4, and more rules. Dropped.
- **Half, and 4 to half max:** good middle shapes, but a completed rest can never be the
  full-heal moment. That moment is part of the excitement the owner protects ("please get a
  Loki" moments).
- **4 to all missing (shipped):** a half-heal-like split on average, one number to explain, no
  extra state, and a full heal remains possible but rare. Within 1–2 points of the other middle
  shapes one-on-one; good but not dominant in crowds (27.8 against a fair 25).

## Other questions the study answered

- **Can a hand of rests make a Unicorn invincible?** No, not even with the full heal. More copies
  made it weaker at L3 and L5, and draws fell rather than rose:

  | Rests in hand | L3 | L5 | L7 |
  |---|---|---|---|
  | 0 | 51.2 | 48.7 | 57.3 |
  | 1 | 52.2 | 39.1 | 56.1 |
  | 2 | 53.6 | 41.3 | 59.2 |
  | 4 | 31.8 | 18.5 | 59.0 |

  Every rest is a turn without an attack, and kneeling costs 2 AC.
- **Wrath on a broken rest** (owner's idea): the Unicorn's next card that rolls to hit rolled
  with advantage, with or without +2 damage. It moved nothing. With the half heal: duels
  45.9 / 39.0 / 55.2 with wrath, against 46.9 / 39.2 / 55.2 without; the split was unchanged. It
  was dropped as complexity for nothing (owner). Two reasons: attack-roll bonuses barely matter
  in this game's short fights (a roadmap 35 finding), and the Unicorn's hand is full of Blasts,
  which never roll to hit.

## Lessons for next time

- For a card whose effect is all-or-nothing, run the per-fight split beside the average, and
  calibrate it with a weak version of the same card. The average hides a coin flip.
- Ask the design question the owner asked: what does a single fight feel like when the effect
  lands? Then measure that fight.
- To-hit modifiers (a penalty, advantage, disadvantage) barely move win rates here, so a
  mechanic that only changes an attack roll must be very strong to matter. Change what lands,
  not the roll.

**Gap.** The harness has no built-in per-fight split. It needs a hook for "did effect X happen in
this fight". Until it has one, a probe that plays `simulate({ fights: 1, seed })` in a loop and
wraps the card's method is the pattern. The split must be calibrated as described above.
