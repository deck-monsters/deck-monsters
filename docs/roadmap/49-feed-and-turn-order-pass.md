---
type: Roadmap
title: Feed wording and turn order pass
description: Owner screenshots of 2026-10-12 — unexplained ac and level changes, a fixed turn order for encounter effects, Workshop status and level labels.
status: draft
audience: internal
tags: [roadmap, combat, feed, workshop, ux]
---
# 49 — Feed wording and turn order

**Status:** Built on `claude/feed-and-workshop-ux-pass`, not yet merged. The live check is written: [turn-order-check-49b](../reference/turn-order-check-49b.md) ([49b](49b-cursor-check.md)). Started 2026-10-12 from
four owner screenshots (a phone, Millefleur): the Ring during two boss fights, and the
Workshop.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | "ac is now 9 (increased by 2, total)": dangling total; winded and exposed said why after the number (bug 244) | Done | `35e1480` |
| 2 | Blink's xp drain dropped a level silently: the line now says "drops to level 2 for this fight" (bug 245) | Done | `35e1480` |
| 3 | Stat block: real roll bonuses instead of "+1 dex bonus" (bug 248) | Done | `35e1480` |
| 4 | Workshop "Ready" on a 0/9 deck → "Needs cards"; filter hint says what it does (bug 247) | Done | `35e1480` |
| 5 | Turn order: time-shift, control, upkeep, card box, card stage; lost turns skip what they skip; Random Play and Pick Pocket; held or awed fliers fall (bug 246) | Done | `f08d1c4` |
| 6 | "Beginner" everywhere instead of "Lvl 0" in the Workshop and Console | Done | `354b5cd` |
| 7 | First-time notes for a time-shifted turn and a level moved mid-fight; docs; notifications plan (48) checked against the code | Done | `85ff129` |
| 8 | Self-review fixes: Delayed Hit still answers a blow on a lost turn (`onLostTurn`); turn start stops when the actor falls | Done | `3c42b7a` |
| 9 | Random Play and Pick Pocket start the turn on the card they become, so a Heal puts out a burn; "beats out the flames" reads under the Heal's box | Done | `3a051e7` |
| 10 | "↓ Latest" is opaque (feed text showed through it); the Ring footer says "Previous fight" while a fight is on | Done | `fa5e7e4` |
| 11 | Review fixes: a held monster's Heal keeps the burn; lost turns share `playLostTurn`; level line says Beginner | Done | `fa5e7e4` |
| 12 | Tipsy: from the third drink in one round, roll 1d20 + str vs 10 or take -1 dex and int for two cards (owner idea) | Done | `5172d26` |
| 13 | Kid mode recorded on [backlog 12](12-new-content-backlog.md#kid-mode) | Done | `5172d26` |
| 14 | Blink breaks the moment the angel falls: "⏳ <angel> has fallen, and the time-shift breaks. <victim> is back in the fight." (owner decision from the live check) | Done | `5397647` |
| 15 | Footer keeps "Previous fight" after a fight ends until that fight's summary arrives, polling meanwhile (bug 250, live check B2) | Done | `5397647` |

## Decisions (owner, 2026-10-12)

- Status lines read above the card box, unless the card caused them.
- **Time-shift skips the whole turn**: no time passes, so burns, penalties and boosts wait.
  Other control (holds, awe) loses the card but not the turn's upkeep.
- A monster that is held or awed cannot stay in the air.
- Dropping a level to Blink's xp drain is correct, and the feed must say so.
- Level zero reads "Beginner" everywhere.
- Bosses keep "👑 The Editor" on the roster.

## Balance check

`sim:monster` for Dragon and Weeping Angel, 200 fights a row, main against this branch before
Tipsy (`d681bf5`): over 60 Dragon rows the decisive win share moved +0.7 points on average
(mean absolute change 2.8), over 30 Weeping Angel rows +0.6 (3.8). Row swings of 8 to 14 points
go both ways (Dragon against the Minotaur is -13 at level 5, +8 at level 1), which is the noise
of 200 fights. No measurable change from the turn order.

## Left open

- The turn banner still says "plays the next card in her deck" on a turn that turns out to be
  lost; the next line says why. Not changed.
- Live check, written 2026-10-12: [turn-order-check-49b](../reference/turn-order-check-49b.md). Workshop labels and the level-0 stat block passed. B2 failed: on the win line the footer said "Last fight" while still naming the fight before; fixed as bug 250 (task 15). Fire Breath, Blink, Take Wing, and three drinks were not reached; the unit tests pin their order, and a later phone session can still look.
- Events after a monster has fallen. Delayed Hit stays as it is. Blink is now revoked the moment the angel falls, with its own line (task 14). Every other lasting effect is open on [roadmap 11](11-balance-and-mechanics.md), with the check's [table](../reference/turn-order-check-49b.md#notes-for-claude-events-after-a-monster-has-fallen).

When merged, fold this into the archive per the roadmap lifecycle; the turn order already
lives in [cards and encounter effects](../architecture/cards-and-encounter-effects.md).
