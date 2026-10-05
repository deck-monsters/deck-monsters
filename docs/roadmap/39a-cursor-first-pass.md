---
type: Roadmap
title: In-game help, Cursor first pass
description: Roadmap 39's spec for the Workshop fixes and in-game Help, and two paste-whole Cursor prompts, one to walk the game as a new player now and one to check the fixes live once they land.
status: draft
audience: internal
tags: [roadmap, onboarding, help, web, cursor]
---
# 39a — In-game help: spec and Cursor passes

**Status:** Checked (2026-09-30). Parts 1 and 2 landed; Cursor's checks are in [help-check](../reference/help-check.md) and [batch 2](../reference/help-check-batch2.md).
drives a real browser but runs a smaller model, does the browser work around them (owner): the
new-player walk now, and a live check once Parts 1 and 2 land. Claude reviews Cursor's branch and
writes any new player-facing text.

## Prompt A: the new-player walk (paste whole into Cursor, now)

```text
Read docs/roadmap/39a-cursor-first-pass.md in the deck-monsters repo. Do Part 3 only, following
its Rules section. Fetch and check out branch claude/unicorn-monster-cards-cigpmw, then create
your own branch cursor/help-walk-39 from it. Commit to your branch only, never push to
claude/unicorn-monster-cards-cigpmw, and do not open a pull request. Push your branch when you
finish, with your report in docs/reference/help-inventory.md.
```

## Prompt B: the live check (paste whole into Cursor, after Claude says Parts 1 and 2 landed)

```text
Read docs/roadmap/39a-cursor-first-pass.md in the deck-monsters repo. Fetch and check out
branch claude/unicorn-monster-cards-cigpmw, then create your own branch cursor/help-check-39 from it.
In a real browser at 390 x 844 and 1440 x 900, check every numbered item in Parts 1 and 2
against the app: does it do exactly what the item says, with exactly the text given? Record
each item as pass or fail, with a screenshot, in docs/reference/help-check.md (front matter
like the other docs/reference files, linked from docs/README.md, `pnpm docs:check` passing).
Fix a failure only when the fix is small and needs no new player-facing text, one commit per
fix, following the Rules section. Push your branch; do not open a pull request.
```

## Rules

- **Branch:** work on the branch your prompt names. Commit in small steps, and push only your
  own branch. Do not open a pull request; Claude reviews the branch and takes the changes.
- **Player-facing text:** use the lines in this file exactly. If you need a line that is not
  here, write a short placeholder, mark it with `// DRAFT(39):` in the code, and list it under
  "Strings for Claude" in your report. Claude writes all player-facing prose in this repo (owner
  rule), following [voice and wording](../reference/voice-and-wording.md).
- **Read first:** `CLAUDE.md`, [web workspace](../architecture/web-workspace.md),
  [workshop and items](../architecture/workshop-and-items.md), and
  [working in this repo](../agents/working-in-this-repo.md) (its verification gate).
- **Run the app** as [local testing](../operations/local-testing.md) says, and check every change
  in the browser at 390 × 844 (a phone) and 1440 × 900, in Test Room A or B.
- **Tests:** update the web tests that name changed labels (`workshopPanel.*.test.tsx` and
  others; search for the old text), and add a test for each new behaviour. Run the full gate
  before your last push: `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm --filter
  @deck-monsters/web test`, `pnpm run build:docs`, `pnpm docs:check`.
- **Docs:** update `web-workspace.md` and `workshop-and-items.md` where they describe what you
  change, in the same commit. Leave the `docs/roadmap/` files alone except for your report.

## Part 1 — Workshop fixes (Claude implements)

Code is mostly in `apps/web/src/components/WorkshopPanel.tsx`, `MonsterWorkshopPanel.tsx`,
`ShopPanel.tsx`, and `apps/web/src/hooks/useDeckWorkshop.ts`.

1. **Coins live in the Shop only.** Remove the wallet from the Workshop header. A new player
   read "196 coins" beside **Train monster** as the price of levelling up the monster below.
   The Shop already shows the balance; make it singular-aware there (`1 coin`, `2 coins`),
   since today it always says "coins".
2. **Train monster gets its own row,** under the header, with this line before the button:
   - When the player can train more: `Train a new monster to fight at your side. You can train
     {n} more.`, with `{n}` from the character's free monster places (the engine has
     `monsterSlots`; if the web does not receive it, add it to the inventory query and say so
     in your report).
   - When every place is taken: `Every place at your side is taken ({slots} monsters).`
   - For a player with no character yet (first run), keep today's first-run behaviour and text.
   The button keeps its label, **Train monster**.
