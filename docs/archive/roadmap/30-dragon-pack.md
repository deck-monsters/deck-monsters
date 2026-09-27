---
type: Archive
title: Dragon Content Pack Pass
description: Closed pass record and approved specification for the Dragon monster, its four cards, and ancient dragons.
status: deprecated
audience: internal
tags: [archive, dragon, content, cards, monsters]
---
# 30 — Dragon Content Pack Pass

**Status:** Closed. Shipped in PR #402 (September 2026). Historical record of the pass; the
research behind it is [29 — Dragon research](29-dragon-research.md). Its lasting rules now
live in [cards and encounter effects](../../architecture/cards-and-encounter-effects.md#ancient-dragons),
the [simulation harness](../../reference/simulation-harness.md), and the
[Dragon strings inventory](../../reference/strings/dragon.md). Its follow-ups (the counter
cards, a flavour-text pass after play, a live browser check, and the ideas this pass
deferred) are tracked in
[12 — New content](../../roadmap/12-new-content-backlog.md#dragon-follow-ups).

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 0 | Harness roster from `allMonsters`, a test that fails when a monster is missing, and `sim:unicorn` generalized into `sim:monster <type>` (Pass B task 0 in [27](../../roadmap/27-next-passes.md)) | Done | 208885b |
| 1 | Monster shell: `Dragon` type, Wizard class, stats, appearance, `look at` profile, lore, names, spawn, web sprite, spawn-catalog test | Done | f27094a |
| 2 | The two cards the requester asked for: Fire Breath and Take Wing; Fire Breath joins the starting deck | Done | d58caa4 |
| 3 | Mood Scales and Tsunami | Done | 27c4e14 |
| 4 | Generated references and strings inventory, `sim:monster Dragon` balance evidence, independent review, read-aloud script for the requester | Done: evidence below; independent review (one should-fix, the ancient trick let allies try, fixed with a test); read-aloud script sent, requester's first reaction positive | 43276e0, 7102f14, db7a060, 7f6071e (ancient dragons), 0980553, 8f7bf97, df4edcd, 91af1b2 |

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
[cards and encounter effects](../../architecture/cards-and-encounter-effects.md#content-and-balance-rules)).

## Owner decisions (2026-09-27)

| Question | Decision |
|---|---|
| Class | **Wizard.** The first Wizard on the roster. A caster curve: fragile early, strong later. The Dragon's own cards carry its identity, since only Cloak of Invisibility and Revive are Wizard-only today. |
| Tsunami | **5 damage to everyone in the ring, the Dragon included.** The self-hit is the price. Epic rarity (Sandstorm's), Dragon-only, back room only. |
| Mood card | **Mood follows HP.** Calm (above half HP): the Dragon blends in, as Cloak of Invisibility. Furious (at or below half HP, the engine's `bloodied`): it cannot hide, but its next melee hit does extra damage. Stated on the card; never random. |
| Fire Breath (second round) | The first build was Blast plus a cost, and the owner asked for something that plays differently: **a cone that grows with level** (fast enough to matter by levels 2–6, since level 5 takes about 38 wins and level 10 about 445), **a hard dodge for half damage**, **burning for two turns**, and **winded kept** as the price. |
| Ancient dragons | Owner: very old dragons should be "immensely powerful but occasionally able to be tricked, because that's the way someone usually defeats them." **Ancient at level 10** (about 445 wins). **Power:** its breath cannot be dodged and burns for 3 turns. **Weaknesses, both:** once per fight each opponent it attacks may outwit it with a riddle or flattery (1d20 + INT vs 20 + the dragon's INT; the attack goes wide and the dragon is exposed, −4 AC until its next card), and a natural 20 with a Hit-family attack finds its soft underbelly for triple damage. |
| Flight card | **Take off, then dive.** Dodge the next melee blow; the next melee hit dives for bonus damage; any other damage while airborne knocks the Dragon down and loses the dive. |

Deferred from 29's candidate table: the hoard card (One Cup Missing), Soft Underbelly as a
shared mechanic, and the Roman cards. They stay in 29 as later ideas.

## Specification

### The monster

- **Type and class:** creature type `Dragon` (`constants/creature-types.ts`), class Wizard.
- **Stats (as shipped):** DEX +1, STR 0, INT +1 (the +2 budget), `acVariance` 1,
  `hpVariance` 2: scales, but a caster's body. The spec began at DEX +2, STR −1, and
  `sim:monster` showed that too weak early for a Wizard, whose random decks are mostly
  generic cards; see [Balance evidence](#balance-evidence). The spread matches the Jinn's;
  the Dragon's AC and HP offsets and its class differ.
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

### Ancient dragons

`cards/helpers/ancient-dragon.ts`. A Dragon at level 10 or more arms one encounter effect
when a fight starts (`Dragon.startEncounter`), so fight cleanup ends it. The sources are
Fafnir, drawn into talk by a hero who hides his name (*Völsunga saga*), and Sigurd striking
from a pit at the underbelly. Its `look at` says it is ancient.

### The cards

All four are Dragon-only (`permittedClassesAndTypes = [DRAGON]`), keep their state on the
encounter (cleared with the fight; no timers or `game.on` listeners), and read sensibly when
Sandstorm's confusion turns them onto the Dragon itself.

| Card | Level / rarity / sale | Effect | Bound and counterplay |
|---|---|---|---|
| **Fire Breath** (required) | 0 / common / front shop; one in the starting deck | A **cone**: the chosen target and the opponents beside it in ring order, 2 at first and 1 more every 2 levels. 2 fire damage +1 per level. Anyone who does not dodge **burns**: 1 damage +1 per 3 levels at the start of their next 2 turns. | Each target can **dodge**, barely: 1d20 + DEX against 15 + the Dragon's INT, for half damage and no burn (Blast, being magic, cannot be dodged). A heal puts a burn out; a new breath rekindles it rather than stacking. The Dragon is **winded**: −2 AC until its next card, as Gloaming Rest. |
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

## Balance evidence

`sim:monster Dragon`, 100 fights per row, against every other monster at each level. The
Dragon's average win rate with random legal decks, then with the thematic fixture deck
(Fire Breath ×2, Take Wing ×2, Hit ×2, Mood Scales, Tsunami, Heal):

| Build | L1 | L5 | L10 | L15 | L20 |
|---|---|---|---|---|---|
| First spec (DEX +2, STR −1, breath as Blast −1), random | 22% | 37% | 43% | 56% | 58% |
| Tuned stats (DEX +1, STR 0, INT +1), random | 36% | 43% | 50% | 60% | 63% |
| Cone, dodge, and burn breath, random | 34% | 45% | 51% | 61% | 62% |
| **With ancient dragons (current), random** | **34%** | **45%** | **59%** | **67%** | **70%** |
| Current, fixture | 26% | 36% | 70% | 82% | 90% |

- **A caster's curve**, as the balance target asks: fragile early and strong late. For
  comparison, the Weeping Angel (Cleric) averaged 47% at level 1 and 66% at level 20 with
  random decks, and the Jinn (Bard) 49% and 53%; both were measured against the first-spec
  Dragon, which inflates their level-1 numbers a little.
- **Why the stats moved.** A Wizard's class pool is only the Dragon's cards plus Cloak and
  Revive, so most of a random deck is generic cards like Hit, and at STR −1 those did too
  little. Removing Take Wing, Mood Scales, or Tsunami from the draw, dropping winded, or
  making breath as common as Blast each moved level 1 by under 3 points; STR 0 moved it 20.
- **Ancient dragons** at level 20 beat every monster but the Unicorn (57%) by 70–77%:
  immensely powerful, still beatable.
- **Crowds.** Over 300 seven-monster free-for-alls from the first and last seat, the Dragon
  wins 13–15% at levels 3 and 5 (fair share 14.3%). A single 100-fight crowd row reads 6%;
  that row is noise.
- **Read the fixture rows as a built deck against unbuilt ones**, and a fixture mirror as
  turn-order tempo ([simulation harness](../../reference/simulation-harness.md#reading-a-report)).

## Counter cards (moved to the backlog)

The owner asked for cards that give the rest of the roster answers to a Dragon (2026-09-27),
and chose two for a follow-up PR once this one merges. They are tracked in
[12](../../roadmap/12-new-content-backlog.md#dragon-follow-ups); the design notes below were
the starting point. Each works against any monster and
shines against the Dragon, so neither is dead in a deck that never meets one:

- **Lullaby** (Bard and Unicorn, beside Dissonant Voice): 1d20 + INT vs the target's INT;
  on a success the target dozes and loses its next card, through `immobilize()`, so the
  Unconquerable Horn ward applies. +4 against a Dragon: old tales lull treasure-guarding
  dragons to sleep with song.
- **Mirror Shield** (Fighter and Bard): the next area attack aimed at you (Fire Breath,
  Blast, Sandstorm, Tsunami) is turned back: you take half, and half hits its caster.
  Spent on use. Perseus's reflection; watch that it does not become a Blast-Cleric hard
  counter in the balance runs.

## Process

- Budget: five tasks in one PR; implementation inline, one independent read-only review
  over the whole diff before the PR is marked ready.
- Checkpoint commit and push after each task, updating this table in the same commit.
