---
type: Reference
title: Basilisk strings
description: Human-review inventory of the Basilisk's generated and long-form flavour copy.
status: stable
audience: internal
tags: [voice, strings, monsters, basilisk]
---
# Basilisk strings

Source: `packages/engine/src/monsters/basilisk.ts`. See the [inventory conventions](README.md).

## Generated `look at` description

```text
a {size adjective}, {color}, {location}-dwelling basilisk with a nasty disposition and the ability to turn creatures to stone with {his} gaze. In the forest {he} {is} king and (weighing {weight}) in the ring {he} {is} much to be feared. See how {he} rear{s} {his} head, and roll{s} about {his} dreadful eyes, to drive all virtue out, or look it dead!
```

Fills: `{color}` defaults to `tan`; `{location}` is `forest`, `desert`, or `cave`;
the paired `{size adjective}` / `{weight}` values are `slender` / `240lbs`, `powerful` /
`300lbs`, `stocky` / `320lbs`, and `massive` / `over 400lbs`. Pronoun fills are
`he/his/is/s`, `she/her/is/s`, or `they/their/are/` (empty verb suffix).

Examples:

- `a slender, tan, forest-dwelling basilisk with a nasty disposition and the ability to turn creatures to stone with his gaze. In the forest he is king and (weighing 240lbs) in the ring he is much to be feared. See how he rears his head, and rolls about his dreadful eyes, to drive all virtue out, or look it dead!`
- `a powerful, tan, desert-dwelling basilisk with a nasty disposition and the ability to turn creatures to stone with her gaze. In the forest she is king and (weighing 300lbs) in the ring she is much to be feared. See how she rears her head, and rolls about her dreadful eyes, to drive all virtue out, or look it dead!`
- `a massive, tan, cave-dwelling basilisk with a nasty disposition and the ability to turn creatures to stone with their gaze. In the forest they are king and (weighing over 400lbs) in the ring they are much to be feared. See how they rear their head, and roll about their dreadful eyes, to drive all virtue out, or look it dead!`

## Long monster description

```text
The basilisk, often called the "King of Serpents," is in fact not a serpent at all, but rather an eight-legged reptile with a nasty disposition and the ability to turn creatures to stone with its gaze. Folklore holds that, much like the cockatrice, the first basilisks hatched from eggs laid by snakes and incubated by roosters, but little in the basilisk's physiology lends any credence to this claim.

Basilisks live in nearly any terrestrial environment, from forest to desert, and their hides tend to match and reflect their surroundings—a desert-dwelling basilisk might be tan or brown, while one that lives in a forest could be bright green. They tend to make their lairs in caves, burrows, or other sheltered areas, and these dens are often marked by statues of people and animals in lifelike poses—the petrified remains of those unfortunate enough to stumble across the basilisk.

Basilisks have the ability to consume the creatures they petrify, their churning stomach acid dissolving and extracting nutrients from the stone, but the process is slow and inefficient, making them lazy and sluggish. As a result, basilisks rarely stalk prey or chase those who avoid their gaze, counting on their stealth and the element of surprise to keep them safe and fed. When not lying in wait for the small mammals, birds, and reptiles that normally make up their diet, basilisks spend their time sleeping in their lairs, and those brave enough to capture basilisks or hide treasure near them find that they make natural guardians and watchdogs.

An adult basilisk is 13 feet long, with fully half of that made up by its long tail, and weighs 300 pounds. Some breeds have short, curved horns on their noses or small crests of bony growths topping their heads like crowns. Though normally solitary creatures, coming together only to mate and lay eggs, in particularly dangerous areas small groups may band together for protection and attack intruders en masse.
```
