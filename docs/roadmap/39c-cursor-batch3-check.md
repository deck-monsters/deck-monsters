---
type: Roadmap
title: In-game help, batch 3 live check
description: Roadmap 39 batch 3's checklist for Cursor's live browser check — command help, button titles, place lines, first-time fight notes and the guided start — with the exact text each item must show.
status: draft
audience: internal
tags: [roadmap, onboarding, help, web, cursor]
---
# 39c — Batch 3 live check (Cursor)

**Status:** Checked (2026-10-01). Results are in
[the batch 3 live check](../reference/help-check-batch3.md). Claude built
[batch 3](39-in-game-help.md#batch-3-tasks-4-6-and-7-2026-09-30). Cursor drove a real browser.
Claude reviews the branch and writes any new player-facing text. This check drafted none.

## Rules

- **Branch:** work on `cursor/help-check-39c`, created from `claude/unicorn-monster-cards-cigpmw`.
  Commit in small steps, push only your own branch, and do not open a pull request.
- **Player-facing text:** every string below is exact. Never reword one. If you need a line
  that is not here, write a short placeholder marked `// DRAFT(39)` in the code, and list it
  under "Strings for Claude" in your report.
- **Fix only what is small,** like a broken layout, a control that does nothing, a label that
  is cut off, or a missing disabled state. Use one commit per fix, list each in the report,
  and run the gate before your last push: `pnpm build`, `pnpm lint`, `pnpm test`,
  `pnpm --filter @deck-monsters/web test`, `pnpm run build:docs`, `pnpm docs:check`.
  Anything needing new words or a design decision goes in the report only.
- **Read first:** `CLAUDE.md`, [local testing](../operations/local-testing.md) (how to run the
  app, the reusable rooms, and "Staging a fight quickly"), and
  [web workspace](../architecture/web-workspace.md).
- **Widths:** check at 390 × 844 (a phone) and 1440 × 900, with a screenshot of every item at
  the width where it matters.
- **Rooms:**
  - Test Room A is for an existing player.
  - The guided start needs a **brand-new player**, so use a throwaway room you create (see
    "Throwaway rooms" in local testing). Never create a character in Test Room B.
  - Delete the throwaway room at the end.
- **Local storage:** the first-time notes and the guide remember what a player has seen in
  local storage. To see them again, clear `mechanicsExplained:*`, `ftuxComplete*` and
  `ftuxStarted*` in DevTools. Note in your report every time you cleared them.

## The checklist

Record each item as **pass** or **fail**, with a screenshot, in
`docs/reference/help-check-batch3.md`. Give it front matter like the other `docs/reference`
files, link it from `docs/README.md`, and make sure `pnpm docs:check` passes.

### A. Command help (Console)

1. `help` ends its command list with
   `Type help and a word to see those commands with an example, like help preset.`, followed
   by the "One Thing Worth Knowing" block.
2. `help preset` prints `Commands with "preset":`. Under it are four preset commands, each
   with its description and a `Try: …` line.
3. `help zzz` prints `No command has "zzz" in it. Type help to see them all.`
4. These now work in Test Room A, using names that exist there:
   - `look at Fang` shows the monster;
   - `look at Hit` shows the card;
   - `look at Potion of Healing` shows the item, or says plainly that you have none.

   `look at` on its own is still not recognised as a command.

### B. Buttons and places

5. Hover on desktop over each button below. Each tooltip reads exactly as shown:

   | Button | Tooltip |
   |---|---|
   | ☰ | `Open the menu` |
   | a monster's **Unequip all** | `Move all of {name}'s cards back to your cards` |
   | the Workshop's **Train monster** | `Choose a type, a name and a look for a new monster` |
   | Preset **Load** | `Replace the monster's deck with this preset's cards` |
   | the Ring's **↓ Latest** | `Jump to the newest events` |

   Spot-check five more buttons of your choice. Every button should show a tooltip that says
   what it does.
6. On a phone, a monster's actions read **Send to ring** and **Unequip all** (no ⟲ icon). Both
   fit on one line inside the monster card.
7. Hover over each tab: the tooltip is the place's description.
   - The Ring: `Watch the fight as it happens: who is in, whose turn it is, and every card played.`
   - Console: `Type commands and answer the game's questions. Type help to see them all.`
   - Workshop: `Train monsters, choose their cards, and spend your coins.`
   - Fights: `Every fight in this room, with its play-by-play.`
   - Leaders: `Who is winning, in this room and across every room.`

   The Fights and Leaders headings show their line underneath, as the Workshop does.
8. With no fight on, the Ring reads
   `No fight yet. A fight starts when two monsters are in the ring: send one of yours, or summon a boss.`
9. In the room lobby:
   - the OWNER tag's tooltip is `You made this room: you can invite players, reset it or delete it`;
   - a MEMBER tag's tooltip is `You joined this room with its invite code`, if the account has one;
   - the empty fields read `e.g. The Editor's Ring` and `e.g. ABC12345`.
10. On a phone, **Train monster** is the width of its label, left-aligned under
    `Train a new monster to fight at your side. You can train {n} more.` There is no big empty gap
    above it, and no lone ⤢ on a line of its own: the ⤢ sits top-right, level with "Workshop".

### C. First-time fight notes

11. Stage a fight in Test Room A (see "Staging a fight quickly"). The first time a boss arrives
    with a temperament line, the line under it reads:
    `ⓘ Every boss has a temperament that decides which challenger it goes after. The line above says this one's.`
    The note shows in the Ring or the Console, not in both. A second boss arriving later
    shows no note.
12. Reload the page. The note does not come back.
13. A ring event. Try `trigger event blood-feud` (or `gauntlet`). It is admin-only: if it is
    refused, record "not reachable" and skip to 14. If it is accepted, the event's banner gets
    its note on first sight. For Blood Feud the note reads:
    `ⓘ A ring event changes one fight. In a Blood Feud there are no teams: teammates fight each other too.`
14. Ambushes and "The bosses turn on one another" are random. Record whether you saw either.
    If you did, its note should read:
    - ambush: `ⓘ An ambush brings one boss more than usual. It is a lesser minion and starts with a third of its health.`
    - rivals: `ⓘ When bosses outnumber the challengers, they fight each other as well as your monsters.`
15. Returning-player check:
    1. Clear `mechanicsExplained:*`.
    2. Reload with a fight's history in the Ring.
    3. The note should appear on the **newest** temperament line, the one you land on, not on
       an old line scrolled out of view.

### D. The guided start (throwaway room, brand-new player, phone first)

16. Join the throwaway room and open the Console. The guide reads
    `Welcome, Beastmaster. Train your first monster to begin.`, with a `train a monster` chip and
    the hint `New here? Help and guides in the ☰ menu has the rules.` The Workshop shows no
    guide box at this step: its own first-run form covers training.
17. Train a monster called, say, Pip. The Console guide reads
    `Give Pip a full deck of 9 cards.` (with a chip `equip Pip`). The Workshop, under the Train
    row, reads `Give Pip a full deck: tap an empty slot to add cards until all 9 are filled.`
18. Fill the deck in the Workshop. Both now read the send step:
    - Console: `Pip's deck is full. Send Pip to the ring.`, with a chip `send Pip to the ring`;
    - Workshop: `Pip's deck is full. Press Send to ring.`
19. Send Pip. The waiting step reads:
    - Console: `Pip is in the ring. A fight starts when a second monster joins. Nobody else here? Summon a boss.`,
      with a `summon a boss` chip and the hint `You can summon 3 bosses a day.`;
    - Workshop: `Pip is in the ring. A fight starts when a second monster joins. Nobody else here? Type summon a boss in the Console.`
20. Summon a boss and let the fight finish.
    - If Pip falls, the guide reads `Pip has fallen. Revive Pip to fight again.` (chip `revive Pip`;
      hint `Above level 0, a revival takes a few minutes.`). The Workshop reads
      `Pip has fallen. Press Revive to bring Pip back.`
    - If Pip lives, or once Pip is revived, the guide reads
      `Pip has fought a fight. Now try changing a card. Type help unequip to see how, or use the Workshop.`
      (chip `help unequip`). The Workshop reads
      `Pip has fought a fight. Now try changing a card: tap one of Pip's cards, then tap an empty slot or your cards to move it.`
21. Do what the Workshop line says: tap a card, then your cards. The guide disappears from
    both places.
22. Dismissal and memory:
    - Reload: the guide stays gone.
    - Open Test Room A: no guide, because the account is an established player there.
    - In a second new throwaway room the guide shows again, on its own.
    - Dismiss it with ✕ in the Console: it also disappears from that room's Workshop.
23. While a Console question is open (for example, mid-`equip`), the Workshop's guide box
    hides.

## Report

Add these sections to the end of `docs/reference/help-check-batch3.md`:

- **Fixed on the way:** each small fix, with its SHA.
- **Strings for Claude:** every `DRAFT(39)` placeholder, where it shows, and what it must say.
- **Not reached:** each item you could not reach, and why.
- **Anything else confusing** that you met along the way, with a screenshot.

## Prompt (paste whole into Cursor)

```text
Read docs/roadmap/39c-cursor-batch3-check.md in the deck-monsters repo. Fetch and check out
branch claude/unicorn-monster-cards-cigpmw, then create your own branch cursor/help-check-39c
from it. Follow the Rules section, then check every numbered item in "The checklist" in a real
browser at 390 x 844 and 1440 x 900, recording pass or fail with a screenshot in
docs/reference/help-check-batch3.md. Commit to your branch only, never push to
claude/unicorn-monster-cards-cigpmw, and do not open a pull request. Push your branch when you
finish.
```
