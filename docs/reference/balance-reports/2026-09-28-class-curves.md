---
type: Reference
title: Class curves, 2026-09-28 (first seat-swapped baseline)
description: Each monster's field average at levels 1-20 with likely and random hands, re-measured with seat-swapped pairs after the fixed first-mover bias was found.
status: stable
audience: internal
tags: [balance, harness, reports, curves]
---
# Class curves, 2026-09-28

**Run:** `plan:curves --fights 40` at commit `df8373c` (PR #407 merged), 336 units, 26,880
fights in 236 s on 4 workers (114 fights a second). Every pair of the seven monsters at
levels 1, 3, 6, 8, 10, 12, 15, 20, as humans, each seat order on the same seed. Each cell is
one monster's expected score (win 1, draw ½) against the other six, 480 fights, with a 95%
Wilson interval. **LOW** and **HIGH** mark an interval wholly outside the owner's 35-75%
band. JSON: [2026-09-28-class-curves.json](2026-09-28-class-curves.json).

Reproduce: `node dist/scripts/plan-curves.js --out plan.json --fights 40`, then
`sim-batch plan.json --out run/` and `sim-report run/`.

## Likely hands (the hand-written informed builds)

| Monster | L1 | L3 | L6 | L8 | L10 | L12 | L15 | L20 |
|---|---|---|---|---|---|---|---|---|
| Basilisk | 66 | 57 | 55 | 48 | 37 | 34 | 36 | **27** |
| Gladiator | 50 | 61 | 60 | 58 | 59 | 48 | 43 | 37 |
| Minotaur | 51 | 53 | 53 | 52 | 52 | 40 | 34 | **30** |
| Jinn | 57 | 73 | 74 | 76 | 73 | 74 | 72 | 69 |
| Weeping Angel | 74 | 65 | 68 | 74 | 76 | **83** | **87** | **89** |
| Dragon | **7** | **11** | **14** | **13** | **23** | 35 | 45 | 61 |
| Unicorn | 46 | **31** | **25** | **28** | **29** | 36 | 34 | 37 |

## Random legal hands

| Monster | L1 | L3 | L6 | L8 | L10 | L12 | L15 | L20 |
|---|---|---|---|---|---|---|---|---|
| Basilisk | 65 | 59 | 57 | 58 | 56 | 48 | 52 | 51 |
| Gladiator | 43 | 47 | 47 | 45 | 44 | 46 | 43 | 39 |
| Minotaur | 57 | 53 | 50 | 51 | 51 | 46 | 45 | 46 |
| Jinn | 46 | 47 | 48 | 50 | 46 | 51 | 47 | 47 |
| Weeping Angel | 45 | 44 | 42 | 41 | 48 | 52 | 51 | 53 |
| Dragon | **31** | 41 | 48 | 45 | 46 | 48 | 51 | 55 |
| Unicorn | 62 | 59 | 58 | 60 | 60 | 59 | 60 | 60 |

## Readings

- **The first mover's edge is small in real hands**: 53% (53-54) over all 26,880 fights,
  against 51-65% in Hit mirrors. The earlier curves still ran high for the monster under
  test, because it always moved first; these replace them.
- **Random hands are inside the band** at every level except the Dragon at level 1 (31%).
  They already show the target shape for the Barbarians (fading) and the Dragon (growing);
  the Unicorn is flat and strong (58-62%) and the Gladiator flat and weak (39-47%).
- **Likely hands are where the band breaks**, and they are the hand-written guesses the
  methodology replaces with a search (roadmap 34 Layer 4), so these are not yet verdicts:
  the Weeping Angel runs 83-89% from level 12, the Jinn 69-76% from level 3, the Dragon
  7-23% through level 10, the Unicorn 25-31% at levels 3-10, and the Barbarians fall to
  27-30% at level 20.
- The Basilisk and Minotaur fading late with likely hands (but not random ones) and the
  Angel rising fits the Layer 0 hypothesis: strikes stop growing past level 10 while HP
  and level-scaled spells keep growing.
