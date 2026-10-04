---
type: Roadmap
title: A first-time player's walk (Cursor)
description: Cursor's brief for playing Deck Monsters as a first-time player on a phone and a desktop, and writing up everything confusing or under-explained.
status: draft
audience: internal
tags: [roadmap, onboarding, help, cursor]
---
# 42a — A first-time player's walk (Cursor)

**Status:** Done (2026-10-04). Report: [new-player walk 2](../reference/new-player-walk-2.md); triage: [42 G](42-next-proposals.md#g-what-cursors-walk-found-and-where-it-goes).

## What this is for

Play Deck Monsters as someone who has never seen it, and write down every moment you are
unsure what something is, what will happen, why something was refused, or what to do next.
The last walk ([help inventory](../reference/help-inventory.md)) came before in-game Help,
the guided start, first-time notes, button titles and chat. This walk checks what a new
player meets now. **Judge as a newcomer, not as a tester:** "I didn't know what this meant"
is a finding even when the game is working as designed.

## Rules

- **Branch:** `cursor/new-player-walk-42a`, from `main`. Commit your report there. Don't
  change code, don't open a pull request, and push only your own branch.
- **Where:** production, `https://deck-monsters.com`, signed in with the test account
  (`TEST_USERNAME`). **Create a new room** for the walk, so you start as a new player: no
  character, no monsters. Never play in `Game Night`, and don't touch Test Room A or B.
  Delete your room at the end.
- **Don't read the docs first.** Don't open `docs/` or the code before or during the walk.
  Learn only from the game itself, including its Help and guides page. You may read the code
  afterwards to explain a finding.
- **Widths:** a phone at 390 × 844 for most of it; repeat the key moments at 1440 × 900.
  Take a screenshot of every finding at the width where you met it.
- **Chat:** a second account isn't required. If you have one, invite it with the room code
  and try chat between the two.

## The walk

Do roughly this, in whatever order a new player would. Note every detour.

1. **Join and start.**
   - Create the room and open it.
   - What do you think you're meant to do first?
   - Follow the guided start, wherever it shows.
2. **Train your first monster,** in the Workshop and then in the Console. Notice:
   - which type you would pick, and why;
   - what each question means;
   - what you expected your monster to look like.
3. **Build a deck.**
   - Fill your monster's deck. Do you know what each card does before you choose it, and
     where would you look?
   - Move a card between monsters, and save and load a preset.
4. **First fight.**
   - Send your monster to the ring, and summon a boss when nobody else is around.
   - Watch the whole fight in The Ring and in the Console.
   - For each line you couldn't follow, write down the line itself.
   - Did a first-time note appear (ⓘ)? Did it help?
5. **After the fight.**
   - Revive a fallen monster, and wait for it if it takes time.
   - Look at your XP, your coins, and what you won.
   - Visit the Shop, and buy or take something.
   - Use an item, and give one to your monster.
6. **Explore.**
   - Fights, Leaders, Chat (send a message, try `msg` and `dm` in the Console), and Help and
     guides.
   - Read How to play, Cards and Items as a newcomer would: skim, look things up.
   - Is anything you needed missing, wrong, or hard to find?
7. **Commands.**
   - Try `help`, then `help` with a word you would naturally reach for.
   - Type three things you think should work but might not, and record what happened.

## Report

Write `docs/reference/new-player-walk-2.md`, with front matter like the other
`docs/reference` files, and link it from `docs/README.md`. `pnpm docs:check` must pass.

1. **The ten most confusing moments,** ranked, each with:
   - where it happened;
   - what you saw (quote the exact text);
   - what you thought it meant;
   - what it actually did;
   - a screenshot;
   - a one-line suggestion. Don't write new player-facing text; describe what's missing.
2. **Everything else,** in a table: place, what you saw, why it confused you, and severity
   (blocked me / slowed me / small).
3. **What worked:** moments that were clear, so they stay that way.
4. **Questions a new player would ask** that nothing in the game answers.
5. **Docs that are wrong:** anything in Help and guides that the game contradicts.
6. **Not reached:** what you couldn't get to, and why.

## Prompt (paste whole into Cursor)

```text
Read docs/roadmap/42a-cursor-new-player-walk.md in the deck-monsters repo (only that file —
do not read other docs or code before the walk). Create a branch cursor/new-player-walk-42a
from main. Then play Deck Monsters at https://deck-monsters.com as a first-time player in a
new room you create, following the Rules and The walk sections, mostly on a phone-size
window (390 x 844) and repeating key moments at 1440 x 900. Write your findings to
docs/reference/new-player-walk-2.md exactly as the Report section says, with screenshots,
link it from docs/README.md, make sure pnpm docs:check passes, commit to your branch, and
push it. Do not change code, do not open a pull request, and delete your room when you
finish.
```

## Actionable remainder

- [ ] The findings, as placed in [42 G](42-next-proposals.md#g-what-cursors-walk-found-and-where-it-goes): A, C and E1, a new pass H (the fight log), and a new pass I (small fixes).
