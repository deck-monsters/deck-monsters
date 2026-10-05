---
type: Reference
title: Live check of the guides and wizard
description: Pass and fail record of the roadmap 44 card guides and training wizard, checked on production at 390×844 and 1440×900.
status: stable
audience: internal
tags: [onboarding, workshop, cards, verification]
---

# Live check of the guides and wizard

Checked on 2026-10-05 at <https://deck-monsters.com>, on branch `cursor/guides-wizard-check-44a`, from `main` at `13ace44b`. The checklist is [44a](../roadmap/44a-cursor-guides-and-wizard-check.md).

The room was `Scratch guides wizard 2026-10-05`, created for this check and deleted at the end. The character is Ada (she/her). The monster is Keleth, a Dragon (she/her). Phone shots are 390×844. The desktop shot is 1440×900. One browser tab.

## A. The training wizard

| Item | Result | What was on screen |
|---|---|---|
| 1. About you | Pass | Workshop, `Train monster`. `Step 1 of 6`, `About you`, and `This is you, the beastmaster. Your monsters fight; you train them.` |
| 2. Next greyed, Back keeps the text | Pass | With the name box empty, `Next` was disabled (opacity 0.5). A click on it stayed on `Step 1 of 6`. `Back` from `Pick a type` returned to `About you` with `Ada` and `she/her` still filled in. |
| 3. Pick a type, Dragon | Pass | Each type is one card with its summary and `Class: {class} · Signature card: {card}`. Dragon reads `Class: Wizard · Signature card: Fire Breath`. Dragon was selected. |
| 4. Pronouns | Pass | `Which pronouns should we use for your Dragon?` `she/her` selected. |
| 5. Name suggestions | Pass | `Suggestions:` showed `Syralth` and `Favnir`. `More names` replaced them with `Nelarth` and `Cadreinth`. Tapping a suggestion filled the box (`Keleth`). The room had no monster yet, so none of those names was already in it. |
| 6. Look | Pass | `What should her scales look like?` With the box empty, the line under `In Keleth's description:` is the grey example `Her scales are deep-sea blue with an ember-red belly.` Typing `copper and gold` changed it live to `Her scales are copper and gold.` and enabled `Next`. |
| 7. Ready, then the description | Pass | `Keleth the Dragon`, `Pronouns: she/her`, `Her scales are copper and gold.`, and `The rest of Keleth's description is drawn when she answers your call.` `Train Keleth` produced `Keleth the Dragon answers your call.` `look at Keleth` includes `Her scales are copper and gold, and she keeps to the cold deep.` |
| 8. Name already taken | Pass | A second train, completed with the name `Keleth`, returned to `Name` (`Step 3 of 5`) with `That monster name is already taken.` |

![About you, step 1 of 6](guides-wizard-check/01-about.png)

![Next is grey while the name is empty](guides-wizard-check/02-next-grey.png)

![Back kept Ada and she/her](guides-wizard-check/02-back.png)

![Dragon selected, with class and signature card](guides-wizard-check/03-dragon.png)

![Which pronouns should we use for your Dragon?](guides-wizard-check/04-pronouns.png)

![Suggestions: Syralth and Favnir](guides-wizard-check/05-names.png)

![More names: Nelarth and Cadreinth](guides-wizard-check/05-more.png)

![Tapping a suggestion filled the name](guides-wizard-check/05-tapped.png)

![The look example, grey, before typing](guides-wizard-check/06-empty.png)

![The look line updates as you type](guides-wizard-check/06-typed.png)

![Ready: Keleth the Dragon](guides-wizard-check/07-ready.png)

![Keleth the Dragon answers your call](guides-wizard-check/07-call.png)

![The description contains the look line](guides-wizard-check/07-description.png)

![That monster name is already taken](guides-wizard-check/08-taken.png)

## B. Card details and unlocks

