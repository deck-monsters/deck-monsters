---
type: Reference
title: Real-card catalogue, 2026-09-28
description: Every card's value in Hit-equivalents on the reference chassis at levels 1, 3, 5, 7, and 12, with outliers flagged against its action class (roadmap 34 Layer 2).
status: stable
audience: internal
tags: [balance, harness, reports, cards]
---
# Real-card catalogue, 2026-09-28

Roadmap 34 task 6 (Layer 2). No card was changed. Plan: `pnpm --filter @deck-monsters/harness
plan:catalogue -- --out plan.json` (defaults: levels 1, 3, 5, 7, 12; 25 fights per seat order),
run with `sim:batch`, and read with `sim:catalogue <run> <ladder runs...>`. That was 5,184
units and 259,200 fights in 22 minutes, with 0 failed units, run at `e325797`. The ladder for
the conversion is the two-sided ladder at levels 1, 4, 7, and 12 (see
[ladder and HE](2026-09-28-ladder-and-he.md)), plus levels 3 and 5 run for this report
(31,920 fights). The JSON is [2026-09-28-catalogue.json](2026-09-28-catalogue.json).

## What each number is

- **sHE** (the main column). This is the card's value in Hit-equivalents: one card in a hand
  of 8 Hits on the reference chassis, played against 9 Hits. The card goes once in each of the
  nine slots, and the hand's score is converted through the ladder, minus 8. A Hit is exactly
  1 and a card that does nothing is 0. Below 0 means worse than an empty slot. Because the
  card sits once in every slot, this is its **position-averaged** value, not its value in the
  best slot.
- **field HE.** The same hand against the reference field hand (`Hit, Hit, Delayed Hit, Hit,
  Heal, Soften, Hit, Forked Stick, Hit`):
  `1 + (score − 9 Hits' score) / (what one Hit is worth against the field)`.
  Its baseline is small, so treat it as a direction check only. For example, level 3's
  one-Hit slope is 7.7 points against 12.5 at level 1, which inflates every level-3 field
  value.
- **Flags.** A card is flagged when it is far from its action class's median sHE at that
  level:
  - above 1.5× the median, with the owner's rarity premium on top (×1.5 for epic and very
    rare, ×1.25 for rare);
  - or below 0.5× the median.
  - Classes with fewer than 3 cards, or a median under 0.2, are not flagged.
- **Precision.** About 900 fights per card per level against Hits, which is roughly ±0.2 HE
  (one standard error). A flag within about 0.3 HE of its threshold may be noise.
- **What this cannot see.** This is a duel on a typeless body:
  - **Type-dependent effects read as a Hit.** Fists of Villainy is exactly 1.00 because in a
    duel it plays exactly like a Hit (its lowest-HP targeting only matters in a ring).
  - **Area and crowd effects are undercounted.** In a duel there is only one opponent.
  - **Holder synergy is absent.** A signature card on its own monster's stats (for example,
    Tsunami on a Dragon's INT) is measured on the median chassis. Layer 3 puts each card back
    on its real holders.

## The catalogue

Levels 1, 3, 5 and 7 are the primary levels (owner: tune for levels 0–7); level 12 is the long tail. `—` means the card cannot be held at that level.

