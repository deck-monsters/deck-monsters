---
type: Reference
title: Monster and card strings
description: Review inventories for monster flavour copy and, where available, their class-specific cards.
status: stable
audience: internal
tags: [voice, strings, monsters, cards]
---
# Monster and card strings

These inventories put the current player-facing copy in one place for human editorial
review. They are **review aids, not a second source of truth**: implementation remains in
`packages/engine/src/monsters/` and `packages/engine/src/cards/`. If a reviewer approves
new wording, change the source and its tests first, then refresh the corresponding
inventory.

Templates use `{braced placeholders}` even though the TypeScript uses template literals.
Each inventory lists the value sets that fill those placeholders and renders several
complete examples, so prose can be judged as a sentence rather than as code fragments.

| Monster | Inventory | Card coverage |
|---|---|---|
| Unicorn | [Unicorn strings](unicorn.md) | Complete for the five Unicorn cards |
| Basilisk | [Basilisk strings](basilisk.md) | Monster text only |
| Gladiator | [Gladiator strings](gladiator.md) | Monster text only |
| Jinn | [Jinn strings](jinn.md) | Monster text only |
| Minotaur | [Minotaur strings](minotaur.md) | Monster text only |
| Weeping Angel | [Weeping Angel strings](weeping-angel.md) | Monster text only |

Shared base-monster messages and generic card-framework messages are outside this pass.
For the non-Unicorn inventories, card mechanics/stat copy and cards are also deferred. The next card-string review can extend
this folder without changing its format.
