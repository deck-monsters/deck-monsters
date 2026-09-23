---
type: Reference
title: Player agency
description: Commitment-then-surrender rules and the limit on live combat control.
status: stable
audience: internal
tags: [agency, items, combat]
---
# Player agency

Read before: proposing player control, mid-fight item behavior, monster attachment, or
balance changes justified by motivation research.

## Commitment, then surrender

Deck Monsters is deliberately hands-off during a fight. A Beastmaster chooses a monster,
deck order, and what that monster carries before the encounter, then watches those choices
resolve. The build phase is the strategic act; continuous combat steering would turn the
game into something else.

Items are the bounded exception. A monster can use only compatible items it already carries
while in an encounter. That keeps a live action available without removing the preparation
decision that limits it. See [`ITEMS.md`](../../ITEMS.md) for player rules and
[workshop and items](../architecture/workshop-and-items.md) for the implementation boundary.

**Do not add unbounded live combat control.** New mid-fight levers must be bounded by a
prior commitment or a separately tested, explicit balance rule.

## Motivation framing

Self-Determination Theory usefully distinguishes:

- **autonomy** — voluntary deck, monster, and preparation choices;
- **competence** — seeing meaningful progress and learning the consequences of those
  choices; and
- **relatedness** — sharing a room and its fights with other players.

Named monsters, their records, memorials, and earned titles can strengthen attachment and
competence, but need durable analytics design before they are promised to players.

## Evidence limits

The supporting research includes video-game motivation work and a separate children's
tabletop-RPG research pass. The former is relevant framing, not a mechanical prescription.
The latter's child-specific observations, practitioner accounts, and player-type taxonomies
are hypotheses, not evidence for adult Deck Monsters players.

Treat proposed balance changes as hypotheses: use the simulation harness and telemetry before
shipping them. The actionable product work is in
[`roadmap/item-followups.md`](../roadmap/item-followups.md); balance measurement is in
[`roadmap/11-balance-and-mechanics.md`](../roadmap/11-balance-and-mechanics.md).
