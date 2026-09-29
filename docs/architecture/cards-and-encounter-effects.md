---
type: Architecture
title: Cards and encounter effects
description: How a card play resolves, where fight-scoped card state lives, the hold boundary, and the checklist for adding cards and monsters.
status: stable
audience: internal
tags: [cards, monsters, combat, content]
---
# Cards and encounter effects

Read this before writing or changing a card, a monster, or anything that reads card state
during a fight. Pacing inside a card follows
[engine concurrency and timing](engine-concurrency-and-timing.md); teams and targeting
follow [boss encounters](boss-encounters.md).

## How one card play resolves

`BaseCard.play()` (`packages/engine/src/cards/base.ts`) runs in two steps.

1. **`applyEffects()` clones the card**, then passes the clone through every armed
   effect: each active contestant's `monster.encounterEffects` (the acting monster's own
   effects get `ATTACK_PHASE`, everyone else's get `DEFENSE_PHASE`), then
   `ring.encounterEffects` with `GLOBAL_PHASE`. An effect may return a modified card, for
   example one whose `getAttackRoll` or `getTargets` is wrapped. Because the card is a
   per-play clone, wrapping its methods never leaks into the deck.
2. **The clone plays**: it announces itself, calls `getTargets()`, and runs `effect()` for
   each target in series (`mapSeries`), so one target's rolls and damage finish before the
   next begins.

Wrapped plays nest in arming order. A check that runs after a play must re-check every
armed effect, not only its own (see "Card effects that wrap a play" in the
[game primer](../agents/game-primer.md)).

**Confusion redirects targets.** Sandstorm wraps the confused monster's `getTargets`, so any
card can resolve against an unexpected target, including the player itself or an ally.
Every `effect(player, target)` must read sensibly when `target === player` and when the
target is someone the card never meant to touch.

## Where fight-scoped state lives

All card state that lasts past one play belongs to the **encounter**:

| State | Where | Cleared by |
|---|---|---|
| Armed per-monster effects | `creature.encounterEffects` (functions with an `effectType`) | `creature.endEncounter()` deletes `creature.encounter` |
| Temporary stat changes | `creature.encounterModifiers` (via `setModifier`) | same |
| Per-fight flags and counters | `creature.encounterModifiers.<name>` | same |
| Ring-wide traps (Bad Batch) | `ring.encounterEffects` | `Ring.endEncounter()` deletes `ring.encounter` |

That one rule is why card state needs no separate cleanup for fight end, flee, death, or a
cancelled fight, and why none of it is serialized or survives room restore. Do not keep
fight state on `card.options` (it is persisted with the deck), and do not add a
`game.on(...)` listener or a timer to track it; see
[engine concurrency and timing](engine-concurrency-and-timing.md).

### Encounter AC is shared by braces and curses

