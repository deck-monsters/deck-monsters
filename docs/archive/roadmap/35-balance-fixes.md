---
type: Archive
title: Balance Fixes — First Pass on Measured Evidence
description: Plan for the first balance changes made from roadmap 34's measurements, covering the Dragon, the Gladiator, and making the unique cards that sit unused usable, with guardrails for the band, excitement, and hope.
status: deprecated
audience: internal
tags: [archive, balance, cards, monsters]
---
# 35 — Balance Fixes: First Pass on Measured Evidence

**Status:** Closed (2026-09-29). PR C (`claude/balance-fixes-c`) shipped the Dragon and Gladiator
body fixes and Tsunami. PR D (`claude/balance-fixes-d`) shipped the Unicorn's four cards and
the Dragon's new options, confirmed by the owner's
[run](../../reference/balance-reports/2026-09-29-confirm-35d.md). The lasting rules are in
[cards and encounter effects](../../architecture/cards-and-encounter-effects.md#content-and-balance-rules)
(the balance rules, the risky heals, and fear and song), the
[voice guide](../../reference/voice-and-wording.md#the-dragons-voice), and the
[simulation harness](../../reference/simulation-harness.md). The card studies are in
[studies](../studies/). The leftovers are in
[11's next balance pass](../../roadmap/11-balance-and-mechanics.md#next-balance-pass-carried-from-roadmap-35)
and [34's candidate list](../../roadmap/34-balance-methodology.md). This is a historical record.

## Why this pass, and what it rests on

Roadmap 34 measured before tuning. Its reports are in
[balance reports](../../reference/balance-reports/README.md):

- the [catalogue](../../reference/balance-reports/2026-09-28-catalogue.md), with its
  [contexts](../../reference/balance-reports/2026-09-28-contexts.md);
- [chassis, collections, and holders](../../reference/balance-reports/2026-09-28-layer3.md);
- the [best-hand search](../../reference/balance-reports/2026-09-28-search.md).

They agree on this:

- **The Dragon is low at every primary level** with searched hands: 23%, 34%, and 33% at
  levels 1, 3, and 5.
  - Its body is 1-2.5 Hits below the reference.
  - Its epic, Tsunami, is worth about nothing in every context.
  - At level 1 the search swapped both Fire Breaths for Delayed Hits.
- **The Gladiator is low at every primary level:** 37%, 37%, and 32%. Its body is 0.5-1.2
  Hits below the reference at every level, against the owner's goal of brutes being strong
  early.
- **The Weeping Angel is the strongest** (65-72%), with two matchups over 85%. It is watched
  here, not trimmed: its field average is in band, and the confirmation run decides.
- **Some unique cards are weak in every context**, so players ignore them. That runs against
  the owner's aim below.

## The owner's direction (2026-09-28)

- **Unique cards should be usable.** "I want these fun cards that are unique and interesting
  to be actually usable, useful, and not just ignored." A card may stay situational, but a
  player who builds around it should find it worth its slot.
- **The Unicorn's cards: definitely tweak.** Unconquerable Horn, Dissonant Voice, and
  Gloaming Rest (and Horn of Proof, which is weak outside crowds).
- **Tsunami: tweak slightly.** It needs only a small boost and must not become overpowered.
- **Mesmerize and Enthrall: optional.** They are probably fine, since the Weeping Angel has
  many good cards, but simple fixes would be welcome.
- **Harden: fine if a bit weak.** Leave it unless a fix is trivial.
- **Prion Disease is a joke card. No change.**
- **Standing rules from 34 apply:**
  - the band (35-75% field average; single matchups 20-80%, none over 85%);
  - levels 0-7 first;
  - the smallest change;
  - hope and excitement kept (the "please get a Loki" moments);
  - counter cards preferred to nerfing the big swing cards;
  - weak cards allowed unless a monster has no competitive picks.

### Owner follow-up (2026-09-29)

- **Blink stays as it is; counters are the answer.** "It's definitely not true that in normal
  full-handed battles against diverse competitors Blink always wins. If it happens to counter
  a really powerful card it can make a huge difference but many times it's not as significant
  as it might appear. So providing more counter options is the better choice to neutering it."
  So the Dragon at level 1 (28% after task 2, the gap one Blink matchup) is **accepted**: no
  Blink trim. More counter options, starting with the Unconquerable Horn counterspell (task 5)
  and the counter family in [12](../../roadmap/12-new-content-backlog.md#cards), are the response.
- **The Unicorn's cards are about being useful and interesting, not about the Unicorn.**
  "Unicorns are already pretty powerful because they can use spells like Blast." Task 5 must
  not raise the Unicorn's field average; a tweak passes when the card earns its slot in the
  hand it is built for, and the Unicorn stays where it is.
- **The Dragon may be missing options.** "It does feel like the dragon may be missing more
  options and need to rely more heavily on just its own special cards since it's the first
  Wizard." The Wizard class holds only the Dragon's own four cards plus Cloak of
  Invisibility and Revive, so most of a Dragon's hand is generic strikes (the reason its STR
  was raised to 0 in [30](30-dragon-pack.md)). Task 8 below widens it.

### The two horns (owner, 2026-09-29)

Making Unconquerable Horn a counterspell (task 5a) left it overlapping Horn of Proof: both
answered curses and poison, one before and one after, and both healed. The owner: "either go
with the split or make H of P the do everything card and UH something different like an attack
or maybe a rally teammate call (one of your allies does a hit-style attack for you alongside
your own hit ... with an imaginary animal like an otter or deer or ram filling in if you have no
ally in the ring)". Measured, a split would leave both cards weak (the pure counterspell was 1-6
points below a Hit), so:

- **Horn of Proof is the protection card:** it cleanses one harm already on you, wards you for
  one round against the next harmful non-damage effect (the counterspell moves here), and heals.
- **Unconquerable Horn is a rally call:** the unicorn sounds its horn, strikes, and an ally in
  the ring strikes the same target; with no ally (every duel) an otter, a deer, or a ram answers
  with a modest attack of its own. The companion's numbers are class settings, to be measured.

### Dragon cards: voice and jokes (owner, 2026-09-29)

Owner follow-up: "It's okay to have a bit of Roman in there too. I just want to make sure the
prose feels flavorful, and the dragon cards are missing that a bit while the other cards
(including the also recent unicorn) have it. Dragons could also have little poems or songs."
So task 8 includes a **flavour pass over the existing Dragon cards** (Fire Breath, Take Wing,
Mood Scales, Tsunami, the ancient dragon lines), not only the new ones, and Dragon narration may
carry short verses: skaldic-style couplets with kennings ("wave-steed", "hoard-warden"),
alliterative lines in the manner of the Eddas, or a Roman marching chant for the draco
standard. Public-domain sources named in a comment, as for the Unicorn.

The jokes may be old public-domain dad jokes, copied or adapted (owner: "the web is full of
them and dragons are a great place for the sort of 'dad joke' you can easily copy"). As with
the quotations, the orchestrator writes these lines; implementers do mechanics.

For task 8's new Dragon cards and any Dragon narration they bring:

- **Voice: Norse mythology and the Vikings.** Old public-domain Norse texts may be quoted for
  atmosphere (the Poetic Edda in a public-domain English, Morris and Magnússon's 1888
  *Völsunga saga*, Gummere's 1910 *Beowulf*), named in a source comment, per "Quoting old
  texts" in the cards architecture doc. The Dragon pack's rule still holds: the *How to Train
  Your Dragon* books supply setting and feel only, never names, quotes, species, or designs.
- **A joke about yelling at the dragon, loudly, to control it.**
- **A joke about the dragon having eaten or otherwise destroyed something it shouldn't have.**
  (The pack already has the hoard's "one cup missing" and the profile's table manners; this is
  a new line, not a repeat.)
- Candidates from the first pass: **Tail Lash** (Topsell's tail; a strike and a smaller follow-up
  on a hit, the Dragon's Battle Focus) and **Draco's Howl** (the Roman draco standard; a roar that
  shakes opponents' aim), alongside existing cards opened to the Wizard. Names and shapes may
  change to suit the Norse voice.

### Finding: attack-roll penalties barely matter (2026-09-29)

Measured in real hands against the field, a penalty to opponents' attack rolls does not earn a
card slot in any shape tried: Dissonant Voice (-2, one card; -4; plus a 1d4 sting) and Helm of
Awe (-2 for three cards; -5; -2 for a whole round) all stayed 5-11 points below the card they
replaced. Fights last about two rounds and each opponent makes only a few attack rolls, so a
few points off each changes little. A card whose job is to blunt opponents needs a stronger
shape: a lost card (fear, cowering), a hold, or a redirect. Design future debuff cards with
this in mind, and do not tune a to-hit penalty upward to fix one.

### Natural 1 and natural 20 are fixed (owner, 2026-09-29)

A natural 1 is the only Curse of Loki and a natural 20 the only stroke of luck. Advantage and
disadvantage fit that precedent, because every roll is still a plain d20. Widening either
range (a natural 1 or 2 as a Curse of Loki) does not fit it, even when it measures well. The
Loki-range variations of Dissonant Voice were measured for information and then removed with
their setting.

### Pinned monsters are easier to hit (owner idea, 2026-09-29; a later task)

A pinned monster could carry a status that gives every attack roll against it advantage, as a
restrained creature has in D&D. "Pinned" means Coil, Constrict, Immobilize, Entrance,
Enthrall, Mesmerize, Horn Gore's hold, the Forked Stick and Rod, and Helm of Awe's cowering.
Dissonant Voice's rattle is not a pin: the monster still acts. The rule would change every
hold at once, so it gets its own task after 5 and 8: one shared "pinned" check (the ward's
`isOpponentHold` is half of it), then a whole-field before/after on the same seeds, probably on
the owner's machine. Expected to be modest, since roll changes move little here. It would also
make more strokes of luck against a held monster. Its active home is
[11's next balance pass](../../roadmap/11-balance-and-mechanics.md#next-balance-pass-carried-from-roadmap-35).

## Targets for a card fix

A tweaked unique card should, at levels 1-7:

- be worth **at least 0.8 Hit-equivalents in its best context** (the
  [context](../../reference/balance-reports/2026-09-28-contexts.md) measure), so it earns a slot
  in the hand it is built for;
- stay **at most its class median times the rarity premium** (1.5× for epic and very rare,
  1.25× for rare), so it does not become the new default;
- **keep its identity:**
  - same role, same fantasy, one readable line of card text, voice per
    [voice and wording](../../reference/voice-and-wording.md);
  - **read like a roll where it can**, rather than a flat number (the Sandstorm-roll
    principle);
- **leave its monster in band:** a card fix must not push its monster's field average above
  75% or any matchup over 85%.

## Candidate changes (to measure, not decisions)

Each change is tried as one or two variants. The smallest variant that meets the targets
wins, measured before and after on the same seeds.

| Card or monster | What is wrong (measured) | Candidates |
|---|---|---|
| **Dragon body** | 1-2.5 Hits below the reference at every level | A small HP or AC variance raise, or a stat offset. Find what the other bodies have that the Dragon lacks before choosing |
| **Fire Breath at level 1** | The search preferred a Delayed Hit on the real Dragon at level 1 | Diagnose first: the dodge difficulty at low INT, the winded give-back, and base damage at level 1. Fix only what the diagnosis shows, and keep the dodge roll (it is the card's excitement) |
| **Tsunami** (owner: slight) | About 0 everywhere. 5 damage to everyone, the Dragon included, so a duel is a wash | Let the Dragon ride its own wave: a DEX roll to take half or none. Or the wave sparing allies. Keep the damage and the self-risk; ceiling at the area class median |
| **Gladiator body** | 0.5-1.2 Hits below the reference; low at every primary level | A small early boost that fades by level 7 (brutes strong early, per the owner), or a flat offset if it is low late too |
| **Unconquerable Horn** (owner's redesign, 2026-09-28) | About 0.2; it wards only against holds, which Hit and field opponents rarely play | **A one-shot counterspell** (owner): until the end of the round, or until it fires, it stops the next negative action aimed at you **that is not damage**. Damage still lands; everything else is warded. See the ward's scope below |
| **Dissonant Voice** | About 0.2: −2 to one attack roll for each opponent who fails an INT save | A larger penalty (−4), or the penalty lasting until the end of the opponent's next card, or a small sting (1d4) on a failed save |
| **Gloaming Rest** | About 0-0.4: any damage before your next card cancels the whole heal, and in a duel damage almost always comes | Damage reduces the heal instead of cancelling it; or a smaller heal that always lands, plus the full rest if undisturbed |
| **Horn of Proof** | 0.3-0.6 in duels (fine in a crowd) | Measure after the others; tweak only if the Unicorn still lacks a usable heal |
| **Mesmerize, Enthrall** (optional) | About 0.2 in every context; self-mesmerize and the type rules often waste them | Only a simple fix, e.g. less self-mesmerize. It must not raise the Weeping Angel's field average |
| **Harden** (optional) | 0.4 | Leave unless trivial |

### Unconquerable Horn as a counterspell (owner, 2026-09-28)

The owner's direction: "like a counterspell that lasts for one round or until some sort of
negative action that is not a damage action is attempted. So a hit or a blast lands but a
blink may not, or a coil may not, or a soften may not." Once used it is gone, and it does not
block everything.

**What the ward stops.** The next negative, non-damage effect an opponent aims at the Unicorn:
- **holds:** Coil, Constrict, Entrance, Enthrall, Mesmerize, and immobilize generally;
- **stat curses:** the curse part of Soften, Molasses, Concussion, and Brain Drain;
- **poison and tampering:** Bad Batch's spoiled drink;
- **removal:** Blink's time-shift;
- **confusion:** Sandstorm's and Enchanted Faceswap's target redraw.

**What still lands:** damage. A Hit, a Blast, Fire Breath, and the damage part of a
curse-strike still land. Only the curse, hold, or redirect that comes with them is warded.

**What it does not touch:** Curse of Loki. That is the attacker's own natural 1 turning back
on them. It is a roll outcome, not an action aimed at the Unicorn, and it is a "please get a
Loki" hope moment worth keeping (34, Hope). If the owner meant something else by "loki", the
scope is easy to extend.

**Duration and count.**
- It lasts until the end of the round, or until it fires, whichever comes first. One block,
  then it is spent.
- It keeps the current rule: no second ward in the same fight.
- A second block at high levels is **not planned**. The owner expects one block to scale
  naturally, since what it blocks grows stronger with level. Measure the single block at
  levels 7-12 before adding one.

**The engine work.** Today the ward hooks only `immobilize()`. The counterspell needs one
generic check before any negative non-damage effect lands on a target, for example
`target.consumeWard(effect)`. That means a shared tag or hook on the curse, poison, removal,
and redirect paths. Each warded effect gets a narration line in the Unicorn's voice, from the
[strings inventory](../../reference/strings/unicorn.md).

**Why it matters beyond the Unicorn.** It is the first card of the counter family in
[12](../../roadmap/12-new-content-backlog.md#cards): it answers Sandstorm, Faceswap, and Blink by
bending them, not by nerfing them. Measure it the way counters are judged (34's rule 5):
against opponents who play those cards, in the holds context (task 1) and against the
searched field.

The candidates come from reading each card's code (2026-09-28). Numbers are starting points
for the measurement.

## Guardrails every change is checked against

- **The band, on searched hands:** the lean search's matrix at levels 1, 3, and 5, before
  and after, on the same validation seeds. Level 7 is added for the final check.
- **The card's own value:** the context catalogue for the changed card, before and after.
- **Excitement and hope** (34, Layer 6): fight length, comebacks, and turnarounds from below
  20% win chance, and the rate and size of Curse of Loki, natural 20s, and strokes of luck.
  Per the working targets in 34, no drop over 20% without the owner's agreement.
- **Bosses:** `sim:bosses` and the mega boss stay at their own targets. The changes here must
  not make bosses easier or harder beyond noise.

## Harness prerequisites (task 1 of PR C)

The lean search had two limits (see the
[search report](../../reference/balance-reports/2026-09-28-search.md)). Fix them before measuring
changes:

1. **Heals do not stack.** The collection model's typical hand caps heals (Heal, Whiskey
   Shot, Scotch) at 2 instead of adding values one card at a time.
2. **Search power.** Add a `--confirm-fights` setting and a before/after mode. That mode
   replays two fixed sets of hands, current and changed, on the same validation seeds, with
   enough fights to see 3-5 points. The owner's machine runs the heavy confirmation.
3. **A holds context** for the catalogue (an opponent whose hand is holds: Coil, Constrict,
   Entrance, Horn Gore), so counters to holds such as Unconquerable Horn are judged where
   their target is played.
4. **Minimal excitement and hope metrics** (34's task 8a, reduced): per fight, rounds,
   comebacks, rare-event counts (Loki, natural 20, stroke of luck), and turnarounds by a
   simple HP-lead proxy. The calibrated win-probability model stays in 34.

## Tasks

| # | PR | Task | Acceptance | Status | Commit |
|---|---|---|---|---|---|
| 1 | C | Harness prerequisites (above) | Tests; the heal cap shows in the collection JSON; before/after mode reproduces a known result | Done: the heal cap and context-ranked typical hands landed in #409 (Codex review); excitement tally in `simulate()` and the runner; a holds context; `plan:matrix` and `sim:matrix-report` for before/after on fixed hands and seeds, with the guardrails | this commit |
| 2 | C | Dragon: diagnose Fire Breath at level 1; choose the smallest body or card change; Tsunami's slight tweak | The Dragon in band at levels 1, 3, 5 on searched hands; Tsunami 0.8+ in its best context and at most the area median; no Dragon matchup under 20%; guardrails hold | Done, mostly: +3 HP and youth AC 2 (a new per-class field) bring the Dragon from 23/33/32% to 34/42/37%; Fire Breath is not the problem and stays; Tsunami's ride-the-wave roll takes it from worse than a Hit to about a Hit. Level 1 (34%) and the matchup under 20% remain, both from the Weeping Angel (94%). [Report](../../reference/balance-reports/2026-09-28-fixes-dragon-gladiator.md) | 1cc68c5, 806036a, this commit |
| 3 | C | Gladiator: early body change | The Gladiator in band at levels 1, 3, 5; brutes stronger early than late; guardrails hold | Done: +3 HP and youth AC 2, from 39/37/31% to 49/45/37% with the Dragon's change beside it; guardrails up 4-9%. [Report](../../reference/balance-reports/2026-09-28-fixes-dragon-gladiator.md) | this commit |
| 4 | C | Confirmation run on the owner's machine, docs (card architecture doc, generated references via `build:docs`, bugs and roadmap tables) | Before/after report checked in | Done: owner's run, a new search at levels 1-7 and 2,000 fights a pair before and after. Levels 3, 5, and 7 are in band for every monster, and the guardrails rose 4-5%. The Dragon at level 1 rose from 16% to 28% and stays below the floor through one card (the Angel's Blink, worth 52 points in that matchup), which is the owner's call. The Unicorn beating the Dragon 98% at level 7 is a search artifact (a plain Dragon hand wins 51%). [Report](../../reference/balance-reports/2026-09-28-confirm-35.md) | fee9549, dcb9197 (owner's run), this commit |
| 5 | D | Unicorn cards: Unconquerable Horn, Dissonant Voice, Gloaming Rest (Horn of Proof if still needed) | Each 0.8+ in its best context and within the class ceiling; the Unicorn stays in band; the card text is readable and in voice | Done. The owner split the two horns: Horn of Proof is the do-everything protection card (cleanse, then a one-round, once-per-fight ward against the next negative non-damage effect, see [cards and encounter effects](../../architecture/cards-and-encounter-effects.md#holds-and-the-horn-of-proof-ward), then a heal of 5: about a Hit, +3.9/-1.0/+0.4 at L3/5/7); Unconquerable Horn is a rally, a Hit where an ally strikes too, or an otter, deer or ram if none (about a Hit or better, +4.3/+1.9/-1.8/+0.3 at L1-7). Measured in the Unicorn's searched hands against every other monster's, 400 fights a pair. Gloaming Rest done: an undisturbed rest heals a random 4 to all missing hp, a broken one nothing, bosses the same. A guaranteed full heal averaged fine but decided single fights (L3 duels: the Unicorn lost 9% of fights where a rest completed); seven shapes and a wrath-on-waking idea were measured, see the [Gloaming Rest study](../studies/2026-09-gloaming-rest.md). Dissonant Voice done: no save; every opponent's next attack rolls at disadvantage, waiting for a card that rolls to hit. At par in crowds and team battles, 1-5 below one-on-one. See the [Helm of Awe and Dissonant Voice study](../studies/2026-09-helm-of-awe-and-dissonant-voice.md). All the Unicorn's cards are done | e751b0c, fed65a8, b6bc66d, d6b5494, 8ae89d4, 6d55666, 74b3c49, 32e9db4, 134a7a0, e7c1821, bc18dea, 7a26519, 2b52ef1, this commit |
| 6 | D | Optional simple fixes: Mesmerize, Enthrall, Harden | Only if a one-line change meets the targets without raising the Weeping Angel | Deferred by the owner (2026-09-29) to [11's next balance pass](../../roadmap/11-balance-and-mechanics.md#next-balance-pass-carried-from-roadmap-35), after the pinned-advantage rule, which changes what the holds are worth | |
| 8 | D | Dragon options: widen the Wizard's card pool, measured on the Dragon's searched hands, level 1 first | The Dragon gains real choices in its hand; its field average rises toward the middle of the band at levels 1-7 without passing 75% or any matchup 85%; guardrails hold | Cards done; a full-hand check is folded into task 7. Enchanted Faceswap and Lucky Strike opened to Wizards (+6..+8 and +2..+4 over the card they replace). New Dragon cards, text written by the orchestrator in the Norse voice: Tail Lash, a Battle-Focus-like strike whose tail comes round for 1d6 (+3.0/+1.9/+2.1/-0.5 at L1-7); Helm of Awe, where each opponent that fails a save cowers and loses its next 2 cards (+3.3/-4.8/-2.3 at L3-7; every attack-penalty shape was 5-8 below); Asinine Companion, a donkey that kicks for 1d8, growing with the Dragon's level (-0.9/-1.3/+0.2/-6.0; the +2 STR boost helped only at L1). The penalty and boost shapes stay behind class settings for the harness. Helm of Awe reshaped as a pin (owner): lose the next card, then save each turn, 3 easier per turn. On a natural 1 the healthy try to flee and the bloodied cower. Level with the card it replaced in duels, crowds, and team battles; a hand of Helms weakens the Dragon. See the [study](../studies/2026-09-helm-of-awe-and-dissonant-voice.md) | dd75323, 6d55666, 2bd9a59, 2b52ef1, this commit |
| 7 | D | Confirmation run and close-out: fold decisions into [cards and encounter effects](../../architecture/cards-and-encounter-effects.md) and the balance method doc; archive this plan | Checked-in report; plan archived | Done: the owner's two-part [run](../../reference/balance-reports/2026-09-29-confirm-35d.md). PR D's code moved no field average more than 1.3 points on PR C's hands. With the new cards owned, the Dragon reached 63/63/59/38% at levels 1/3/5/7; every field average is in band and the guardrails are within ±4%. The decisions are folded into the current docs, and this plan is archived | cc8f03d, this commit |

Later, not in this pass: the counter cards to the big swing effects
([12](../../roadmap/12-new-content-backlog.md#cards)), the roll for initiative, the Sandstorm roll, rarity
copy limits, and a trim for the Weeping Angel if the confirmation run shows one is needed.
All are in [34's candidate list](../../roadmap/34-balance-methodology.md#candidate-changes-to-evaluate-in-the-next-pass-not-this-one).

## Process

- One commit per task, with this table updated in the same commit (AGENTS.md rules 5 and 6).
- **Every card or monster change is measured before and after on the same seeds,** and the
  numbers go into the task's report. No change lands on intuition.
- **Player-facing text changes** follow [voice and wording](../../reference/voice-and-wording.md),
  and the generated `CARDS.md` and `MONSTERS.md` are rebuilt, never hand-edited.
- The owner runs the heavy confirmation runs; the agent session runs quick checks.
