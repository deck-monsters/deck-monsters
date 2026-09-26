---
type: Roadmap
title: New Content Backlog
description: Concrete card, monster, and world proposals, including the researched Unicorn content pack.
status: draft
audience: internal
tags: [content, cards, backlog]
---
# New Content Backlog

**Status:** Backlog — concrete post-launch content proposals. Prioritize only after the
balance harness can evaluate their interactions.

## Cards

- [ ] Card Pops: upgrade a card after a natural 20 or Stroke of Luck; decide whether the
  upgrade takes effect mid-fight or afterward.
- [ ] Re-quip: clone each configured deck into a fight hand and refresh it at round five.
- [ ] Design and test Healing Balm, Enchanted Mirror, Bear Trap, Shardblade, Kata, Gini
  Coefficient, Healing Wind, Shuffle, Delve, Wild, Trade Hands, and Swarm.
- [ ] Strengthen repeated Immobilize rather than merely resetting its hold.
- [ ] **Owner: Cards.** Evaluate a hybrid data-driven card spec (schema plus optional
  hooks) and a card-authoring agent skill covering file locations, the base class, tests,
  and balance pitfalls. Do this after the simulation harness in
  [balance and mechanics](11-balance-and-mechanics.md) can review a proposed card. The
  spec stays optional until more people author cards; the current class-per-card system
  remains the implementation.

## Monsters and items

- [ ] Deliver the **Unicorn content pack** specified below: one trainable monster, five
  related cards, generated-reference copy, tests, and balance evidence. `Sticketh` is the
  required signature card and spelling; do not normalize it to *Stickith*, *Sticks*, or
  *Striketh*.
- [ ] Add the Time Lord monster and its time-manipulation deck.
- [ ] Add the Bureaucrat monster and its tax, redistribution, and arrest mechanics.
- [ ] Design equipment slots and their stat trade-offs.
- [ ] Decide how monster-slot capacity is earned; the existing modifier is deliberately
  dormant until a reward is chosen.

## Unicorn content pack

**Status:** Planned, not in development. This section is the implementation brief and the
single roadmap home for the proposal. It deliberately specifies ranges and questions rather
than pretending untested combat values are final.

### Creative thesis

Make this the old, dangerous unicorn rather than a pastel horse with a cosmetic horn. The
recognisable silhouette remains horse-like, white, and single-horned, but close inspection
reveals the contradictory creature assembled by centuries of reports: a stag's head, goat's
beard and tail, cloven or elephantine feet, and a boar-like tail among different variants.
The contradiction is a feature. Each trained Unicorn should feel like one imperfect witness's
account of a creature too rare and distant to become ordinary.

The playable identity has three tensions:

1. **Untouchable / vulnerable.** The Unicorn is swift and hard to catch, but choosing trust
   or stillness exposes it. This supports DEX-led defence and one deliberate rest card rather
   than permanent evasion.
2. **Healer / weapon.** The horn purifies poison and restores health in one tradition, while
   Solinus calls it four feet long and sharp enough to pierce whatever it charges. Its deck
   should force a choice between preserving and spending that power.
3. **Gentle / unconquerable.** Aelian's animal is gentle toward other species yet fights its
   own kind; medieval capture stories oppose ferocity with trust. In Deck Monsters, translate
   this into target selection and counterplay, **not** a gender, virginity, sexuality, or
   moral-worth check on a player or monster.

This is a companion who answers a Beastmaster's call, not quarry that the player captures.
“Cannot be taken alive” becomes refusal to be controlled in combat; the flower-bearing
maiden scene becomes freely offered trust and rest. Use singular *they* correctly and do not
call the Unicorn *it* in new player-facing copy.

### Source palette and quotation policy

