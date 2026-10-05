---
type: Roadmap
title: Proposals for the next passes (October 2026)
description: Owner requests from 2026-10-04 worked into proposals — a wizard for training a monster, a livelier Unicorn witness line, fuller card and item guides, boss hands with a shape — plus smaller items seen in recent sessions, for the owner to pick from.
status: draft
audience: internal
tags: [roadmap, planning, workshop, bosses, cards]
---
# 42 — Proposals for the next passes

**Status:** Proposed (2026-10-05). B is done. F's walk is done and triaged in G. A, C and E1
shipped as [44](../archive/roadmap/44-guides-cards-and-training.md) (#423) and G's pass I as
[43](../archive/roadmap/43-walk-fixes.md) (#422), both archived. Open for the owner to pick:
**D** (boss hands), the rest of **E**, **H** (the fight log) and **J** (what 43 and 44 left).
Each pick gets its own plan with a task table, in the usual way.

The owner's requests were A to D. E lists what Claude noticed in recent sessions. F was
Cursor's walk. The card **role** that A, C and D share now exists (`cards/helpers/roles.ts`,
from 44); D uses it.

## A. Train a monster as a wizard

**Done (2026-10-05).** Shipped as roadmap 44 K4 (#423): the Workshop trains with a step-by-step
wizard, the look question and a live preview line come from the engine's shared look table,
and names are suggested. Fixing the other random details at preview and a colour swatch are in
J. The proposal below is kept as written.

**Owner:** move the Workshop's monster trainer to a wizard, so each question has room to
explain itself, with an example of how the answer reads in the monster's description.

**Today** (`WorkshopPanel.tsx`): one form holds Type, a one-line summary, Pronouns, Name and
Appearance. Appearance has a fixed placeholder, `gold and black`, for every type. The
Console asks the same question better: "What should her scales look like? (eg: deep-sea blue
with an ember-red belly)", with a phrase and an example for each type in
`monsters/helpers/spawn.ts`. The web never sees them. Nothing shows the monster before you
press Train.

**Proposal:** one question per screen, with Back and Next and a step count ("2 of 5"). Each
screen keeps its answer if you go back.

1. **About you** (first run only): name, pronouns, avatar, as today.
2. **Type:** a card per type: its summary, its class, and one signature card each.
3. **Pronouns.**
4. **Name:** a text box, with two suggested names as chips (from `names.ts`, clean since
   bug 214).
5. **Look:** the type's own question and example, for instance "What should her scales look
   like?" for a Dragon. Below it, **a live line in the monster's own description**, which
   changes as you type. For a Dragon: "Her scales are deep-sea blue with an ember-red belly."
6. **Meet your monster:** the monster card as `look at` would show it, then **Train**.

**Decisions to make:**
- **The look question needs one home.** The engine would export each type's phrase and
  example, and the Console and the web would both read them.
- **The preview is a sample.** Some types draw details at random when trained (the
  Unicorn and the Dragon most of all), so the preview says it is an example, or
  fixes the random draws at preview time and passes them to Train. Fixing them is truer, but
  takes more work.
- **Optional colour swatch.** A main-colour swatch beside the text would let the pixel
  sprite match. Today a player's typed colour never reaches the sprite; only bosses get a hex
  colour. This would be its own small task.

**Size:** one web task, plus a small engine change for the shared look question and the
preview. Then a Cursor check at 390 px.

## B. The Unicorn's witness line

**Done (2026-10-04).** Shipped as proposed, with these changes in the build:
- the shape is named `seen` (three draws in four) beside `commoner`;
- the sightings for "where it lives" are a pool (garden and roses, kitchen, village well,
  orchard, hayloft); the garden is never drawn when the claim is "an enclosed garden";
- the contradicting value comes from a stored `sightingRoll`, not the id. A Unicorn saved
  before this has no roll and reads as roll 0, so its line is still the same on every look;
- `doubter` is gone; a saved `liar` or `saith` reads as `seen`;
- review fix: the shape, swearer, commoner and roll are drawn only for a new unicorn (no saved
  `witness`). `hydrateMonster` spreads saved options into the constructor, so a default drawn
  there for a key an old save lacks was redrawn on every restore, and the line changed between
  looks;
- the horn line ends in a bit of nonsense (owner, 2026-10-04): "…ringed black, and tasted a little
  like a candy cane." Three more in the same note are in the pool;
- the commoner never vouches for the horn, which the description has already named.

**Owner:** the end of the Unicorn description reads bland. Perhaps one authority makes a
claim, and the monster does something that undoes it ("…says her eyes are blue, but she
blinks slowly and you swear they're green"). Drop one name, add an action, or change the
part entirely.

**Today** (`monsters/unicorn.ts`, `witnessLine`), three shapes drawn at training:
- `liar`, the most common: "Pliny swears that her eyes are dark blue; Aelian calls Pliny a
  liar."
- `saith`: "So saith Ctesias: her voice is clear as a bell. Solinus saith otherwise, and
  loudly."
- `commoner`: "A drunken sailor swears that she keeps to a rocky gorge. He is not believed,
  but he is not wrong."

Two of the three only report an argument. The reader is told the witnesses disagree, and
never sees why.

**Proposal:** keep the joke that no two witnesses agree, and make the player the second
witness. One authority says something, and the monster, right now, does the opposite. The
quarrel is shown, not reported. A second value is drawn from the same pool, and is never the
same as the claim.

- **Eyes:** "Ctesias wrote that her eyes are dark blue. She blinks, slowly, and for a moment
  you would swear they are black."
- **Voice:** "Pliny says his voice is low as a lowing ox. Then he calls once across the ring,
  clear as a bell."
- **Where it lives:** "Aelian says they keep to an inaccessible mountain. But just this
  morning you found them in the garden, eating your roses." (The owner's phrasing, 2026-10-04:
  the contradiction is personal and recent. "Just this morning" and "your" carry the joke.)
- **Horn** (new): "Topsell swears her horn is bright ivory. In the ring's light it looks
  ringed and black."

The new shape (built as `seen`) takes most draws. The `commoner` shape stays, because it already
lands. `liar` and `saith` go, since both are the bland "two names argue" pattern the owner
means. The anhorn line, 1 in 20, stays. The orchestrator writes the final lines, a pool of 3
to 4 actions for each detail. They follow the voice guide's rule that verbs agree with the
pronoun (`agree()`).

**Saved Unicorns:** as built, see the Done note at the top of this section. A saved `liar` or
`saith` reads as `seen` (nothing is rewritten), and the contradicting value comes from a stored
`sightingRoll`, with roll 0 for a save that has none.

**Size:** one small engine task with tests, plus the strings-inventory regeneration.

## C. Fuller card and item guides

**Done (2026-10-05).** Shipped as roadmap 44 K1, K2, K3 and K5 (#423): a role for every card,
CARDS.md grouped by role with full cards, a legend and per-type "what it can hold" tables, the
items generated into ITEMS.md, the Workshop's card details and `At level` line, and
`look at cards for [monster]`. Odds for the 20 cards with none are in J. The proposal below is
kept as written.

**Owner:** clean up the card and item guides so they help more: the detailed version of each
card, with its actions and stats, perhaps grouped by type, with some flavour around each
group.

**Today:**
- `CARDS.md` is generated, and so is the in-game Help → Cards page. Every card and item is
  listed in code order, ungrouped, and shows only its icon, name, rarity and flavour text. The
  Hit entry, for instance, says only "A basic attack, the staple of all good monsters."
- The detailed card already exists: `look at card Hit` shows the dice, level, who can use it,
  hit chance, damage per turn, price and targets. The guide just doesn't use it.
- `ITEMS.md` is written by hand and grouped by purpose, which works well. But the items also
  appear a second time at the end of CARDS.md, with no stats.

**Proposal:**
1. **Cards, grouped by role,** each group with a short intro in the game's voice (the
   orchestrator writes these): **Attacks**, **Area attacks**, **Healing**, **Protection and
   hiding**, **Tricks and curses** (holds, poison, psychic), and **Monster signatures**, with a
   subsection per type and a line about that type's style. The groups are alphabetical
   inside, with a contents list by group.
2. **Each entry is the detailed card.** It shows what the card does in plain words first,
   then the numbers: dice, chance to hit, damage or healing per turn, level, who can use it,
   rarity and price. The flavour text follows, set apart. Each block must read at 390 px (the
   frames are 34 columns, which fits).
3. **Items, generated the same way, inside ITEMS.md's structure.** ITEMS.md keeps its
   hand-written rules and advice. Its tables are generated, with stats, grouped by the same
   purposes. The duplicate item list leaves CARDS.md.
4. **Which cards a monster can use, and when** (owner, 2026-10-04). Each card already
   knows who may hold it (`permittedClassesAndTypes`) and its minimum level, but a player
   has nowhere to see it. Three views, from one source:
   - **In the guide,** every entry says who can use it and from which level. Each monster
     type gets a short table, "What a Dragon can hold", by level: what it can hold now and
     what opens up at each level.
   - **In the Workshop,** a monster's panel says what its next level opens up ("At level 2:
     Fire Breath, Tail Sweep"). The card detail sheet (E1) says whether this monster can
     hold the card, and if not, why: the wrong type, or what level it needs.
   - **In the Console,** a command such as `look at cards for [monster]` lists what that
     monster can hold, grouped by role, with locked cards marked by their level. Its exact
     wording goes through the catalogue.
5. **One role table.** Every card gets a role, set in one place. A test fails when a card has
   none, in the same way every ring event must have a note. D uses the same table.

**Size:** one engine build task (generators and the role table), plus the group intros. The
in-game Help page updates by itself.

## D. Boss hands with a shape

**Owner:** give boss hands personality. A set of hand shapes, chosen by class, monster type,
aggression and team play, would outline a hand, with matching cards filling the outline. The
outline would be shuffled and jittered so it can't be guessed. Keep or improve the
protections against filler cards.

**Today** (`characters/helpers/random.ts`), a boss's hand is nearly random:
1. A 20-card character deck is drawn, with cards weighted by rarity and limited to those the
   monster's type and level allow.
2. Weak basics (Hit, Heal, Harden, Whiskey Shot, Flee) are filtered out, and the last refill
   can bring some back.
3. The monster's slots are filled from that deck.

Three protections exist: Flee is banned, there is at most one plain heal, and about 17% of
slots end up as basics. Nothing about the boss steers its cards. Its temperament (bully,
glory, grudge, wild) only changes who it targets.

**Proposal:**
1. **Roles,** from C: attack, area, heal, guard, trick, and signature (a card that only its
   type can use).
2. **Shapes:** for a 9-slot hand, a target count per role, scaled to the slot count. Five to
   start:

   | Shape | Attack | Area | Heal | Guard | Trick | Signature | Open |
   |---|---|---|---|---|---|---|---|
   | Brute | 5 | 1 | 1 | 1 | – | – | 1 |
   | Duelist | 3 | – | 1 | 2 | 2 | – | 1 |
   | Warden | 3 | – | 2 | 3 | – | – | 1 |
   | Schemer | 2 | 1 | 1 | – | 3 | – | 2 |
   | Ravager | 3 | 3 | – | 1 | 1 | – | 1 |

   Every shape also takes one or two signature cards for its type, taken out of the open
   slots, so a boss shows what kind of monster it is.
3. **Choosing a shape:** the boss's monster type and class weight the draw. A Unicorn leans
   Warden, a Dragon leans Ravager, a Basilisk leans Duelist. Temperament shifts it too:
   - bully → Brute;
   - glory → Duelist or Warden;
   - grudge → Schemer;
   - wild → the open slots double, so it's harder to read.

   When bosses fight in a crowd (the Gauntlet, an ambush, a mega boss), Ravager gets more
   weight. Every shape keeps some chance, so no type always gets the same one.
4. **Jitter:** after the shape is chosen, one or two slots move to a neighbouring role
   (attack and area, guard and heal, trick and open). Open slots draw from any role. Each slot
   still draws through the existing `draw`, so rarity, type and level limits stay. The hand is
   shuffled, and the shape is never shown.
5. **Filler protections, made explicit:**
   - Flee stays banned.
   - The one-plain-heal cap stays, rising to two for a Warden.
   - **At most two basics** (Hit and the other weak basics) per hand, in place of the 17% that
     falls out today.
   - **At most two copies of any card,** so no hand of four Fire Breaths.
6. **Measured before it ships:**
   - A new `sim:boss-hands` script reports the role mix, the share of basics and the distinct
     cards per hand, for the old builder and the new one.
   - The existing boss and ring sims report the human win rate against bosses, compared with
     today's.
   - It ships behind a switch (`BOSS_HAND_SHAPES`), so the comparison runs in one build. The
     win rate should stay within a band the owner sets before the pass.
7. **Optional flavour:** the arrival line could hint at the shape: "She fights like a wall:
   patient, and hard to wear down." The owner decides. It gives away some of the surprise in
   exchange for something to plan around, which is how temperament lines work today.

**Size:** the largest of the four. Roles, shapes and the builder are one engine task. The
sims and a balance check are a second. It belongs in its own PR, with the simulation evidence
in the description (`docs/reference/simulation-harness.md`).

## E. Seen in recent sessions

Smaller items, each worth a line in some pass:

1. **Card details in the Workshop** (done in 44 K3). Tapping a card there selects it, but nothing shows what
   it does. A detail sheet on long-press or a ⓘ, the same detailed card C puts in the guide,
   would answer the question every new player has when building a deck.
2. **A test-room switch for forced events.** Cursor could not reach the first-time notes for
   ring events, ambushes or bosses turning on each other, because forcing an event is
   admin-only. A test-room-only way to force each one would let the live checks cover them.
3. **`help <word>` matches inside other words.** `help dm` also lists `look at dm guide`.
   Match whole words first, or rank exact command words above other matches.
4. **Chat metrics.** Chat has no counters: messages sent, refusals by reason, rows swept.
   `observability.md` should cover chat like everything else.
5. **The long room name** wraps to three lines on a phone (already in roadmap 39's known
   gaps). This is a small header fix.
6. **Open bug items J and K** (`10-bug-fixes.md`): what a reset leaves behind, and slow
   simulation runs. J matters more now that chat and notes keep more per-room state.
7. **Roadmap 22's decisions** are still waiting on the owner.

## F. Cursor: a first-time player's walk

The prompt and its rules are in [42a](../archive/roadmap/42a-cursor-new-player-walk.md). It is a fresh walk of the
whole game as a first-time player, after batches 2 and 3 and chat. Its findings feed
roadmap 39's known gaps and the choice between A to E. **Done (2026-10-04):** triaged in G
below.

## G. What Cursor's walk found, and where it goes

Cursor walked the game as a new player on 2026-10-04
([new-player walk 2](../reference/new-player-walk-2.md)). Each finding is placed below. The
numbers are the report's ten moments (§1); "table" means its "Everything else" table (§2).
Claude checked the code behind each **bug** before listing it.

**Folds into A (the training wizard):**
- one first step: the empty Console says `look at monsters` while the guide says train (#10);
- the suggested character name is `Beastmaster-<id>`, part of an account id (#10);
- the avatar row has no labels and doesn't say it is you, not the monster (table);
- the first type's sentence scrolls off the top on a phone (table);
- the finished monster card gives `ac`, `hp` and Class with no legend (#10, §4).

**Folds into C (guides and card info) and E1 (card details in the Workshop):**
- the equip question can't show what a card does, and `look at` is refused while it is open
  (#1). `9 of 9 slots remaining` and `Hit [4]` need plain wording;
- Help → Cards: the contents don't jump to the card, the ASCII frames are clipped at 390, and
  "see ITEMS.md" should name the Items tab (#7);
- `that kind of monster can't use it` should say which kinds can (table). This is C's "which
  cards when";
- MSRP, DPT and hit chance on the card shown in the ring (#4), and a legend for the card marks
  (§4);
- `help heal` finds nothing, because help searches commands, not cards (table);
- the Items guide's first sentence is not player language (table).

**A new pass, H: the fight log reads as one stream.** Flavour, rolls, running tallies and
results share one voice (#4). A roll can disagree with its sentence (`rolled 4 on 1d4 … to
drink` then `🎲 18`), and a tally can say `2 HITS` above `Miss...`. The end line,
`1 dead after 3 rounds`, names nobody, and the card found in the dust reads as loot for the
boss. H separates what happened from its flavour, checks the roll lines, and ends a fight by
naming who fell and what each player won (XP, coins, the card). It needs its own plan.

**A new pass, I: small fixes from the walk** (planned in [43](../archive/roadmap/43-walk-fixes.md)). These are each a line or two:
1. **Bug:** the Workshop's multi-card move says `Moved 1 cards` (`server/src/trpc/router.ts`,
   the move-many summary, which has no singular).
2. The Workshop's first-deck note says `tap an empty slot`. The control needs a card selected
   first (#2).
3. On a phone, the second monster is off the right edge, and only two dots show it (#2).
4. The guide still says `Nobody else here? Summon a boss.` after the fight has started (#3).
5. `It's Ada's turn` reads as a choice to make (#3).
6. Revive says `instantly`, and the monster comes back at 1 HP with nothing saying it heals
   while idle (#5).
7. The shop's confirm button says `Equip cards`, and neither the confirm nor the receipt names
   the item (#6). The Sorting Hat's `Are you sure?` doesn't say what happens, and `give` after
   the hat is gone says "doesn't have any items that Rex can use" (table).
8. A boss arrives `at the behest of 👑 The Editor`. That is the house (`RING_PATRON`), not a
   player, but a new player reads it as a person; Cursor took it for its own account. The
   header's `boss in ~13m` shows while a boss stands, and the timer boss doesn't spend a summon
   (#8). The boss's strategy line, `You target the weakest player`, addresses the player.
9. An answered or timed-out question stays on screen and takes the next Enter
   (`Prompt is no longer active`) (#9). This touches the prompt lifecycle, so read
   [engine concurrency and timing](../architecture/engine-concurrency-and-timing.md) first.
10. `look at items` with no items prints nothing (§5).
11. The fight reward (2 XP, 10 coins) is never said (table, §4). Folds into H's end line.
12. The Fights row's `Card: Soften` reads as the winning card, and the row doesn't open (table).
13. Leaders at 390 hides its right-hand columns (table).
14. A first boss shows `Fights: 129 · Won: 103` (table).
15. The long room name: this is E5.

**Owner decisions (2026-10-04):**
- **Prion Disease keeps its name,** `1993-09-7202 18:58`. It is a joke card.
- **Characters start with 30 coins,** so the first fight's 10 buys a 33-coin item. Items get a
  little easier to reach without tipping the balance.
- **Order:** I first, as its own PR once #421 merges; then A + C + E1; then H; then D.

A, C and E1 are built together in [44](../archive/roadmap/44-guides-cards-and-training.md). I is built in [43 — Small fixes from the new-player walk](../archive/roadmap/43-walk-fixes.md), with the
starting coins as part of its task I3.

## J. Left from 43 and 44, and what the guides check found

43 and 44 are shipped and archived. What they left goes here until a pass takes it.

**For pass H (the fight log):** the play-by-play opens with the plain `Fight begins with N
contestants` line (43).

**Follow-ups to A and C (44's remainder):**
- odds in `card-odds.json` for the 20 cards with none, so their guide entries show a chance line;
- fix a new monster's other random details (a Dragon's wings, a Unicorn's witness) at the
  wizard's preview, so Ready can show the whole description;
- a colour swatch in the wizard that reaches the pixel sprite.

**Small fixes from the guides check** ([report](../reference/guides-wizard-check.md)), being done in [45](45-guides-check-fixes.md):
1. The shop's card pick and Back Room pick print the `Choose one or more…` question twice: as
   a line, then again above the buttons.
2. The shop's yes/no confirm offers only `Cancel`; there are no `Yes` and `No` buttons, so a
   new player must type `yes`.
3. A taken monster name shows its message twice in the wizard: in the Workshop's banner and
   under the suggestions.
4. `summon a boss` with one monster in the ring answered `Every challenger in the ring already
   has a boss to face…`, yet a fight began against a boss. Find which boss it meant (the timer
   boss arriving at the same moment?) and make the refusal match the ring.
5. The check couldn't reach the `can use this from level {n}` sheet line live (every
   affordable card was Beginner); tests cover it.