| Card | Class | Rarity | Holders | sHE L1 | sHE L3 | sHE L5 | sHE L7 | sHE L12 | field L1 | field L3 | field L5 | field L7 | field L12 | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Sandstorm | area | epic | Jinn | 2.18 | 2.04 | 1.93 | 2.66 | 3.44 | 1.88 | 3.72 | 2.61 | 3.12 | 3.68 |  |
| Fire Breath | area | common | Dragon | 1.44 | 1.32 | 1.52 | 1.73 | 2.49 | 0.81 | 1.53 | 1.13 | 1.37 | 2.96 |  |
| Blast | area | abundant | Cleric | 1.07 | 1.28 | 1.27 | 2.01 | 2.68 | 0.76 | 1.64 | 1.13 | 1.20 | 2.69 |  |
| Tsunami | area | epic | Dragon | 0.32 | 0.13 | 0.33 | -0.01 | 0.62 | 0.08 | -0.40 | 0.15 | 0.13 | -0.23 | L1 low (0.3x); L3 low (0.1x); L5 low (0.2x); L7 low (-0.0x); L12 low (0.3x) |
| Blast II | area | uncommon | Cleric | — | 1.21 | 1.68 | 1.29 | 1.96 | — | 1.93 | 1.52 | 1.56 | 2.11 |  |
| Prion Disease ("1993-09-7202 18:58") | area | epic | any | — | 0.05 | 0.29 | 0.19 | 0.27 | — | -0.08 | 0.13 | 0.40 | 0.46 | L3 low (0.0x); L5 low (0.2x); L7 low (0.1x); L12 low (0.1x) |
| Harden | boost | common | any | 0.37 | 0.33 | 0.45 | 0.43 | 0.36 | 0.55 | 0.14 | 0.41 | 0.28 | 0.14 |  |
| Unconquerable Horn | boost | uncommon | Unicorn | 0.30 | 0.30 | 0.23 | 0.06 | 0.42 | 0.13 | -0.12 | 0.17 | 0.13 | 0.02 | L5 low (0.5x); L7 low (0.2x) |
| Adrenaline Rush | boost | common | Barbarian/Fighter | — | 0.38 | 0.86 | 0.49 | 0.73 | — | 1.54 | 1.22 | 0.63 | 1.49 | L5 high (1.9x class median) |
| Basic Shield | boost | common | Bard/Fighter | — | 0.48 | 0.54 | 0.58 | 0.76 | — | 0.88 | 0.71 | 0.71 | 0.36 | L7 high (1.7x class median) |
| Calisthenics | boost | common | Barbarian/Fighter | — | 0.43 | 0.64 | 0.32 | 0.76 | — | 1.11 | 0.86 | 0.50 | 0.41 |  |
| Ecdysis | boost | common | Basilisk | — | 0.50 | 0.45 | 0.17 | 1.08 | — | 1.62 | 0.45 | 1.31 | 1.76 | L7 low (0.5x); L12 high (1.5x class median) |
| Feline Companion | boost | common | Bard/Cleric | — | -0.72 | -0.00 | -0.05 | -0.37 | — | 0.25 | 0.04 | 0.56 | -0.18 | L3 low (-1.8x); L5 low (-0.0x); L7 low (-0.1x); L12 low (-0.5x) |
| Thick Skin | boost | common | Basilisk | — | 0.53 | 0.41 | 0.39 | 0.67 | — | 1.53 | 0.86 | 0.67 | 0.34 |  |
| Enchanted Faceswap | confusion | rare | Bard/Cleric | 2.07 | 2.31 | 1.84 | 1.73 | 1.83 | 1.38 | 2.96 | 2.14 | 1.63 | 2.23 |  |
| Constrict | control | very rare | Basilisk | 1.74 | 1.16 | 1.34 | 1.12 | 1.28 | 1.21 | 1.59 | 1.43 | 1.23 | 1.22 |  |
| Horn Gore | control | epic | Minotaur | 1.54 | 1.48 | 1.57 | 1.20 | 1.10 | 1.59 | 1.86 | 0.92 | 1.50 | 1.42 |  |
| Coil | control | epic | Basilisk | 1.15 | 1.09 | 1.20 | 1.79 | 1.13 | 1.24 | 2.22 | 1.86 | 1.25 | 1.23 |  |
| Sticketh | control | rare | Unicorn | 1.10 | 1.05 | 0.98 | 1.79 | 1.66 | 1.38 | 1.64 | 1.99 | 1.23 | 1.33 |  |
| Forked Stick | control | uncommon | Bard/Barbarian/Fighter | 0.57 | 1.12 | 1.18 | 0.60 | 0.44 | 0.76 | 1.73 | 1.41 | 0.99 | 1.03 | L12 low (0.4x) |
| Mesmerize | control | common | Weeping Angel | 0.37 | 0.00 | 0.43 | 0.21 | -0.28 | 0.03 | -0.15 | 0.25 | -0.21 | -0.06 | L1 low (0.3x); L3 low (0.0x); L5 low (0.4x); L7 low (0.2x); L12 low (-0.2x) |
| Enthrall | control | uncommon | Weeping Angel | — | 0.00 | 0.36 | 0.32 | 0.09 | — | 0.80 | 0.83 | -0.24 | 0.66 | L3 low (0.0x); L5 low (0.3x); L7 low (0.3x); L12 low (0.1x) |
| Entrance | control | rare | Weeping Angel | — | 1.28 | 1.16 | 1.29 | 1.63 | — | 1.76 | 0.90 | 1.51 | 2.02 |  |
| Forked Metal Rod | control | very rare | Fighter/Barbarian | — | 1.35 | 1.44 | 1.36 | 1.71 | — | 2.14 | 1.68 | 1.40 | 1.51 |  |
| Soften | curse-strike | uncommon | any | 1.29 | 0.98 | 1.05 | 1.29 | 0.98 | 0.83 | 1.40 | 1.16 | 1.16 | 1.24 |  |
| Molasses | curse-strike | uncommon | any | 1.15 | 1.05 | 1.09 | 1.17 | 0.93 | 0.80 | 1.91 | 1.18 | 0.71 | 0.69 |  |
| Concussion | curse-strike | uncommon | Barbarian/Fighter | 1.12 | 0.88 | 1.11 | 1.09 | 0.73 | 0.79 | 1.93 | 1.48 | 0.95 | 0.96 |  |
| Brain Drain | curse-strike | uncommon | Cleric/Jinn | 0.80 | 0.75 | 1.09 | 0.85 | 1.10 | 0.79 | 1.14 | 0.96 | 1.37 | 1.77 |  |
| Delayed Hit | delayed | uncommon | any | 0.79 | 0.93 | 0.67 | 1.16 | 0.59 | 0.98 | 1.64 | 0.90 | 0.53 | 1.17 |  |
| Blink | economy | epic | Weeping Angel | 2.20 | 1.39 | 0.77 | 1.03 | 0.78 | 2.20 | 1.98 | 1.44 | 0.85 | 0.91 | L3 high (2.4x class median) |
| Pick Pocket | economy | common | any | 1.07 | 0.65 | 1.11 | 0.80 | 0.80 | 1.22 | 1.09 | 1.52 | 1.05 | 1.14 |  |
| Random Play | economy | common | any | 0.90 | 0.53 | 0.75 | 0.85 | 1.00 | 0.77 | 0.99 | 0.62 | 0.86 | 0.92 |  |
| Bad Batch | economy | uncommon | Bard | 0.18 | 0.08 | -0.03 | 0.36 | 0.16 | 0.20 | 0.34 | 0.30 | 0.05 | -0.07 | L1 low (0.2x); L3 low (0.1x); L5 low (-0.0x); L7 low (0.4x); L12 low (0.2x) |
| Heal | heal | common | any | 1.29 | 1.16 | 1.25 | 0.87 | 1.53 | 0.75 | 1.41 | 1.13 | 0.85 | 1.58 | L3 high (1.6x class median) |
| Gloaming Rest | heal | rare | Unicorn/Cleric | — | -0.09 | 0.29 | -0.20 | 0.49 | — | 0.41 | 0.41 | 0.49 | 0.34 | L3 low (-0.1x); L5 low (0.2x); L7 low (-0.2x); L12 low (0.3x) |
| Horn of Proof | heal | rare | Unicorn/Cleric | — | 0.28 | 0.23 | 0.36 | 0.47 | — | 0.64 | 0.82 | 0.34 | 0.51 | L3 low (0.4x); L5 low (0.2x); L7 low (0.4x); L12 low (0.3x) |
| Scotch | heal | rare | any | — | — | 1.71 | 1.93 | 1.96 | — | — | 2.05 | 1.55 | 2.44 | L7 high (2.2x class median) |
| Whiskey Shot | heal | common | any | — | 1.21 | 1.25 | 1.41 | 1.68 | — | 1.80 | 1.68 | 1.43 | 1.48 | L3 high (1.7x class median); L7 high (1.6x class median) |
| Take Wing | hide | uncommon | Dragon | 1.66 | 1.62 | 1.20 | 1.90 | 1.45 | 1.21 | 1.83 | 1.40 | 1.72 | 2.37 | L1 high (3.8x class median); L3 high (7.1x class median); L5 high (1.6x class median); L7 high (4.9x class median); L12 high (3.3x class median) |
| Mood Scales | hide | rare | Dragon | 0.50 | 0.23 | 0.45 | 0.43 | 0.44 | 0.63 | 0.88 | 0.50 | -0.05 | 0.61 |  |
| Cloak of Invisibility | hide | rare | Bard/Cleric/Wizard | 0.38 | 0.20 | 1.02 | -0.27 | 0.44 | 0.28 | 0.04 | 0.50 | 0.43 | 0.24 | L7 low (-0.7x) |
| Camouflage Vest | hide | rare | Barbarian/Fighter | 0.35 | 0.23 | 0.20 | 0.34 | 0.29 | 0.36 | 0.25 | 0.22 | -0.02 | 0.01 | L5 low (0.3x) |
| Berserk | multi-strike | common | Barbarian | 1.52 | 0.75 | 0.50 | 1.10 | 0.91 | 0.84 | 1.17 | 0.94 | 0.78 | 1.23 |  |
| Battle Focus | multi-strike | epic | Gladiator | 1.45 | 1.30 | 1.18 | 1.29 | 1.10 | 0.82 | 1.46 | 1.41 | 1.16 | 1.57 |  |
| Rehit | multi-strike | uncommon | Cleric/Fighter | — | 1.41 | 0.95 | 1.82 | 1.58 | — | 1.99 | 1.58 | 1.28 | 1.97 |  |
| Fists of Virtue | strike | common | any | 1.12 | 1.16 | 1.05 | 1.29 | 1.08 | 1.11 | 1.27 | 1.48 | 1.09 | 1.32 |  |
| Wooden Spear | strike | common | Bard/Fighter | 1.12 | 0.90 | 1.05 | 0.91 | 1.53 | 1.05 | 1.62 | 1.28 | 0.88 | 1.46 |  |
| Fight or Flight | strike | abundant | any | 1.11 | 1.17 | 1.09 | 1.42 | 1.14 | 0.86 | 2.34 | 1.21 | 1.36 | 1.69 |  |
| Fists of Villainy | strike | uncommon | any | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.11 | 1.59 | 1.35 | 1.25 | 0.79 |  |
| Hit | strike | abundant | any | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.41 | 1.17 | 0.97 | 0.74 |  |
| The Kalevala | strike | very rare | any | 1.00 | 0.65 | 0.70 | 1.06 | 1.18 | 1.06 | 1.15 | 1.20 | 1.08 | 1.42 |  |
| Dissonant Voice | strike | uncommon | Unicorn/Bard | 0.17 | 0.50 | -0.33 | 0.30 | 0.33 | 0.33 | 0.75 | 0.41 | 0.12 | -0.47 | L1 low (0.2x); L3 low (0.4x); L5 low (-0.3x); L7 low (0.3x); L12 low (0.3x) |
| Hit Harder | strike | common | Barbarian/Fighter | — | 1.21 | 1.02 | 0.91 | 0.91 | — | 0.86 | 1.20 | 1.40 | 1.32 |  |
| Horn Swipe | strike | rare | Minotaur | — | 1.18 | 1.41 | 1.29 | 1.88 | — | 1.69 | 1.88 | 1.59 | 1.89 |  |
| Lucky Strike | strike | rare | Bard/Cleric/Fighter | — | 1.41 | 1.16 | 1.32 | 1.83 | — | 2.33 | 1.65 | 1.44 | 1.91 |  |
| Pound | strike | very rare | Bard/Barbarian | — | 1.51 | 1.46 | 1.55 | 1.23 | — | 2.63 | 2.05 | 1.42 | 1.32 |  |
| Vengeful Rampage | strike | rare | Barbarian | — | 1.76 | 1.36 | 1.20 | 1.35 | — | 2.28 | 1.30 | 1.49 | 1.97 |  |
| Iocane | strike-heal | uncommon | Bard/Cleric | 1.59 | 1.23 | 1.39 | 1.12 | 1.10 | 1.49 | 2.21 | 1.41 | 0.97 | 1.26 |  |
| Survival Knife | strike-heal | uncommon | Fighter | 1.56 | 1.39 | 1.11 | 1.50 | 1.28 | 1.02 | 1.86 | 1.67 | 1.60 | 1.82 |  |
| Turkey Thigh | strike-heal | uncommon | Barbarian | 1.20 | 1.41 | 1.18 | 1.06 | 1.55 | 1.22 | 1.47 | 1.39 | 1.48 | 1.14 |  |

