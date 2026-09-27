---
type: Reference
title: Unicorn strings
description: Human-review inventory of all Unicorn monster and card flavour strings.
status: stable
audience: internal
tags: [voice, strings, monsters, cards, unicorn]
---
# Unicorn strings

This is the priority hand-off inventory for the Unicorn pass. It covers the Unicorn's own
flavour copy and every player-facing description, rules block, narration, roll reason, and
outcome owned by its five new cards. Shared card-framework text is outside this inventory. Sources:
`packages/engine/src/monsters/unicorn.ts` and the five named files under
`packages/engine/src/cards/`. See the [inventory conventions](README.md).

> Reviewer note: lines below reproduce the implementation rather than proposing polished
> replacements. Review for voice, rhythm, repetition, pronoun agreement, punctuation, and
> consistency with the [voice contract](../voice-and-wording.md).

## Monster copy

### Generated `look at` description

```text
{A/An} {build} unicorn bearing {a/an} {horn} horn. {His} coat is {coat}. One witness swears that {witness detail}; the next account will disagree.
```

Fill catalogs:

- `{build}`: `horse-like` (2 weighted slots), `goat-bearded` (2), `stag-headed` (2),
  `stocky, cloven-hoofed` (2), or `elephant-footed` (1).
- `{horn}`: `ringed black`, `white, crimson, and black`, `bright ivory`, or
  `long, straight black`.
- `{coat}`: `ivory white`, `winter white`, `tawny`, or `white with a dark-red head`.
- `{witness detail}` is one of three subtemplates:
  - `{he} {keeps/keep} to {retreat}`, where `{retreat}` is `a rocky gorge`,
    `a laurel grove`, `an inaccessible mountain`, `a lonely wilderness`, or
    `an enclosed garden`.
  - `{his} voice is {voice}`, where `{voice}` is `low as a lowing ox`,
    `clear as a bell`, or `startlingly dissonant`.
  - `{his} eyes are {eyes}`, where `{eyes}` is `dark blue`, `black`, or
    `woodland brown`.
- Pronouns fill as `he/his/keeps`, `she/her/keeps`, or `they/their/keep`.
- `{A/An}` and `{a/an}` are computed from the first letter of the following fill; `{His}` is
  the sentence-capitalized possessive pronoun.

Generated examples:

- `a horse-like unicorn bearing a ringed black horn. His coat is ivory white. One witness swears that he keeps to a rocky gorge; the next account will disagree.`
- `a goat-bearded unicorn bearing a white, crimson, and black horn. Her coat is tawny. One witness swears that her voice is clear as a bell; the next account will disagree.`
- `an elephant-footed unicorn bearing a bright ivory horn. Their coat is white with a dark-red head. One witness swears that their eyes are woodland brown; the next account will disagree.`
- `a stocky, cloven-hoofed unicorn bearing a long, straight black horn. Their coat is winter white. One witness swears that they keep to an inaccessible mountain; the next account will disagree.`

### Long monster description

```text
No two accounts of the unicorn agree. Ancient travellers described a wild creature of distant lands, white in body and dark red about the head, swifter than any horse, with a single horn banded white, crimson, and black. Other ancient writers gave them a stag's head, a boar's tail, even an elephant's feet, and later ones a goat's beard and cloven hooves. What survives every retelling is the silhouette: a pale, horse-shaped animal with one horn, glimpsed at a distance and gone before anyone gets closer.

The horn is at the heart of every story. Some tellers say that whoever drinks from a cup carved from it is safe from poison; others describe a weapon long and sharp enough to run a foe straight through. In the ring both stories hold. A unicorn's charge is terrible, but a patient opponent who steps aside at the last instant can leave that horn stuck fast in the timber.

Unicorns keep to deserted places. They are gentle with most creatures, yet they are said to fight their own kind, and they cannot be taken and held against their will. A unicorn who fights beside a Beastmaster has chosen to, and one who trusts a companion may kneel to rest in the evening light, which is the closest anyone ever gets.
```

## Dissonant Voice

Source: `cards/dissonant-voice.ts`.

**Card description (fixed):** `A cry that no throat that shape should make. It is hard to aim while it rings.`

**Rules copy (generated from fixed `-2`):**

