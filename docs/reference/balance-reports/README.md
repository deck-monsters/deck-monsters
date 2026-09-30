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
| [2026-09-29 Gauntlet candidate fixes](2026-09-29-gauntlet.md) | Roadmap 38: a lone human wins 0-8% of Gauntlets today (levels 0-5), 25-71% with rivals-alone, 1-32% with minions, 48-74% with both; two humans 1-14% today, 36-50% when outnumbered bosses become rivals; the ambush case; how often each ring event fires |
| [2026-09-29 roadmap 36 confirmation](2026-09-29-confirm-36.md) | The owner's before and after of the pin rule, Take Wing's area dodge, and Mesmerize's natural-1 self-catch on PR D's hands: every field average in band, the level 7 Dragon 38% → 48%, and the level 1 Dragon vs Basilisk 85.2% (the pin rule; the Faceswap ceiling, left as it is) |
| [2026-09-29 roadmap 35 PR D confirmation](2026-09-29-confirm-35d.md) | The owner's run, in two parts: the branch's code on PR C's hands (nothing else moved), then a new search where the Dragon and Unicorn own their new cards (the Dragon 63% / 63% / 59% / 38% at levels 1-7, every field average in band) |
| `2026-09-29-collection-35d.json` (input) | The Layer 3 collection with one change for PR D's confirmation run: the Dragon and the Unicorn also own their new and reworked cards (Tail Lash, Asinine Companion, Enchanted Faceswap, Lucky Strike, Helm of Awe; Unconquerable Horn, Dissonant Voice, Horn of Proof, Gloaming Rest) at share 1 at every level that can hold them. New cards are in no real player's collection yet, so the search could not otherwise try them |
| [2026-09-28 roadmap 35 confirmation](2026-09-28-confirm-35.md) | The owner's run: a new search on the changed game at levels 1-7, then 2,000 fights a pair before and after the Dragon, Gladiator, and Tsunami changes |
| [2026-09-28 Dragon, Gladiator, and Tsunami fixes](2026-09-28-fixes-dragon-gladiator.md) | Roadmap 35: the variants tried and the combined before/after check that chose the first body and card changes |
| [2026-09-28 best-hand search](2026-09-28-search.md) | Lean Layer 4: searched hands at levels 1, 3, 5 and the first band check on them (run overnight by the owner) |
| [2026-09-28 catalogue contexts](2026-09-28-contexts.md) | Task 6b: every card in a caster hand, a brute hand, against drinks, and in a crowd |
| [2026-09-28 chassis, collections, and holders](2026-09-28-layer3.md) | Layer 3: each monster's body value with a fixed hand, what a typical player owns by level (from the drop code), and restricted cards on their real holders |
| [2026-09-28 real-card catalogue](2026-09-28-catalogue.md) | Layer 2: every card's value in Hit-equivalents at levels 1-12 on the reference chassis, against Hits and the reference field, with outliers against each action class |
| [2026-09-28 ladder and HE validation](2026-09-28-ladder-and-he.md) | The two-sided calibration ladder, slot weights, and the value unit validated on synthetic strikes |
| [2026-09-28 formula tables](2026-09-28-formula.md) | Layer 0: chassis by level, and a Hit's and a Blast's per-play damage and turns to kill (no fights) |
| [2026-09-28 class curves](2026-09-28-class-curves.md) | Each monster's field average at eight levels, likely and random hands, seat-swapped (the first corrected baseline) |
