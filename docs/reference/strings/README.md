---
type: Reference
title: Monster and card strings
description: Generated review inventories of each monster's flavour copy and its signature cards, and how to review them.
status: stable
audience: internal
tags: [voice, strings, monsters, cards]
---
# Monster and card strings

These inventories put each monster's player-facing copy in one place for editorial review.
They are **generated** by `packages/engine/src/build/strings-inventory.ts` when you run
`pnpm run build:docs`; do not edit them by hand. A test
(`strings-inventory.test.ts`) fails when a checked-in inventory no longer matches the
source, so a string change and its inventory land in the same commit.

They were hand-written until September 2026. The first voice pass on the Unicorn changed
nearly every line the Unicorn inventory had copied, which is why they are now built from
the code.

| Monster | Inventory |
|---|---|
| Basilisk | [Basilisk strings](basilisk.md) |
| Dragon | [Dragon strings](dragon.md) |
| Gladiator | [Gladiator strings](gladiator.md) |
| Jinn | [Jinn strings](jinn.md) |
| Minotaur | [Minotaur strings](minotaur.md) |
| Unicorn | [Unicorn strings](unicorn.md) |
| Weeping Angel | [Weeping Angel strings](weeping-angel.md) |

## What each inventory contains

- **`look at` examples**, rendered from the monster with a fixed seed and cycling he, she,
  and they, so a reviewer can read real sentences with every pronoun set.
- **Fill lists**: the module-level lists the monster samples from.
- **Templates**: every string and template literal in the monster's class, with `${...}`
  shown as `{placeholders}`.
- **Ring entrance**: additive player and house narration from `announcements/ring-flavour.ts`,
  rendered with he, she and they; every live player/boss variant is enumerated without
  advancing the Ring’s rotation. The Minotaur also shows its Unicorn/roses variant.
- **Long description**: the lore shown in `MONSTERS.md`.
- **Signature cards**: every card whose permitted types name the monster. Each card shows
  its description, its rules text, its narration and outcome templates, and any line
  elsewhere in the engine that names the card.

## Reading placeholders

- `{player}`, `{target}`: a monster's name.
- `{he}`, `{his}`, `{him}`, `{He}`: pronouns; a capital means the sentence starts there.
- `{keeps/keep}`: a verb that agrees with the pronoun (`agree()`): the first form for
  he or she, the second for they.
- `{is}` or `{s}`: a pronoun-dependent verb or suffix.
- `{succeeded! / failed.}`: a ternary, showing what each branch prints; `—` is an empty
  branch.
- Any other `{name}` is a value filled at runtime, named after the variable or method that
  supplies it (`{freedomThresholdNarrative}` is the shared "will roll 11 or higher"
  sentence).
- `⏎` marks a line break inside a table cell.

Extraction reads literals, not meaning: a literal with no space in it is treated as an
identifier and left out, and shared card-framework text (for example the base hit and miss
lines) belongs to the framework, not to any one monster.

## Review checklist

- Preserve placeholders and branch distinctions when suggesting replacements; a fixed line
  cannot silently gain data its branch does not have.
- Read the examples aloud with he, she, and they.
- Check old-fashioned lines against the house style in
  [voice and wording](../voice-and-wording.md#old-fashioned-lines).
- Check repeated motifs across a monster and its cards.
- Treat each rules block as a constraint on what the flavour may claim.
