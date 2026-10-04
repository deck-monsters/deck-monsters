---
type: Roadmap
title: Card guides and training wizard, live check
description: Cursor's live browser checklist for roadmap 44, covering the training wizard, card details and level unlocks in the Workshop, the grouped card guide, look at cards for a monster, the shop's Buy buttons and the walk-fixes follow-ups.
status: draft
audience: internal
tags: [roadmap, cards, workshop, onboarding, cursor]
---
# 44a — Card guides and training wizard, live check (Cursor)

**Status:** Ready to run once [44](44-guides-cards-and-training.md) is merged and deployed.

## Rules

- **Branch:** `cursor/guides-wizard-check-44a`, from `main`. Commit only your report there.
  Don't change code, don't open a pull request, and push only your own branch.
- **Where:** production, `https://deck-monsters.com`, with the test account. **Create a new
  room** so the character is new. Never play in `Game Night`, and don't touch Test Room A or
  B. Delete your room at the end.
- **Player-facing text:** every quoted string below is exact. Record what you see, word for
  word, when it differs.
- **Widths:** 390 × 844 unless an item says otherwise; 1440 × 900 where it says so. One
  screenshot per item.
- **One tab, one device.** Item 17 checks a bug that a second tab could also cause.

## The checklist

Record each item as **pass** or **fail**, with a screenshot, in
`docs/reference/guides-wizard-check.md`. Give it front matter like the other `docs/reference`
files, link it from `docs/README.md`, and make sure `pnpm docs:check` passes.

### A. The training wizard (Workshop)

1. Open the Workshop in the new room and press `Train monster`. The first screen is
   `About you` (`Step 1 of 6`) with
   `This is you, the beastmaster. Your monsters fight; you train them.`
2. `Next` is greyed until the step is filled in. `Back` keeps what you typed.
3. `Pick a type`: one card per type, each with its summary and
   `Class: {class} · Signature card: {card}`. Pick Dragon.
4. `Pronouns`: `Which pronouns should we use for your Dragon?`
5. `Name`: `Suggestions:` shows two names. Tapping one fills the box. `More names` gives two
   others. Neither is the name of a monster already in the room.
6. `Look`: the question is the Dragon's (for she/her, `What should her scales look like?`).
   With the box empty, the line under `In {name}'s description:` shows the example, greyed.
   As you type, it changes live (`Her scales are …`).
7. `Ready`: `{name} the Dragon`, the pronouns, the look line, and
   `The rest of {name}'s description is drawn when she answers your call.` Press
   `Train {name}`. The monster answers your call, and its description really contains the
   look line.
8. Train a second monster with a name already in the room. The wizard goes back to `Name`
   with the server's message.

### B. Card details and unlocks (Workshop)

9. Each card in a monster's deck and in `Your cards` has an ⓘ. At 390 it's a strip under
   the card, easy to tap without selecting the card. At 1440 it's a corner badge.
10. Tap ⓘ on Hit: the sheet shows the card, `Level: Beginner`, `Used by: Any monster`,
    `Price: …`, and `{monster} can use this.` `Close` closes it; so do Escape and a tap
    outside.
11. Tap ⓘ on a card your monster can't use (a card for another type) and on one it can't use
    yet (a higher level). The lines read `{monster} can't use this. Only {list} can.` and
    `{monster} can use this from level {n}. {monster} is level {m} now.`
12. Each monster panel shows `At level {n}: {cards}.` for the next level that opens cards.
13. Slots are labelled `ATTACK`, `AREA`, `HEAL`, `DEFENCE` or `TRICK`. The list of unequipped
    cards is headed `Your cards`.

### C. Guides and the Console

14. Help and guides → Cards opens with `How to read a card:` and a `Jump to:` row. The groups
    are Attacks, Area attacks, Healing, Boosts and defence, Tricks and curses, then
    `What each type can hold` with a table per type. Each card shows its numbers. `Items are
    in the Items guide.` opens the Items tab, which ends with `Every item`.
15. In the Console, `look at cards for {monster}` lists `{monster} can use these cards now:`,
    a line per role, then `Later:` with `Level {n}: …` lines. `help cards` lists the command.

### D. The shop and the walk-fixes follow-ups

16. `visit the shop`, pick cards: the button reads `Buy cards`, then `Buy 1 card` /
    `Buy 2 cards`. If the Back Room offers a pick, its button reads `Buy` / `Buy {n}`.
17. Buy an item. The yes/no confirm appears without an `Action cancelled.` line above it.
18. Reload the page, then type `help` as the first command. It runs; it is not answered with
    `Prompt is no longer active`. Repeat twice.
19. Send your monster to the ring and let a fight run. During the fight the guide reads
    `{name} is fighting. Watch The Ring.`, including during a second fight, when it would
    otherwise suggest changing a card. Allow a few seconds.
20. The Console chip reads `Look at monsters`, and typing `look at my monsters` works.

## Report

Add to the end of `docs/reference/guides-wizard-check.md`:

- **Not reached:** each item you couldn't reach, and why.
- **Anything else confusing:** with a screenshot.

## Prompt (paste whole into Cursor)

```text
Read docs/roadmap/44a-cursor-guides-and-wizard-check.md in the deck-monsters repo. Create a
branch cursor/guides-wizard-check-44a from main. Follow its Rules, then check every numbered
item at https://deck-monsters.com in a new room you create, at 390 x 844 (and 1440 x 900
where an item says so), recording pass or fail with a screenshot in
docs/reference/guides-wizard-check.md as the checklist says. Link it from docs/README.md, make
sure pnpm docs:check passes, commit to your branch, and push it. Do not change code, do not
open a pull request, and delete your room when you finish.
```
