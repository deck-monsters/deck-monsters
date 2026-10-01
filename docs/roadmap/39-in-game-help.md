---
type: Roadmap
title: In-game help for every control
description: Backlog plan to explain every option, command, button and screen inside the game, so a new player can start playing and find every control without outside help.
status: draft
audience: internal
tags: [roadmap, onboarding, help, web, commands, wording]
---
# 39 — In-game help for every control

**Status:** In progress (2026-09-30). Tasks 1–3 and batch 2 done; batch 3 (tasks 4, 6, 7) is done; task 5, writing the rest of the text, continues as new surfaces are found; Cursor's live check of 1 and 2 passed on everything it could reach ([help check](../reference/help-check.md)); batch 2 from the walk is being built and reviewed.

## Why

The owner (2026-09-30): "we need way better in game documentation / narration of what every
single option, command, button, screen, etc does so that it's really clear to people how to get
started playing and what controls are available to them."

Today the help is scattered:
- `help` prints the command catalogue (`packages/engine/src/commands/catalog.ts`); `help <word>` narrows it to matching commands, and a test checks every entry reaches a handler;
- the player handbook (`PLAYER_HANDBOOK.md`, generated from `packages/engine/src/build`) lives
  outside the game;
- the first-run flow trains a first monster (see
  [workshop and items](../architecture/workshop-and-items.md)).

Much of the web workspace, though, explains itself only by its labels: the Ring, Console,
Workshop, Fights and Leaders tabs; the ring roster and its "Use an item" row; the Workshop
panels; presets; the boss countdown and summons counter in the ring header. Mechanics such as
ring events, bosses, ambushes, teams, and revival are explained only if a player reads the
handbook.

## Goal

A new player can start playing, and find and understand every control, from inside the game.
Every option, command, button and screen says what it does at the moment it matters. The help
is written in the game's voice ([voice and wording](../reference/voice-and-wording.md)), and the
orchestrator writes every player-facing line.

## First findings: a new player in the Workshop (owner, 2026-09-30)

Someone new to the game used the Workshop on a phone, with the owner watching. Each finding has
a proposed fix; the owner's own suggestions are marked.

| What they saw | Why it confused them | Fix |
|---|---|---|
| The coin balance sits next to **Train monster** in the header | They read it as the price of training, Pokémon style: spend coins to level up the monster below | Move the balance to the Shop, where coins are spent (owner). The header keeps no wallet |
| **Train monster** | Nothing says it makes a *new* monster. The name stays (owner: it is the chosen term) | Give it its own row with a line above it saying what it does and how many monsters you can have (owner) |
| **Sync** | Nobody could tell what it does. The Workshop already refreshes every 30 s, after every change you make, and when coins arrive | Remove it (owner: "not even sure it's needed any more"). Refresh also when a fight ends, a monster revives or levels up, and when the tab regains focus, so nothing waits 30 s |
| Sorting Hat priced **0 coins** | Looked like a bug, and nothing said why a free item is on offer | Show **Free** for any zero price (owner). Lead the description with what it is for (join, switch, or leave a team) and why it is free; the Gryffindor line comes after |
| **Revive** on a fallen monster above level 0 | After pressing it the monster takes minutes to come back, but the button still says Revive, so it looks as if nothing happened. The card shows "Fallen · revives in 8 min" in small text, updated every 30 s | While a revival is running, the button reads **Reviving…** and is disabled, and the card shows the time it will be back ("back at 6:42, in 8 min"), counting down each second in the last minute (owner) |
| The handbook, monster, card and item guides | Only reachable by typing `look at player handbook` in the Console | A Help entry in the menu that opens them in-game |

## Tasks

Tasks 1 and 2 are specified in [39a](39a-cursor-first-pass.md), which Claude implements; Cursor, which drives a real browser, does task 3's walk and a live check of 1 and 2 from the prompts there.

