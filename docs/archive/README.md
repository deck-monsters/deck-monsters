---
type: Archive
title: Archived Documentation
description: Historical plans and retired subsystems that are not current contracts.
status: deprecated
audience: internal
tags: [archive, history, index]
---
# Archived Documentation

> Historical record. Current code and documents linked from `docs/README.md` are
> authoritative. Any remaining work has been copied to the active roadmap.

This directory preserves shipped plans, retired subsystems, and completed pass records
whose reasoning may explain a current constraint. It is not a planning queue.

| Location | Contents |
|---|---|
| [roadmap/](roadmap/) | Shipped roadmap plans, including historical mobile, Slack, graphics, item, workspace, and pixel work, the Unicorn content pack, the Unicorn voice punch-up, the Dragon research and content pack, Pass B's realistic rings and boss balance, Pass C's mega boss and class balance, and the heal and stat-card pass, roadmap 35's balance fixes (the Dragon and Gladiator bodies, the Unicorn's cards, the Dragon's new options), roadmap 36 (advantage against pinned monsters, Take Wing's area dodge, Mesmerize's natural-1 self-catch, the per-fight split), roadmap 38 (bosses that outnumber the humans turn on each other; ring events picked by weight among all events), roadmaps 37 and 40 (room state as `jsonb`, the `state_blob` drop, and the save-crash, cross-process reset, CI Postgres and sim-leak fixes), roadmap 39a (the in-game help spec and Cursor's first passes), roadmap 42a (the second new-player walk), roadmap 43 (small fixes from that walk) roadmap 44 (card roles and guides, card details in the Workshop, `look at cards for`, the training wizard) roadmap 45 (fixes from the guides check), roadmap 49 (a fixed turn order for encounter effects, ac and level changes that say why, Workshop "Needs cards", "Beginner" everywhere, Tipsy, Blink breaking when the angel falls), roadmap 50 (three matchup tiers for hold cards, effects that end when their caster falls, reset cleanup, the fight log), and roadmap 51 (every attack card names and rolls its stat, the Kalevala rolls int, hiding as a contest lasting three cards, same-turn damage on a falling monster, natural-1 backfires and d20-only crits, Tipsy's 1d6) |
| [passes/](passes/) | Completed multi-task pass records, including the documentation lifecycle reset |
| [studies/](studies/) | Closed design studies with their measurements, including the [Gloaming Rest heal study](studies/2026-09-gloaming-rest.md), the [Helm of Awe and Dissonant Voice study](studies/2026-09-helm-of-awe-and-dissonant-voice.md), and the [Millefleur theme iterations](studies/millefleur-theme/README.md) |
| [retired/](retired/) | Deliberately retired subsystems |

For active work, start at [`docs/roadmap/README.md`](../roadmap/README.md). For current
behavior, start at [`docs/README.md`](../README.md).
