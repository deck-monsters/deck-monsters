---
type: Roadmap
title: Deck Monsters Roadmap
description: Index of active roadmap work and the stable fixed-bug ledger.
status: stable
audience: internal
tags: [roadmap, planning, index]
---
# Deck Monsters Roadmap

**Status:** Active planning only. Current behavior belongs in [`docs/README.md`](../README.md);
completed reasoning belongs in the [archive](../archive/README.md).

| Area | Actionable work |
|---|---|
| [10 — Bug fixes](10-bug-fixes.md) | Indentation and spacing in feed messages (first example captured in the fight log) |
| [11 — Balance and mechanics](11-balance-and-mechanics.md) | The next balance pass carried from 35 (pinned-advantage rule, Mesmerize/Enthrall/Harden, the level 7 Dragon against Blast); simulation, telemetry, healing prices, crit ticks, fight threads, and combat decisions |
| [12 — New content](12-new-content-backlog.md) | Dragon follow-ups (counter cards, flavour pass, live check); counters to the big swing cards (Sandstorm, Faceswap, Blink); concrete cards, monsters, card authoring, equipment, world, and endgame proposals |
| [Item follow-ups](item-followups.md) | Prompt transport for items that ask a question |
| [22 — Small leftovers](22-small-leftovers.md) | Cross-cutting decisions, manual verification gates, and small Workshop features |
| [34 — Balance methodology](34-balance-methodology.md) | In progress: PR A merged (#408); PR B (catalogue and contexts, chassis and collections, lean best-hand search) in review. Still open: idealized action classes (task 5), excitement tooling (8), rings (10), the method reference doc (11) |
| [36 — Pins, the Dragon against Blast, and the hold cards](36-pins-and-dragon-resistance.md) | In progress: advantage against pinned monsters (task 1), the level 7 Dragon against Blast, Mesmerize and Enthrall, and a per-fight split in the harness |
| [27 — Next passes](27-next-passes.md) | The order of the next passes: command and workshop bugs, the Dragon, realistic rings with boss balance, and the mega boss (done), then later work |

[`10b-bugs-fixed.md`](10b-bugs-fixed.md) remains the stable fixed-bug ledger because code
cites it. Shipped plans, retired subsystems, and pass records are historical only; they
cannot be the sole home of open work.

## Lifecycle

- Put a newly discovered, reproducible defect in 10; move it to 10b with root cause and
  test evidence when fixed.
- Put new actionable work in its owning roadmap file, not an archive.
- Move a shipped plan to the archive only after its remaining work has a current roadmap
  home.
