---
type: Roadmap
title: Pass C — Mega Boss, Class Balance, and Harness Decks
description: Active pass plan for the mega boss event, likely-deck harness rings with ring events, Unicorn and Gladiator balance, and the doubled Workshop console lines.
status: draft
audience: internal
tags: [roadmap, bosses, balance, harness]
---
# 32 — Pass C: Mega Boss, Class Balance, and Harness Decks

**Status:** In progress on branch `claude/pass-c-mega-boss-and-balance`, started 2026-09-27,
after Pass B ([31](../archive/roadmap/31-pass-b-rings-and-bosses.md), PR #403). The owner
asked for the leftovers in [11](11-balance-and-mechanics.md) and
[12](12-new-content-backlog.md#mega-boss-event), plus the doubled Workshop lines in the
Console, in one new branch and PR.

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 1 | Workshop actions echo into the Console twice (the engine's lines plus the server's summary); keep one line per action (10b #195) | Done | 1b56fb7 |
| 2 | Harness: likely-deck archetypes per class beside the random hand (`deckStyle`), and ring events (`ringEvents`), both as `sim:rings` flags | Done | 675f493 |
| 3 | Balance: the Unicorn strong at every level, the Gladiator weak early, measured with task 2 against the class-curve target. Investigated: no Unicorn or Gladiator change the evidence supports; the one robust finding, level-scaled Blast and Sandstorm late, now scales by half past level 10 (owner) | Done | 9634d46, f58489f |
| 4 | The mega boss event: daily per room, announced 30 minutes ahead with a countdown, a two-minute hold on ordinary fights, fitted to about 20%, relics and minions, rewards, called off below two humans; `sim:mega` | Done | 14f3d89 |
| 5 | Docs close-out, generated references, independent review and its fixes | Done | this commit |

## Decisions (owner, 2026-09-27)

| Question | Decision |
|---|---|
| Mega boss frequency | **About once a day** per room, at a random time |
| Announcement | **30 minutes** ahead, with reminders, and a countdown players can see |
| Difficulty | Fitted to the humans in the ring when it starts so humans win **about 20%** |
| Reward | Every surviving challenger gets **bonus coins and XP and a guaranteed rare card** |
| Blast late (task 3) | **Half scaling past level 10**: Blast and Sandstorm add their level damage for every caster level up to 10, then one per two levels |
| Cancellation (from [12](12-new-content-backlog.md#mega-boss-event)) | No more than one human in the ring when it is due: cancelled with flavour, and a regular boss instead |

## Evidence: class curves, random against likely decks (`sim:rings curves`, 120 fights per cell)

Each monster as a human against a random other at its level, share of decisive fights won.

| Monster | Random decks L1 / L3 / L5 / L10 / L15 / L20 | Likely decks L1 / L3 / L5 / L10 / L15 / L20 |
|---|---|---|
| Basilisk (Barbarian) | 70 / 58 / 59 / 55 / 57 / 52 | 73 / 79 / 55 / 25 / 17 / 29 |
| Gladiator (Fighter) | 40 / 42 / 46 / 47 / 45 / 52 | 54 / 60 / 74 / 56 / 33 / 41 |
| Jinn (Bard) | 49 / 44 / 52 / 54 / 45 / 49 | 65 / 86 / 64 / 50 / 97 / 83 |
| Minotaur (Barbarian) | 61 / 53 / 63 / 57 / 53 / 47 | 54 / 54 / 51 / 60 / 43 / 30 |
| Weeping Angel (Cleric) | 37 / 48 / 49 / 58 / 53 / 67 | 83 / 68 / 56 / 83 / 93 / 99 |
| Unicorn (Cleric) | 71 / 56 / 58 / 64 / 67 / 66 | 66 / 34 / 17 / 41 / 52 / 36 |
| Dragon (Wizard) | 38 / 46 / 61 / 39 / 50 / 55 | 4 / 9 / 6 / 24 / 47 / 51 |

The deck model moves the verdict more than any card does: with likely decks the Gladiator is
fine early and the Unicorn weak, the reverse of the random-deck finding in 11, and the Dragon
collapses early while the Weeping Angel and Jinn run away late. The likely decks are guesses,
so no card changes on this alone; task 3 looks for causes that hold under both.

A larger likely-deck run (360 fights per cell) matched the table above within a few points,
so the likely-deck curves are stable; what they measure is the hand-written decks.

## Evidence: mega boss difficulty (`sim:mega`, 120 fights per cell)

Humans' win rate against the fitted mega boss and two minions; the owner's target is about 20%.

| HP rule | 2 humans L1 / L3 / L6 / L10 | 3 humans | 4 humans | Overall |
|---|---|---|---|---|
| 0.8 × combined HP | 12 / 7 / 17 / 32 | 18 / 29 / 48 / 70 | 29 / 52 / 66 / 62 | 37% |
| 1.2 × | 3 / 2 / 6 / 32 | 5 / 10 / 24 / 53 | 9 / 28 / 43 / 43 | 21% |
| 1.6 × | 1 / 0 / 4 / 13 | 1 / 5 / 13 / 37 | 3 / 13 / 22 / 39 | 12% |
| **0.25 + 0.15 × humans + 0.11 × level** (shipped) | 13 / 4 / 6 / 16 | 15 / 21 / 16 / 33 | 21 / 33 / 31 / 19 | **19%** |

A single share hit the average but not the rooms: more humans and higher levels deal damage
faster than HP alone keeps up with. The shipped rule grows with both.

## Task 3 findings

Probes on likely decks (80–360 fights each), damage per hit from `SimResult.avgDamagePerCard`:

- **Unicorn and Gladiator.** The random-deck findings in 11 reverse under likely decks, so no
  card is at fault that the harness can see. The Unicorn's likely deck holds four cards that
  deal no damage (Horn of Proof, Unconquerable Horn, Gloaming Rest, Dissonant Voice); at
  level 5 it lands Sticketh for 11.5 and still loses 19% to 78% to a Minotaur.
- **Dragon.** Its likely deck loses 90% or more early for the same reason: Take Wing, Mood
  Scales, and Cloak of Invisibility deal nothing, and Tsunami hurts the Dragon too. Fire
  Breath itself is on par with a Hit per play (2 + level, plus a burn); its low per-hit
  figure (1.6 at level 1) averages in the 1-damage burn ticks. A player who equips every
  signature card is punished, which is a deck-building lesson, not a broken card.
- **Level-scaled area spells (holds under both models).** At level 15, Blast deals 18.9 a
  hit and Sandstorm 16 (both `damage + 1 × caster level`), against 11.7 for a Hit or Horn
  Swipe. Blast reaches every opponent and cannot be dodged. With likely decks the Weeping
  Angel (two Blasts) wins 90% against a Minotaur at level 15 and 95–99% across levels 15–20;
  the Jinn (Sandstorm) 96% at level 15. The owner's target wants casters strong late; how
  strong is a decision, not a measurement. Options are in 11's "Blast and Cleric power" item.

After the owner's decision (`scaledCasterLevel`, `cards/blast.ts`), likely decks, same seeds:
levels 1–10 are unchanged, as they should be. The Weeping Angel falls from 93% to 84% at
level 15 and from 99% to 94% at level 20. The Jinn does not move (96% and 85%), so its late
strength is Sandstorm's confusion (opponents attack the wrong target), not its damage; that
is recorded in 11 for the owner rather than changed here.

## Independent review (task 5)

A read-only review of the whole branch confirmed the owner's decisions are met and found
three faults, fixed before the PR opened:

- **The mega boss party could be stranded** (blocker). It has no despawn timer and is exempt
  from `dismissExtraBosses`, so if every human withdrew before the fight it stayed in the ring,
  and a lone newcomer walked into a fight fitted for a crowd. `removeMonster` now sends the
  party away when the last human leaves.
- **A partial card move lost its reason.** `Beastmaster.moveCard` said why it stopped short
  only in its own line, which the Console no longer prints (task 1). It returns `blockedBy`
  now, and both move summaries carry it; a batch move also names each failed card's reason.
- **A freshly rolled mega boss time waited for an unrelated save**, because the server
  attaches the store after the Game is built. The `stateStore` setter now saves it.

## Codex review of PR #405

Three findings, all fixed with tests that fail without them:

- **Ring events in a mega boss fight.** An armed Blood Feud survived its arrival and turned
  off the challengers' alliance. `addMegaBoss` clears the armed event and `rollRingEvent`
  rolls none while the party is in the ring.
- **A crowded ring.** `addMonster` refuses past twelve, so ten humans got one minion and
  twelve got no boss, after it was announced. It now brings what fits, boss first, and is
  called off (restarting the countdown) when the ring holds none.
- **Harness hands past the copy limit.** A likely deck's preferred card on top of the starting
  deck gave five of one card. Hands now obey `MAX_CARD_COPIES_IN_HAND`, which moved to
  `constants/card-management.ts` from its two private copies in equip and Beastmaster.
  Re-measured: the likely-deck curves match within a point, and `sim:mega` reads 18.2%.

## Cursor review of PR #405

Four findings, fixed with tests:

- **Reward XP mid-fight.** Monster XP levels a monster at once, so paying at the boss's death
  changed live combat. Earners are recorded at its death and paid at `fightConcludes`.
- **The crown did nothing.** Pre-battle AC ignores permanent modifiers; the +2 AC relic now
  goes on `acVariance`.
- **The hold armed a countdown anyway.** The timer was set, announced, and a ring event
  rolled before the fire-time check skipped the fight. `Ring.holdForMegaBoss` now runs before
  arming, and the 2-minute reminder stops a countdown already running.
- **Retries and restarts.** A long fight's retries kept the original saved time, so a restart
  after the 10-minute grace rolled tomorrow; each retry now saves the current time. A restart
  just past its time announced it "in 1 minute" before arriving; it now arrives unannounced.
