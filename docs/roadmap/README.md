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
| [10 — Bug fixes](10-bug-fixes.md) | Reward investigation, feed recovery, equip/unequip command capture, first-run workshop fetch, fast-fight log, card labels, and card-box borders |
| [11 — Balance and mechanics](11-balance-and-mechanics.md) | Simulation, telemetry, healing prices, crit ticks, fight threads, and combat decisions |
| [12 — New content](12-new-content-backlog.md) | Dragon research brief; concrete cards, monsters, card authoring, equipment, world, and endgame proposals |
| [Item follow-ups](item-followups.md) | Prompt transport for items that ask a question |
| [22 — Small leftovers](22-small-leftovers.md) | Cross-cutting decisions and manual verification gates |
| [27 — Next passes](27-next-passes.md) | The order of the next passes: command and workshop bugs, realistic harness rings, then Dragon research |
| [28 — Unicorn voice punch-up](28-unicorn-voice-punch-up.md) | Proposals awaiting the owner's picks. The archive checks of the quotations are recorded in that file |

[`10b-bugs-fixed.md`](10b-bugs-fixed.md) remains the stable fixed-bug ledger because code
cites it. Shipped plans, retired subsystems, and pass records are historical only; they
cannot be the sole home of open work.

## Lifecycle

- Put a newly discovered, reproducible defect in 10; move it to 10b with root cause and
  test evidence when fixed.
- Put new actionable work in its owning roadmap file, not an archive.
- Move a shipped plan to the archive only after its remaining work has a current roadmap
  home.
