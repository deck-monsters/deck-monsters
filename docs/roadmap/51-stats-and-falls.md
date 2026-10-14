---
type: Roadmap
title: Attack stats, hiding, target deaths, crit failures
description: Roadmap 51 — every attack card names and rolls its stat, the Kalevala rolls int, hiding becomes a contest against 10 + a stat, effects whose target falls, and natural-1 outcomes.
status: draft
audience: internal
tags: [roadmap, cards, balance, combat]
---
# 51 — Attack stats, hiding, target deaths, crit failures

**Status:** In progress on `claude/int-audit-and-roadmap-51`. Started 2026-10-14.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Archive roadmap 50 | Done | `1da3a28` |
| 2 | `attackStat` on every attack card: the roll and the text agree; the Kalevala rolls int (10b #256) | Done | `ae4318b` |
| 3 | Hiding is a contest: 1d20 + finder's int vs 10 + hider's int (dex for the Vest) | Done | `ae4318b` |
| 4 | Card texts name both sides of each roll | Done | `ae4318b` |
| 5 | Effects whose target falls: same-turn damage stands; a fallen captive's hold is not announced (10b #257) | Done | `e198a03` |
| 6 | Crit failures: a natural 1 on your own move backfires; only a d20 crits (10b #258) | Done | |

## Decisions (owner, 2026-10-14)

- Feline Companion already raised the int modifier; the Kalevala rolling dex was why it seemed
  not to matter. The Kalevala now rolls int; its reach (targets int, and as ACOUSTIC ignores
  cloaks, vests and flight) is unchanged.
- Hiding: "1d20 + int mod vs 10 + int mod", the owner's idea. Attacks stay against the raw
  stat (5 + modifier); moving them would slow every fight.
- The Camouflage Vest hides with dex (Claude's call while the owner left it open; one line to
  change back).
- Damage keeps landing in the turn a monster falls, down into negative hp: Berserk's last
  swing, every armed Delayed Hit (owner). Only effects that would speak *after* that turn
  are silenced.
- Natural 1s and 20s are for d20s only; a card's own rare luck roll (Heal's 1-in-100 phial)
  stays (owner). Blink's natural 1 reuses the confused angel's self-shift rather than adding
  a new penalty (Claude's call).
- Not in this pass: notifications, the phone check, boss hands.

## Balance check

`sim:rings curves` (240 fights a cell) before and after tasks 2-4: no monster's average moved
more than 3 points, inside the ±6 noise of a cell.