The supplied anthology pages are the primary creative prompt. They reproduce or attribute
passages to Ctesias, Pliny the Elder, Aelian, Julius Solinus, Edward Topsell, Edmund Spenser,
the Brothers Grimm, Edwin Julian, and Welleran Poltarnees. Preserve only short, attributed
fragments in cards or lore; paraphrase the rest.
The anthology is *A Book of Unicorns*, a Star & Elephant Book from The Green Tiger Press,
La Jolla, California, with an introduction by Welleran Poltarnees (from the owner's
photographs of the covers and interior pages). The owner's copy has no copyright page, so
the year and edition stay unrecorded. Its newest dated artwork, *The Unicorn in Winter* by
S.W.D., is from 1976, so the book is no earlier. The pages photographed quote Ctesias
(*Indica* fragment 25), Pliny (*Historia Naturalis*), Aelian (*De Animalium Natura*),
Julius Solinus (*Polyhistoria*, in early-modern English), Olfert Dapper (*Die Unbekante Neue
Welt*, 1673), Edward Topsell (*History of Four Footed Beasts*, 1607), Spenser (*The Faerie
Queene*), the Brothers Grimm ("The Brave Little Tailor"), and Edwin Julian ("The Capture of
the Unicorn", illustrated by Reginald Birch).
Source comments cite these texts directly.

| Motif to carry forward | Short source fragment or visual cue | Game use |
|---|---|---|
| A form people continually imagine | Poltarnees calls the horse-and-horn silhouette its “Platonic form” | Keep the readable silhouette while variant traits supply generated descriptions. |
| Rarity as distance, not weakness | The introduction describes the Unicorn as “rare, distant, untouched” | High DEX, solitary locations, and a defensive identity—not a low spawn probability until rarity is measured against onboarding. |
| Speed and force | Ctesias: “exceedingly swift and powerful” | DEX-forward baseline and a charge whose reward needs setup. |
| White, red, black, and blue | Ctesias gives a white body, dark-red head, dark-blue eyes, and a white/crimson/black horn | Historically rooted palette variants beyond plain white or rainbow styling. |
| Antidotal horn | Ctesias describes horn dust and horn vessels as protection from drugs, convulsions, and poison | A bounded cleanse/heal card; never claim this as real medicine. |
| Solitude and discord | Aelian's *cartazon* seeks deserted places, has a dissonant voice, and bears an “unconquerable horn” | Location variants, a disruptive sound card, and anti-control resistance. |
| Gentleness across species | Aelian says it is gentle with other kinds but fights its own | Prefer a protective card over indiscriminate area damage; explore a mirror-match wrinkle only if it remains legible and fair. |
| Refusal of captivity | Pliny says the *monocerōs* “cannot be taken alive”; Solinus similarly says it may be killed but not taken | A once-per-fight answer to immobilize/enthrall, not immunity to losing or dying. |
| Trust in the gloaming | Edwin Julian's Unicorn kneels and sleeps before the flower-bearing maiden | A voluntary, interruptible recovery card. Avoid reproducing the old virginity test. |
| The piercing horn | Solinus: “His horne sticketh out”; what it charges, “he striketh it through easily” | The force and reach behind the signature charge. |
| The tree feint | Topsell's lion dodges behind a tree, where the charging Unicorn's “sharp horn sticketh fast”; Spenser likewise has the horn strike “in the stocke” | The risk at the heart of **Sticketh**: a powerful charge can leave its user stuck and exposed. |
| Melancholy, captivity, and choosing one's own form | The animated film *The Last Unicorn* (1982), adapted from Peter S. Beagle's novel, contrasts an immortal creature's distance with captivity, apparent extinction, transformation, and the painful knowledge gained by entering mortal life | Give the pack a wistful undertone beneath its ferocity; frame freedom and self-possession as more important than being admired or preserved. |

Corroborate and contextualise the anthology during implementation with public or museum
sources, prioritising primary texts and clearly labelling later interpretation:

- Ctesias, *Indica* fragment 25: compare the supplied translation with the surviving
  epitome and the source notes in [Livius' Ctesias overview](https://www.livius.org/sources/content/ctesias/ctesias-indika/).
- Pliny, *Natural History* VIII: use a public-domain translation such as
  [Perseus' Pliny text](https://www.perseus.tufts.edu/hopper/text?doc=Plin.+Nat.+8.31),
  and retain *monocerōs* where discussing Pliny rather than silently treating every ancient
  one-horned animal as the same medieval Unicorn.
- The medieval *Physiologus* tradition: consult the
  [Fordham Medieval Sourcebook translation](https://sourcebooks.fordham.edu/basis/physiologus.asp)
  for the small fierce animal and capture allegory. Treat its theology and sexual symbolism
  as historical context, not as a rule imposed on players.
- The visual capture/death cycle: use the Metropolitan Museum's object record for
  [*The Unicorn Rests in a Garden*](https://www.metmuseum.org/art/collection/search/467642)
  and its related Unicorn Tapestries records for costume, flora, chain, wound, and enclosure
  references. Do not lift museum photography into the game without a separate rights check.
- Use *The Last Unicorn* as a **modern tonal reference**, not a source to reproduce. Review
  the 1982 film and Peter S. Beagle's novel for their melancholy treatment of rarity,
  captivity, identity, transformation, and memory. Do not copy dialogue, songs, character
  names, the Red Bull, the film's character designs, or its distinctive visual staging into
  cards, lore, sprites, or marketing; Deck Monsters' Unicorn must remain an original design
  grounded primarily in the historical source palette above.
- Marco Polo's encounter with an animal identified as a unicorn—heavy, muddy, and unlike
  the imagined captive of a maiden—in
  [Book III, chapter 15](https://en.wikisource.org/wiki/The_Travels_of_Marco_Polo/Book_3/Chapter_15)
  is useful corrective texture for stocky or dark variants. Present the likely rhinoceros
  identification as reception history, not as proof that the mythic creature was observed.

Research rules for the eventual implementation PR:

- distinguish ancient report, medieval allegory, early-modern natural history, later poem,
  and modern interpretation in comments and docs;
- quote no more than a short phrase on a card, credit it in source comments, and write
  original player-facing prose around it;
- do not flatten Indian, Persian, Chinese, or Japanese one-horned traditions into a generic
  “Oriental unicorn.” A future qilin/kirin creature deserves its own sourced design rather
  than becoming a cosmetic Unicorn variant;
- avoid claims that horn powder cures disease or poison outside the explicitly fictional
  card mechanic; and
- have final lore copy reviewed for the companion vocabulary and for the gendered capture
  tradition before generating `MONSTERS.md` or `CARDS.md`.

### Monster specification

**Name/type:** `Unicorn` / Unicorn. **Provisional class:** Cleric, because the current class
vocabulary already supports healing and antidotal cards. Do not add a one-off `Paladin`
class solely for this monster; revisit the class only if the full card-permission audit
shows Cleric grants combinations that erase the intended risk.

**Provisional level-0 shape:** `STR +1`, `DEX +2`, `INT -1`; HP one or two below the current
roster midpoint; AC variance high enough to express swiftness without exceeding the best
existing spawn AC by more than one. These are simulation inputs, not approved final values.
The total modifier budget should match existing monsters. The Unicorn should win through
tempo, cleansing, and one risky charge—not by combining top-tier AC, healing, and burst.

**Generated appearance fields:**

- coat: ivory white, winter white, tawny, or white with a dark-red head;
- eyes: dark blue, black, or woodland brown;
- horn: ringed black; white/crimson/black; bright ivory; or long straight black;
- build: horse-like, goat-bearded, stag-headed, stocky/cloven-hoofed, or the rare
  elephant-footed witness account;
- retreat: rocky gorge, laurel grove, inaccessible mountain, lonely wilderness, or enclosed
  garden; and
- voice: lowing, bell-like, or startlingly dissonant.

Keep the icon readable in the terminal (`🦄` unless rendering tests expose a width problem).
Descriptions should combine at most three variant clauses so `look at` remains skimmable.
The durable lore paragraph should say that accounts conflict rather than declaring one
anatomy canonical.

### Related cards

Values below are starting hypotheses. Every new card needs explicit class/type permissions,
rarity, shop/drop treatment, level, cost, target strategy, confusion behaviour, natural-1
and natural-20 outcomes where applicable, multi-team behaviour, and JSON hydration coverage.

#### 1. Sticketh — signature attack, required

The title is exactly **Sticketh**. It preserves the accidental mid-read that made the word
sound like a card name. The direct source is the tree-feint episode on the newly supplied
anthology page, attributed there to Edward Topsell's *History of Four Footed Beasts* (1607):
the lion sidesteps a Unicorn's charge and the “sharp horn sticketh fast.” The adjacent stanza
from Spenser's *The Faerie Queene* supplies the same reversal. The joke lives in the title;
rules and narration should be immediately clear.

- Unicorn-only melee card; candidate uncommon/rare, level 0, and initially not for sale so
  its availability can be deliberately seeded rather than flooding the generic drop pool.
- One target. Make a forceful charge against AC with a small to-hit bonus and strong but
  bounded damage (`1d10` candidate). It must not bypass armour or become an unavoidable
  opening kill.
- **Stick fast:** after a failed attack, make a STR save. On a failed save the Unicorn is
  immobilized until they pass the ordinary freedom check, representing the opponent's feint
  and the horn caught in the ring's timber. A natural 1 fails this save automatically; a
  natural 20 uses the engine's standard maximum-damage rule and never adds another multiplier.
- Being stuck creates counterplay rather than self-damage: the opponent gains an opening,
  but the Unicorn does not gore themself and narration should not turn the reversal into
  slapstick. In a team fight the state belongs only to the Unicorn who played the card.
- Do not inherit `Horn Gore`: that card assumes two horns, stacking immobilization, and
  Minotaur-specific matchups. Reuse small attack helpers, not its fiction or state model.
- Reuse the existing immobilization/freedom machinery rather than inventing a bespoke stuck
  status. The implementation spike must confirm that self-applied immobilization cleans up
  correctly on freedom, fight end, flee, death, cancellation, and hydration.

#### 2. Horn of Proof — cleanse with a cost

- Unicorn or Cleric; candidate rare, level 2.
- Target self or an ally under the existing team-target rules. Remove one supported poison
  or ongoing harmful effect, then heal a small fixed amount. If the current status model
  cannot enumerate effects safely, v1 must name exactly which effects it cleanses rather
  than promising a universal dispel.
- The horn is **not** consumed or filed away. The cost is tempo: this card deals no damage,
  and its heal must be weaker than a dedicated Heal of the same tier.
- Card copy may evoke a drinking vessel or clear water, but must state that this is a
  fantasy effect and avoid medical claims in generated explanatory prose.

#### 3. Unconquerable Horn — bounded anti-control

- Unicorn-only defensive card; candidate uncommon, level 1.
- Arm a once-per-fight ward. The next successful immobilize, enthrall, or equivalent
  control effect against the Unicorn is cancelled and the ward is consumed. It does not
  cancel damage, does not reflect the effect, and cannot stack.
- Decide from a card/effect audit whether “control” has a shared engine predicate. Do not
  identify it from narration strings or card names. If no safe shared boundary exists,
  support an explicit, tested list for v1.

#### 4. Dissonant Voice — disruptive utility

- Unicorn or Bard; candidate uncommon, level 1.
- Affect opponents, not allies. Each target makes an INT-based save; failure applies one
  small, one-play attack penalty. No damage and no multi-round silence.
- Use serial resolution and normal sub-event pacing so a large ring does not emit every
  save in one feed tick. Confirm confusion redirects both source and affected team correctly.

#### 5. Gloaming Rest — voluntary vulnerability

- Unicorn or Cleric; candidate rare, level 3.
- The Unicorn kneels and arms a delayed heal. Until their next card would play, their AC is
  reduced by a bounded amount. If they take damage, the rest is interrupted and the heal is
  lost; otherwise restore a meaningful but capped amount, then clear the penalty.
- This is trust, not magical obedience. No maiden target, gender gate, “purity” score, or
  sleep-control interaction. Narration can include flowers, laurel, evening, and kneeling.
- Implement as encounter-scoped state with cleanup on fight end, flee, death, hydration,
  and cancellation. Review the delayed-effect ordering rules before choosing hooks.

**Existing-card fit:** test Unicorn access to `Heal`, `Iocane`, `Fists of Virtue`, `Flee`,
and ordinary attacks. Do not automatically permit `Horn Gore` merely because Unicorn has a
horn. A proposed nine-card thematic test deck is `Sticketh` ×2, `Horn of Proof`,
`Unconquerable Horn`, `Dissonant Voice`, `Gloaming Rest`, `Heal`, `Fists of Virtue`, and
`Flee`; this is a simulation fixture and design demonstration, **not** a special starting
deck or a replacement for player deck-building.

### Implementation slices and definition of done

Implement in small commits only after this roadmap item is prioritised:

1. **Source and mechanic spike.** Complete the book citation; audit poison/control/damage
   events, encounter cleanup, team targeting, hydration, and card availability. Resolve the
   fallbacks above in a short decision note within this section before writing card code.
2. **Monster shell.** Add the creature type, class choice, Unicorn model and appearance
   variants, registry/export/hydration paths, spawn tests, and generated lore source. Confirm
   old saves still hydrate and seeded spawn tests remain deterministic.
3. **Sticketh vertical slice.** Implement the signature card and self-immobilization path,
   including hit, miss, both rolls, crits, confusion, freedom, cleanup, and serialization
   tests. Independently review this slice before building other delayed/ward effects on it.
4. **Support cards.** Add the other four cards one at a time with focused tests. Reuse shared
   effect primitives only when at least two cards genuinely share semantics; do not create a
   broad status framework just to make the proposal look uniform.
5. **Distribution and references.** Register cards for lookup, draw, sort, hydration, and
   permissions; make an explicit sale/drop decision for each; update generator sources and
   run `pnpm run build:docs` rather than editing `MONSTERS.md` or `CARDS.md` by hand.
6. **Balance pass.** Extend the harness roster and run seeded all-pairs trials at levels
   1/5/10/15/20 with both random legal decks and the thematic fixture. Report win rate,
   average rounds, damage per card, heal/cleanse value, ward trigger rate, Sticketh miss and
   self-immobilization rates, Gloaming Rest completion rate, mirror matches, and at least one
   team fight.
7. **Live copy and pacing check.** Stage ordinary, mirror, control-heavy, poison-heavy, and
   multi-contestant fights. Verify narration order, pronoun agreement, card readability,
   emoji width, and cleanup after flee/death/cancel. Capture a screenshot only when a visible
   UI or sprite implementation is part of the eventual change.

Acceptance gates:

- all new state is encounter-scoped, survives or intentionally resets through hydration,
  and cannot leak across rooms or fights;
- no card adds an unscoped `game.on(...)` listener or timer; delayed effects follow the
  engine concurrency/timing contract;
- no unconditional immunity, unavoidable burst, permanent stat change, or gender/morality
  gate enters the design;
- the Unicorn's fixed-deck seeded matchup win rates follow a Cleric's power curve across
  levels (see the balance target in [11](11-balance-and-mechanics.md#combat-design)); rows
  outside the harness review band (35–65%) are documented with a reason, not treated as a
  gate;
- source-derived copy is original, short quotations are attributed in source comments, and
  the generated monster/card references pass the documentation checks; and
- `pnpm build && pnpm typecheck && pnpm lint && pnpm test`, `pnpm docs:check`, and the relevant
  `sim:*` reports complete, followed by the required independent code review and live check.

## World and long-term goals

- [ ] Design graveyard NPCs and a memorial-compatible return for permanently dismissed
  monsters.
- [ ] Decide whether the retired exploration concept should return as a structured
  adventure/job-board system.
- [ ] Design tournaments with brackets, prizes, titles, and awards.
- [ ] Design The King's Sentence for large-group boss victories.
- [ ] Decide whether a currency symbol improves the player-facing economy vocabulary.

## Constraints

New combat content needs simulation coverage. Player-facing terminology follows
[voice and wording](../reference/voice-and-wording.md); items follow
[`ITEMS.md`](../../ITEMS.md); teams and boss content follow
[boss encounters](../architecture/boss-encounters.md). Card-spec and card-authoring skill
work is the Cards item above.
