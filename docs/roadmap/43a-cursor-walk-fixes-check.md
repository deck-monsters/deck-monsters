---
type: Roadmap
title: Small fixes from the walk, live check
description: Cursor's live browser checklist for roadmap 43 — the stacked Workshop on a phone, the header and Leaders at 390, the guide during a fight, revive and boss lines, the shop's Buy button, 30 starting coins, finished questions leaving the input, and the Fights list.
status: draft
audience: internal
tags: [roadmap, onboarding, web, console, cursor]
---
# 43a — Small fixes from the walk, live check (Cursor)

**Status:** Ready to run once [43](43-walk-fixes.md) is merged and deployed.

## Rules

- **Branch:** `cursor/walk-fixes-check-43a`, from `main`. Commit only your report there.
  Don't change code, don't open a pull request, and push only your own branch.
- **Where:** production, `https://deck-monsters.com`, with the test account. **Create a new
  room** so the character is new. Never play in `Game Night`, and don't touch Test Room A or
  B. Delete your room at the end.
- **Player-facing text:** every quoted string below is exact. Record what you see, word for
  word, when it differs.
- **Widths:** 390 × 844 unless an item says otherwise; 1440 × 900 where it says so. One
  screenshot per item.

## The checklist

Record each item as **pass** or **fail**, with a screenshot, in
`docs/reference/walk-fixes-check.md`. Give it front matter like the other `docs/reference`
files, link it from `docs/README.md`, and make sure `pnpm docs:check` passes.

### A. Start and the Workshop

1. A new character has 30 coins (`look at character`, or the shop's opening line).
2. Train a monster in the Console and a second in the Workshop. At 390 both monsters show,
   one above the other, with no sideways scroll and no dots. At 1440 they sit side by side.
3. The Workshop's first-deck note reads
   `Give {name} a full deck: tap a card in Your cards, then tap one of {name}'s empty slots. Fill all 9.`,
   and doing exactly that works.
4. Select two cards and move them to the other monster, then one card. The lines read
   `Moved 2 cards …` and `Moved 1 card …` (never `1 cards`).
5. Rename the room to something long (40+ characters) or use a long room name. At 390 the
   header shows it on one line ending in `…`; `DECK MONSTERS` and the ⚙ stay on one line.
6. Leaders at 390: the table's right edge shows a fade when more columns are off screen, and
   swiping inside the table reaches them. The page itself never scrolls sideways.

### B. The fight

7. Send a monster to the ring and summon a boss (or wait for one). Once the boss is in, the
   Console guide reads `{name} is in the ring. Watch The Ring: a fight starts when the countdown ends.`
   with no summon chip. During the fight it reads `{name} is fighting. Watch The Ring.`
8. While a boss stands in the ring, the header shows no `boss in ~…`. Hovering (1440) the
   summons badge shows
   `Bosses you summon. The house also sends one on its own timer, which doesn't use yours.`
9. The boss arrives with `… enters the ring, sent by the house (👑 The Editor).` Its card says
   `{boss}'s orders:` and shows no `Fights: … · Won: …` line. Your monster's card still shows
   its record.
10. A turn line reads `It's {your name}'s turn. {monster} plays the next card in {his|her|their} deck.`
11. If your monster falls, revive it. The line reads
    `{name} has begun to revive. {He} {is|are} a beginner monster, so {he} {comes|come} back right away, with 1 HP. Monsters heal a little at a time while they rest.`
12. Fights tab: the row reads `… · Card found: {card}` when a card dropped. Tapping the row
    shows `Loading the play-by-play…` briefly, then the events. Note anything else you see.

### C. The shop and items

13. `buy items`: the pick button reads `Buy items`, then `Buy 1 item` / `Buy 2 items` as you
    pick. Pick two copies of one item if you can afford it. The confirm reads
    `{Item ×2 and …} from {shop} for {n} coins. Buy them? (yes/no)` and the receipt
    `Sold: {items}. {name} has {n} coins left. Use an item with use, or give it to a monster with give.`
14. `use Sorting Hat` asks
    `Put on the Sorting Hat? It sorts {name} into one of four teams, and is used up. (yes/no)`.
15. With no items left: `look at items` says
    `You have no items. Buy some with buy items, or win them in fights.`, and
    `give {item} to {monster}` says
    `{name} has no items {monster} can use. Used items are gone; buy more in the shop.`

### D. Questions that are over (the hardest one)

16. Start `equip {monster}` and leave the question open past 2 minutes (it times out). The
    question's buttons disappear for the tombstone, and the next line you type (`help`) runs
    as a command, the first time.
17. Start `equip {monster}`, then reload the page while the question is open, wait for it to
    time out on the server (2 minutes), then type `help`. It runs the first time; you never
    see `Prompt is no longer active` for a line that wasn't an answer.
18. Start two questions one after the other (answer the first, the next appears). Only the
    newest question's buttons are live; older ones are greyed or tombstoned.
19. Turn the network off (DevTools offline) with a question open, click an answer, turn it
    back on. The question comes back live, and you can answer it.

## Report

Add to the end of `docs/reference/walk-fixes-check.md`:

- **Not reached:** each item you couldn't reach, and why.
- **Anything else confusing:** with a screenshot.

## Prompt (paste whole into Cursor)

```text
Read docs/roadmap/43a-cursor-walk-fixes-check.md in the deck-monsters repo. Create a branch
cursor/walk-fixes-check-43a from main. Follow its Rules, then check every numbered item at
https://deck-monsters.com in a new room you create, at 390 x 844 (and 1440 x 900 where an
item says so), recording pass or fail with a screenshot in docs/reference/walk-fixes-check.md
as the checklist says. Link it from docs/README.md, make sure pnpm docs:check passes, commit
to your branch, and push it. Do not change code, do not open a pull request, and delete your
room when you finish.
```
