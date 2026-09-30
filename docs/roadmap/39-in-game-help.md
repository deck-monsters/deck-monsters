---
type: Roadmap
title: In-game help for every control
description: Backlog plan to explain every option, command, button and screen inside the game, so a new player can start playing and find every control without outside help.
status: draft
audience: internal
tags: [roadmap, onboarding, help, web, commands, wording]
---
# 39 — In-game help for every control

**Status:** Next (owner, 2026-09-30: "let's tackle 39 next"), after [40](40-room-state-close-out-and-bugs.md). No code yet.

## Why

The owner (2026-09-30): "we need way better in game documentation / narration of what every
single option, command, button, screen, etc does so that it's really clear to people how to get
started playing and what controls are available to them."

Today the help is scattered:
- `help` prints the command catalogue (`packages/engine/src/commands/catalog.ts`);
- the player handbook (`PLAYER_HANDBOOK.md`, generated from `packages/engine/src/build`) lives
  outside the game;
- the first-run flow trains a first monster (see
  [workshop and items](../architecture/workshop-and-items.md)).

Much of the web workspace, though, explains itself only by its labels: the Ring, Console,
Workshop, Fights and Leaderboard tabs; the ring roster and its "Use an item" row; the Workshop
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
| 1 | **Workshop quick wins,** from the findings above: the wallet moves to the Shop; Train monster gets its own row and a line of help; Sync goes, with event and focus refresh in its place; zero prices read **Free**; the Sorting Hat's description leads with its purpose; a revival in progress shows **Reviving…** and its return time | Planned |
| 2 | **Help in the game:** a Help entry in the menu that opens the player handbook, the monster, card and item guides, and the command list, readable on a phone | Planned |
| 3 | **Inventory,** by walking the game as a new player in a real browser at phone and desktop widths (a Cursor prompt is below): every tab, panel, button, menu, header counter, Console command and prompt, and every mechanic a player meets in a fight. For each, what explains it today (a label, a tooltip, a help line, a handbook section, or nothing) and what confused the walker | Planned |
| 4 | **Decide the forms of help,** per kind of control: a short description on each button and menu item (tooltip, or long-press on a phone); a one-line "what is this" for each tab and panel, shown the first time and reachable after; `help <command>` with an example for every command; and a narration line the first time a player meets a mechanic in a fight (a ring event, a boss's temperament, an ambush, bosses turning on each other). Keep it short, and never block play | Planned |
| 5 | **Write the text.** The orchestrator writes every line in the game's voice, from the inventory, in batches by surface | Planned |
| 6 | **A guided start,** from joining a room to a first fight and a first card change, built on the existing first-run training | Planned |
| 7 | **Keep it complete:** a test that fails when a catalogue command, or a button in the web app, has no help text | Planned |

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
