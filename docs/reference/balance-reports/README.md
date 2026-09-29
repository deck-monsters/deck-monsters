---
type: Reference
title: Balance reports
description: Checked-in summaries of balance runner results that informed a decision, newest first.
status: stable
audience: internal
tags: [balance, harness, reports]
---
# Balance reports

Summaries of [standalone runner](../simulation-harness.md#the-standalone-runner-simbatch--packagesharnesssrcbalance)
results that informed a decision, each with the plan, commit, and a JSON beside it. The
method is [roadmap 34](../../roadmap/34-balance-methodology.md). Raw `results.jsonl` files
are not checked in; rerun the plan to reproduce them.

| Report | What it measured |
|---|---|
| [2026-09-28 roadmap 35 confirmation](2026-09-28-confirm-35.md) | The owner's run: a new search on the changed game at levels 1-7, then 2,000 fights a pair before and after the Dragon, Gladiator, and Tsunami changes |
| [2026-09-28 Dragon, Gladiator, and Tsunami fixes](2026-09-28-fixes-dragon-gladiator.md) | Roadmap 35: the variants tried and the combined before/after check that chose the first body and card changes |
| [2026-09-28 best-hand search](2026-09-28-search.md) | Lean Layer 4: searched hands at levels 1, 3, 5 and the first band check on them (run overnight by the owner) |
| [2026-09-28 catalogue contexts](2026-09-28-contexts.md) | Task 6b: every card in a caster hand, a brute hand, against drinks, and in a crowd |
| [2026-09-28 chassis, collections, and holders](2026-09-28-layer3.md) | Layer 3: each monster's body value with a fixed hand, what a typical player owns by level (from the drop code), and restricted cards on their real holders |
| [2026-09-28 real-card catalogue](2026-09-28-catalogue.md) | Layer 2: every card's value in Hit-equivalents at levels 1-12 on the reference chassis, against Hits and the reference field, with outliers against each action class |
| [2026-09-28 ladder and HE validation](2026-09-28-ladder-and-he.md) | The two-sided calibration ladder, slot weights, and the value unit validated on synthetic strikes |
| [2026-09-28 formula tables](2026-09-28-formula.md) | Layer 0: chassis by level, and a Hit's and a Blast's per-play damage and turns to kill (no fights) |
| [2026-09-28 class curves](2026-09-28-class-curves.md) | Each monster's field average at eight levels, likely and random hands, seat-swapped (the first corrected baseline) |
