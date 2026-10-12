---
type: Reference
title: Live check of feed wording and turn order
description: Pass, fail, and not-reached record of roadmap 49's Workshop labels, Ring footer, and fight-line order, checked locally at 390×844 and 1440×900.
status: stable
audience: internal
tags: [feed, workshop, combat, verification]
---

# Live check of feed wording and turn order

Checked on 2026-10-12 against the local app, on branch `cursor/turn-order-check-49b`, from `claude/feed-and-workshop-ux-pass`. The checklist is [49b](../roadmap/49b-cursor-check.md).

The room was Test Room A. Phone shots are 390×844. Desktop shots are 1440×900. Phosphor and Millefleur were both checked for sections A and B. The API was restarted on a fresh `@deck-monsters/engine` build before the console and fight checks, so the running server matched the branch. `mechanicsExplained:*` was cleared before the fights; no such keys were stored. The beastmaster's name is redacted to `Trainer` in the Ring shots.

Fang entered the later fights at 1 HP. A beginner revive puts him back at once with 1 HP, and the three boss fights ended in about a round, before Fire Breath, Blink, Take Wing, or a third drink came up. No summons were left after Kissirri.

## A. Workshop

| Item | Result | What was on screen |
|---|---|---|
| 1. Needs cards | Pass | A short deck reads `Needs cards` in Millefleur, in dim ink `rgb(105, 92, 140)`, with a dim dot. Beside it: `Deck 8/9 · needs 1 more to enter the ring`. Send to ring is disabled. Phosphor draws that same label in the theme's small capitals, so the player reads `NEEDS CARDS`, in dim ink `rgb(90, 112, 80)`. |
| 2. Ready | Pass | A full deck reads `Ready`. In Millefleur the word and the dot are the success green `rgb(31, 107, 87)`. In Phosphor the tag is `READY` with a green dot `rgb(136, 204, 68)`. Send to ring is enabled. |
| 3. Beginner, and Lvl 2 | Pass for Beginner and the XP goal. `Lvl 2` was not reached. | Fang: `Basilisk · Beginner · he/him`. Chuvvo: `Gladiator · Beginner · he/him`. Neither subtitle reads `Lvl 0`. The XP goal reads `Lvl 1 ›`. Both monsters are Beginner, so a levelled subtitle was not on screen. |
| 4. Name filter | Pass | Tapping Fang's name shows `Your cards show only what Fang can use. Tap the name again to show all.` Tapping again removes the hint. The inventory heading adds `Showing cards usable by Fang (20/21).` and, after one more card was unequipped, `Showing cards usable by Fang (21/22).` The cards stay listed. Clearing the filter removes that line. |
| 5. Revive title | Pass | Hovering Revive on Chuvvo, in both themes, shows `Bring Chuvvo back. A Beginner is back at once; after level 1 it takes a few minutes`. |
| 6. Card inventory | Pass | `look at card inventory` lists `Fang [Basilisk, Beginner]  9/9 slots` and `Chuvvo [Gladiator, Beginner]  9/9 slots`. |

![Needs cards, Millefleur, phone](turn-order-check-49b/a1-needs-390-millefleur.png)

![Needs cards, Phosphor, phone](turn-order-check-49b/a1-needs-390-phosphor.png)

![Needs cards, Millefleur, desktop](turn-order-check-49b/a1-needs-1440-millefleur.png)

![Needs cards, Phosphor, desktop](turn-order-check-49b/a1-needs-1440-phosphor.png)

![Ready, Millefleur, phone](turn-order-check-49b/a2-ready-390-millefleur.png)

![Ready, Phosphor, phone](turn-order-check-49b/a2-ready-390-phosphor.png)

![Ready and Fallen, Millefleur, desktop](turn-order-check-49b/a2-ready-1440-millefleur.png)

![Ready, Phosphor, desktop](turn-order-check-49b/a2-ready-1440-phosphor.png)

![The filter hint, Phosphor, phone](turn-order-check-49b/a4-filter-on-390-phosphor.png)

![The hint is gone, Phosphor, phone](turn-order-check-49b/a4-filter-off-390-phosphor.png)

![The filter hint, Millefleur, desktop](turn-order-check-49b/a4-filter-on-1440-millefleur.png)

![Your cards, filtered for Fang](turn-order-check-49b/a4-your-cards-on-1440-millefleur.png)

![Revive title, Phosphor](turn-order-check-49b/a5-tooltip-screen-phosphor.png)

![Revive title, Millefleur](turn-order-check-49b/a5-tooltip-screen-millefleur.png)

![Card inventory, Phosphor, phone](turn-order-check-49b/a6-inventory-390-phosphor.png)

![Card inventory, Phosphor, desktop](turn-order-check-49b/a6-inventory-1440-phosphor.png)

## B. Ring

