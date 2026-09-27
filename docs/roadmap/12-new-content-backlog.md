---
type: Roadmap
title: New Content Backlog
description: Concrete card, monster, and world proposals, including the Dragon research brief.
status: draft
audience: internal
tags: [content, cards, backlog]
---
# New Content Backlog

**Status:** Backlog — concrete post-launch content proposals. Measure any new combat
content with the [simulation harness](../reference/simulation-harness.md) before it ships,
and follow the checklist in [cards and encounter effects](../architecture/cards-and-encounter-effects.md#adding-a-card-or-a-monster).

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

- [x] **Unicorn content pack.** Shipped in PR #394: the Unicorn and five cards (Sticketh,
  Horn of Proof, Unconquerable Horn, Dissonant Voice, Gloaming Rest). The pass record and the
  original brief are archived as [26 — Unicorn content pack](../archive/roadmap/26-unicorn-pack.md).
- [ ] **Unicorn voice punch-up.** The owner finds the Unicorn's flavour text bland (September
  2026) and wants more edge from the old sources. Researched proposals for every Unicorn
  string, with tagged quotations, a house style, and research requests, are in
  [28 — Unicorn voice punch-up](28-unicorn-voice-punch-up.md), awaiting the owner's picks.
- [ ] **Dragon.** A second requested monster, researched and built the way the Unicorn was.
  Research comes first; see the [Dragon research brief](#dragon-research-brief) below.
- [ ] A qilin/kirin creature deserves its own sourced design rather than a cosmetic Unicorn
  variant (a rule carried over from the Unicorn brief).
- [ ] Add the Time Lord monster and its time-manipulation deck.
- [ ] Add the Bureaucrat monster and its tax, redistribution, and arrest mechanics.
- [ ] Design equipment slots and their stat trade-offs.
- [ ] Decide how monster-slot capacity is earned; the existing modifier is deliberately
  dormant until a reward is chosen.

## Dragon research brief

**Status:** Requested by the owner (September 2026); research and design not started. The
Unicorn pack is the model: a sourced creative thesis, a monster specification with ranges
rather than final numbers, a handful of related cards, then a pass plan with slices,
simulation evidence, and a live check. Nothing below is decided; the leanings recorded here
are starting points for the research, not a design.

### Who asked, and the world it should feel like

The Dragon was requested by the owner's eight-year-old son. His favourite dragons are the
ones in Cressida Cowell's *How to Train Your Dragon* **books** (not the films, which change
much of the world). The Dragon should feel familiar to a reader of that series while being
our own creature, built on the same public-domain roots the books draw on.

- **What we may borrow: setting and feel.** A Viking-age Norse world of island tribes; many
  kinds of dragon, from small, scrappy, disobedient ones to vast sea dragons; dragons that
  are clever, vain, funny, and frightening at once; and the idea that understanding a
  dragon, even talking with it, beats shouting at it. The books also bring Romans in, which
  gives the Dragon a natural link to the Gladiator and the Roman-flavoured cards, and book 3
  has an arena fight (below), which is our ring.
