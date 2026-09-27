---
type: Reference
title: Minotaur strings
description: Human-review inventory of the Minotaur's generated and long-form flavour copy.
status: stable
audience: internal
tags: [voice, strings, monsters, minotaur]
---
# Minotaur strings

Source: `packages/engine/src/monsters/minotaur.ts`. See the [inventory conventions](README.md).

## Generated `look at` description

```text
a battle-hardened, {color} minotaur with a {pattern} pattern shaved into {his} thick fur. Make no mistake, despite {his} {descriptor} bulk {he} {is} a first-class host who has never been put to shame at a dinner party.
```

Fills: `{color}` defaults to `angry red`; `{pattern}` is `crescent`,
`mind-blowingly intricate`, or `bold`; `{descriptor}` is `tremendous`,
`awe-inspiring`, or `fearsome`. Pronoun fills are `he/his/is`, `she/her/is`, or
`they/their/are`.

Examples:

- `a battle-hardened, angry red minotaur with a crescent pattern shaved into his thick fur. Make no mistake, despite his tremendous bulk he is a first-class host who has never been put to shame at a dinner party.`
- `a battle-hardened, angry red minotaur with a mind-blowingly intricate pattern shaved into her thick fur. Make no mistake, despite her awe-inspiring bulk she is a first-class host who has never been put to shame at a dinner party.`
- `a battle-hardened, angry red minotaur with a bold pattern shaved into their thick fur. Make no mistake, despite their fearsome bulk they are a first-class host who has never been put to shame at a dinner party.`

## Long monster description

```text
The bull-folk have many of the same characteristics as the bulls they resemble. Both genders have horned heads covered with shaggy hair. Warriors braid their hair with teeth or other tokens of fallen enemies. The thick hair covering their large bodies varies widely in color, from bright white to medium red-browns to dark brown and black. Many minotaurs shave or dye their fur in patterns signifying their allegiances and beliefs. Other methods of decoration include brands, ritual scars, and gilding or carving their horns.

Adult males can reach a height of 6 ½ – 7 feet, with females averaging 3 inches shorter. Both genders have a great deal of muscle mass even for their considerable size, and physical prowess plays a large part in their social structure. Minotaurs can live as long as humans but reach adulthood 3 years earlier. Childhood ends around the age of 10 and adulthood is celebrated at 15. However, most minotaurs don't form their own families until at least the age of 25. They spend those 10 years proving themselves to their elders.

Minotaurs are omnivores and consume large quantities of both meat and vegetation. Great banquets mark important social and religious occasions, and a successful feast is often a point of regional pride; competition between regional cuisines is fierce, sometimes violent, and eagerly anticipated. The minotaurs are particularly mindful of meals before great ceremonies or displays of skill, and the hosts of such events can earn nearly as much honor as the champions by providing memorable feasts. To fail as a host brings deep shame.
```