| Class median sHE | L1 | L3 | L5 | L7 | L12 |
|---|---|---|---|---|---|
| boost | 0.33 | 0.40 | 0.45 | 0.35 | 0.70 |
| economy | 0.99 | 0.59 | 0.76 | 0.82 | 0.79 |
| multi-strike | 1.49 | 1.30 | 0.95 | 1.29 | 1.10 |
| area | 1.26 | 1.24 | 1.40 | 1.51 | 2.22 |
| curse-strike | 1.14 | 0.93 | 1.09 | 1.13 | 0.96 |
| hide | 0.44 | 0.23 | 0.74 | 0.39 | 0.44 |
| control | 1.12 | 1.12 | 1.18 | 1.20 | 1.13 |
| delayed | 0.79 | 0.93 | 0.67 | 1.16 | 0.59 |
| strike | 1.00 | 1.17 | 1.05 | 1.13 | 1.16 |
| confusion | 2.07 | 2.31 | 1.84 | 1.73 | 1.83 |
| heal | 1.29 | 0.72 | 1.25 | 0.87 | 1.53 |
| strike-heal | 1.56 | 1.39 | 1.18 | 1.12 | 1.28 |

## Findings (levels 1–7 first)

1. **Area spells scale with level; Sandstorm and Enchanted Faceswap lead from level 1.**
   - Sandstorm is worth about 2 Hits at levels 1–5 and 2.7 at level 7, and Enchanted Faceswap
     about 1.7–2.3. Both are target-redraw cards: in a duel, a confused opponent mostly hits
     itself.
   - Blast rises from 1.1 at level 1 to 2.0 at level 7, and Fire Breath from 1.4 to 1.7.
   - At level 12 all three area spells reach 2.5–3.4, which is Layer 0's structural caster
     edge ([formula](2026-09-28-formula.md)) seen on real cards.
   - Neither Sandstorm nor Faceswap is flagged, because their classes run high.
   - Per copy, Sandstorm is already about twice a Hit at level 1. This is the single-copy
     view of the owner's worry about stacking it; copies are measured in Layer 4.