```text
Each opponent rolls 1d20 + int vs your int. On a failure, their next card takes 2 off its attack roll. A card that does not roll to hit (Blast, Heal) uses up the penalty with no effect.
No damage. Does not stack.
```

| Situation | Template |
|---|---|
| Penalty consumed | `{target}'s ears still ring 🔔 (-2 to attack).` |
| Save succeeds | `{target} shakes it off.` |
| Already affected | `{target} is already rattled.` |
| Save fails | `{target} is rattled!` |
| Save reason, ordinary target | `vs {player}'s int ({int}) to keep {his} focus.` |
| Save reason, confused self-target | `vs {his} own int ({int}) to keep {his} focus.` |

Examples:

- `Bramble's ears still ring 🔔 (-2 to attack).`
- `Nola shakes it off.`
- `Bramble is already rattled.`
- `Nola is rattled!`
- `vs Nola's int (9) to keep his focus.`
- `vs their own int (9) to keep their focus.`

## Gloaming Rest

Source: `cards/gloaming-rest.ts`.

**Card description (fixed):** `Kneel among the laurel as the light goes. Trust that nobody strikes before you rise.`

**Rules copy (generated from fixed `-2 ac` and `3d4`):**

```text
Kneel to rest: -2 ac until your next card.
If nothing damages you before then, heal 3d4 as that card begins. Any damage interrupts the rest and the healing is lost.
```

| Situation | Template |
|---|---|
| Rest begins normally | `🌙 As the light fails, {player} kneels among the laurel and closes {his} eyes.` |
| Confused target rests | `🌙 In confusion, {player} coaxes {target} to kneel and rest.` |
| Rest interrupted | `🌙 {target}'s rest was broken. {He} {rises/rise} without its comfort.` |
| Rest succeeds (roll reason) | `for a quiet rest.` |
| Rest succeeds (outcome) | `{target} rises from the laurel, restored.` |
| Already resting | `{target} is already resting.` |

Examples:

- `🌙 As the light fails, Nola kneels among the laurel and closes her eyes.`
- `🌙 In confusion, Nola coaxes Bramble to kneel and rest.`
- `🌙 Bramble's rest was broken. He rises without its comfort.`
- `🌙 Nola's rest was broken. They rise without its comfort.`
- `Nola rises from the laurel, restored.`
- `Bramble is already resting.`

## Horn of Proof

Source: `cards/horn-of-proof.ts`.

**Card description (fixed):** `Dip the horn in the cup, and whatever was poisoned is made clean.`

**Rules copy (generated from fixed `3 hp`):**

```text
Remove one of these, in order: your worst stat penalty this fight, or a Bad Batch waiting in the ring. If the horn is turned on someone who is held, it frees them first.
Then heal 3 hp.
```

| Situation | Template |
|---|---|
| A hold is cleansed | `🏺 The horn's touch loosens the hold. {target} is free.` |
| A stat curse is cleansed | `🏺 The horn draws out the curse on {target}'s {stat}.` |
| A Bad Batch is cleansed | `🏺 {target} dips the horn in the cups in the ring. One bad batch is found out and poured away.` |
| Nothing is cleansed | `🏺 The horn finds nothing to purify.` |

`{stat}` can be `ac`, `dex`, `str`, or `int`. Examples:

- `🏺 The horn's touch loosens the hold. Nola is free.`
- `🏺 The horn draws out the curse on Nola's dex.`
- `🏺 Bramble dips the horn in the cups in the ring. One bad batch is found out and poured away.`
- `🏺 The horn finds nothing to purify.`

## Unconquerable Horn

Source: `cards/unconquerable-horn.ts`.

**Card description (fixed):** `They may be beaten, but they will not be taken and held.`

**Rules copy (fixed):**

```text
Ward yourself against the next hold an opponent lands on you (immobilize, pin, coil, enthrall, and the like). The hold is cancelled and the ward is spent; any damage that comes with it still lands.
Once per fight. Does not stack.
```

| Situation | Template |
|---|---|
| Ward armed normally | `💎 {player} lowers {his} horn and plants {his} hooves. The next hold will not take.` |
| Ward armed on a confused target | `💎 In confusion, {player} lends {his} ward to {target}. The next hold on {him} will not take.` |
| Ward already armed | `{target} is already braced against being held.` |
| Ward already spent | `{target} has already refused one hold this fight. The ward will not rise again.` |

Examples:

