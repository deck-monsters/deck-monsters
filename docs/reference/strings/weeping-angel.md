---
type: Reference
title: Weeping Angel strings
description: Review inventory for Weeping Angel flavour copy.
status: stable
audience: internal
tags: [voice, strings, monsters, weeping-angel]
---
# Weeping Angel strings

Source: `packages/engine/src/monsters/weeping-angel.ts`. See the [inventory conventions](README.md).

## Generated `look at` description

```text
{A/An} {color} weeping angel. On meeting {him} one might form the following three impressions: that {he} {was} {nationality}, that {he} {was} intelligent, and that {he} {was} {descriptor} than a treeful of monkeys on nitrous oxide.
```

Fills: `{color}` defaults to `stone gray`; `{A/An}` follows the color's first letter;
`{nationality}` is `English`, `Welsh`, or `Scottish`; `{descriptor}` is `frutier` or
`nuttier` (the source spells `frutier` with one `i`). Pronouns are `he/him/was`,
`she/her/was`, or `they/them/were`.

Examples:

- `A stone gray weeping angel. On meeting him one might form the following three impressions: that he was English, that he was intelligent, and that he was frutier than a treeful of monkeys on nitrous oxide.`
- `A stone gray weeping angel. On meeting her one might form the following three impressions: that she was Welsh, that she was intelligent, and that she was nuttier than a treeful of monkeys on nitrous oxide.`

## Long monster description

See the source's static `description` block. It is included here verbatim:

```text
The Weeping Angels are an extremely powerful species of quantum-locked humanoids (sufficient observation changes the thing being observed), so called because their unique nature necessitates that they often cover their faces with their hands to prevent trapping each other in petrified form for eternity by looking at one another. This gives the Weeping Angels their distinct "weeping" appearance. They are known for being "kind" murderous psychopaths, eradicating their victims "mercifully" by dropping them into the past and letting them live out their full lives, just in a different time period. This, in turn, allows them to live off the remaining time energy of the victim's life. However, when this potential energy pales in comparison to an alternative power source to feed on, the Angels are sometimes known to kill by other means, such as snapping their victims' necks.
```
