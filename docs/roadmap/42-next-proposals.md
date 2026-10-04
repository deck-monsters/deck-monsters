---
type: Roadmap
title: Proposals for the next passes (October 2026)
description: Owner requests from 2026-10-04 worked into proposals — a wizard for training a monster, a livelier Unicorn witness line, fuller card and item guides, boss hands with a shape — plus smaller items seen in recent sessions, for the owner to pick from.
status: draft
audience: internal
tags: [roadmap, planning, workshop, bosses, cards]
---
# 42 — Proposals for the next passes

**Status:** Proposed (2026-10-04). Nothing here is started. The owner picks what goes first;
each pick then gets its own plan with a task table, in the usual way.

The owner's requests are A to D. E lists what Claude noticed in recent sessions. F is
Cursor's next walk. A, C and D share one new piece, a **role** for every card (attack, area,
heal, guard, trick). Build it once, in whichever of C or D goes first.

## A. Train a monster as a wizard

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

`witnessed`, the new shape, takes most draws. The `commoner` shape stays, because it already
lands. `liar` and `saith` go, since both are the bland "two names argue" pattern the owner
means. The anhorn line, 1 in 20, stays. The orchestrator writes the final lines, a pool of 3
to 4 actions for each detail. They follow the voice guide's rule that verbs agree with the
pronoun (`agree()`).

**Saved Unicorns:** the shape and its values are stored on the monster. A Unicorn that already
has `liar` or `saith` is moved to `witnessed` on load. The contradicting value is picked
from its stored id, the same way `doubter` is today, so its description is the same every
time it is looked at.

**Size:** one small engine task with tests, plus the strings-inventory regeneration.

## C. Fuller card and item guides

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

1. **Card details in the Workshop.** Tapping a card there selects it, but nothing shows what
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

The prompt and its rules are in [42a](42a-cursor-new-player-walk.md). It is a fresh walk of the
whole game as a first-time player, after batches 2 and 3 and chat. Its findings feed
roadmap 39's known gaps and the choice between A to E.
