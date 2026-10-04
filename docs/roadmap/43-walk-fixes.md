---
type: Roadmap
title: Small fixes from the new-player walk
description: Pass I from roadmap 42 G — the small, player-visible fixes Cursor's second new-player walk found in the Workshop, the guide, revive, the shop, bosses, stale prompts and the Fights list, plus 30 starting coins.
status: draft
audience: internal
tags: [roadmap, onboarding, web, console, shop, ux]
---
# 43 — Small fixes from the new-player walk

**Status:** In progress (2026-10-04), after #421 merged. I1 and I3 are with implementers. Source:
[new-player walk 2](../reference/new-player-walk-2.md), triaged in
[42 G](42-next-proposals.md#g-what-cursors-walk-found-and-where-it-goes). Numbers in brackets
are the report's ten moments (#) or its "Everything else" table.

## Decisions

Made with the owner on 2026-10-04:

- **Pass I goes first,** as its own short PR, before A + C + E1, then H, then D.
- **Characters start with 30 coins,** so the first fight's 10 coins buys a 33-coin item.
  Items should be a little easier to reach without tipping the balance. Only new characters
  get the 30; existing characters keep what they have (orchestrator's call: a top-up would
  reward players who had already spent theirs, and the walk was about a first session).
- **Prion Disease keeps its name,** `1993-09-7202 18:58`. It is a joke card.

Made by the orchestrator:

- The fight's reward line (item 11 in 42 G) waits for pass H, which rewrites the fight's end.
- The stale-prompt fix (I4) touches the prompt lifecycle. Its implementer reads
  [engine concurrency and timing](../architecture/engine-concurrency-and-timing.md) and
  [the prompt-answer contract](../reference/prompt-answer-contract.md) first, and gets a
  live browser check after review, because fake-timer tests have passed while the real
  browser still misbehaved (#162).

## Tasks

| # | Task | Area | Can run beside | Status | Commit |
|---|---|---|---|---|---|
| I1 | **Workshop and layout.** The move-many summary says `Moved 1 cards` (`server/src/trpc/router.ts`, move-many announcement): give it a singular. The first-deck and first-move notes (`GuidedStartBox.tsx`) say to tap an empty slot first; the control needs a card selected first. On a phone, a second monster sits off the right edge with two dots as the only hint [#2]: stack the monster cards, or show a clear "1 of 2" with arrows. Leaders at 390 hides its right-hand columns. The long room name wraps to three lines (42 E5) | Web, server | I3 | In progress | |
| I2 | **The guide, revive and bosses.** The guide drops "Nobody else here? Summon a boss." once a second monster or a boss is in the ring [#3]. `It's {name}'s turn` explains that the card is played for you. The revive line says the HP the monster returns with and that it heals while resting [#5]. Bosses: the arrival line names the house so it reads as the game, not a player; the header doesn't count down to a boss while one is standing; the summons badge says a timer boss doesn't use a summon; a monster card labels its strategy as that monster's orders, so "you" reads as the monster [#8]. A boss card leaves out its `Fights: 129` record | Engine, web | I3 (after I1: both edit `GuidedStartBox.tsx`) | Planned | |
| I3 | **Shop and items, and 30 starting coins.** The shop's pick button says buy, not `Equip cards` [#6]. The confirm and the receipt name the items. The Sorting Hat's `Are you sure?` says what happens. `give` after an item is used up says so. `look at items` with none says you have none and where to get some. New characters start with 30 coins; the handbook says so | Engine, web, build | I1, I2 | In progress | |
| I4 | **Questions that are over leave the input.** An answered, cancelled or timed-out question stops taking the next Enter (`Prompt is no longer active`), and its buttons stop looking live [#9] | Web, server prompts | — (after I1–I3) | Planned | |
| I5 | **Fights list, docs and close-out.** The Fights row's `Card: Soften` says it is the card found after the fight, and the row opens its play-by-play (or stops promising one). Help inventory, handbook, 10b for the bug, roadmap README; fold the decisions into area docs and move this plan to the archive | Web, docs | — (last) | Planned | |

Each task gets an independent read-only review before it lands. I1 and I4 get a live check
at 390 and 1440 (Cursor), since they are layout and timing.

## The text (orchestrator)

Implementers use these exactly. Anything else is a `DRAFT(43)` placeholder for Claude.

**I1**
- Move many: `Moved {n} {card|cards} from {from} to {to}.`
- First deck (Workshop): `Give {name} a full deck: tap a card in Your cards, then tap one of {name}'s empty slots. Fill all {slots}.`
- First deck (Console hint): `Or use the Workshop: tap a card in Your cards, then an empty slot.`
- First move: `{name} has fought a fight. Now try changing a card: tap one of {name}'s cards, then tap an empty slot, or Your cards, to move it there.`

**I2**
- Guide, once a fight is coming or on: `{name} is in the ring. Watch The Ring: a fight starts when the countdown ends.`
- Turn line: `It's {name}'s turn. {name} plays the next card in {his} deck.`
- Revive, beginner: `{name} has begun to revive. {He} {is|are} a beginner monster, so {he} {comes|come} back right away, with 1 HP. Monsters heal a little at a time while they rest.`
- Revive, above beginner: the same, with `in about {time}` in place of `right away`.
- Boss arrival: `A{adjective} {type} enters the ring, sent by the house ({RING_PATRON}).`
- Timer badge while a boss stands: none (hide it). Summons badge title: `Bosses you summon. The house also sends one on its own timer, which doesn't use yours.`
- Strategy lines: the label on a monster card becomes `{name}'s orders:` in place of `Strategy:`. The lines themselves are orders, written to the monster ("You target the weakest player…", "Your mother told you…"), and many are jokes; the label makes clear who "you" is without rewriting them (orchestrator, 2026-10-04).
- A boss's card leaves out its `Fights: … · Won: …` record. Bosses are rebuilt from shared templates, so the record isn't one opponent's history.

**I3**
- Pick button: `Buy {n} {item|items}`, titled `Buy the items you picked.`
- Confirm: `{Items} from {shop} for {value} {coin|coins}. Buy {it|them}? (yes/no)`, with the item names joined by "and".
- Receipt: `Sold: {items}. {name} has {coins} {coin|coins} left. Use an item with use, or give it to a monster with give.`
- Sorting Hat: `Put on the Sorting Hat? It sorts {name} into one of four teams, and is used up. (yes/no)`
- `give` with nothing: `{name} has no items {monster} can use. Used items are gone; buy more in the shop.`
- `look at items` with none: `You have no items. Buy some with buy items, or win them in fights.`
- Handbook: `New characters start with 30 coins.`

**I4–I5:** no new player-facing text yet. A `DRAFT(43)` placeholder if one is needed; the
Fights row label is written at I5.

## Process

- Pass size: five tasks, at most two implementers at once (I1 beside I3, then I2 beside I3
  if I3 runs long). I4 and I5 run alone.
- Implementers in a shared worktree never create or switch branches, `git add` only their
  own files, and never push. The orchestrator commits each task, with this table updated in
  the same commit.

## Actionable remainder

- [ ] I1 Workshop and layout.
- [ ] I2 The guide, revive and bosses.
- [ ] I3 Shop and items, and 30 starting coins.
- [ ] I4 Questions that are over leave the input.
- [ ] I5 Fights list, docs and close-out.
