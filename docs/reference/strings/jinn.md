---
type: Reference
title: Jinn strings
description: Human-review inventory of the Jinn's generated and long-form flavour copy.
status: stable
audience: internal
tags: [voice, strings, monsters, jinn]
---
# Jinn strings

Source: `packages/engine/src/monsters/jinn.ts`. See the [inventory conventions](README.md).

## Generated `look at` description

```text
a {color} figure {descriptor} in the dusty shadows at the corner of your vision. At first you think it might be human and you wonder who or what {he} {is}. What {is} {he} thinking about? When you turn to look closer all you see is a {animal} and a gently settling cloud of sand.
```

Fills: `{color}` defaults to `fiery red`; `{descriptor}` is `lurks`, `sulks`,
`tip-toes`, or `hides`; `{animal}` is `black dog`, `coyote`, `goat`, `crow`, or `lamp`.
Pronoun fills are `he/is`, `she/is`, or `they/are`.

Examples:

- `a fiery red figure lurks in the dusty shadows at the corner of your vision. At first you think it might be human and you wonder who or what he is. What is he thinking about? When you turn to look closer all you see is a black dog and a gently settling cloud of sand.`
- `a fiery red figure tip-toes in the dusty shadows at the corner of your vision. At first you think it might be human and you wonder who or what she is. What is she thinking about? When you turn to look closer all you see is a crow and a gently settling cloud of sand.`
- `a fiery red figure hides in the dusty shadows at the corner of your vision. At first you think it might be human and you wonder who or what they are. What are they thinking about? When you turn to look closer all you see is a lamp and a gently settling cloud of sand.`

## Long monster description

```text
Jinn are not purely spiritual, but also physical in nature, being able to interact in a tactile manner with people and objects and also subject to bodily desires like eating and sleeping. Generally jinn lack individuality and are thought to appear in mists or sandstorms, but when they materialize in different forms they may gain individuality. Individual jinn are commonly depicted as monstrous and anthropomorphized creatures with body parts from different animals or human with animalic traits. Their speed, cunning, and amorphous nature makes them difficult to catch a glimpse of against their will.
```
