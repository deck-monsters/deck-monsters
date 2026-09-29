---
type: Roadmap
title: Pins, the Dragon against Blast, and the hold cards
description: Plan for the balance pass carried from roadmap 35, covering advantage against pinned monsters, the level 7 Dragon folding to Blast, Mesmerize and Enthrall, and a per-fight split in the harness.
status: draft
audience: internal
tags: [roadmap, balance, cards, harness]
---
# 36 — Pins, the Dragon against Blast, and the hold cards

**Status:** In progress (2026-09-29) on branch `claude/unicorn-monster-cards-cigpmw`. This
pass takes over the work that
[11's next balance pass](11-balance-and-mechanics.md#next-balance-pass-carried-from-roadmap-35)
carried from [35](../archive/roadmap/35-balance-fixes.md).

It keeps 35's method: variants behind class settings, searched hands, duels, crowds and team
battles, and the per-fight split for all-or-nothing effects. The worked examples are the
[Gloaming Rest](../archive/studies/2026-09-gloaming-rest.md) and
[Helm of Awe and Dissonant Voice](../archive/studies/2026-09-helm-of-awe-and-dissonant-voice.md)
studies. The standing rules are in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).

## The owner's direction (2026-09-29)

- **The pin rule goes first.** It changes what every hold is worth, so the hold cards come
  after it.
- **Blast stays essentially as it is.** A change or cap at higher levels is acceptable. If the
  finding holds up, the preferred fix is something Dragons can do to balance it, such as a
  resistance.
- **Proceed with the carried work now.**

## Tasks

| # | Task | Acceptance | Status | Commit |
|---|---|---|---|---|
| 1 | **Pinned monsters are easier to hit.** Every attack roll against a pinned monster has advantage, as against a restrained creature in D&D. Pinned means held by any `ImmobilizeEffect`, or awed by Helm of Awe. One shared roll-mode helper makes advantage and disadvantage cancel, and Dissonant Voice moves onto it. | Tests; a whole-field before and after on the same searched hands and seeds shows the band and guardrails hold; the owner's run confirms | In progress | |
| 2 | **The level 7 Dragon against Blast.** Validate the finding (3% against the Unicorn), then find its cause in the Dragon's body or hand before changing anything. If it holds, measure Dragon-side fixes first (a resistance), then a Blast cap at high levels | The matchup under the 85% cap, the Dragon's field average in band, no other monster moved out of band | Planned | |
| 3 | **Mesmerize and Enthrall**, after task 1 changes what holds are worth. Candidate first fix: Mesmerize catches its caster only on a natural 1 | Each at least 0.8 in its best context; the Weeping Angel's field average does not rise | Planned | |
| 4 | **Harness: a per-fight split.** A runner option that tags each fight with whether an effect happened, so all-or-nothing cards get the check routinely | Tests; the Gloaming Rest split reproduces | Planned | |
| 5 | **Confirmation and close-out.** The owner's run, then Harden (only if trivial) and the Faceswap watch against production data | Report checked in; this plan archived | Planned | |

## Decisions

- **The advantage comes from the pin's own effect.** The hold's encounter effect already runs
  whenever another monster plays a card. In `DEFENSE_PHASE` it wraps that card's effect, so
  attacks aimed at the pinned monster roll with advantage for that target only. Faceswap,
  Blink, and Take Wing already wrap cards this way. A card's own "roll twice and keep the
  better" (Lucky Strike) already is advantage, and does not stack.
- **Advantage and disadvantage cancel,** as in D&D, through one helper. Dissonant Voice's
  rattle and a pin can both touch the same attack, so each one counting in its own wrapper
  would make the result depend on which effect ran first.
