---
type: Roadmap
title: In-game help for every control
description: Backlog plan to explain every option, command, button and screen inside the game, so a new player can start playing and find every control without outside help.
status: draft
audience: internal
tags: [roadmap, onboarding, help, web, commands, wording]
---
# 39 — In-game help for every control

**Status:** Backlog (owner, 2026-09-30). Not started; no code yet.

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

## Tasks

| # | Task | Status |
|---|---|---|
| 1 | **Inventory.** List every control and surface: each web tab, panel, button, menu and header counter (on phone and desktop widths), every Console command and its prompts, the Discord commands, and every mechanic a player can meet in a fight (ring events, bosses, ambushes, the mega boss, teams, holds, revival, items). For each, record what explains it today (a label, a tooltip, a line of help, a handbook section, or nothing). | Planned |
| 2 | **Decide the forms of help,** per kind of control: a short description on each button and menu item (tooltip or long-press on phone); a one-line "what is this" for each tab and panel, shown the first time and reachable after; `help <command>` with an example for every command; and a narration line the first time a player meets a mechanic in a fight (a ring event, a boss's temperament, an ambush). Keep it concise, and never block play. | Planned |
| 3 | **A guided start.** From joining a room to a first fight and a first card change: what to do next at each step, and where each control lives. It builds on the existing first-run training, not beside it. | Planned |
| 4 | **Write the text.** The orchestrator writes every line in the game's voice, from the inventory, in batches by surface. | Planned |
| 5 | **Keep it complete.** A test or check that fails when a command in the catalogue, or a button in the web app, has no help text, so new controls cannot ship unexplained. | Planned |

## Notes for whoever picks this up

- Read [web workspace](../architecture/web-workspace.md), [workshop and items](../architecture/workshop-and-items.md),
  [events, prompts and replay](../architecture/events-prompts-and-replay.md) and
  [voice and wording](../reference/voice-and-wording.md) first.
- Test with a genuinely new player's path on a phone, where most play happens: the owner's
  screenshots are from mobile.
- Mechanics narration (task 2) is also where the roadmap 38 line belongs: the first time
  bosses turn on each other, a player should understand why.
