---
type: Roadmap
title: Feed wording and turn order live check
description: Roadmap 49's checklist for Cursor's live browser check — Workshop status and level labels, the Ring footer and Latest button, the stat block, and the new turn order in the fight feed — with the exact text each item must show.
status: draft
audience: internal
tags: [roadmap, combat, feed, workshop, web, cursor]
---
# 49b — Feed wording and turn order live check (Cursor)

**Status:** Checked 2026-10-12. The report is [turn-order-check-49b](../reference/turn-order-check-49b.md).
Claude built [roadmap 49](49-feed-and-turn-order-pass.md) on `claude/feed-and-workshop-ux-pass`.
Claude reviews the report and writes any new player-facing text.

## Rules

- **Branch:** work on `cursor/turn-order-check-49b`, created from
  `claude/feed-and-workshop-ux-pass`. Commit in small steps, push only your own branch, and do
  not open a pull request.
- **Player-facing text:** every string below is exact. Never reword one. If you need a line
  that is not here, write a short placeholder marked `// DRAFT(49)` in the code, and list it
  under "Strings for Claude" in your report.
- **Fix only what is small,** like a broken layout, a label that is cut off, or a control that
  does nothing. One commit per fix, each listed in the report. Run the gate before your last
  push: `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm --filter @deck-monsters/web test`,
  `pnpm run build:docs`, `pnpm docs:check`. Anything needing new words, or any change to the
  order of fight lines, goes in the report only: the order is a rule, pinned by
  `packages/engine/src/cards/turn-order.test.ts`.
- **Read first:** `CLAUDE.md`, [local testing](../operations/local-testing.md) (running the
  app, the reusable rooms, "Staging a fight quickly"), and the "Turn order" table in
  [cards and encounter effects](../architecture/cards-and-encounter-effects.md).
- **Widths:** 390 × 844 (a phone) and 1440 × 900. Screenshot every item at the width where it
  matters. Check A and B in **both** themes, Phosphor and Millefleur.
- **Rooms:** Test Room A for an existing player. A throwaway room you create for a level-0
  monster if Test Room A has none (see "Throwaway rooms"); delete it at the end.
- **Local storage:** the first-time notes remember what a player has seen. To see them again,
  clear `mechanicsExplained:*` in DevTools, and note in your report each time you did.

## The checklist

Record each item as **pass**, **fail**, or **not reached** (for fight lines that depend on
which cards come up), with a screenshot, in a new `docs/reference/turn-order-check-49b.md`.
Give it front matter like the other `docs/reference` files, link it from `docs/README.md`, and
make sure `pnpm docs:check` passes.

### A. Workshop

1. A benched, living monster whose deck is short (unequip one card if needed) shows the status
   `Needs cards`, in dim ink, not green. Beside it the deck line still reads
   `Deck 8/9 · needs 1 more to enter the ring`, and Send to ring is disabled.
2. The same monster with a full deck shows `Ready` (green dot in Millefleur).
3. A level-0 monster's subtitle reads `<Type> · Beginner` (with its pronouns after, if set),
   never `Lvl 0`. A levelled monster still reads `Lvl 2`. The XP bar's next goal still reads
   `Lvl 1 ›`.
4. Tap a monster's name. Under the actions the hint reads
   `Your cards show only what <name> can use. Tap the name again to show all.` Tap the name
   again: the hint goes and every card is back.
5. Desktop only: hover Revive on a fallen monster. The title reads
   `Bring <name> back. A Beginner is back at once; after level 1 it takes a few minutes`.
6. Console: `look at card inventory` lists a level-0 monster as `<name> [<Type>, Beginner]`.

### B. Ring

1. Scroll up in the Ring feed during a fight so `↓ Latest` appears. No feed text shows through
   the button: it is solid, with a soft shadow.
2. While a fight is on, the footer reads `Previous fight: … (#N)`. When it ends, the footer
   reads `Last fight: … (#N+1)`.
3. A boss's arrival card shows `Level: Beginner` for a level-0 boss (not `beginner`), and a
   line starting `Roll bonuses:` with entries like `+5 to hit`, `+5 to damage`,
   `+4 on int rolls`. No line reads `+1 dex bonus`.

### C. Fight order (summon bosses; watch several fights)

Bosses carry Fire Breath, Take Wing, Helm of Awe and Blink often enough to show these in a few
fights. Use `summon a boss` (three a day) with a monster in the ring, and Test Room A's own
fights. Mark anything you never see **not reached**; the unit tests pin the order, and this is
about how it reads on a phone.

1. **Winded ends above the card.** After a Fire Breath (`… is winded, and smoke trails from
   her nostrils. (-2 ac until her next card.)`), that monster's next turn shows, in order:
   `<name> has her breath back.`, then `<name>'s ac is back to N (increased by 2)`, then
   `<name> lays down the following card:`. Nothing reads `, total)`.
2. **Random Play.** A monster's statuses (breath back, `🔥 … is still burning: N fire damage.`)
   come *above* the Random Play card box, not between it and
   `The ancient scraps crumble in <name>'s hands — and reassemble into something else...`.
3. **Time-shift skips the turn.** A monster that reads
   `<name> is currently ⏳ time-shifted for 1 more turn by <angel>.` shows no card box that
   turn, and no burn tick or `has her breath back` either. The first time, the note under it
   reads `ⓘ A time-shifted monster loses its whole turn: no card, and no time passes for it, so
   its burns, penalties and boosts all wait. Each turn it stays shifted, the monster that
   shifted it steals a little of its HP and XP.`
4. **Level drop.** After a Blink drain, a line reads
   `<icon> <name>'s xp is now N (decreased by M). <name> drops to level L for this fight.`, and the roster
   row's `Lvl` and `AC` change at the same moment. The first time, the note reads
   `ⓘ Level comes from XP, so XP drained or gained in a fight moves the level, and max HP and
   AC with it, until the fight ends.`
5. **The dive follows the card.** `<name> folds her wings and dives!` appears *under* that
   monster's card box, never on a turn with no card box.
6. **A held flier falls.** When a flying monster is held or awed:
   `<name> falls out of the sky! No dive this time.`
7. **A Heal puts out a burn.** A burning monster that plays Heal (or a Random Play that becomes
   one) shows the Heal box, then `<name> beats out the flames.`, and takes no burn damage that
   turn.
8. **Exposed ends with a reason.** An ancient dragon's guard coming back reads
   `<name> gathers her wits, and her guard is up again.` before the ac line.

9. **Tipsy.** Equip a monster with three or more Whiskey Shots (or let a boss with drinks play).
   On the third drink in one round, a roll line reads `… vs 10 to hold his third drink this
   round.`; on a miss, `🥃 <name> is tipsy! (-1 dex and -1 int for his next 2 cards.)` with the
   first-time note `ⓘ Three Whiskey Shots or Scotches in one round can leave a monster tipsy: -1
   dex and -1 int for its next two cards. Strength helps it hold its drink.` Two cards later,
   above that turn's card box: `<name> sobers up.`

## Report

List per item: pass / fail / not reached, the screenshot path, and for any fail what you saw.
Then "Fixes" (commits) and "Strings for Claude".
