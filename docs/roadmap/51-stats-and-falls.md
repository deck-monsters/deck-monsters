---
type: Roadmap
title: Attack stats, hiding, target deaths, crit failures
description: Roadmap 51 — every attack card names and rolls its stat, the Kalevala rolls int, hiding becomes a contest against 10 + a stat, effects whose target falls, and natural-1 outcomes.
status: draft
audience: internal
tags: [roadmap, cards, balance, combat]
---
# 51 — Attack stats, hiding, target deaths, crit failures

**Status:** In review on `claude/int-audit-and-roadmap-51`. Started 2026-10-14.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Archive roadmap 50 | Done | `1da3a28` |
| 2 | `attackStat` on every attack card: the roll and the text agree; the Kalevala rolls int (10b #256) | Done | `ae4318b` |
| 3 | Hiding is a contest: 1d20 + finder's int vs 10 + hider's int (dex for the Vest) | Done | `ae4318b` |
| 4 | Card texts name both sides of each roll | Done | `ae4318b` |
| 5 | Effects whose target falls: same-turn damage stands; a fallen captive's hold is not announced (10b #257) | Done | `e198a03` |
| 6 | Crit failures: a natural 1 on your own move backfires; only a d20 crits (10b #258) | Done | `c731231` |
| 7 | Review fixes: Blink's natural 1 freezes rather than shifts; escape texts name both sides; Cloak find-roll tests | Done | `5af7ed5` |
| 8 | Hides last three cards; a natural 20 tears the cloak off (owner) | Done | `1a249e7` |
| 9 | Tipsy rolls 1d6 for its kind, the Ballmer peak on a 5 (owner) | Done | `1a249e7` |

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
  stays (owner). Blink's natural 1 freezes the angel in stone for a turn, still targetable
  (Claude's call; a self-shift was tried first and was a gift, since it made the angel
  untargetable). A confused angel's self-blink freezes too.
- Hides (Cloak, Vest, Mood Scales) last three cards, up from two; a finder's natural 20
  tears the cloak off and the hide ends at once (owner). Blink and Take Wing are not hides.
- Tipsy's kind is a 1d6: 1 -1 int, 2 -2 int, 3 -1 dex, 4 -2 dex, 5 the Ballmer peak
  (+1/+1), 6 -2/-2 (owner). A further drink restarts the clock without rerolling.
- Not in this pass: notifications, the phone check, boss hands.

## Balance check

`sim:rings curves` (240 fights a cell) before and after tasks 2-4: no monster's average moved
more than 3 points, inside the ±6 noise of a cell.

After every task (final build, same 240 fights a cell), averaged over the six levels:
Basilisk 55.7 → 56.8, Gladiator 51.2 → 51.5, Jinn 46.0 → 47.0, Minotaur 49.5 → 51.8,
Weeping Angel 49.7 → 46.0, Unicorn 63.3 → 64.0, Dragon 56.3 → 54.8. Single cells moved up to
13 points (Angel and Dragon at L15), about two standard errors; the Angel's -4 average fits a
Blink that now backfires on 1 roll in 20. Worth a second look if live play agrees.

