---
type: Roadmap
title: Feed wording and turn order pass
description: Owner screenshots of 2026-10-12 — unexplained ac and level changes, a fixed turn order for encounter effects, Workshop status and level labels.
status: draft
audience: internal
tags: [roadmap, combat, feed, workshop, ux]
---
# 49 — Feed wording and turn order

**Status:** Built on `claude/feed-and-workshop-ux-pass`, not yet merged. Started 2026-10-12 from
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
| 8 | Self-review fixes: Delayed Hit still answers a blow on a lost turn (`onLostTurn`); turn start stops when the actor falls | Done | `3c42b7a` |
| 9 | Random Play and Pick Pocket start the turn on the card they become, so a Heal puts out a burn; "beats out the flames" reads under the Heal's box | Done | `3a051e7` |
| 10 | "↓ Latest" is opaque (feed text showed through it); the Ring footer says "Previous fight" while a fight is on | Done | this commit |
| 7 | First-time notes for a time-shifted turn and a level moved mid-fight; docs; notifications plan (48) checked against the code | Done | `85ff129` |

## Decisions (owner, 2026-10-12)

- Status lines read above the card box, unless the card caused them.
- **Time-shift skips the whole turn**: no time passes, so burns, penalties and boosts wait.
  Other control (holds, awe) loses the card but not the turn's upkeep.
- A monster that is held or awed cannot stay in the air.
- Dropping a level to Blink's xp drain is correct, and the feed must say so.
- Level zero reads "Beginner" everywhere.
- Bosses keep "👑 The Editor" on the roster.

## Left open

- The turn banner still says "plays the next card in her deck" on a turn that turns out to be
  lost; the next line says why. Not changed.
- Live check on a phone of the new order (owner or Cursor), especially a Random Play by a
  winded dragon and a time-shifted flier.

When merged, fold this into the archive per the roadmap lifecycle; the turn order already
lives in [cards and encounter effects](../architecture/cards-and-encounter-effects.md).