| Item | Result | What was on screen |
|---|---|---|
| 1. Latest | Pass | Scrolling the feed during a fight shows `↓ Latest` at both widths, in Phosphor and Millefleur. The fill is opaque (opacity 1): Phosphor uses `rgb(10, 14, 10)` under a solid tint, Millefleur uses `rgb(251, 248, 245)` under a solid tint. The shadow is `0 2px 8px` at 0.18 black. Feed text sits under the button and does not read through it. |
| 2. Footer | Fail | While a fight is on, the footer is right. During Akhazriel it read `Previous fight: Fang vs Hoyalli (#10)`. During Kissirri it read `Previous fight: Akhazriel vs Fang (#11)`. When the win line was already on screen, and still 1.5s later, the label had flipped to `Last fight` but it still named the previous fight: `Last fight: Fang vs Hoyalli (#10)` under `Akhazriel wins!`, and `Last fight: Akhazriel vs Fang (#11)` under `Kissirri wins!` at both widths. Leaving for the Workshop and coming back to the Ring then read `Last fight: Kissirri vs Fang (#12)`, on a feed that still showed `Kissirri wins!`. |
| 3. Boss card | Pass | Akhazriel, a level-0 Weeping Angel: `Level: Beginner \| XP: 10` and `Roll bonuses: +1 to hit, -1 to damage, +2 on int rolls`. Kissirri, a level-0 Gladiator: `Level: Beginner \| XP: 4` and `Roll bonuses: +1 to hit, +1 to damage`. Hoyalli was level 1 and read `Level: 1 \| XP: 44`. No line read `+1 dex bonus` or `Level: beginner`. |

![Latest, Phosphor, phone](turn-order-check-49b/b1-latest-phosphor-390.png)

![Latest, Phosphor, desktop](turn-order-check-49b/b1-latest-phosphor-1440.png)

![Latest, Millefleur, phone](turn-order-check-49b/b1-latest-millefleur-390.png)

![Latest, Millefleur, desktop](turn-order-check-49b/b1-latest-millefleur-1440.png)

![Previous fight during Akhazriel, phone](turn-order-check-49b/b2-during-phosphor-390.png)

![Previous fight during Akhazriel, desktop](turn-order-check-49b/b2-during-phosphor-1440.png)

![Previous fight during Kissirri](turn-order-check-49b/b2-during-millefleur-390.png)

![Akhazriel wins, footer still Hoyalli (#10)](turn-order-check-49b/b2-after-phosphor-390.png)

![Kissirri wins, footer still Akhazriel (#11), phone](turn-order-check-49b/b2-after-millefleur-390.png)

![Kissirri wins, footer still Akhazriel (#11), desktop](turn-order-check-49b/b2-after-millefleur-1440.png)

![A later visit: Last fight, Kissirri vs Fang (#12)](turn-order-check-49b/b2-footer-now-390.png)

![Akhazriel, Level Beginner, Phosphor, phone](turn-order-check-49b/b3-arrival-phosphor-390.png)

![Akhazriel, Level Beginner, Phosphor, desktop](turn-order-check-49b/b3-arrival-phosphor-1440.png)

![Kissirri, Level Beginner, Millefleur, phone](turn-order-check-49b/b3-arrival-millefleur-390.png)

## C. Fight order

Three summons: Hoyalli (Gladiator, level 1), Akhazriel (Weeping Angel, Beginner), Kissirri (Gladiator, Beginner). Fang was on 1 HP for the second and third, and each of those ended in one round.

| Item | Result | What was on screen |
|---|---|---|
| 1. Winded ends above the card | Not reached | No Fire Breath, no `has her breath back`, no `ac is back to`. |
| 2. Random Play | Not reached for a status above the box | Akhazriel's Random Play read, in order: `Akhazriel lays down the following card:`, the Random Play box, then `The ancient scraps crumble in Akhazriel's hands — and reassemble into something else...`. That turn had no breath or burn line to place. |
| 3. Time-shift | Not reached | Akhazriel did not play Blink before the fight ended. No time-shift line and no first-time note. |
| 4. Level drop | Not reached | No XP-drain line and no level note. |
| 5. The dive | Not reached | No `folds her wings and dives`. |
| 6. A held flier falls | Not reached | No `falls out of the sky`. |
| 7. A Heal puts out a burn | Not reached | No burning line and no `beats out the flames`. |
| 8. Exposed ends with a reason | Not reached | No `gathers her wits, and her guard is up again`. |
| 9. Tipsy | Not reached | No Whiskey Shot or Scotch was played. Fang is Beginner, so he cannot hold Whiskey Shot (level 2). No third-drink line, no `is tipsy!`, no `sobers up`. |

![Random Play, then the scraps line](turn-order-check-49b/c-random-p390.png)

## Fixes

| Commit | What |
|---|---|
| `d80baffe` | Millefleur painted Fallen with Ready's green. The later status-tag rule set every status to success green, and only Needs cards was restated after it. Fallen and in-ring colours are restated after that rule. Recorded as 10b #249. The Needs cards desktop Millefleur shot was taken before this fix, so Chuvvo's dot there is still that green. The Ready desktop Millefleur shot is after it. |

No fight line was reordered. No player-facing string was reworded.

## Strings for Claude

None. Phosphor's status tags are the existing small-capitals lettering (`NEEDS CARDS`, `READY`), not a new sentence.
