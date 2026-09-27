---
type: Roadmap
title: Dragon Content Pack Pass
description: Active pass plan and approved specification for the Dragon monster and its four cards.
status: draft
audience: internal
tags: [roadmap, dragon, content, cards, monsters]
---
# 30 — Dragon Content Pack Pass

**Status:** In progress on branch `claude/dragon-pack`, started 2026-09-27. The research
behind it is [29 — Dragon research](29-dragon-research.md); this file is the specification
the owner approved from it and the record of the build.

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 0 | Harness roster from `allMonsters`, a test that fails when a monster is missing, and `sim:unicorn` generalized into `sim:monster <type>` (Pass B task 0 in [27](27-next-passes.md)) | Done | 208885b |
| 1 | Monster shell: `Dragon` type, Wizard class, stats, appearance, `look at` profile, lore, names, spawn, web sprite, spawn-catalog test | Done | f27094a |
| 2 | The two cards the requester asked for: Fire Breath and Take Wing; Fire Breath joins the starting deck | Done | this commit |
| 3 | Mood Scales and Tsunami | Not started | — |
| 4 | Generated references and strings inventory, `sim:monster Dragon` balance evidence, independent review, read-aloud script for the requester | Not started | — |

Each task gets its own checkpoint commit, and every code task gets an independent
read-only review before the pass closes.

## What the requester asked for

The requester is the owner's eight-year-old son (September 2026 interview):

- A **flight** card and a **fire-breath** card (asked earlier; both required).
- His favourite dragon is sleek: a **flat head, a long body, and aerodynamic wings**. That
  is the silhouette to aim for, drawn in our own style. We do not copy any film or book
  character's design, colouring, or name.
- He likes **sea dragons** and **mood dragons** (colour that follows the dragon's mood).
- A **Tsunami** card: a very powerful wave that does five damage to everybody in the ring.
- Not a Cleric: the Weeping Angel and the Unicorn already are.

As with the Unicorn, old quotations are for flavour and style, not scholarship
("Quoting old texts" in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules)).

## Owner decisions (2026-09-27)

| Question | Decision |
|---|---|
| Class | **Wizard.** The first Wizard on the roster. A caster curve: fragile early, strong later. The Dragon's own cards carry its identity, since only Cloak of Invisibility and Revive are Wizard-only today. |
| Tsunami | **5 damage to everyone in the ring, the Dragon included.** The self-hit is the price. Epic rarity (Sandstorm's), Dragon-only, back room only. |
| Mood card | **Mood follows HP.** Calm (above half HP): the Dragon blends in, as Cloak of Invisibility. Furious (at or below half HP, the engine's `bloodied`): it cannot hide, but its next melee hit does extra damage. Stated on the card; never random. |
| Flight card | **Take off, then dive.** Dodge the next melee blow; the next melee hit dives for bonus damage; any other damage while airborne knocks the Dragon down and loses the dive. |

Deferred from 29's candidate table: the hoard card (One Cup Missing), Soft Underbelly as a
shared mechanic, and the Roman cards. They stay in 29 as later ideas.

## Specification

### The monster

- **Type and class:** creature type `Dragon` (`constants/creature-types.ts`), class Wizard.
- **Stats:** DEX +2, STR −1, INT +1 (the +2 budget). The quick, clever flier; the
  Basilisk keeps strength. No other monster has this spread (the Unicorn is +2/+1/−1, the
  Weeping Angel +1/−1/+2). `acVariance` 1, `hpVariance` 2: scales, but a caster's body.
- **Appearance** (drawn at spawn, stored in options like the Unicorn's): the player's
  colour for the scales, plus a head (flat, wedge-shaped, crested), a body (long and
  sleek, whip-thin, sea-serpent long), wings (swept-back, bat-webbed, fin-edged), and a
  home that mixes the two strands he likes: sea caves, storm cliffs, a smoking mountain,
  the deep. Sea and fire are one dragon, as in Job's Leviathan, which breathes fire and
  boils the deep.
- **`look at` profile:** a rated profile in the spirit of trading-card stat lines, with
  our own categories from 29: Hoard Patience, Smoke Control, Roman Opinion, and Table
  Manners, each drawn from a small set of funny ratings. Read aloud to the requester
  before the pass closes.
- **Voice:** vain, clever, a little frightening, never gory. Old lines from Job 41 and
  Isaiah (1611 King James Bible) and the bestiaries, quoted for atmosphere.

### The cards

All four are Dragon-only (`permittedClassesAndTypes = [DRAGON]`), keep their state on the
encounter (cleared with the fight; no timers or `game.on` listeners), and read sensibly when
Sandstorm's confusion turns them onto the Dragon itself.

| Card | Level / rarity / sale | Effect | Bound and counterplay |
|---|---|---|---|
| **Fire Breath** (required) | 0 / common / front shop; one in the starting deck | Fire to every opponent: 2 damage +1 per Dragon level (Blast is 3 +1 per level, Cleric-only). | The Dragon is **winded**: −2 AC until its next card, the same penalty and give-back as Gloaming Rest. Opponents get a visible opening. |
| **Take Wing** (required) | 0 / uncommon / front shop | The Dragon takes off until its next card. The first melee blow aimed at it that turn misses ("strikes empty air"). If it is still airborne when its next card is a melee attack, that attack **dives**: +2 to hit and +1d6 damage. | Anything that lands while it is airborne (a second melee blow, or area damage it cannot dodge) knocks it down: the dive is lost. Only one dodge per take-off. A non-melee next card lands it with no dive. The dive and Mood Scales' fury share `cards/helpers/empower-melee.ts`. |
| **Mood Scales** | 1 / rare / back room | **Calm** (above half HP): blends in exactly as Cloak of Invisibility does. **Furious** (at or below half HP): turns red and cannot hide; its next melee hit gets +1d6 damage. | The mood is read when the card is played and shown in its narration. Calm's concealment has Cloak's own answers (area cards, a 1d20 search vs INT). |
| **Tsunami** | 0 / epic / back room | A great wave does 5 damage to **everyone** in the ring, the Dragon and its allies included. | The self-hit and the ally hit are the price. It is an area card, so it reaches hidden monsters, and it knocks an airborne Dragon down like any other non-melee damage. |

Fire Breath is the signature card in `getMinimumDeck()` beside Blast, Sandstorm, and the
others, so every new character can start with one.

Numbers are starting points. Task 4 measures them with `sim:monster Dragon` against every
monster at levels 1–20 and in larger rings (area cards change value with ring size), then
tunes them if the Dragon's curve runs the wrong way for a caster.

### Sources for the flavour

- **1611 King James Bible:** Job 41 (Leviathan: "out of his mouth go burning lamps", "he
  maketh the deep to boil like a pot"); Isaiah 27:1 ("the dragon that is in the sea");
  Isaiah 30:6 ("fiery flying serpent").
- **Holland's 1601 Pliny**, book 8, on the chameleon that changes colour with what is near
  it, for Mood Scales.
- **Topsell's 1608 *Historie of Serpents*** on winged dragons and their breath.
- **Gummere's 1910 *Beowulf*** for fire-drake and hoard wording.

Each card and the monster name their sources in a comment beside the text, as the Unicorn
does. No modern book or film's names, dialogue, species, or designs.

## Process

- Budget: five tasks in one PR; implementation inline, one independent read-only review
  over the whole diff before the PR is marked ready.
- Checkpoint commit and push after each task, updating this table in the same commit.