2. **The Dragon, Unicorn, and Weeping Angel each hold several near-dead cards.** Below
   0.5 HE at every primary level:
   - Dragon: Tsunami (epic, 0.0–0.3). Mood Scales is 0.2–0.5.
   - Unicorn: Unconquerable Horn (0.06–0.30), Gloaming Rest (−0.2–0.3), Horn of Proof
     (0.2–0.4), Dissonant Voice (−0.3–0.5).
   - Weeping Angel: Mesmerize (0.0–0.4), Enthrall (0.0–0.4).

   The pattern matches the corrected curves:
   - The Unicorn (25–31% mid-level) has one strong card of its own (Sticketh, 1.0–1.8) and
     four weak ones.
   - The Dragon (7–23% through level 10) has Take Wing and Fire Breath, and an epic that does
     almost nothing in a duel.
   - The Weeping Angel stays strong through Blink and Entrance, not its commons.

   Layer 3 checks this on the real holders, since a type bonus could lift a card like Tsunami.
3. **Other cards at or below an empty slot:**
   - Feline Companion is −0.7 to 0.0: a boost that costs its slot and then some.
   - Bad Batch is −0.03 to 0.36.
   - Prion Disease is 0.05–0.3 as an epic.
   - The hide cards: Cloak of Invisibility, Camouflage Vest, and Mood Scales. Take Wing is the
     exception at 1.2–1.9, which makes it the Dragon's best card, flagged against its class at
     every level.
   - The boost class overall sits at 0.3–0.6. Fights last 2–3 rounds, so a stat change that
     lasts has little time to pay back.