`encounterModifiers.ac` is a single number with two meanings. A positive value is a
**brace**: `creature.hit()` spends it to absorb melee damage. A negative value is a
**curse** (Soften) or a temporary penalty (Gloaming Rest, Fire Breath's winded). A card
that lowers AC for a while must give back exactly what it took, as those two do; a cleanse that lifts
negative AC must not lift another card's temporary penalty, as Horn of Proof checks.

### Temporary stat changes and their caps

A boost or curse on DEX, STR, or INT changes the raw stat and every roll that stat feeds,
once (10b #175). Changes stack within a fight up to `getMaxModifications`: `level + 1` for
AC, and `level + 1` but never more than `MAX_TEMPORARY_STAT_CHANGE` (±5) for DEX, STR, and
INT. Past the cap a boost heals instead and a curse deals damage instead (`BoostCard`,
`CurseCard`). The ±5 cap is the owner's (roadmap 33): with `level + 1`, stacked Molasses
reached −21 DEX at level 20, the target's accuracy and defense on a d20.

A curse that comes with an attack (Soften, Molasses, Concussion, Brain Drain) lands only
when the attack roll succeeds, through `HitCard.onLanded`. It used to land before the roll,
hit or miss, and past the cap each play still became extra damage. Curses without an attack
roll (Blink) always apply.

Heals read INT as a bonus only: an INT penalty counts as zero, and a bonus fades by one per
play before it resets (10b #198).

### "Until your next card" and one-play bonuses

An effect that lasts until its monster's next card is an encounter effect that answers the
`ATTACK_PHASE` call for that monster and removes itself: Gloaming Rest, Fire Breath's
winded, and Take Wing's flight all work this way, so a second copy played as that next card
is resolved after the first has already been given back and never stacks.

- **A bonus on the next attack** goes on the per-play clone the effect is handed, never on
  the card in the hand. `cards/helpers/empower-melee.ts` does it for the Dragon's dive and
  fury: it wraps the clone's `getAttackRoll` and `getDamageRoll`, adds to `modifier` (a
  natural 20 recomputes damage from the dice maximum plus `modifier`, so `bonusResult` would
  be dropped), and skips the roll Hit makes for the *target* on a natural 1. The damage die
  is added once per play (Horn Gore rolls damage per horn) and reaches Hit Harder's
  `{ betterRoll, worseRoll }` pair; its `onDamageBonus` hook fires only when it lands, which
  is how Mood Scales' fury waits for a hit rather than an attempt.
- **Reacting to someone else's card** (a dodge) means wrapping that clone's `effect` in the
  `DEFENSE_PHASE` call and checking `target === self` inside the wrapper, because the
  effect sees every card played in the ring, not only those aimed at its monster. Take Wing
  checks HP before and after the wrapped effect to see whether anything landed. It dodges the
  first MELEE blow or AOE card aimed at the flier, a tsunami included (roadmap 36: the Unicorn's
  Blasts had held the level 7 Dragon to 2% against it; `static dodgesSpells` switches the area
  dodge off for the harness). When two
  such effects sit on one monster (Take Wing and a Cloak-style hide), the one armed later
  wraps outside the other and answers first: a flight taken after hiding spends its dodge
  before the hide's search roll. Neither order double-counts damage; it is a play-order
  choice, not a rule.
- **A self-hit that is not a mistake.** The hit line says "…himself by mistake" when the
  assailant is the target. A card that hurts its own player on purpose (Tsunami) sets
  `flavorText` on its clone for that one hit and clears it after.

### The hit log records what a blow carried and what it took

Every `creature.hit()` unshifts a `HitLogEntry` onto `encounterModifiers.hitLog`:
`damage` (what the blow carried), `dealt` (HP actually lost; 0 when a brace absorbed it
all), `assailant`, `card`, and `when`. `when` uses `hitLogTimestamp()`, the same clock
Delayed Hit and Gloaming Rest compare against. Under `DECK_MONSTERS_SKIP_DELAYS` that clock
is a counter, so never compare it with `Date.now()`. Use `dealt ?? damage` when the
question is "did this hurt".

## Holds and the Horn of Proof ward

Every hold one creature puts on another, including Immobilize, Horn Gore, Coil, Constrict,
Entrance, Enthrall, Mesmerize, Forked Stick, and Forked Metal Rod, goes through
`ImmobilizeCard.immobilize()` (`cards/immobilize.ts`). A hold is an `ImmobilizeEffect` on
the held creature: at the start of that creature's turn it rolls to break free, and while
held its card does nothing.

**Pinned monsters are easier to hit** (owner, roadmap 36). Every attack roll against a pinned
monster has advantage, as against a restrained creature in D&D. Pinned means held by any
`ImmobilizeEffect` or awed by Helm of Awe (`isPinned` in `cards/helpers/pinned.ts`, and
`PIN_RULES.advantage` switches it off for the harness). Dissonant Voice's rattle is not a pin,
since the monster still acts. The pin's own encounter effect grants the advantage: in
`DEFENSE_PHASE` it gives the incoming card advantage against the pinned monster only.

- **Decided at the roll, not the play.** Who is being attacked is read when the die is
  rolled: from `rollWithModes`'s target, or from the `hitCheck` or `effect` call in progress.
  A first version read it from the play's target and missed two cases (Codex review of #412).
  Enthrall picks its victims inside its own effect. The donkey's kick, Tail Lash's tail, and
  the Unconquerable Horn's creature of the wood roll their own d20. A new strike that rolls its
  own d20 must go through `rollWithModes`.
- **Companions take only the target's modes.** The donkey and the creature of the wood pass
  `targetOnly`, so they get a pin's advantage but not their player's rattle. The tail is the
  dragon's own blow and takes both.

- **One roll-mode helper.** `addRollMode(card, mode)` (`cards/helpers/roll-mode.ts`) counts
  advantage and disadvantage on a clone's `getAttackRoll`, and one of each cancels, as in D&D.
  So a pin and a rattle on the same attack give a plain roll whichever effect ran first. A
  natural 1 is still the worst roll and a natural 20 the best. A card that already rolls twice
  and keeps the better (Lucky Strike, `static rollsTwice`) gains nothing from advantage.
- **What it moved.** The whole field shifted by no more than 1.2 points in the owner's
  [confirmation run](../reference/balance-reports/2026-09-29-confirm-36.md). The one matchup it
  pushed over the 85% cap is the level 1 Dragon's Faceswap hand against the Basilisk (85.2%),
  which the owner left as it is.

**Mesmerize catches its own caster only on a natural 1** (roadmap 36). It holds everyone
else, then rolls a d20 for the caster, and a 1 is a Curse of Loki moment. It used to catch the
caster every time, which held the Weeping Angel in most of its own fights.

The ward began as the Unconquerable Horn's refusal to be held. The owner asked (2026-09-28,
roadmap 35 "Unconquerable Horn as a counterspell") for more: "like a counterspell that lasts
for one round or until some sort of negative action that is not a damage action is
attempted." On 2026-09-29 the owner made Horn of Proof "the do everything card", so the ward
moved there (`HornOfProofCard.ward()`): cleanse, then ward, then heal, in that order. It is a
one-round, once-per-fight counterspell against the next negative, non-damage effect an
opponent lands on the warder. The mechanism is in `cards/helpers/control-ward.ts` and did
not change with the move.

- **What it covers.** Holds (via `immobilize()`), the curse part of a curse-carrying Hit
  (Soften, Molasses, Concussion, Brain Drain — `CurseCard.applyCurse` in `cards/curse.ts`),
  Blink's time-shift (`cards/blink.ts`), Bad Batch's poison (`cards/bad-batch.ts`),
  Sandstorm's confusion (`cards/sandstorm.ts`), and Enchanted Faceswap's redirect
  (`cards/enchanted-faceswap.ts`). **Damage always still lands** — only the extra,
  non-damage effect riding with it is cancelled. **Curse of Loki is not warded**: a natural 1
  turning an attacker's own blow back on itself is a roll outcome aimed at nobody, not an
  opponent's action against the target.
- **The single entry point.** `cards/helpers/control-ward.ts` exports `wardAgainst(target,
  source, { activeContestants, ring })`: it returns true (and spends the ward) when `target`
  has an armed ward and `source` is an opponent per `isOpponentHold()` (same team rules; a
  creature never spends its own ward on itself, and an ally's effect never spends it). A new
  negative, non-damage effect is not warded until it calls `wardAgainst` (or the lower-level
  `consumeControlWard`) itself. `HitCard.onLanded` threads `ring` and `activeContestants`
  through so `CurseCard.applyCurse` has the team data `wardAgainst` needs.
- **Duration: one round.** Arming a ward attaches a counting `encounterEffects` entry to the
  warder (the same `ATTACK_PHASE`-keyed-to-one-monster pattern `fire-breath.ts`'s `wind()`
  uses) that ticks down once per card the warder itself plays. If the ward has not fired by
  the time the warder has played a full hand's worth of further cards (`monster.cardSlots`,
  9 by default — the same point next round), it lapses: `encounterModifiers.unconquerableWard`
  becomes `'lapsed'`, with its own narration. **Once per fight either way**: `armControlWard`
  refuses to re-arm after `'spent'` or `'lapsed'`.
- **Never a dead card.** Horn of Proof also cleanses and heals (`healAmount`, a class setting
  for the balance harness) whether or not the ward takes. The steadying 1d6 the Unconquerable
  Horn briefly carried is gone with the ward.
- **The Unconquerable Horn is a rally, not a ward** (owner, 2026-09-29). The unicorn makes its
  own Hit and the horn, kindling and ringing, brings a second blow on the same target: from
  a living ally in the ring (found with `isOpponentHold`, so only real teammates count and a
  duel or free-for-all has none), else a creature of the wood, an otter, a deer, or a ram.
  The creature is an attack profile, not a contestant: `companionHitBonus` (2) and
  `companionDamageDice` ('1d4') are static fields for the harness, it rolls without crits (no
  stroke of luck, no Curse of Loki), takes no damage, and a killing blow is credited to the
  unicorn. The horn rallies only against a foe: a confused unicorn hitting itself or an ally
  calls nobody. See `cards/unconquerable-horn.ts`.
- **Self-holds skip the ward.** Sticketh sticks its own player with the ordinary
  `ImmobilizeEffect` through `stickFast()`, not `immobilize()`, so freedom rolls, fatigue,
  and cleanup are shared with every other hold.
- **Narration hooks.** `ImmobilizeCard.emitHeldEffect()` and `getFreedomCommentary()` let a
  subclass narrate its own hold. The defaults read "X is currently held by Y", which is
  wrong for a self-hold. `controlWardNarration(target, refusal)` in `control-ward.ts` is the
  shared refusal line for every other warded effect: the Job 39:9 quote only for a Unicorn
  (confusion can lend the ward to any creature), naming what was refused in plain words.
- **A held monster's card never plays.** A card that frees its own player from a hold cannot
  work on that player's turn; it only helps when it lands on someone else.

## Fear and song: Helm of Awe and Dissonant Voice

**Helm of Awe** (`cards/helm-of-awe.ts`, Dragon) is a pin, but not an `ImmobilizeEffect`. Its
own `AWE_EFFECT` behaves the same way. Every opponent saves (1d20 + int vs 10 + the dragon's
int modifier). One that fails loses its next card. At the start of each later turn it saves
again, `holdFatigue` (3) easier each time: a failure loses that card, and a success ends the
awe. So does the dragon's death.

- **The flee.** A natural 1 on a recovery save makes an opponent that is not bloodied try to
  flee with a Flee roll (1d20 + dex, 10 or more), through `leaveCombat`. A bloodied one cowers.
  Bosses can be frightened away: the rule that they never flee covers the Flee cards they
  carry, not fear.
- **No refresh.** A second helm on an awed opponent does nothing, so a hand of Helms cannot
  chain the pin.
- **The ward.** Awe goes through `wardAgainst`, so Horn of Proof's ward cancels it.

**Dissonant Voice** (`cards/dissonant-voice.ts`, Unicorn and Bard) has no save and no damage.
Every opponent's next card that rolls to hit rolls twice and keeps the worse, through the
shared roll-mode helper, so a pin's advantage cancels it. A card that does
not roll to hit leaves it waiting. A natural 1 stays the worst roll and a natural 20 the best.

Both were chosen from 13 measured variations, in duels, crowds, and team battles. The numbers,
the owner's rules (a natural 1 is the only Curse of Loki; complexity must earn its place), and
why each variation was dropped are in the
[Helm of Awe and Dissonant Voice study](../archive/studies/2026-09-helm-of-awe-and-dissonant-voice.md).
Read it before designing a debuff, a fear effect, or a support card for team fights.

## Ancient dragons

A Dragon at level 10 or more is **ancient** (`cards/helpers/ancient-dragon.ts`). The owner
asked for very old dragons to be "immensely powerful but occasionally able to be tricked"
(September 2026), so an ancient dragon has one strength and two weaknesses:

- **Fire Breath cannot be dodged** and burns for three turns instead of two. Fire Breath
  checks `isAncientDragon(player)`.
- **Outwitted by talk.** Once per fight, each *opponent* an ancient dragon attacks (with an
  attack card: melee, area, poison, psychic, or acoustic, so a confused heal is not one) rolls
  1d20 + INT against 20 + the dragon's INT (a tie goes to the dragon). On a success that
  attack goes wide and the dragon is exposed, −4 AC until its next card. Opponents only,
  by `isOpponentHold`: an ally caught in the dragon's Tsunami must not talk its way out of
  the wave (a review finding before merge).
- **The soft underbelly.** A natural 20 with a Hit-family attack (anything with
  `rollForDamage`) against it does triple damage.

`Dragon.startEncounter` arms all of it as one encounter effect, so fight cleanup ends it,
and the "once per fight" record lives in that effect's closure. `look at` says the dragon is
ancient. A new card that should respect ancient dragons reads `isAncientDragon`.

## Adding a card or a monster

The Unicorn pass (archived as
[26 — Unicorn content pack](../archive/roadmap/26-unicorn-pack.md)) touched every place a
new card or monster must reach. Check each one.

**A card**

- `permittedClassesAndTypes` (class names and creature types), `level` (the draw and hold
  gate), `probability` (rarity from `helpers/probabilities.ts`), and `cost`.
- Sale: default is the front shop; `notForSale` sends it to the back room at a steep
  markup; `neverForSale` keeps it out of both.
- Register it in `cards/helpers/all.ts` **in alphabetical order**, because the generated
  card lists follow that array, and export it from `cards/index.ts`.
- A monster's signature card goes in `getMinimumDeck()` (`cards/helpers/deck.ts`) beside
  the others, and in `docs/agents/game-primer.md`'s starting-deck count.
- Give the web workshop a badge keyword in `apps/web/src/utils/cards.ts`; it classifies by
  name, and an unmatched card shows as Utility.
- Tests: permissions, stats text, hit and miss, natural 1 and 20, confusion
  (`target === player`), encounter cleanup, and a JSON hydration round trip.
- Regenerate `CARDS.md`, `DMG.md`, `cards.html`, and the
  [strings inventories](../reference/strings/README.md) with `pnpm run build:docs`. A card
  whose permitted types name a monster appears in that monster's inventory by itself, and
  a test fails when an inventory is stale.

**A monster**

- A creature-type constant, a class from `constants/creature-classes.ts`, a +2 total
  DEX/STR/INT modifier budget, `acVariance`, `hpVariance`, and a lore `description`.
  Optionally `youthAc`: extra AC while young, the full amount to level 3, half (rounded up)
  to level 6, none from level 7 (`youthAcBonus` in `creatures/stats.ts`; the generated
  references show it). The Dragon and the Gladiator have 2 (roadmap 35): a body that starts
  behind gets help where players are without changing its late game. Reach for body
  fields (`hpVariance`, `acVariance`, `youthAc`) before the modifier budget, which every
  monster shares.
- **Append** it to `allMonsters` (`monsters/helpers/all.ts`). The spawn prompt answers with
  an index, so inserting mid-list shifts every later monster.
- The spawn colour example (`monsters/helpers/spawn.ts`), a name generator
  (`helpers/names.ts`), a sprite in `apps/web/src/animations/pixel-fight/sprites.ts`, and
  the server's spawn-catalog test. The harness reads `allMonsters` itself; add a report in
  `packages/harness/src/scripts/monster-reports/` if the monster's cards need their own
  counters in `sim:monster` ([simulation harness](../reference/simulation-harness.md#one-roster)).
- Regenerate `MONSTERS.md` and `DMG.md` with `pnpm run build:docs`; adding to
  `allMonsters` changes both, and `docs:check` does not catch them going stale.
- A description must read well with a player-chosen colour, including one that carries
  its own "with"; give the colour its own sentence. Verbs after a pronoun use `agree()`;
  verbs after a name never do ([voice and wording](../reference/voice-and-wording.md)).

## Risky heals: Gloaming Rest

Gloaming Rest (`cards/gloaming-rest.ts`) is a heal with a risk attached. The monster kneels
at −2 AC until its next card. If nothing damages it before that card begins, it heals a random
amount from 4 up to all the hp it is missing. Any damage in between (`dealt ?? damage` in the
hit log, so a blow the brace absorbed does not count) breaks the rest, and it heals nothing.
Bosses rest the same way. `restShape: 'dice'` keeps the old 3d4 for the harness.

The upper end is random so the heal can never restore everything every time. A guaranteed
full heal wins any fight in which the opponent's next card happens not to deal damage. It
measured fine on average but decided single fights (owner rule, 2026-09-29). The
[Gloaming Rest study](../archive/studies/2026-09-gloaming-rest.md) records the seven shapes
tried, the per-fight measurement that exposed the problem, and why each was dropped. Read it
before designing another conditional or all-or-nothing effect.

## Content and balance rules

- **Balance target (owner decision, September 2026).** Aim for a power curve per class
  across levels, not 50/50 at every level. As in D&D, casters (Cleric, Bard, Wizard) start fragile
  and grow strong; brutes (Barbarian, Fighter) are strongest early and stay useful as they
  fall behind. A problem is a class that dominates across the whole range, or a curve that
  runs the wrong way. The 35–65% flag in `sim:winrates` and `sim:monster` marks rows to look
  at, not a pass/fail gate, and ring context (size, teams, the cards in play) shifts
  matchups a great deal.
- **Balance rules (owner, roadmaps 34 and 35, September 2026).** These are standing rules for
  any balance change:
  - **The band.** Keep each monster's field average within 35–75%; ancient dragons may reach
    80%. Keep single matchups within 20–80%, and none over 85%.
  - **Levels 0–7 come first.**
  - **The smallest effective change wins.**
  - **Hope and excitement are protected**: rare turnarounds, Curse of Loki, natural 20s, and
    strokes of luck (the "please get a Loki" moments). None is reduced without the owner's
    agreement.
  - **Counter cards come before nerfs.** Blink stays as it is.
  - **Unique cards should be usable**: a player who builds around one should find it worth its
    slot. Weak situational cards are allowed. Prion Disease is a joke card and stays as it is.
- **A natural 1 and a natural 20 are fixed (owner, 2026-09-29).** Only a natural 1 is a Curse of
  Loki, and only a natural 20 a stroke of luck. Advantage and disadvantage fit that precedent;
  widening either range does not, however well it measures.
- **Complexity must earn its place (owner, 2026-09-29).** A rule that does not move the numbers
  is dropped. Wrath on a broken rest, Dissonant Voice lasting until a hit lands, and the
  deepening rest all measured as noise and were cut.
- **What moves a fight (measured, roadmap 35).**
  - Attack-roll changes barely matter here. A −2 to −5 penalty or a sting stayed 5–11 points
    below the card it replaced, because fights last about two rounds. A debuff needs a stronger
    shape: a lost card, a hold, a redirect, or damage that lands.
  - An all-or-nothing effect can average fine while deciding single fights. Check the
    per-fight split ([simulation harness](../reference/simulation-harness.md#averages-hide-all-or-nothing-cards)).
  - Team battles flatten card differences to about ±2 points. Test a support card in them
    (`SideSpec.team`), not only in free-for-alls.
  - The worked examples are the [Gloaming Rest study](../archive/studies/2026-09-gloaming-rest.md)
    and the [Helm of Awe and Dissonant Voice study](../archive/studies/2026-09-helm-of-awe-and-dissonant-voice.md).
- **Measured balance changes (roadmap 35).** A body or card change is measured before and
  after on the same searched hands and seeds (`plan:matrix`, `sim:matrix-report`), with the
  excitement and hope guardrails beside the band; experiment variants
  (`harness/src/balance/variants.ts`) let a candidate be tried before it is written into
  the engine. The first changes, 2026-09-28: the Dragon and the Gladiator got 3 more HP and
  youth AC 2; Tsunami lets the Dragon roll 1d20 + DEX vs 10 to ride its own wave.
- **Evidence comes from the harness.** Run the [simulation harness](../reference/simulation-harness.md)
  before a balance claim, and read its known limits there.
- **Sources.** Credit every source in a comment beside the text it shaped. The Unicorn's
  sources are listed in `monsters/unicorn.ts` and each card file; the
  Dragon's in `monsters/dragon.ts` and its card files.
- **Quoting old texts (owner decision, September 2026).** Public-domain texts may be quoted
  directly, or quoted with a playful twist, in flavour text and narration. Their archaic
  spelling and grammar ("sticketh", "belloweth") are welcome when a line stays readable
  aloud. Name a public-domain edition in a source comment (for example Holland's 1601
  Pliny, Golding's 1587 Solinus, Topsell's 1607 bestiary, the 1611 King James Bible,
  Spenser, Shakespeare, or Morris and Magnússon's 1888 *Völsunga saga*). The aim is
  atmosphere: the phrase, the old grammar, and the sound of the books. A small difference
  from one printing is fine, including a spelling that reads more clearly aloud, or two
  public-domain tellings of the same passage blended together. The sense should stay the
  author's. Modern translations, modern anthologies (including *A Book of Unicorns*), and
  in-copyright works stay paraphrase and tonal reference only.
