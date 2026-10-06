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
| [12 — New content](12-new-content-backlog.md) | Dragon follow-ups (counter cards, flavour pass, live check); counters to the big swing cards (Sandstorm, Faceswap, Blink); concrete cards, monsters, card authoring, equipment, world, and endgame proposals; trading and gifting cards between players |
| [Item follow-ups](item-followups.md) | Prompt transport for items that ask a question |
| [22 — Small leftovers](22-small-leftovers.md) | Cross-cutting decisions, manual verification gates, and small Workshop features |
| [34 — Balance methodology](34-balance-methodology.md) | In progress: PR A (#408) and PR B (#409, catalogue and contexts, chassis and collections, lean best-hand search) merged. Still open: idealized action classes (task 5), excitement tooling (8), rings (10), the method reference doc (11) |
| [39 — In-game help for every control](39-in-game-help.md) | In progress: Workshop fixes, Help, batch 2, and batch 3 are built and checked in the browser ([help check](../reference/help-check.md), [batch 2](../reference/help-check-batch2.md), [batch 3](../reference/help-check-batch3.md)). Batch 3 adds `help <word>`, a title on every button, a line for each place, first-time fight notes, and a guided start in the Console and the Workshop. The batch 3 check drafted no new lines. Left: writing text for any surface still found wanting |
| [42 — Proposals for the next passes](42-next-proposals.md) | Open for the owner to pick: D (boss hands with a shape, needs a win-rate band), the rest of E, H (the fight log), J (what 43 and 44 left). Done: B, F (the walk, [archived](../archive/roadmap/42a-cursor-new-player-walk.md)), I as 43 (#422) and A, C, E1 as 44 (#423), both archived |
| [46 — A unicorn theme](46-unicorn-theme.md) | Design final (2026-10-06): Millefleur, a light watercolour theme, specified in the [Millefleur design system](../reference/millefleur/design-system.md). Open: the build, in two passes (theme plumbing; palette, type and components; surfaces; paint and paper; pixel monsters; live check) |
| [47 — Dream Desktop](47-dream-desktop-theme.md) | Brief: a System 7 theme from the Millefleur exploration, to be developed as its own theme. Open: studies, screens, a design system |
| [41 — Room chat](41-room-chat.md) | Shipped in #420: `msg`/`dm`, the Chat tab, retention until seen. Backlog: a Discord bridge, moderation, notifications |
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
