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
- [ ] **Strings inventory follow-ups.** The per-monster inventories are generated
  (`packages/engine/src/build/strings-inventory.ts`, September 2026). Still open:
  - Inventories for text no monster owns: the shared card framework (base hit and miss,
    the default immobilize lines), items, bosses and ring events, and command help. The
    same extractor can render them; they need a sensible page per area.
  - Non-signature cards that several classes share (Blast, Heal, Soften) have no
    inventory yet; a per-class page is the natural home.
  - A lint check for an "-eth" verb right after a pronoun placeholder (`{he} riseth`),
    which reads "they riseth" for a they/them monster. The inventories make it a regex
    over generated text.

## Monsters and items

- [x] **Unicorn content pack.** Shipped in PR #394: the Unicorn and five cards (Sticketh,
  Horn of Proof, Unconquerable Horn, Dissonant Voice, Gloaming Rest). The pass record and the
  original brief are archived as [26 — Unicorn content pack](../archive/roadmap/26-unicorn-pack.md).
- [x] **Unicorn voice punch-up.** The owner finds the Unicorn's flavour text bland (September
  2026) and wants more edge from the old sources. Proposals for every Unicorn string, with
  the archive checks recorded, are in
  [28 — Unicorn voice punch-up](../archive/roadmap/28-unicorn-voice-punch-up.md). Shipped
  with the owner's picks (September 2026).
- [ ] **Dragon.** A second requested monster, researched and built the way the Unicorn was.
  Research comes first; see the [Dragon research brief](#dragon-research-brief) below.
- [ ] A qilin/kirin creature deserves its own sourced design rather than a cosmetic Unicorn
  variant (a rule carried over from the Unicorn brief).
- [ ] Add the Time Lord monster and its time-manipulation deck.
- [ ] Add the Bureaucrat monster and its tax, redistribution, and arrest mechanics.
- [ ] Design equipment slots and their stat trade-offs.
- [ ] Decide how monster-slot capacity is earned; the existing modifier is deliberately
  dormant until a reward is chosen.

## Dragon follow-ups

The Dragon shipped in PR #402 ([30 — Dragon pack](../archive/roadmap/30-dragon-pack.md);
research in [29](../archive/roadmap/29-dragon-research.md), which also keeps the original
brief). Its current rules are in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#ancient-dragons).
Open work:

- [ ] **Counter cards, the next content PR** (owner, 2026-09-27). Cards that answer a Dragon
  but are useful against anyone, so neither is dead in a deck that never meets one:
  - **Lullaby** (Bard and Unicorn, beside Dissonant Voice): 1d20 + INT vs the target's
    INT; on a success the target dozes and loses its next card, through `immobilize()`, so
    the Unconquerable Horn ward applies. +4 against a Dragon (old tales lull
    treasure-guarding dragons to sleep with song).
  - **Mirror Shield** (Fighter and Bard): the next area attack aimed at you (Fire Breath,
    Blast, Sandstorm, Tsunami) turns back: you take half, and half hits its caster. Spent
    on use. Watch in `sim:monster` that it does not become a hard counter to Blast Clerics.
- [ ] **Flavour-text pass after play**, as the Unicorn had
  ([28](../archive/roadmap/28-unicorn-voice-punch-up.md)). Start from the
  [Dragon strings inventory](../reference/strings/dragon.md) and the requester's reactions
  (his first was positive). Keep the pack's rule: the *How to Train Your Dragon* books
  supply setting and feel only (Vikings, Romans, the arena), never names, quotes, species,
  or designs; old public-domain texts may be quoted for atmosphere.
- [ ] **Live check in the browser**: the Dragon's sprite in the ring roster, and each card's
  feed lines in a real fight (breath burns and dodges, a take-off and dive, a calm hide and
  a fury, a Tsunami self-hit). Unit tests and the harness cover the rules, not the display.
- [ ] **Ideas the pack deferred** (details in 29's candidate table):
  - *The hoard* (One Cup Missing): a bounded next-attack bonus when a card is stolen from
    the Dragon's hand. Needs a generic "a card was taken from you" hook on the victim.
  - *Soft Underbelly as a shared mechanic*: an "exposed" state other attacks read. Ancient
    dragons have their own local version (the natural-20 underbelly); a shared one touches
    every attack roll and needs its own design.
  - *Roman cards* (Raise the Draco, Ballista Crew): likely a Gladiator pack, not a Dragon one.

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
