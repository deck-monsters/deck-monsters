---
type: Roadmap
title: New Content Backlog
description: Concrete card, monster, and world proposals, including the Dragon research brief.
status: draft
audience: internal
tags: [content, cards, backlog]
---
# New Content Backlog

**Status:** Backlog — concrete post-launch content proposals. Measure any new combat
content with the [simulation harness](../reference/simulation-harness.md) before it ships,
and follow the checklist in [cards and encounter effects](../architecture/cards-and-encounter-effects.md#adding-a-card-or-a-monster).

## Cards

- [ ] Card Pops: upgrade a card after a natural 20 or Stroke of Luck; decide whether the
  upgrade takes effect mid-fight or afterward.
- [ ] Re-quip: clone each configured deck into a fight hand and refresh it at round five.
- [ ] Design and test Healing Balm, Enchanted Mirror, Bear Trap, Shardblade, Kata, Gini
  Coefficient, Healing Wind, Shuffle, Delve, Wild, Trade Hands, and Swarm.
- [ ] Strengthen repeated Immobilize rather than merely resetting its hold.
- [ ] **Owner: Cards.** Evaluate a hybrid data-driven card spec (schema plus optional
  hooks) and a card-authoring agent skill covering file locations, the base class, tests,
  and balance pitfalls. Do this after the simulation harness in
  [balance and mechanics](11-balance-and-mechanics.md) can review a proposed card. The
  spec stays optional until more people author cards; the current class-per-card system
  remains the implementation.

## Monsters and items

- [x] **Unicorn content pack.** Shipped in PR #394: the Unicorn and five cards (Sticketh,
  Horn of Proof, Unconquerable Horn, Dissonant Voice, Gloaming Rest). The pass record and the
  original brief are archived as [26 — Unicorn content pack](../archive/roadmap/26-unicorn-pack.md).
- [ ] **Dragon.** A second requested monster, researched and built the way the Unicorn was.
  Research comes first; see the [Dragon research brief](#dragon-research-brief) below.
- [ ] A qilin/kirin creature deserves its own sourced design rather than a cosmetic Unicorn
  variant (a rule carried over from the Unicorn brief).
- [ ] Add the Time Lord monster and its time-manipulation deck.
- [ ] Add the Bureaucrat monster and its tax, redistribution, and arrest mechanics.
- [ ] Design equipment slots and their stat trade-offs.
- [ ] Decide how monster-slot capacity is earned; the existing modifier is deliberately
  dormant until a reward is chosen.

## Dragon research brief

**Status:** Requested by the owner (September 2026); research and design not started. The
Unicorn pack is the model: a sourced creative thesis, a monster specification with ranges
rather than final numbers, a handful of related cards, then a pass plan with slices,
simulation evidence, and a live check. Nothing below is decided.

### Research to do

- **Which dragon.** "Dragon" covers traditions that disagree more than the unicorn's did:
  the hoarding, fire-breathing wyrm of Germanic and later European story (Beowulf's dragon,
  Fáfnir in the Völsunga saga, the dragon of the Saint George legend), the serpent-dragon of
  Greek and Roman natural history (Pliny's dragon that fights the elephant), the bestiary and
  early-modern tradition (Topsell's *History of Serpents*, 1608, the companion to his
  *Four-footed Beasts* that fed Sticketh), and East Asian traditions (the Chinese *lóng*,
  associated with water, rain, and good fortune). Choose one for the monster, as the Unicorn
  chose the horse-shaped Western unicorn, and do not flatten the others into cosmetic
  variants; the East Asian dragon, like the qilin, deserves its own design if it is ever made.
- **Sources.** Find public-domain primary texts for the chosen tradition and record exact
  citations. Treat modern works (Tolkien's Smaug, film and game dragons) as tonal references
  only: no names, dialogue, or distinctive designs.
- **Fit with the roster.** The Basilisk is already a serpent with a signature coil and a
  petrifying gaze. A Dragon must play differently, not as a bigger Basilisk.
- **Place on the power curve.** Dragons in story grow from wyrmling to ancient terror. Decide
  whether the Dragon is a caster-like late bloomer (fragile young, strong old) or a brute, and
  whether its growth can be expressed through the existing level scaling rather than new
  systems. Check against the balance target in
  [cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).

### Candidate ideas to evaluate (not decisions)

- A breath attack that hits several opponents but must recover before it can be used again,
  so it is not a better Blast.
- The weak spot: Sigurd kills Fáfnir from a pit beneath its unarmoured belly. That could be a
  counterplay hook, the way the tree feint became Sticketh's risk.
- The hoard: stolen treasure wakes Beowulf's dragon. Any card touching coins or items needs
  the economy owner's review first; see [balance and mechanics](11-balance-and-mechanics.md).
- Scales and flight as defence, bounded like the Unicorn's ward: no unconditional immunity.

### Definition of done for the research step

A design brief in this file with the same sections the Unicorn brief had (creative thesis,
sources and quotation policy, monster specification, three to five related cards with their
risks and counterplay, implementation slices, acceptance gates), reviewed by the owner before
any code is written.

## World and long-term goals

- [ ] Design graveyard NPCs and a memorial-compatible return for permanently dismissed
  monsters.
- [ ] Decide whether the retired exploration concept should return as a structured
  adventure/job-board system.
- [ ] Design tournaments with brackets, prizes, titles, and awards.
- [ ] Design The King's Sentence for large-group boss victories.
- [ ] Decide whether a currency symbol improves the player-facing economy vocabulary.

## Constraints

New combat content needs simulation coverage. Player-facing terminology follows
[voice and wording](../reference/voice-and-wording.md); items follow
[`ITEMS.md`](../../ITEMS.md); teams and boss content follow
[boss encounters](../architecture/boss-encounters.md). Card-spec and card-authoring skill
work is the Cards item above.
