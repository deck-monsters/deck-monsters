---
type: Roadmap
title: Unicorn Voice Punch-Up
description: Researched proposals, awaiting the owner's picks, to give the Unicorn's lore, card text, and narration more edge using public-domain sources.
status: draft
audience: internal
tags: [content, strings, unicorn, voice]
---
# 28 — Unicorn Voice Punch-Up

**Status:** Proposals, awaiting the owner's review (September 2026). Nothing here has
shipped. The owner found the Unicorn's flavour text bland and asked for more edge: real
quotations from the old sources, lightly twisted quotations, and new lines written in
their old-fashioned English. The owner picks lines here; a small strings-only pass then
implements them (see [27 — Next passes](27-next-passes.md#later)).

Current wording lives in the source files and the
[Unicorn strings inventory](../reference/strings/unicorn.md). The quoting rule is "Quoting
old texts" in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).

## How to read the proposals

Each line is tagged by where it comes from:

- **[Q]** a quotation whose wording was confirmed against at least one reliable
  transcription during research (see [Sources](#sources)). Check the spelling against a
  scan of the named edition before shipping.
- **[Q?]** a real quotation found only second-hand. Check the wording against the edition
  before shipping, or rewrite it as [A].
- **[T]** a real quotation with a deliberate twist. Credit the original in a source
  comment.
- **[A]** an original line written in the same old style. It needs no citation, but a
  comment should say which source inspired it.

The owner's own example sets the tone for [A] lines: *"Beware, books of yore warn that in
this way be ye confounded."*

## House style for old-fashioned lines

- **Early modern English, not Old English.** Write as the King James Bible and Shakespeare
  do (thou, thee, ye, -eth, "beware", "of yore"), which players can read aloud. Save real
  Old English for one easter egg (see [Old English](#old-english)).
- **Flavour old, mechanics plain.** Keep numbers, dice, and rules in plain modern English
  ("-2 to attack", "will roll 11 or higher to pull it free"). Only the colour around them
  goes archaic, so a new player can still read what happened.
- **One archaic line per event.** A whole fight in "thee" and "thou" gets tiring. Put the
  archaic line where the moment is biggest: the card's description, a stuck horn, a
  refused hold, a broken rest.
- **Grammar with pronoun subjects.** "-eth" belongs to a singular subject. After a name,
  write "Nola riseth". After a pronoun, use `agree()` with both forms, for example
  `agree(pronouns, 'riseth', 'rise')`, so a "they" monster reads "they rise"
  ([voice and wording](../reference/voice-and-wording.md)).
- **Tests and inventory.** Every changed string updates its test and the
  [strings inventory](../reference/strings/unicorn.md) in the same change.

## Monster lore (`Unicorn.description`, shown by `look at` and in MONSTERS.md)

Current: three paragraphs starting "No two accounts of the unicorn agree." They are
accurate and mild.

Proposal, keeping the three-paragraph shape:

> Pliny, as Philemon Holland Englished him in 1601, called it **"the most fell and furious
> beast of all other"** [Q]: a horse's body, a stag's head, an elephant's feet, a boar's
> tail, one black horn two cubits long, and a voice that **"loweth after an hideous
> manner"** [Q]. Ctesias gave it a white body, a dark-red head, and a horn banded white,
> black, and crimson. Marco Polo met one wallowing in mud and called it **"a passing ugly
> beast to look upon"** [Q?], nothing like the one caught in a maiden's lap. No two
> witnesses agree, and each calls the last a liar.
>
> The horn is the heart of every tale. Topsell swore that unicorn horn **"doth wonderfully
> help against poisons"** [Q?]; the King James Bible says that with such horns **"he shall
> push the people together to the ends of the earth"** [Q]. In the ring both tales hold. But
> heed Spenser: the wise foe **"slips aside"**, and the furious beast's horn **"strikes in
> the stocke, ne thence can be releast"** [Q].
>
> **"Will the unicorn be willing to serve thee, or abide by thy crib?"** [Q] It will not,
> by any art of man. A unicorn who fights beside a Beastmaster has chosen to. And if thou
> seest one kneel to rest in the gloaming, beware: the books of yore say that is how the
> hunters take it. [A]

Shorter alternatives for any sentence:

- Opening [T]: "Of all beasts, the most fell and furious. So says Pliny, and Pliny had
  never met this one."
- Closing [A]: "Men have hunted it with dogs, with nets, with maidens, and with trees. It
  hath not been held."

## Look-at description (`Unicorn.prototype.description`)

Current: "One witness swears that her voice is low as a lowing ox; the next account will
disagree."

Proposal: name the old authorities, and let them quarrel. Pick a random swearer and a
different random doubter from a list such as Pliny, Aelian, Ctesias, Solinus, Topsell,
Marco Polo, "a drunken sailor", and "a very old woman in the market".

- [A] "Pliny swears that her voice is low as a lowing ox; Aelian calls Pliny a liar."
- [A] "So saith Ctesias: her eyes are dark blue. Topsell saith otherwise, and loudly."
- [A] "A drunken sailor swears that she keeps to a rocky gorge. He is not believed, but he
  is not wrong."

The old names for the beast can ride along with the witness: Pliny's *monoceros*, Aelian's
*cartazon*, the French *licorne* that Holland uses ("the Licorne or Monoceros" [Q]).
Example [A]: "Aelian would call her a cartazon, and swears her voice is startlingly
dissonant; Pliny calls Aelian a liar."

## Sticketh

**Card text.** Current: 'Charge horn-first. Old accounts warn that a clever foe steps
aside, and the "sharp horn sticketh fast."'

- [Q] "He slips aside; the whiles that furious beast / His precious horne, sought of his
  enimies, / Strikes in the stocke, ne thence can be releast." (Spenser, *The Faerie
  Queene* II.v.10, 1590.) Charge anyway.
- [Q] "Unicorns may be betray'd with trees." (Shakespeare, *Julius Caesar* II.i.) Charge
  horn-first, and choose thy tree with care.
- [A] "Charge thou horn-first. Yet heed the tale of yore: the wily foe slippeth aside, and
  the horn sticketh fast in the tree."

**Narration.**

| Moment | Current | Proposal |
|---|---|---|
| Natural 20 | "{name} rolled a natural 20. Automatic max damage." | Keep, and add: "With that horn {he} shall push the people together to the ends of the earth." [T] (Deuteronomy 33:17) |
| Natural 1 on the attack | "{name} rolled a 1. {target} sidesteps at the last instant." | "{name} rolled a 1. {target} slips aside at the last instant." [T] (Spenser) |
| Horn sticks | "The horn sticks fast!" | "The horn sticketh fast!" [A] |
| Tie on the stick save | "Tie... the horn sticks." | "Tie... the horn sticketh." [A] |
| Natural 1 on the stick save | "{name} rolled a natural 1. The horn buries itself in the timber." | "{name} rolled a natural 1. Pride and wrath confound {him}, and {he} {is} made the conquest of {his} own fury." [T] (Shakespeare, *Timon of Athens* IV.iii) |
| Still stuck | "{target}'s horn is still stuck fast in the timber." | "{target}'s horn is still stuck fast in the stocke, ne thence releast." [T] (Spenser) |
| Opponent's opening | "{target} has an opening." | "{target} has an opening. Unicorns may be betray'd with trees." [Q] |

The mechanical sentence ("At the beginning of {his} turn {he} will roll … to pull it
free.") stays plain.

## Unconquerable Horn

**Card text.** Current: "They may be beaten, but they will not be taken and held."

- [Q] "Canst thou bind the unicorn with his band in the furrow?" (Job 39:10, King James
  Version, 1611.)
- [T] "Canst thou bind the unicorn with his band in the furrow? Thou canst not. Many have
  tried."
- [A] "Beaten, it may be. Bound, never."

**Narration.**

| Moment | Current | Proposal |
|---|---|---|
| Ward armed (self) | "{name} lowers {his} horn and plants {his} hooves. The next hold will not take." | "{name} lowers {his} horn and plants {his} hooves. Canst thou bind the unicorn? The next hold will not take." [T] |
| Hold refused (`immobilize.ts`) | "{target} cannot be taken and held. {He} refuses to be {held}, and the Unconquerable Horn's ward is spent." | "'Will the unicorn be willing to serve thee?' {target} will not. The hold slides off, and the Unconquerable Horn's ward is spent." [T] (Job 39:9) |
| Already armed | "{target} is already braced against being held." | "{target} already standeth braced. No band shall hold {him}." [A] |
| Ward spent this fight | "{target} has already refused one hold this fight. The ward will not rise again." | "{target} has refused one hold already. The ward riseth not twice." [A] |

## Dissonant Voice

**Card text.** Current: "A cry that no throat that shape should make. It is hard to aim
while it rings."

- [Q] It "belloweth horriblie" (Solinus, trans. Arthur Golding, 1587) and "loweth after an
  hideous manner" (Pliny, trans. Philemon Holland, 1601). Hard to aim while thine ears
  ring.
- [A] "Of all beasts the most jarring of voice, say the authors of yore. Stop thine ears,
  if thou canst."

**Narration.** Current: "{target}'s ears still ring (-2 to attack)." Proposal: "{target}'s
ears yet ring with that hideous lowing (-2 to attack)." [T] (Holland's Pliny)

## Gloaming Rest

This is the card that most wants the owner's example. In the bestiaries from the
*Physiologus* on, a unicorn lays its head in a maiden's lap and falls asleep, and that is
when the hunters take it. The card's risk is that story: rest, and trust that nobody
strikes.

**Card text.** Current: "Kneel among the laurel as the light goes. Trust that nobody
strikes before you rise."

- [A] "Kneel among the laurel as the light goes. Beware: the books of yore warn that thus
  was the unicorn taken, asleep, while the hunters crept near."
- [A] "Rest thee in the gloaming. Yet heed the old bestiaries: so doth the unicorn lay down
  its head, and so do the hunters come."
- [A], nearest to the owner's example: "Kneel and rest. But beware, for the books of yore
  warn that in this way be ye confounded."

**Narration.**

| Moment | Current | Proposal |
|---|---|---|
| Kneels (self) | "As the light fails, {name} kneels among the laurel and closes {his} eyes." | Keep, and add: "Somewhere in the dusk, the hunters are listening." [A] |
| Rest broken | "{target}'s rest was broken. {He} rises without its comfort." | "The hunters were waiting! {target}'s rest is broken, and {he} {rises} without its comfort." [A] |
| Rest completes | "{target} rises from the laurel, restored." | "No hunter came. {target} riseth from the laurel, restored." [A] |
| Already resting | "{target} is already resting." | Keep; it is a plain rules message. |

## Horn of Proof

Current card text: "Dip the horn in the cup, and whatever was poisoned is made clean."

- [Q?] The horn "doth wonderfully help against poisons" (Topsell, *The Historie of
  Foure-Footed Beastes*, 1607). Dip it and see.
- [A] "Whoso drinketh from the horn shall take no hurt of poison, nor of curse, nor of
  binding: so say the physicians of yore."
- The kings' cup, via Topsell's retelling of Philostratus [A]: "Kings drank from such
  horns, and feared no cup."

**Narration.**

| Moment | Current | Proposal |
|---|---|---|
| Hold loosened | "The horn's touch loosens the hold. {target} is free." | "The horn toucheth the bonds, and they fall away. {target} is free." [A] |
| Curse lifted | "The horn draws out the curse on {target}'s {stat}." | "The horn draweth out the curse on {target}'s {stat}, as it draweth poison from the cup." [A] |
| Bad Batch found | "{target} dips the horn in the cups in the ring. One bad batch is found out and poured away." | "{target} dips the horn in the cups in the ring. One cup froths and hisses; that bad batch is poured away." [A] (early-modern belief that the horn sweats or froths near poison; confirm a source before citing it) |
| Nothing to cleanse | "The horn finds nothing to purify." | "The horn findeth no poison here." [A] |

## Old English

Old English called the unicorn ***ānhorn***, a word-for-word loan of Latin *unicornis*;
"unicorn" later replaced it. Confirm the entry in Bosworth-Toller before use. Keep it to
one easter egg, for example a rare witness line: "The oldest English called her
*ānhorn*, and did not argue about her feet."

## Sources

Public domain unless noted. Wording was confirmed through search results that reproduce
the text; the archives themselves (Gutenberg, EEBO-TCP, archive.org, Chicago's Penelope)
were blocked from the research environment, so check spellings against a scan.

- Pliny, *Natural History* book 8, trans. Philemon Holland (1601): "the most fell and
  furious beast of all other", "loweth after an hideous manner", "the Licorne or
  Monoceros", "by report, this wild beast cannot possibly be caught alive". Transcription:
  [Penelope, University of Chicago](https://penelope.uchicago.edu/holland/pliny8.html).
- Solinus, *Polyhistor*, trans. Arthur Golding (1587): "a Monstar that belloweth
  horriblie". [EEBO-TCP](https://quod.lib.umich.edu/e/eebo/A12581.0001.001/1:69?rgn=div1&view=fulltext).
- Spenser, *The Faerie Queene* II.v.10 (1590): the lion and unicorn stanza. Confirmed in a
  modernised spelling; recover the 1590 spelling from a scan.
- Shakespeare, *Julius Caesar* II.i: "unicorns may be betray'd with trees"; *Timon of
  Athens* IV.iii: "wert thou the unicorn, pride and wrath would confound thee and make
  thine own self the conquest of thy fury". [MIT Shakespeare](https://shakespeare.mit.edu/julius_caesar/julius_caesar.2.1.html),
  [Folger](https://www.folger.edu/explore/shakespeares-works/timon-of-athens/read/4/3/).
- King James Bible (1611): Job 39:9–10; Deuteronomy 33:17 ("his horns are like the horns of
  unicorns: with them he shall push the people together to the ends of the earth").
  [Job 39:10](https://www.kingjamesbibleonline.org/Job-39-10/).
- Topsell, *The Historie of Foure-Footed Beastes* (1607): "doth wonderfully help against
  poisons", "He is an enemy to Lions", and that it "fighteth with the mouth and with the
  heels". Found second-hand, in modernised spelling. [Brown University Library, "Of the
  Unicorne"](https://library.brown.edu/create/unicornfound/of-the-unicorne/),
  [Early Modern Medicine](https://earlymodernmedicine.com/poisons-potions-and-unicorn-horns/).
- Marco Polo, trans. Henry Yule (1871; Cordier's revision 1903): "a passing ugly beast to
  look upon, and is not in the least like that which our stories tell of as being caught
  in the lap of a virgin". Found second-hand; check against Yule.
- The virgin-capture story: *Physiologus* and the medieval bestiaries. Modern translations
  (for example of the Worksop or Aberdeen bestiaries) are in copyright, so the proposals
  retell it as [A] lines.
- Ctesias, *Indica*: the colours of the horn. The translations found were modern; use
  McCrindle's 1882 translation if a direct quote is wanted.
- *ānhorn*: [Etymonline, "unicorn"](https://www.etymonline.com/word/unicorn).

## Research requests for the owner

The research environment could not open the text archives, so these checks need a person
(or an agent with archive access) before the chosen lines ship:

1. **Spenser, *Faerie Queene* II.v.10, 1590 spelling.** Search Gutenberg or EEBO for
   "rebellious Unicorne" and copy the stanza as printed.
2. **Holland's Pliny, book 8.** Open the Penelope transcription linked above, find
   "Licorne", and copy the whole sentence with its spelling.
3. **Topsell, "Of the Unicorne" (1607).** On archive.org or EEBO, find the poison passage
   ("wonderfully help against"), the lion and tree passage, and whether Topsell retells the
   maiden capture; copy each with original spelling. A Topsell line for Gloaming Rest would
   replace an [A] line with a [Q].
4. **Yule's Marco Polo.** Search the Gutenberg text for "passing ugly" and copy the
   sentence.
5. **The horn and poison.** Find a public-domain source (Topsell, Paré, or Browne's
   *Pseudodoxia Epidemica*, 1646) for the belief that the horn sweats or froths near
   poison, before the Bad Batch line cites it.
6. **Bosworth-Toller, *ānhorn*.** Confirm the entry and its spelling.