4. **Heals are about a Hit** (Heal 0.9–1.3 after the #407 fix).
   - Whiskey Shot (1.2–1.4) and Scotch (1.7–1.9, rare) are flagged above the class median
     mostly because the class also holds the two weak Unicorn heals.
   - Scotch stays flagged at level 7 even with the rarity premium.
5. **Strikes cluster close to a Hit.** The rare and very rare strikes run 1.2–1.8, inside the
   owner's rarity premium. Their 0.9–1.2 commons, the curse-strikes (0.8–1.3), and control
   (1.1–1.2) are balanced against each other.
6. **Blink falls with level:** 2.2 at level 1, 1.4 at level 3, 0.8–1.0 after. It is the only
   epic that gets weaker as its holder grows.

## Next steps

- **Layer 3 (task 7).** Put each card on its real holders and rerun the outliers, so a type
  bonus is counted. Separate what the Dragon's and Unicorn's weakness owes to the chassis from
  what it owes to their cards.
- **HE on real cards.** Repeat the validation from task 4 on held-out real-card hands. The
  synthetic check landed on its mark of 5; real cards with lasting effects may add more
  error.
- **An overnight run for the owner, as confirmation only:**
  - Every level 0–7, with twice the fights:
    `plan:catalogue -- --levels 0,1,2,3,4,5,6,7 --fights 50`, about 830,000 fights, about
    70 minutes on 4 cores.
  - The ladder for levels 0, 2 and 6, for the conversion.
  - Findings 1 and 2 are far outside noise already; the longer run tightens the flags near
    their thresholds.
- **No card changes yet** (owner's rule). Candidates stay in plan 34's list.