- **What we may not borrow.** No quotes, names (characters, places, dragon species, the
  books' dragon language), plot events, or distinctive designs, and nothing that implies
  the game is connected to the books or films. The same rule the Unicorn followed with its
  modern tonal references applies, more strictly, because this series is in copyright and
  well known. Where the books and the old sources share something (Vikings, sagas, sea
  serpents, Romans), cite the old source.
- **What the books contain (checked September 2026).** The owner confirmed, and publisher
  and reader summaries agree, on these points. Fan wikis were the only detailed sources
  found, so treat anything below as secondary until it is checked against the books.
  - **Dragon statistics.** Throughout the series, dragons get small stat panels rated out
    of ten: Fear Factor, Attack, Speed, Size, and Disobedience. A young reader already
    expects a dragon to come with a stat card, which suits a card game. Echo the *shape*
    (a short, rated profile in the Dragon's look-at text or card box) with our own stats,
    not those five names.
  - **Kinds of dragon by habitat.** The books sort their many species mostly by where they
    live: cave, tree, bog, sky, mountain, sea, and tiny dragons. Cowell's companion *Book
    of Dragons* (2014; *Incomplete* in the UK, *Complete* in the US) collects them. Habitat
    is a natural axis for the Dragon's appearance options; plain words like "cave" or
    "sea" are fine, the books' species names are not.
  - **Romans and the arena: book 3, *How to Speak Dragonese*.** Romans at a fort try to
    set two tribes against each other. The young heroes are made to fight in the fort's
    amphitheatre, which is flooded so they face untrainable sea dragons from a ship. They
    get out with the help of a tiny, arrogant dragon and its king's plan. That fits the
    owner's memory of tiny, almost insect-like dragons saving the day. It is our ring, with
    Romans, which is the Gladiator's world.
  - **Still to ask the requester:** his favourite dragons and why; whether he wants to
    raise a small dragon that grows or command a big one from the start; and which moments
    he would want as cards.
- **Audience and tone.** Narration should be exciting and funny rather than gory, readable
  aloud to an eight-year-old, and follow [voice and wording](../reference/voice-and-wording.md).
  The owner's son is a natural playtester for the strings inventory and the finished monster.

### Research to do

- **Which dragon.** "Dragon" covers traditions that disagree more than the unicorn's did:
  the hoarding, fire-breathing wyrm of Germanic and later European story (Beowulf's dragon,
  Fáfnir in the Völsunga saga, the dragon of the Saint George legend), the serpent-dragon of
  Greek and Roman natural history (Pliny's dragon that fights the elephant), the bestiary and
  early-modern tradition (Topsell's *History of Serpents*, 1608, the companion to his
  *Four-footed Beasts* that fed Sticketh), and East Asian traditions (the Chinese *lóng*,
  associated with water, rain, and good fortune). Choose one for the monster, as the Unicorn
  chose the horse-shaped Western unicorn, and do not flatten the others into cosmetic
  variants; the East Asian dragon, like the qilin, deserves its own design if it is ever made.
  **Leaning, given who asked:** the Norse and Germanic dragon, with Roman encounters as the
  second strand. That is the world of the books above, and both strands have public-domain
  sources to cite.
- **Primary sources to gather**, beyond the ones above, with exact editions and passages
  (translations must be public domain, or paraphrased with a citation):
  - Norse: the *Völsunga saga* (Fáfnir, his hoard, and Sigurd's pit); the *Prose Edda*
    (Níðhöggr gnawing the root of the world tree; Jörmungandr, the sea serpent Thor fishes
    for); *Beowulf*'s last fight, woken by a stolen cup; saga and runestone dragon imagery,
    and dragon-headed ship prows.
  - Roman: Pliny's *Natural History* book 8 (dragons and elephants); the serpent at the
    Bagradas River that a Roman army under Regulus fought with siege engines (told by
    Valerius Maximus and others; find the best public-domain telling); the *draco*
    standard, a dragon-headed windsock carried by Roman cavalry, described in Arrian's
    *Ars Tactica* and Ammianus Marcellinus. The standard and the Bagradas serpent are the
    strongest links to the Gladiator's world.
  - Bestiary and early modern: Topsell's *History of Serpents* (1608), Aldrovandi's
    *Serpentum et Draconum Historiae* (1640), and the medieval bestiaries on the dragon and
    the elephant.
  - Ask the owner for a dragon counterpart to *A Book of Unicorns*, the anthology whose
    pages shaped the Unicorn's final content review.
- **Sources.** Find public-domain primary texts for the chosen tradition and record exact
  citations. Treat modern works (Tolkien's Smaug, film and game dragons) as tonal references
  only: no names, dialogue, or distinctive designs.
- **Fit with the roster.** The Basilisk is already a serpent with a signature coil and a
  petrifying gaze. A Dragon must play differently, not as a bigger Basilisk.
- **Place on the power curve.** Dragons in story grow from wyrmling to ancient terror, and a
  young reader's favourite dragon is often a small one that grows into something great. Decide
  whether the Dragon is a caster-like late bloomer (fragile young, strong old) or a brute, and
  whether its growth can be expressed through the existing level scaling rather than new
  systems. Check against the balance target in
  [cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).

### Candidate ideas to evaluate (not decisions)

- A breath attack that hits several opponents but must recover before it can be used again,
  so it is not a better Blast.
- The weak spot: Sigurd kills Fáfnir from a pit beneath its unarmoured belly. That could be a
  counterplay hook, the way the tree feint became Sticketh's risk.
- The hoard: stolen treasure wakes Beowulf's dragon. Any card touching coins or items needs
  the economy owner's review first; see [balance and mechanics](11-balance-and-mechanics.md).
- Scales and flight as defence, bounded like the Unicorn's ward: no unconditional immunity.
- Understanding over force: a card that calms or turns a hostile creature by talking to it
  rather than hurting it, echoing the feel of the books without their dragon language. It
  would need the same bounds as other control cards and the hold rules in
  [cards and encounter effects](../architecture/cards-and-encounter-effects.md#holds-and-the-unconquerable-horn-ward).
- A disobedient streak: a small chance the Dragon ignores the planned card and does what it
  likes, for good or ill. Funny and in keeping with the world, but it takes control from the
  player, so weigh it against [player agency](../reference/player-agency.md).
- Roman links: a *draco* standard card usable by the Gladiator's side, or a Roman
  siege-engine answer to a dragon (from the Bagradas story) as a counter card.
- Many kinds of dragon: appearance options (habitat, size, colour, horns, wings, temper)
  wide enough that a child can make "their" dragon, the way the Unicorn's options vary its
  telling.
- A swarm of tiny dragons: the backlog's unbuilt Swarm card (Cards, above) could become
  many small dragons that each do little but add up, which echoes the book 3 rescue without
  borrowing it. Scale it with the number of opponents, and measure it in mixed ring sizes.
- A rated profile: a short stat panel in the Dragon's look-at text (see "What the books
  contain" above).

### Voice: give it edge from the start

The Unicorn launched with careful, mild prose and needed a punch-up
([28](28-unicorn-voice-punch-up.md)). Write the Dragon's voice with edge in the first draft,
still readable aloud to an eight-year-old: exciting, funny, a little scary, never gory.
Use the house style and the [Q]/[Q?]/[T]/[A] tags from 28, so the owner can see at a glance
which lines are real quotations.

**Method.** The Unicorn's voice pass taught the order:

1. List every string the Dragon will need before writing any: lore, look-at template,
   each card's text, and each narration moment (hit, miss, natural 1 and 20, the card's
   special outcome, cleanup).
2. Mine the sources for lines with bite, not facts: insults, boasts, warnings, threats.
   Record each with edition, passage, and a link, tagged [Q] or [Q?].
3. For each string, draft two or three options: one quotation, one twist, one original
   line in the old style. Put the most dramatic moment's line in the card text.
4. Read every option aloud to the requester and keep what makes him laugh or lean in.
   Record his picks in the brief.
5. List what could not be checked as research requests for the owner, as 28 does, rather
   than guessing.

**Suggestions to start from.**

- **A dragon that talks back.** In the *Völsunga saga* the dying Fáfnir argues with
  Sigurd, who hides his name in a riddle: "I am called a noble beast: neither father have
  I nor mother, and all alone have I fared hither" (trans. Morris and Magnússon, 1888, [Q]).
  Old dragons speak, so a vain, sarcastic, boastful Dragon has its source there, not in the
  books. Its taunts and boasts can be [A] lines in the saga's manner.
- **Kennings as titles.** *Beowulf* calls its dragon *niðdraca*, "hate-dragon" (line
  2273), *lyftfloga*, "air-flier" (2315), *ligdraca*, "fire-dragon" (2333, 3040), and
  *uhtsceaða*, "dawn-ravager" (about 2271; confirm the line). Give each spawned Dragon a
  random kenning title (the Dawn-Ravager, the Air-Flier, the Hoard-Warden) and invent more
  in the same pattern. "Wyrm" and "drake" let Old English show up in a readable way.
- **Wake it and regret it.** *Beowulf*'s dragon wakes because a thief takes one cup from
  its hoard, and burns the country for it. A narration pattern: a small slight, then a
  vast overreaction. That is funny and scary at once.
- **Jokes in the stat profile.** The books' "Disobedience" score is a joke. Our own
  profile can carry invented jokes ("Hoard Envy: 10", "Table Manners: 1").
- **Old sources with bite.** The King James Revelation's "the great dragon was cast out,
  that old serpent" (12:9) and Pliny's dragon that coils round an elephant and is crushed
  when it falls (Holland, 1601; find the passage) are dramatic and quotable.
- **Roman and Viking voices.** Roman soldiers who sneer at barbarian dragons, and Viking
  boasting, suit the arena and the Gladiator crossover, written as [A] lines.

**Research requests for the owner** (or an agent with archive access):

1. The Fáfnir dialogue in Morris and Magnússon (Gutenberg, "The Story of the Volsungs",
   chapter 18): copy the best exchanges, especially Fáfnir's warnings about the gold.
2. *Beowulf* lines 2200–2400 in a public-domain translation (Gummere 1910, or Hall 1901)
   for the dragon's waking and its kennings, with line numbers.
3. Holland's Pliny, book 8: the dragon and elephant passage.
4. The *Prose Edda*, trans. Brodeur (1916): Níðhöggr and Jörmungandr passages.
5. From the requester: favourite dragon moments and jokes from the books, so our
   originals can aim at the same feeling without borrowing them.

### Definition of done for the research step

A design brief in this file with the same sections the Unicorn brief had (creative thesis,
sources and quotation policy, monster specification, three to five related cards with their
risks and counterplay, implementation slices, acceptance gates), reviewed by the owner before
any code is written. The brief also records the requester's answers to "Still to ask", and
its strings inventory is read aloud to the requester before the content pass starts.

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
