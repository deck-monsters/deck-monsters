---
type: Archive
title: Unicorn Content Pack Pass
description: Closed pass record and original design brief for the Unicorn monster and its five cards.
status: deprecated
audience: internal
tags: [content, cards, monsters, unicorn]
---
# 26 — Unicorn Content Pack Pass

**Status:** Closed. Shipped in PR #394 (September 2026); follow-up browser checks and fixes
landed in the same PR. Historical record of the pass. Its lasting rules now live in
[cards and encounter effects](../../architecture/cards-and-encounter-effects.md), the
[simulation harness](../../reference/simulation-harness.md), and the
[Unicorn strings inventory](../../reference/strings/unicorn.md). This pass ran as
roadmap 23 while active and was renumbered on archiving, because archive 23 was already
taken by the pixel fight stage.

## Tasks

| # | Slice | Status | Commit |
|---|---|---|---|
| 1 | Source and mechanic spike (decision note below) | Done | this file |
| 2 | Monster shell: `Unicorn` type, Cleric class, appearance variants, registry, spawn prompt, names, web sprite, harness roster | Done | 73e04d1 |
| 3 | `Sticketh` vertical slice with self-stick via the immobilize machinery | Done | ce3b048 |
| 4 | Support cards: Horn of Proof, Unconquerable Horn, Dissonant Voice, Gloaming Rest | Done | 862762b |
| 5 | Distribution and generated references (`pnpm run build:docs`) | Done | 16ae4c2 |
| 6 | Balance pass (`sim:winrates` plus the new `sim:unicorn`) | Done (rerun after harness fix #183) | 71c3d9d, c72b2e0, 9d31af0 |
| 7 | Live copy and pacing check (feed level, then browser) | Done | 6e0d53f, 1cf6ed3, 9733e6d |

## Decisions from the spike

- **Class.** Cleric, as the brief proposes. The Cleric pool adds Iocane, Revive, Lucky
  Strike, Brain Drain, Rehit, Blast, Cloak of Invisibility, Enchanted Faceswap, and Feline
  Companion. None of those combine with the Unicorn cards into unconditional immunity or
  unavoidable burst, so no new class was added. `Horn Gore` stays Minotaur-only.
- **Stats.** DEX +2, STR +1, INT −1 (the same +2 budget as every monster), `acVariance` 2
  (ties the best existing spawn offset rather than exceeding it), `hpVariance` 1 (one below
  the roster midpoint of 2).
- **Roster order.** `Unicorn` is appended after `WeepingAngel` in `allMonsters`. The spawn
  prompt answers with an index into that array, so inserting alphabetically would have
  shifted the Weeping Angel's index for tests and saved harness configs.
- **Description.** At most three variant clauses: build with coat, horn, and one "witness"
  detail (eyes, retreat, or voice). All six fields are still generated and persisted.
- **Control boundary.** Every current control effect (Immobilize, Horn Gore, Coil,
  Constrict, Entrance, Enthrall, Mesmerize, Forked Stick, Forked Metal Rod) applies through
  `ImmobilizeCard.immobilize()`, which is the shared predicate the Unconquerable Horn ward
  hooks. Sandstorm's confusion is not control for v1 and is not cancelled.
- **Cleanse list.** Horn of Proof names exactly what it removes, in priority order: an
  immobilize hold on the target, the target's harshest negative encounter stat penalty
  (Soften and similar curses), then a Bad Batch poison waiting in the ring. It removes one.
- **State.** Every new state lives on `creature.encounter` (modifiers or effects), which
  `endEncounter()` deletes, so nothing survives fight end, flee, death, or cancellation,
  and nothing is serialized. No new `game.on(...)` listener or timer is added.
- **Sticketh.** Extends `ImmobilizeCard` only to reuse `ImmobilizeEffect`, freedom rolls,
  fatigue, and cleanup. Charge: 1d20 + DEX + 1 vs AC for 1d10 + STR. A natural 1 on the
  charge is a miss (no fling-back self-damage). After any miss the Unicorn makes a
  1d20 + STR save against the target's DEX (a nimbler foe sells the feint better); on a
  failure they hold themself with freedom 1d20 + STR vs their own STR − 3 per turn stuck.
  The self-hold bypasses `immobilize()`, so Unconquerable Horn never cancels it. Two
  `ImmobilizeCard` hooks, `emitHeldEffect` and `getFreedomCommentary`, let it narrate
  "horn stuck in the timber" instead of "X is stuck by X"; the default text is unchanged.
  It is seeded in the starting deck beside the other monster signatures, rare in drops,
  and back-room only in the shop.
- **Unconquerable Horn.** Unicorn-only, uncommon, level 1. Arms
  `encounterModifiers.unconquerableWard` (`cards/helpers/control-ward.ts`). The next
  successful hold an opponent lands through `immobilize()` is cancelled and the ward is
  spent; attached damage (Coil, Forked Stick) still lands. A teammate's area hold
  (Mesmerize catches allies) does not spend it; allegiance uses the ring's team precedence,
  and a free-for-all ring event makes everyone an opponent. It does not re-arm in the same
  fight and does not stack.
- **Horn of Proof.** Unicorn or Cleric, rare, level 2. Removes the first of: a hold, the
  harshest negative encounter stat (not counting a Gloaming Rest's own temporary −2 AC,
  which the rest gives back itself), or one queued ring Bad Batch (others stay queued); then heals a fixed 3 (below Heal's
  1d4 + INT, which also scales with level). Self-targeted like Heal; ally targeting waits
  for a team-heal targeting rule, which no card has today. A held monster's own card never
  plays, so the hold case only applies when confusion turns the card on someone else; the
  stats text says that instead of promising a self-cleanse.
- **Dissonant Voice.** Unicorn or Bard, uncommon, level 1. Each opponent (team-aware via
  `getTarget`) rolls 1d20 + INT vs the singer's INT; a failure takes 2 off that monster's
  next attack roll. The penalty is spent on the next card either way, never stacks, and
  deals no damage. Saves resolve serially with a sub-event beat each.
- **Gloaming Rest.** Unicorn or Cleric, rare, level 3. −2 AC until the Unicorn's next card;
  if no hit that took HP is logged after the rest began (same `hitLogTimestamp` clock as
  Delayed Hit; hit-log entries now record `dealt`, so a blow the brace absorbs in full does
  not break the rest), heal 3d4 as that card begins. The full −2 is given back: a brace
  raised during the rest was only reduced by the penalty, so whatever the hits did not
  spend returns whole. (A first version clamped the give-back and lost the 2 AC for the
  rest of the fight whenever a brace was already up.)
- **Distribution.** Sticketh: rare drop, seeded in the starting deck, back-room only.
  Unconquerable Horn (uncommon), Dissonant Voice (uncommon), Horn of Proof (rare), and
  Gloaming Rest (rare) are ordinary drops and sold in the front shop. The four support
  cards sit alphabetically in `cards/helpers/all.ts`, which is also the order of the
  generated card lists.
- **Citation.** The anthology is *A Book of Unicorns* (Star & Elephant Book, The Green
  Tiger Press, La Jolla, California; introduction by Welleran Poltarnees). The owner's copy
  has no copyright page; its newest dated artwork is from 1976. A final content pass checked
  every source comment and the lore against the photographed pages and corrected four
  things: stag's head, elephant's feet, and boar's tail are Pliny's (ancient), not "later
  bestiaries"; the cloven hooves, black eyes, long straight horn, and lonely wilderness are
  Dapper's (1673), not Marco Polo's; Ctesias says a horn cup makes the drinker immune to
  poison, not that it betrays poison; and Edwin Julian's poem is comic verse illustrated by
  Reginald Birch, which the first comment called "modern". The Topsell, Spenser, and Brothers
  Grimm page confirms Sticketh's sources word for word; the Grimm tailor's tree feint is now
  cited too. Card and monster copy remains original prose.

## Balance evidence (slice 6)

The first run of this section measured harness bugs: alphabetical card draws stacked
Cleric decks with Blast (fixed-bug #183), team fights used a team-blind boss strategy, and
the card counters included other monsters' plays. These numbers are from the rerun after
those fixes, with Flee kept out of harness decks: `sim:winrates` at level 5 (200 fights per
pair) and `sim:unicorn` (100 fights per row). Values are the Unicorn's share of decisive
fights; draws are now 0–10%.

| Opponent | Random deck L1 | L5 | L10 | L15 | L20 | Test deck L1 | L5 | L10 | L15 | L20 |
|---|---|---|---|---|---|---|---|---|---|---|
| Basilisk | 59 | 62 | 80 | 71 | 87 | 42 | 44 | 40 | 38 | 33 |
| Gladiator | 68 | 70 | 78 | 94 | 89 | 53 | 53 | 44 | 45 | 30 |
| Jinn | 81 | 62 | 67 | 67 | 70 | 63 | 43 | 35 | 29 | 28 |
| Minotaur | 58 | 52 | 76 | 85 | 77 | 45 | 54 | 40 | 42 | 39 |
| Weeping Angel | 65 | 72 | 70 | 60 | 58 | 59 | 42 | 38 | 20 | 9 |

In the level 5 `sim:winrates` matrix every pair lands in 39.5–65.5%; the Unicorn wins
51.5–64% as the first contestant and its opponents 39.5–47.5% against it.

Card rates (test deck, Unicorn plays only): Sticketh hits 74% and sticks the Unicorn on 11%
of plays; the Unconquerable Horn ward triggers in 44% of fights where it is armed (65% in
the team fight); Horn of Proof finds something to cleanse 39% of the time; Dissonant Voice
rattles 16% of saves; Gloaming Rest completes 61% of the time for an average 7.5 hp and is
interrupted 36% of the time. Mirror match: 55 / 45%, no draws; both test decks run in
step, so each rest resolves before the other side attacks. Team fight (Unicorn + Gladiator
vs Minotaur + Basilisk, team-aware targeting): member win rates 36 / 54 / 12 / 42%, 3% draws.

### Findings

The balance target is a class power curve across levels, not 50/50 everywhere (see
[11 — Balance](../../roadmap/11-balance-and-mechanics.md#combat-design)), so none of these blocks merge:

1. **The random-deck Unicorn is on the strong side, and its curve rises with level** (about
   52–81% at levels 1–5, 58–94% at 15–20). The rising curve is right for a Cleric; the early
   strength is a little high. Watch it in real play. If it proves too strong early, the first
   levers are Sticketh's +1 to hit or `hpVariance` 1 → 0.
2. **The 9-card test deck is even early and fades late** (42–63% at levels 1–5, 9–45% at
   15–20). Six of its nine cards are utility with no level scaling, so this is the deck, not
   the monster. It is a design demonstration, not a starter deck, so no change.

## Live copy and pacing check (slice 7)

Seeded single fights through `simulate()` with the public feed captured (ordinary, mirror,
control-heavy Basilisk with Coil and Constrict, poison-heavy Jinn with Bad Batch, and a
four-monster crowd). Checked the order of turn banner, card box, rolls, narration, and
state lines; pronoun agreement for he, she, and they; and that 🦄 🏺 💎 🔔 🌙 render as
single-width emoji in the card boxes. Two fixes came out of it:

- "Sim 1 kneel among the laurel and close their eyes": Gloaming Rest ran `agree()` on a
  sentence whose subject is the monster's name, which is always singular. Fixed, with a
  regression test.
- Horn of Proof's stats promised to free a hold on the player, which cannot happen on their
  own turn. The text now says what it does.

Also observed, working as designed: a Unicorn stuck by Sticketh counts as already held, so
an opponent's Coil or Constrict turns into a plain hit ("shows no mercy") and does not spend
the Unconquerable Horn ward. That free hit is the "opening" the card narrates.

An independent read-only review of the whole diff found no blockers. Its two nits, that the
single-line branches of Unconquerable Horn and Gloaming Rest take no sub-event beat, match
the other one-line self-buffs (Boost, Thick Skin, Battle Focus, Basic Shield), which rely on
the ring's card-to-card gap. They were left as they are.

A browser check on PR #394 (a Cursor agent, in a throwaway room) trained a they/them
Unicorn, equipped Sticketh from the starting inventory, and fought a Gladiator boss. The
sprite and roster read as a unicorn, the card box wrapped inside its frame, pronouns agreed,
and nothing threw. It found four fixes, all made: the description read "a coat of ivory
white with a dark-red head and a … horn" (the coat is now its own sentence); the web
workshop badged Sticketh as Utility (the name-keyword list now covers the pack); Dissonant
Voice's stats implied the penalty survives a non-attack card (it does not, and now says
so); and Horn of Proof still said it checked "every cup". The card-box border drifting on
emoji rows affects every card and is filed as item K in [10 — Bug fixes](../../roadmap/10-bug-fixes.md).

Nothing in this pass is still open. Archive it once PR #394 merges.

## Design brief (as approved)

The brief below is the original specification from the content backlog, kept verbatim
for its research notes and rationale. Where it and the task decisions above differ, the
decisions record what shipped.

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
  levels (see the balance target in [11](../../roadmap/11-balance-and-mechanics.md#combat-design)); rows
  outside the harness review band (35–65%) are documented with a reason, not treated as a
  gate;
- source-derived copy is original, short quotations are attributed in source comments, and
  the generated monster/card references pass the documentation checks; and
- `pnpm build && pnpm typecheck && pnpm lint && pnpm test`, `pnpm docs:check`, and the relevant
  `sim:*` reports complete, followed by the required independent code review and live check.