| # | Task | Status |
|---|---|---|
| 1 | **Workshop quick wins,** from the findings above: the wallet moves to the Shop; Train monster gets its own row and a line of help; Sync goes, with event and focus refresh in its place; zero prices read **Free**; the Sorting Hat's description leads with its purpose; a revival in progress shows **Reviving…** and its return time | Done (2026-09-30): f9f8fc0d, c359cd4a; the Sorting Hat text 8f260bb8. Needs the live check (Prompt B in 39a) |
| 2 | **Help in the game:** a Help entry in the menu that opens the player handbook, the monster, card and item guides, and the command list, readable on a phone | Done (2026-09-30): a Help and guides page from the ☰ menu, not a tab (the phone tab bar already overflows); lazy-loaded; 57563764, 9e31cf05. Needs the live check |
| 3 | **Inventory,** by walking the game as a new player in a real browser at phone and desktop widths (a Cursor prompt is below): every tab, panel, button, menu, header counter, Console command and prompt, and every mechanic a player meets in a fight. For each, what explains it today (a label, a tooltip, a help line, a handbook section, or nothing) and what confused the walker | Done (2026-09-30): Cursor's walk at phone and desktop widths, [help inventory](../reference/help-inventory.md) (fc23174f). Its top ten are triaged below |
| 4 | **Decide the forms of help,** per kind of control: a short description on each button and menu item (tooltip, or long-press on a phone); a one-line "what is this" for each tab and panel, shown the first time and reachable after; `help <command>` with an example for every command; and a narration line the first time a player meets a mechanic in a fight (a ring event, a boss's temperament, an ambush, bosses turning on each other). Keep it short, and never block play | Done in batch 3: the decisions below (C1–C4) |
| 5 | **Write the text.** The orchestrator writes every line in the game's voice, from the inventory, in batches by surface | Planned |
| 6 | **A guided start,** from joining a room to a first fight and a first card change, built on the existing first-run training | Done in batch 3 (C3) |
| 7 | **Keep it complete:** a test that fails when a catalogue command, or a button in the web app, has no help text | Done in batch 3: `button-titles.test.ts` (web) and the catalogue tests (C1, C2) |

## Batch 2: from the walk (2026-09-30)

Cursor's [help inventory](../reference/help-inventory.md) ranked ten confusions. Items 6
(the wallet beside Train monster, Sync) and the Workshop subtitle were already fixed by
task 1. The rest, grouped into tasks that do not share files. The live check is
[help-check batch 2](../reference/help-check-batch2.md): the shipped sentences matched,
and the remaining gaps (the banner over a long question, the Console's older equip
line, `Unequipped 1 cards`, and a fight row that says `HealCard`) are listed there.

| # | Task | From the walk | Status |
|---|---|---|---|
| B1 | **The Console on a phone.** While a prompt is open, the suggestion chips and the getting-started guide step aside, so the question is on screen; the banner no longer says suggestions are paused while they still show. The name suggestions read as suggestions, not buttons. A command typed into a card prompt is recognised as a command, with a line saying how to cancel first. The equip example no longer says to type a JSON array | 2, 8 | Done: prompts clear the chips and guide; name suggestions read as suggestions; a command typed into a card prompt is recognised by the real dispatcher; no JSON example. Needs the live phone check (da2ad87b…7985c56c) |
| B2 | **Say what is happening now.** The fight log and the leaderboard stop saying nothing has happened while a fight is on the ring. The Workshop's fighting line says the cards are locked until the monster returns, instead of implying a queue | 1, 3 | Done: the Fights and Leaders panels and the Workshop say a fight is on; the list refreshes when it ends (review blocker fixed) (f51a5b14, d9f20516) |
| B3 | **The ring header and the boss.** While a fight is on, the boss countdown and the summons count are hidden (owner); on a clear ring, summons read as what is left. The roster shows a boss's whole name. A boss's turn names the boss, not The Editor | 4, 7 | Done: the countdown and summons hide during a fight (owner); `{n} summons left`; boss names wrap; a boss's turn names the boss (677cbbf0) |
| B4 | **One name per place** (owner: the tab names win): The Ring, Console, Workshop, Fights, Leaders in the tabs, the menu, and page headings; all five tabs fit at 390 px | 8 | Done: The Ring, Console, Workshop, Fights, Leaders everywhere; five tabs fit at 390 px by the CSS (needs the live check) (69c7ab31) |
| B5 | **Training and card moves say why.** Each monster type gets a one-line description in both training paths; the Console path asks the player's name as the form does; "You have 10 of 10 monsters left to train" reads as what it means. A refused card move says why, and a successful one says what the count counts | 9, 10 | Done: a line per monster type in both training paths; the Console asks a new player's name (`type ok to be {suggested}`, since an empty answer cannot be sent); the place count; one equip line and refusal reasons everywhere (e69c9567, 759de2cc, 1c1d776c). Needs the live check |
| B6 | **A glossary.** The fight's numbers (`ac`, `hp`, `dex`, `str`, `int`, dice like `1d20`, `XP`, level and "beginner", bloodied, a natural 1 and 20) explained in the handbook, reachable from Help | 5 | Done: "Reading a Fight" in the handbook, so also in Help. Found on the way: the handbook's XP table predated the early-level discount (Level 1 said 50 XP; the game asks 28), now generated from `levels.ts` |

**Live check of batch 2** (Cursor, [help check, batch 2](../reference/help-check-batch2.md)):
B2–B6 passed. B1 failed on one point: the "A command is waiting for your answer" banner covered
the lower choices of a long prompt, because it was drawn over the feed and shows exactly when
the prompt's end is off screen; it now sits in the layout above the input. The check also found
a fight's card drop listed by class name ("HealCard"), "Protector Of Creatures's turn", and
"Unequipped 1 cards"; all fixed. Not yet seen live: a timed revival, a balance of 1 coin, a
full roster.

Also from the walk, smaller: the boss arriving with `Fights: 102` in a new room (boss history
is global; say so or show this room's count), `OWNER` and `MEMBER` undefined on the rooms
page, placeholders that look filled in, the long room name colliding with the logo on a
phone, the closed command reference still read by screen readers, and the desktop theme
circle with no word. The walk did not see a fight end, revival, death, an item used, a hold,
an ambush, or a team; Prompt B's live check should cover a fight end and a revival.

## Batch 3: tasks 4, 6 and 7 (2026-09-30)

Owner: "Go ahead and start those next tasks, no need for a separate PR." Built on
`claude/unicorn-monster-cards-cigpmw` after #418, with the same rules as batch 2: Sonnet
implementers, one independent review each, the orchestrator writes every player-facing line.

**Task 4, the forms of help (decided):**

- **Buttons:** every `<button>` in the web app carries a `title`: one line saying what it does,
  shown on hover on a desktop and read by screen readers. A phone never shows a `title`, and a
  long-press is a gesture nobody finds, so there is no long-press tooltip. Instead, on a phone
  **the visible label must say it**: an icon-only control is a universal one (☰, ✕, ↓) or
  gets words (⟲ becomes **Unequip all**).
- **Places:** each tab has a one-line description in the surface registry. It is the tab's
  `title`, and the panel shows it under its heading (the Workshop already does). A line that
  is always there costs one line and never needs a "seen it" flag.
- **Commands:** `help <word>` lists every catalogue command containing that word, with its
  example (`help preset`). Every command that takes a name already has an example; a command
  with nothing to fill in is its own example.
- **Mechanics:** the first time a player sees a ring event, a boss's temperament, an ambush,
  or bosses turning on each other, one short line under it says what the rule is. The
  engine tags those lines with the mechanic; the web remembers per player (local storage)
  which it has explained. Discord players see the narration without the note.
- **Never block play:** no modal, no forced tour; every note can be ignored.

| # | Task | Status |
|---|---|---|
| C1 | **Command help** (task 7, commands): `help <word>`; the full list says it exists; a test that every catalogue entry (its example, or the command itself) reaches a real handler, and that every entry with a `[name]` has an example | Done: `help <word>` with examples; tests that every catalogue entry reaches a handler and every `[name]` has an example. Found and fixed on the way: a bare `look at <name>` matched no handler (bug 211); Discord `/status` and `/monsters` sent text no handler matched (bug 212); the item examples named items that don't exist (now Potion of Healing). Review: two rounds (e05df511, f442a436, 4adf98bd) |
| C2 | **Every button and place explains itself** (tasks 4, 5, 7 on the web): a `title` on every button, the surface descriptions, subtitles on Fights and Leaders, the Ring's empty state says how a fight starts; the walk's leftovers (OWNER and MEMBER, placeholders that look filled in); a test that fails on a button without a `title` | Done: a `title` on all 54 buttons, surface descriptions as tab titles and subtitles, ⟲ is **Unequip all**, the Ring's empty state, the lobby's role tags and placeholders, `button-titles.test.ts`. Review: approved; fixes to Unequip all's accessible name, the Load title and the test's path (87dee75f, 3865adeb, 1009e9d6) |
| C3 | **A guided start** (task 6): the Console's getting-started steps also show in the Workshop, where most new players start on a phone; the waiting step says a boss can be summoned; a last step changes a card | Done: one hook (`useGuidedStart`) and box, in the Console and the Workshop; steps spawn, equip (deck not full), send, waiting (summon a boss), fallen, change a card; "established" decided once per room on first load; flags per user and room, older dismissals still honoured. Review: approved; fixes for step order, deck comparison, per-room keys, a history error, and a Workshop render test (1b53eede, 597b8479) |
| C4 | **First-time mechanic notes** (task 4, mechanics): engine tags on the four announcements; the web shows each rule once per player | Done: `payload.mechanic` on the ambush, boss-rivals and temperament lines (ring events already carry their id); `lib/mechanic-notes.ts` with a note per mechanic and a test that every ring event has one; shown once per player across the Ring and Console (local storage). Review: approved; fixes for the Console claiming a note before the player is known and a test leaking timers (325e7c68, e9e9de70) |

## Cursor prompt for task 3 (paste whole)

```text
You are a player who has never seen Deck Monsters. Use the running app in a real browser.
Do the walk twice: at 390 x 844 (a phone) and at 1440 x 900. Use a fresh account or a
room where you have no character yet, and follow docs/operations/local-testing.md to run it.

Goal: list everything a new player can see or do, and what explains it, without reading the
code or the docs first. Go from joining a room to finishing a first fight and changing a card.

For every tab, panel, button, menu item, header counter, badge, Console command and prompt,
record in one table row:
- where it is (tab > panel > control) and its exact label;
- what you guessed it would do before using it;
- what it actually did;
- what explains it today: label only, tooltip, a line of help text, a Console help entry, a
  handbook section, or nothing;
- anything that confused you, looked like a bug, or had no visible result.

Also note every fight mechanic you see happen (ring events, bosses, ambushes, teams, holds,
revival, items) and whether the game told you what it was.

Take a screenshot for every confusing moment. Write the results to
docs/reference/help-inventory.md (tables by surface, then a "most confusing first" list of the
top ten). Give it front matter like the other files in docs/reference/, link it from
docs/README.md, and run `pnpm docs:check`. Do not change any code.
```

## Notes for whoever picks this up

- Read [web workspace](../architecture/web-workspace.md), [workshop and items](../architecture/workshop-and-items.md),
  [events, prompts and replay](../architecture/events-prompts-and-replay.md) and
  [voice and wording](../reference/voice-and-wording.md) first.
- Test with a genuinely new player's path on a phone, where most play happens: the owner's
  screenshots are from mobile.
- Mechanics narration (task 2) is also where the roadmap 38 line belongs: the first time
  bosses turn on each other, a player should understand why.