- `💎 Nola lowers her horn and plants her hooves. The next hold will not take.`
- `💎 Rowan lowers their horn and plants their hooves. The next hold will not take.`
- `💎 In confusion, Nola lends her ward to Bramble. The next hold on him will not take.`
- `Bramble is already braced against being held.`
- `Nola has already refused one hold this fight. The ward will not rise again.`

## Sticketh

Source: `cards/sticketh.ts`.

**Card description (fixed):** `Charge horn-first. Old accounts warn that a clever foe steps aside, and the "sharp horn sticketh fast."`

**Rules-copy template:**

```text
Charge: {attack dice} +1 vs ac / Damage: {damage dice}
On a miss, roll 1d20 + str vs the target's dex to pull up in time.
Fail, and your horn is stuck fast: at the start of each of your turns, roll 1d20 + str vs your own str - (turns stuck x 3) to pull it free. A stuck monster misses that turn.
Natural 1 on either roll fails. Natural 20 on the charge deals max damage.
```

Both dice placeholders default to `1d10`, producing `Charge: 1d10 +1 vs ac / Damage: 1d10`.

The card also supplies the action labels `stick fast`, `sticks fast`, and `stuck fast` to
the shared immobilize flow.

### Charge roll

| Situation | Template or fixed string |
|---|---|
| Natural 20 | `{player} rolled a natural 20. Automatic max damage.` |
| Natural 1 | `{player} rolled a 1. {target} sidesteps at the last instant.` |
| Tie | `Miss... Tie goes to the defender.` |
| Ordinary success | `Hit!` |
| Ordinary failure | `Miss...` |
| Reason against opponent | `vs {target}'s ac ({ac}) to see if the charge lands.` |
| Reason when confused | `vs {his} own ac ({ac}) in confusion.` |

Examples: `Nola rolled a natural 20. Automatic max damage.`; `Nola rolled a 1. Bramble
sidesteps at the last instant.`; `vs Bramble's ac (14) to see if the charge lands.`; and
`vs their own ac (14) in confusion.`

### Pull-up roll after a miss

| Situation | Template or fixed string |
|---|---|
| Success | `{player} pulls up in time.` |
| Natural 1 | `{player} rolled a natural 1. The horn buries itself in the timber.` |
| Tie | `Tie... the horn sticks.` |
| Failure | `The horn sticks fast!` |
| Reason against opponent | `vs {target}'s dex ({dex}) to pull up before the horn sticks.` |
| Reason when confused | `vs {his} own dex ({dex}) to pull up before the horn sticks.` |

Examples: `Nola pulls up in time.`; `Nola rolled a natural 1. The horn buries itself in the
timber.`; `vs Bramble's dex (12) to pull up before the horn sticks.`; and `vs her own dex
(12) to pull up before the horn sticks.`

### Stuck and freedom narration

| Situation | Template or fixed string |
|---|---|
| Hold begins | `{player}'s horn 🦄 sticks fast in the timber. At the beginning of {his} turn {he} will roll {freedom threshold} to pull it free.` |
| Still held | `{target}'s horn is still 🦄 stuck fast in the timber.` |
| Freedom natural 20 | `{target} rolled a natural 20 and wrenches the horn free.` |
| Freedom natural 1 | `{target} rolled a natural 1. The horn only sinks deeper.` |
| Freedom tie | `Tie... the timber holds.` |
| Opponent opening after the self-hold | `{target} has an opening.` |

`{freedom threshold}` is a nested shared-mechanics string produced by
`ImmobilizeCard.freedomThresholdNarrative`, not by Sticketh itself. Examples:

- `Nola's horn is still 🦄 stuck fast in the timber.`
- `Bramble rolled a natural 20 and wrenches the horn free.`
- `Nola rolled a natural 1. The horn only sinks deeper.`
- `Bramble has an opening.`

## Editorial hand-off checklist

- Preserve placeholders and branch distinctions when suggesting replacements; a fixed line
  cannot silently acquire data the runtime branch does not have.
- Read generated examples aloud with he/him, she/her, and they/them pronouns.
- Flag deliberate archaism (`Sticketh`) separately from accidental stiffness.
- Check repeated motifs across the monster and cards: witnesses disagree, voluntary trust,
  the horn's purity, dissonance, and refusal to be held.
- Treat the mechanics in each rules block as constraints on flavour claims.