| Item | Result | What was on screen |
|---|---|---|
| 9. The ⓘ | Pass | Equipped Hit and the cards in `Your cards` each have an ⓘ. At 390 it is a strip under the card (Hit's measured 107×44, directly under a 107×92 card). At 1440 it is a 32×32 badge in the card's top-right corner. Tapping it opened the sheet. |
| 10. Hit's sheet, and closing it | Pass | `Level: Beginner`, `Used by: Any monster`, `Price: 10 coins`, and `Keleth can use this.` `Close`, Escape, and a tap outside each removed the sheet. The closed frame is after the outside tap. |
| 11. Can't use, and can't use yet | Pass for the other-type line. The higher-level line was not reached. | Sticketh: `Keleth can't use this. Only Unicorn can.` No card in the deck or in `Your cards` was above Beginner, so the level line never appeared. See Not reached. |
| 12. Next level | Pass | `At level 1: Asinine Companion, Cloak of Invisibility, Enchanted Faceswap, Fists of Villainy, Fists of Virtue, Harden, Molasses, Mood Scales, Soften, Tail Lash and The Kalevala.` |
| 13. Slot labels and Your cards | Pass | Cards in the deck and in `Your cards` are labelled `ATTACK`, `AREA`, `HEAL`, `DEFENCE`, or `TRICK`. The unequipped list is headed `Your cards`. An empty slot is `[+]` with accessible name `Empty slot` and no role word. |

![At 390 the ⓘ is a strip under Hit](guides-wizard-check/09-phone.png)

![At 1440 the ⓘ is a corner badge](guides-wizard-check/09-desk.png)

![Hit's detail sheet](guides-wizard-check/10-hit.png)

![The sheet is gone after a tap outside](guides-wizard-check/10-closed.png)

![Keleth can't use Sticketh](guides-wizard-check/11-other-type.png)

![At level 1, on the monster panel](guides-wizard-check/07-call.png)

![Your cards, with every role word](guides-wizard-check/13-roles.png)

## C. Guides and the Console

| Item | Result | What was on screen |
|---|---|---|
| 14. Cards guide, then Items | Pass | Cards opens with `How to read a card:` and `Items are in the Items guide.` The jump row is `Jump to: Attacks · Area attacks · Healing · Boosts and defence · Tricks and curses · What each type can hold`. Those groups follow. `What each type can hold` has a table per type (Basilisk is first). A card shows `Hit chance: 74% \| DPT: 3`. The Items link opens the Items tab. Its last heading is `Every item`. |
| 15. look at cards, help cards | Pass | `Keleth can use these cards now:` then a line per role, then `Later:` with `Level 1: …`, `Level 2: …`, and `Level 4: Scotch.` `help cards` lists `look at cards for [monster]`. |

![How to read a card](guides-wizard-check/14-read.png)

![Jump to, and the Attacks group](guides-wizard-check/14-jump.png)

![A card's numbers, then what each type can hold](guides-wizard-check/14-types.png)

![The Items tab ends at Every item](guides-wizard-check/14-items.png)

![look at cards for Keleth](guides-wizard-check/15-cards.png)

![help cards lists the command](guides-wizard-check/15-help.png)

## D. The shop and the walk-fixes follow-ups

| Item | Result | What was on screen |
|---|---|---|
| 16. Buy buttons | Pass | Card pick: `Buy cards` with nothing picked, then `Buy 1 card`, then `Buy 2 cards`. Back Room pick: `Buy` with nothing picked, then `Buy 1`. |
| 17. Item confirm | Pass | One tab. `Lottery Ticket from The Affordable Wisp for 17 coins. Buy it? (yes/no)` with no `Action cancelled.` line above it. Typing `yes` bought it: `Sold: Lottery Ticket. Ada has 13 coins left.` |
| 18. Reload, then help | Pass | Three times, reload and then `help` as the first command. Each time it printed the command reference. `Prompt is no longer active` did not appear. |
| 19. Guide during a fight, twice | Pass | Fight 1, within a few seconds of `The fight has begun!`: `Keleth is fighting. Watch The Ring.` After that fight the guide moved to changing a card. Fight 2 (Uxun, a summoned Basilisk) switched it back to `Keleth is fighting. Watch The Ring.` while `The fight has begun!` was on screen, and left it there until she fell. |
| 20. Look at monsters | Pass | The chip reads `Look at monsters`. `look at my monsters` printed Keleth's card. |

![Buy cards, nothing picked](guides-wizard-check/16-buy-cards.png)

![Buy 1 card](guides-wizard-check/16-buy-1.png)

![Buy 2 cards](guides-wizard-check/16-buy-2.png)

![Back Room: Buy](guides-wizard-check/16-back.png)

![Back Room: Buy 1](guides-wizard-check/16-back-1.png)

![The item confirm, with no Action cancelled line](guides-wizard-check/17-confirm.png)

![help after a reload](guides-wizard-check/18-help.png)

![First fight: Keleth is fighting](guides-wizard-check/19-fight1.png)

![Second fight: the same line, after the change-a-card step](guides-wizard-check/19-fight2.png)

![look at my monsters](guides-wizard-check/20-monsters.png)

## Not reached

- **Item 11, the higher-level line.** `{monster} can use this from level {n}. {monster} is level {m} now.` Every ⓘ in the Workshop belonged to a Beginner card. `look at cards for Keleth` lists her later cards (`Level 1`, `Level 2`, `Level 4`), and none of those were in `Your cards`. The shop's Tail Lash, one of the level 1 cards, cost 87 coins. Ada had 30, then 13 after the Lottery Ticket.

## Anything else confusing

- **The shop question is printed twice.** The card pick and the Back Room pick both show the `Choose one or more…` paragraph, then the same paragraph again above the buttons. [16-buy-cards.png](guides-wizard-check/16-buy-cards.png)
- **The yes/no confirm has no yes or no button.** Only `Cancel`, and the box says `Type your answer or click a choice`. Typing `yes` bought the ticket. [17-confirm.png](guides-wizard-check/17-confirm.png)
- **The taken-name sentence is shown twice.** Once in a banner at the top of the Workshop, and again under the suggestions. [08-taken.png](guides-wizard-check/08-taken.png)
- **The first summon said a boss was already waiting.** `send Keleth to the ring`, then `summon a boss`, answered `Every challenger in the ring already has a boss to face. Bring a friend into the ring, then summon another.` The fight still started, against Shanna. After it, a second `summon a boss` called Uxun. [19-fight1.png](guides-wizard-check/19-fight1.png)
