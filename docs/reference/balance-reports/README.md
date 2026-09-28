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
| [2026-09-28 real-card catalogue](2026-09-28-catalogue.md) | Layer 2: every card's value in Hit-equivalents at levels 1-12 on the reference chassis, against Hits and the reference field, with outliers against each action class |
| [2026-09-28 ladder and HE validation](2026-09-28-ladder-and-he.md) | The two-sided calibration ladder, slot weights, and the value unit validated on synthetic strikes |
| [2026-09-28 formula tables](2026-09-28-formula.md) | Layer 0: chassis by level, and a Hit's and a Blast's per-play damage and turns to kill (no fights) |
| [2026-09-28 class curves](2026-09-28-class-curves.md) | Each monster's field average at eight levels, likely and random hands, seat-swapped (the first corrected baseline) |