3. **Sync goes.** Remove the button. The Workshop already refetches every 30 s, after every
   Workshop change, and when coins arrive. Also refetch the inventory, monsters and shop:
   - when a fight the player was in ends (find where the web already hears the fight result
     for coins, around `WorkshopPanel.tsx` line 80, and reuse it);
   - when one of the player's monsters revives or levels up, if an event for that reaches the
     web;
   - when the tab becomes visible again (`visibilitychange`), or through React Query's
     `refetchOnWindowFocus`.
   Say in your report which events you used and which you could not find.
4. **Free reads Free.** Any shop price of 0 shows **Free** on the button instead of `0 coins`.
   The buy confirmation for a free item says `Take the {item}? It's free.`, and the success
   message says `You took the {item}. It was free.` Priced items keep today's text.
5. **The Sorting Hat says what it is for.** Replace `SortingHat.description` in
   `packages/engine/src/items/scrolls/sorting-hat.ts` with this text exactly (the paragraph
   breaks are `\n\n`), then run `pnpm run build:docs`:

   > Join a team, switch teams, or leave one. Teammates go after everyone else in the ring
   > first, and only turn on each other when nobody else is left. If your character has joined
   > a team but your monster hasn't, that monster is on your character's team.
   >
   > It's free, and every shop keeps one in stock, because choosing a side should never cost
   > you. `leave team` also takes you and your monsters off a team for free.
   >
   > An enchanted hat that once belonged to Godric Gryffindor. Put it on and find out where you
   > truly belong.

   Check the Shop row on a phone: if the description is cut short, the first sentence must be
   the one that shows.
6. **A revival in progress says so.** In `MonsterWorkshopPanel.tsx`, when a fallen monster has
   `revivesAt`:
   - the button reads **Reviving…** and is disabled;
   - the status reads `Fallen · back at {time} (in {m} min)`, with `{time}` in the viewer's
     local time (`toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })`);
   - in the last minute it reads `Fallen · back in {s} s`, ticking every second (it ticks every
     30 s today);
   - a fallen monster with no timer running keeps **Revive** and `Fallen`.
   First confirm in the browser that `revivesAt` is set only once a revival has started; if it
   is also set before the player presses Revive, stop and report it rather than guessing.
7. **The Workshop's subtitle** changes from "Manage equipped and unequipped cards in one view."
   to `Train monsters, choose their cards, and spend your coins.`

## Part 2 — Help inside the game (Claude implements)

Today the handbook is reachable only by typing `look at player handbook` in the Console.

1. Add a **Help and guides** entry to the workspace menu (the ☰ button). It opens a readable
   page or panel, scrollable on a phone, with these sections in this order:
   - `How to play`: `PLAYER_HANDBOOK.md`
   - `Monsters`: `MONSTERS.md`
   - `Cards`: `CARDS.md`
   - `Items`: `ITEMS.md`
   - `Commands`: the command list the Console's command reference already shows.
2. Above the sections, one line: `Everything the game does, written down. New here? Start with
   How to play.`
3. The guides are generated Markdown at the repo root. Prefer bundling them at build time
   (for example Vite's `?raw` import) over a new server endpoint, and render them with a small
   Markdown renderer (check `apps/web/package.json` for one already present before adding a
   dependency). Headings and tables must be readable at 390 px (tables may scroll sideways
   inside their own box, never the page).
4. Record the design in `web-workspace.md`: where Help lives, where its text comes from, and
   that `pnpm run build:docs` refreshes it.

## Part 3 — Walk the game as a new player (Cursor, Prompt A)

Use the paste-whole walk-through prompt in
[roadmap 39](39-in-game-help.md#cursor-prompt-for-task-3-paste-whole): phone and desktop, from
joining a room to a first fight and a card change. Write the tables to
`docs/reference/help-inventory.md` as it says.

You may fix what you find **when the fix is small and needs no new player-facing text**: a
broken layout, a control that does nothing, a label cut off, a missing disabled state. Commit
each fix separately and list it in the report. Anything that needs new wording or a design
decision goes in the report only.

## Report

At the end of `docs/reference/help-inventory.md`, add:

- **Fixed on the way:** each small fix from Part 3, with its SHA.
- **Strings for Claude:** every `DRAFT(39)` placeholder, where it shows, and what it must say.
- **Screenshots** of each confusing moment, at the width where it happened.
