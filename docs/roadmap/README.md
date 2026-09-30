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
| [10 — Bug fixes](10-bug-fixes.md) | Indentation and spacing in feed messages (first example captured in the fight log); what a reset leaves behind (a running fight, open prompts, connector subscriptions); some simulation runs take far longer than expected |
| [11 — Balance and mechanics](11-balance-and-mechanics.md) | The leftovers of the balance pass 36 closed (the level 1 Dragon's Faceswap watch, the level 5 Weeping Angel against the Minotaur, a group-fight card); simulation, telemetry, healing prices, crit ticks, fight threads, and combat decisions |
| [12 — New content](12-new-content-backlog.md) | Dragon follow-ups (counter cards, flavour pass, live check); counters to the big swing cards (Sandstorm, Faceswap, Blink); concrete cards, monsters, card authoring, equipment, world, and endgame proposals |
| [Item follow-ups](item-followups.md) | Prompt transport for items that ask a question |
| [22 — Small leftovers](22-small-leftovers.md) | Cross-cutting decisions, manual verification gates, and small Workshop features |
| [34 — Balance methodology](34-balance-methodology.md) | In progress: PR A (#408) and PR B (#409, catalogue and contexts, chassis and collections, lean best-hand search) merged. Still open: idealized action classes (task 5), excitement tooling (8), rings (10), the method reference doc (11) |
| [37 — Room state as Postgres `jsonb`](37-room-state-in-postgres.md) | In progress (expand shipped; the close-out is [40](40-room-state-close-out-and-bugs.md)): replace the gzip+base64 `rooms.state_blob` with a queryable `jsonb` column (key-order and NUL risks, ordered saves, dual-write rollout with rollback, backfill, read-only views) |
| [40 — Room state close-out and open bugs](40-room-state-close-out-and-bugs.md) | Tasks done (release 2, query views, CI Postgres, the save crash, cross-process reset, the sim leak); the `state_blob` drop follows after deploy |
| [39 — In-game help for every control](39-in-game-help.md) | In progress: the Workshop fixes a new player needed and Help inside the game are built; Cursor browser passes next ([39a](39a-cursor-first-pass.md)); then explain every option, command, button, screen and fight mechanic inside the game, with a guided start and a check that no new control ships unexplained |
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
