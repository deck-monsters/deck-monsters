---
type: Reference
title: Calibration ladder and HE validation, 2026-09-28
description: The two-sided calibration ladder that defines the Hit-equivalent, slot weights, and the validation of the value unit on synthetic strikes (tasks 3-4 of roadmap 34).
status: stable
audience: internal
tags: [balance, harness, reports, ladder]
---
# Calibration ladder and HE validation, 2026-09-28

**Runs:** `plan:ladder --levels 1,4,7,12` (912 units, 63,840 fights) and `plan:validate-he`
(464 units, 56,320 fights) at commit `522e493`, 4 workers, about 205 fights a second. All
hands are on the reference chassis against 9 Hits. JSON of the pooled ladder:
[2026-09-28-ladder.json](2026-09-28-ladder.json). The full ladder at every sampled level is
a longer run for later.

## The ladder (expected score %, both seed sets pooled)

Rung k: for k up to 9, k Hits and 9-k null cards against 9 Hits; above 9, 9 Hits against an
opponent missing k-9 Hits, so a hand worth more than 9 Hits has a rung to land on.

| Level | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | 0 | 0 | 0 | 2 | 7 | 12 | 22 | 30 | 37 | 50 | 59 | 70 | 78 | 88 | 95 | 98 | 99 | 100 | 100 |
| L4 | 0 | 0 | 1 | 3 | 7 | 14 | 23 | 31 | 41 | 50 | 58 | 66 | 75 | 88 | 93 | 98 | 100 | 100 | 100 |
| L7 | 0 | 0 | 1 | 2 | 7 | 15 | 23 | 33 | 40 | 50 | 58 | 69 | 78 | 86 | 95 | 97 | 100 | 100 | 100 |
| L12 | 0 | 0 | 1 | 5 | 6 | 15 | 22 | 38 | 40 | 50 | 59 | 68 | 78 | 88 | 94 | 98 | 100 | 100 | 100 |

- Monotone at every level in both seed sets.
- **Nearly the same at every level**: near an even match one Hit-equivalent is worth about
  9-10 points of expected score (40 → 50 → 59), so a score converts to HE almost independent
  of level.
- A first, one-sided ladder (k up to 9 only) read every card stronger than a Hit as exactly
  1.00, because 9 Hits was its ceiling. It also had 6 of 96 rungs differ between seed sets
  by more than chance, because a null's cost depends on its slot; the ladder now averages 6
  shuffles per rung.

## Slot weights (HE a Hit is worth in each slot)

Measured with a null in each slot of 9 Hits; the raw values are noisy (320 fights a slot),
so the straight-line fit is used:

| Level | Slot 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.80 | 0.80 | 0.80 | 0.80 | 0.81 | 0.81 | 0.81 | 0.81 | 0.81 |
| 4 | 1.52 | 1.38 | 1.23 | 1.09 | 0.95 | 0.81 | 0.67 | 0.52 | 0.38 |
| 7 | 1.17 | 1.04 | 0.91 | 0.78 | 0.65 | 0.51 | 0.38 | 0.25 | 0.12 |
| 12 | 1.41 | 1.36 | 1.30 | 1.24 | 1.18 | 1.13 | 1.07 | 1.01 | 0.95 |

At levels 4-7 an early slot is worth several times a late one (fights often end before the
last slots come round again); at levels 1 and 12 position barely matters. So card order can
matter a lot in the levels the owner cares about most, which task 5 measures directly.

## Validation

Synthetic strikes that differ only in their damage dice (a Hit is 1d6), each measured once in
every slot, then 80 held-out random hands of Hits, nulls, and strikes predicted from those
single values weighted by slot:

| Strike | L1 | L4 | L7 | L12 |
|---|---|---|---|---|
| 1d4 | 0.93 | 0.77 | 0.92 | 0.94 |
| 1d8 | 1.29 | 1.04 | 1.16 | 1.32 |
| 1d10 | 1.20 | 1.10 | 1.28 | 1.35 |
| 2d6 | 1.57 | 1.39 | 1.10 | 1.08 |

Stacking two or three copies stays within noise of the single value (linear).

| Prediction | Mean absolute error (noise floor 2.1) |
|---|---|
| First design (one-sided ladder, all slots equal) | 13.5: fail |
| Two-sided ladder, raw slot weights | 5.2: fail |
| Two-sided ladder, position ignored | 5.7: fail |
| **Two-sided ladder, fitted slot weights** | **4.9: pass** (mark 5) |

**What HE can be used for.** It passes narrowly on simple strikes: it ranks cards and
explains results, with single-card precision of about ±0.3-0.5 HE at these fight counts.
Decisions stay on whole-hand simulation (Layer 4). The check is repeated on real cards once
the catalogue exists (task 6), where effects that last or interact are more likely to break
additivity.
