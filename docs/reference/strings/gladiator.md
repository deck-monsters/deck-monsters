---
type: Reference
title: Gladiator strings
description: Human-review inventory of the Gladiator's generated and long-form flavour copy.
status: stable
audience: internal
tags: [voice, strings, monsters, gladiator]
---
# Gladiator strings

Source: `packages/engine/src/monsters/gladiator.ts`. See the [inventory conventions](README.md).

## Generated `look at` description

```text
a {size adjective} gladiator, dressed in {color} and hailing from {location}. Many years ago {he} {was} captured, stripped of {his} title and land, and forced to compete in brutal matches for the entertainment of a blood-thirsty crowd. Standing {height} tall, when you see {him} you know instantly that this is a warrior who has witnessed the worst humankind has to offer and has overcome.
```

Fills: `{color}` defaults to `leather`; `{location}` is `the Roman colosseum`,
`a dusty rural arena`, or `an underground fight club`; paired `{size adjective}` / `{height}`
values are `nimble` / `just over 5 feet`, `powerful` / `a towering 6 feet`, `stocky` /
`a portly five and a half feet`, and `gigantic` / `well over 8 feet`. Pronoun fills are
`he/his/him/was`, `she/her/her/was`, or `they/their/them/were`.

Examples:

- `a nimble gladiator, dressed in leather and hailing from the Roman colosseum. Many years ago he was captured, stripped of his title and land, and forced to compete in brutal matches for the entertainment of a blood-thirsty crowd. Standing just over 5 feet tall, when you see him you know instantly that this is a warrior who has witnessed the worst humankind has to offer and has overcome.`
- `a stocky gladiator, dressed in leather and hailing from a dusty rural arena. Many years ago she was captured, stripped of her title and land, and forced to compete in brutal matches for the entertainment of a blood-thirsty crowd. Standing a portly five and a half feet tall, when you see her you know instantly that this is a warrior who has witnessed the worst humankind has to offer and has overcome.`
- `a gigantic gladiator, dressed in leather and hailing from an underground fight club. Many years ago they were captured, stripped of their title and land, and forced to compete in brutal matches for the entertainment of a blood-thirsty crowd. Standing well over 8 feet tall, when you see them you know instantly that this is a warrior who has witnessed the worst humankind has to offer and has overcome.`

## Long monster description

```text
The gladiator is a professional duelist. Many are born slaves and reared in gladiatorial schools, until such time as they earn their freedom in battle, escape, or rebel. Some join dueling academies voluntarily, seeking fame or fortune in prize fights and honor matches. Some gladiators began as warriors from faroff lands, captured in battle and forced to fight to the death, while others are condemned criminals, paying their debt to society by participating in ritual combat for the public. Whatever their station or background, the gladiator has been hardened by combat and has learned to anticipate a wily foe. While gladiatorial matches often follow a prescribed, even ritual format, the gladiator must always be ready for the possibility that they will be thrown into a situation with unusual weapons, conditions, or opponents. Some arena fighters specialize in fighting exotic animals and monsters.
```
