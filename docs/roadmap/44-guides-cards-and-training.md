---
type: Roadmap
title: Card guides, card details and a training wizard
description: Roadmap 42 A, C and E1 as one pass, covering card roles, guides with full cards and who can hold them, card details in the Workshop, a Console card list per monster, and a step-by-step training wizard.
status: draft
audience: internal
tags: [roadmap, cards, guides, workshop, onboarding]
---
# 44 — Card guides, card details and a training wizard

**Status:** In progress (2026-10-04). K1 and K2 done; K3 with an implementer. Proposals: [42 A, C and E1](42-next-proposals.md). Owner
order: after [43](43-walk-fixes.md), which is merged; its live check runs alongside.

## Why

New-player walk 2 ([report](../reference/new-player-walk-2.md)) found a player can't tell what
a card does while building a deck (#1), can't tell which cards a monster can hold (`that kind
of monster can't use it`), and gets a monster that reads nothing like what they pictured
(#10). The owner asked for a training wizard with an example for each question, guides with
each card's real numbers, grouped, and a way to see which cards a monster can use at which
level.

## Decisions

Made by the orchestrator, from the [triage](#triage):

- **Roles.** Every card gets exactly one role, set in one table in the engine, with a test that
  fails when a card has none. Five roles:

  | Role | Label | A card belongs here when it… |
  |---|---|---|
  | `attack` | Attacks | damages one opponent, or only boosts the next hit |
  | `area` | Area attacks | strikes every opponent, or several at once |
  | `heal` | Healing | gives hit points back |
  | `guard` | Boosts and defence | raises the player's own defence or stats, hides it, or lets it escape |
  | `trick` | Tricks and curses | holds, curses, poisons, confuses, steals or reorders, rather than simply damaging |

  "Signature" is not a role. A card only one type can hold is that type's signature card,
  and the guide lists those under each type. The implementer proposes the role of each card
  by reading what it does; the review checks every one against these rules. `cardClass` stays
  as it is (the Ancient Dragon uses it).
- **Guide entries are the full card** (`actionCard(card, true)`): description, the dice,
  level, who can use it, chance and damage per turn, price, targets. `root-docs.test.ts`
  forbids `Hit chance … DPT` in CARDS.md on purpose today; that contract changes, and the test
  changes with it. 20 cards have no odds in `card-odds.json`; their entries show no chance
  line for now (remainder).
- **No new prose per card.** The card's own description and stats text explain it. The
  orchestrator writes the group intros and the type lines below.
- **Items leave CARDS.md.** ITEMS.md stays hand-written. Below its rules, a generated section
  between markers lists every item with its full card. Only the text between the markers is
  rewritten by `build:docs`.
- **Who can hold a card** gets one pure engine function with a reason: allowed, the wrong kind
  of monster (with who can), or the level (with the level needed). The guide, the Workshop and
  the Console all use it.
- **The Workshop gets card facts from the server** (a room-scoped, membership-checked query
  built from the engine), not a browser bundle of every card class.
- **Workshop slot labels use the role.** The name-guessing `getCardClass` goes.
- **The look question gets one home** in the engine: per type, the question's wording, its
  example, and a preview line. The Console's `askForColor` and the web wizard both read it.
  A test checks that each type's preview line matches what its description really prints.
- **The wizard previews the look line only.** It doesn't fix the other random details (a
  Dragon's wings, a Unicorn's witness) before training; the last step says the rest is drawn
  when the monster answers your call. Fixing the draws, and a colour swatch for the sprite,
  are in the remainder.
- **Name suggestions reach the web** through a server query (the name lists are Node-only).
- **The shop's card pick says Buy.** Its question gets the buy marker. The web keys the
  button on `to buy:` and takes the noun from the question: `Buy 2 cards`, `Buy 2 items`, or
  `Buy 2` for the Back Room, whose question no longer calls cards items.

## Tasks

| # | Task | Area | Can run beside | Status | Commit |
|---|---|---|---|---|---|
| K1 | **Engine foundations.** The role table and its test; `cardHoldVerdict(card, monster)` with reasons; the shared look table (question, example, preview) used by `askForColor`, with the preview test; card facts (name, role, description, stats, level, who can use it, rarity, price, signature type) as one pure function; exports for the server and, where browser-safe, `browser.ts` | Engine | — (first) | Done. Roles keyed by `cardType` (the Kalevala's instance name carries its dice). Review: 61 of 64 roles kept as proposed; Prion Disease moved to tricks (it mostly heals everyone); Forked Stick stays an attack (a chance to hold, like Horn Gore). `lookQuestion` is byte-identical to the old Console question | e8924079 + this commit |
| K2 | **The guides.** CARDS.md grouped by role with full cards and a contents list by group; a "What each type can hold" section per type, by level, with its signature cards; items removed from CARDS.md and generated into ITEMS.md between markers; the Help page picks it up; root-docs tests updated | Engine build, docs | K3 | Done. Review: the cards print MSRP, DPT and Hit chance with no meaning given (walk 2 #4), so CARDS.md opens with a "How to read a card" legend and a Jump to row. The web's Markdown skips the ITEMS.md markers | (cherry-picked K2 commits) |
| K3 | **Card details in the Workshop, and the shop.** A server card-facts query; a ⓘ on each card opens a detail sheet with the card and whether this monster can hold it; "At level N: …" on each monster panel; slot labels from the role; the shop's card and Back Room picks say Buy | Server, web, engine (shop) | K2 | In progress | |
| K4 | **The training wizard.** One step per screen in the Workshop, with the look question and live preview, name suggestion chips, and the Ready step; `spawnOptions` carries the look question; a name-suggestions query | Web, server | K5 | Planned | |
| K6 | **What the walk-fixes check found** ([report](../reference/walk-fixes-check.md)). (1) The guide's `change_card` step tells a fighting monster to change a card, and the first fight can end before the guide's 15-second ring check sees it: during any fight the guide says `{name} is fighting. Watch The Ring.`, from the monsters' own fight state rather than a slow poll. (2) The chip `Look at my monsters` teaches a line the game refuses: the label becomes `Look at monsters`, and `look at my monsters` is accepted too. (3) After a reload, the first command is sometimes taken as an answer to a question that's already over: find where a replayed question gets armed, and stop it. (4) The shop's confirm appears under `Action cancelled.`: an answered pick question is being tombstoned as cancelled when the confirm arrives. (5) The Workshop's list is headed `Your Inventory`; the note calls it Your cards: the heading becomes `Your cards` | Web, server | K4 (not ConsolePane: K4 doesn't touch it) | Planned | |
| K5 | **`look at cards for [monster]`, docs and close-out.** The Console command and its catalogue entry; help inventory, handbook, architecture docs; Cursor's live check (44a) | Engine, docs | K4 | Planned | |

Every task gets an independent read-only review and a fix round; K3 and K4 get a live look at
390 and 1440.

## The text (orchestrator)

Implementers use these exactly. Anything else is a `DRAFT(44)` placeholder for Claude.

**Roles (labels as above). Group intros in the guide:**
- **Attacks:** `Cards that hit one opponent. Most roll a d20 against the target's AC, then roll for damage. Bigger dice hit harder.`
- **Area attacks:** `Cards that strike every opponent at once. Each hit is smaller, but in a crowded ring they add up.`
- **Healing:** `Cards that give hit points back. A monster at 0 HP is out of the fight, so a heal at the right moment can matter more than a hit.`
- **Boosts and defence:** `Cards that make your monster harder to hit, stronger for a while, or gone from sight. They do nothing to the other side; they help you last.`
- **Tricks and curses:** `Cards that hold, curse, poison, confuse or rob an opponent instead of simply hitting them. Read these closely.`

**Guide, how to read a card** (after review): `How to read a card:` then `Hit chance: how often the card hurt its target in practice plays.`, `DPT: the damage it does each time it's played, on average, with misses counted.`, `Heal chance and HPT: the same, for healing.`, `MSRP: its price in the shop, in coins.`, `Targets: the stat the target defends with. ac is armour class.`, `Level and Usable by: the level a monster needs, and which monsters can use it.` A `Jump to:` row precedes the contents.

**Guide, which cards when:**
- Section heading: `What each type can hold`. Intro: `Every card says which monsters can use it and from which level. Cards only one type can use are its signature cards.`
- Per type: heading `{Type}`, then `Signature cards: {list}.`, then a table `Level | Cards that open up`, with level 0 written `Beginner`, listing every card that type can hold by the level it opens.
- CARDS.md header line: `Items are in the Items guide.` (replaces the ITEMS.md pointer).
- ITEMS.md generated section heading: `Every item`, intro `Each item with its full card. Generated from the game; the rules above explain how to use them.`

**Workshop:**
- The ⓘ on a card: title `What this card does`.
- Detail sheet: the card's name and role label, its description, its stats, then `Level: {Beginner|n}`, `Used by: {Any monster|list}`, `Price: {n} coins`. Close button `Close`, title `Close the card details`.
- Verdict line, for the monster in view:
  - `{monster} can use this.`
  - `{monster} can't use this. Only {list} can.`
  - `{monster} can use this from level {n}. {monster} is level {m} now.`
- Monster panel: `At level {n}: {cards}.` for the next level that opens anything. Nothing at all opens later: no line.
- Slot labels: `ATTACK`, `AREA`, `HEAL`, `DEFENCE`, `TRICK`.

**Shop:**
- Card pick question: `Choose one or more of the following cards to buy:` Button `Buy {n} {card|cards}`, with nothing picked `Buy cards`, title `Buy the cards you picked.`
- Back Room pick question: `Choose one or more of the following to buy:` Button `Buy {n}`, with nothing picked `Buy`, title `Buy what you picked.`

**Console:**
- Catalogue: `look at cards for [monster]` — `See which cards a monster can use now, and which open up at later levels` — example `look at cards for Rex`.
- Output:
  - `{monster} can use these cards now:` then one line per role with cards, `{Role label}: {cards}.`
  - `Later:` then `Level {n}: {cards}.` per level. Omitted when nothing is left.
  - With no monster by that name, the existing refusal for an unknown monster.

**The training wizard** (Workshop, phone first):
- Step line: `Step {n} of {total}`. Buttons: `Back`, `Next`; on the last step `Train {name}`.
- **About you** (first run only): heading `About you`, line `This is you, the beastmaster. Your monsters fight; you train them.`, then name, pronouns and avatar as today.
- **Type:** heading `Pick a type`. One card per type: name, its summary, then `Class: {class} · Signature card: {card}`.
- **Pronouns:** heading `Pronouns`, question `Which pronouns should we use for your {type}?`
- **Name:** heading `Name`, label `Name`, then `Suggestions:` with two names as chips and a `More names` button, title `Suggest two other names`.
- **Look:** heading `Look`, the engine's question for that type and pronouns (for example `What should her scales look like?`), the example as the input's placeholder, then `In {name}'s description:` and the preview line, which updates as you type; with the box empty it shows the example, muted.
- **Ready:** heading `Ready`, `{name} the {type}`, then `Pronouns: {pronouns}` and the preview line, then `The rest of {name}'s description is drawn when {he} {answers|answer} your call.`

## Process

- K1 runs alone. Then K2 beside K3 (generators versus server, web and shop). Then K4 beside
  K5. K3 and K4 both touch the server router, so they don't run together. K6 was added after
  Cursor's check of 43; it runs beside K4 or K5, and its prompt items get a live re-check.
- Implementers in a shared worktree never create or switch branches, `git add` only their
  own files, and never push. The orchestrator commits each task, with this table updated in
  the same commit.

## Triage

A read-only survey on 2026-10-04 found:
- the look phrases are an if/else chain in `askForColor` (`monsters/helpers/spawn.ts`), one
  per type;
- 64 cards in `cards/helpers/all.ts`, with eight `cardClass` values that only loosely match
  roles;
- `canHold` returns a boolean, and the refusal can't say whether the type or the level is the
  reason;
- the Workshop receives card names only, and guesses a class from the name;
- CARDS.md uses the short card form in code order and repeats the items; ITEMS.md is
  hand-written;
- the shop's card pick has no buy marker;
- there is no `look at cards for` command.

## Actionable remainder

- [ ] K1 Engine foundations.
- [ ] K2 The guides.
- [ ] K3 Card details in the Workshop, and the shop.
- [ ] K4 The training wizard.
- [ ] K5 `look at cards for [monster]`, docs and close-out.
- [ ] K6 What the walk-fixes check found.
- [ ] Later: odds for the 20 cards with none; fix the random draws at preview; a colour swatch that reaches the sprite.
