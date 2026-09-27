---
type: Roadmap
title: Unicorn Voice Punch-Up
description: Proposals for a sharper Unicorn voice, with the September 2026 archive checks of the quotations copied out for the owner to pick from.
status: draft
audience: internal
tags: [content, strings, unicorn, voice]
---
# 28 — Unicorn Voice Punch-Up

**Status:** Proposals, awaiting the owner's review (September 2026). Nothing here has
shipped. The owner found the Unicorn's flavour text bland and asked for more edge: real
quotations from the old sources, lightly twisted quotations, and new lines written in
their old-fashioned English. The archive checks requested at the end of this file were
made on 2026-09-27; the copied passages are in [Research findings](#research-findings).
The owner picks lines here; a small strings-only pass then implements them (see
[27 — Next passes](27-next-passes.md#later)).

Current wording lives in the source files and the
[Unicorn strings inventory](../reference/strings/unicorn.md). The quoting rule is "Quoting
old texts" in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).

## How to read the proposals

Each line is tagged by where it comes from:

- **[Q]** a quotation whose wording was confirmed against at least one reliable
  transcription during research (see [Sources](#sources)).
- **[Q?]** a real quotation found only second-hand. Use it when the sense is clearly that
  author's, or rewrite it as [A].
- **[T]** a real quotation with a deliberate twist. Credit the original in a source
  comment.
- **[A]** an original line written in the same old style. It needs no citation, but a
  comment should say which source inspired it.

The owner's own example sets the tone for [A] lines: *"Beware, books of yore warn that in
this way be ye confounded."*

## Atmosphere

Owner note, 27 September 2026. These quotations, this phrasing, and this old language are
here to make atmosphere. Matching one sentence to one printing, letter for letter, matters
very little. Getting a spelling slightly off is fine: keep "enimies" if it reads more
clearly than "enimye", mix Holland's phrase with Topsell's spelling, or smooth a letter
two transcriptions disagree on. Credit whose words they are in a source comment. The same
rule is [Quoting old texts](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).
The spelling differences under [Spelling differences on record](#spelling-differences-on-record)
are notes for anyone who is curious.

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
> beast to look upon"** [Q], nothing like the one caught in a maiden's lap. No two
> witnesses agree, and each calls the last a liar.
>
> The horn is the heart of every tale. Topsell swore that unicorn horn **"doth wonderfully
> help against poisons"** [Q]; the King James Bible says that with such horns **"he shall
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

- [Q] Spenser, *The Faerie Queene* II.v.10, as the 1590 quarto is transcribed by the
  [Spenser Archive Prototype](https://talus.artsci.wustl.edu/spenserArchivePrototype/html/fq1590.bk2_canto_5.html).
  "Enimies" is the 1596 reading; 1590 prints "enimye". Charge anyway:

  > Like as a Lyon, whose imperiall powre / A prowd rebellious Vnicorne defyes, /
  > T'auoide the rash assault and wrathfull stowre / Of his fiers foe, him to a tree
  > applyes, / And when him ronning in full course he spyes, / He slips aside; the whiles
  > that furious beast / His precious horne, sought of his enimye / Strikes in the stocke,
  > ne thence can be releast, / But to the mighty victor yields a bounteous feast.

- [Q] Topsell, 1658 (the 1607 chapter tells the same story; see
  [findings](#3-topsell-of-the-unicorne)): "He is an enemy to the Lions, wherefore as soon
  as ever a Lion seeth a Unicorn, he runneth to a tree for succour … the Unicorn in the
  swiftness of his course runneth against the tree, wherein his sharp horn sticketh fast."
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
- [Q] Topsell, 1658: "There was nothing more horrible then the voice or braying of it, for
  the voyce is strained above measure."
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
- [Q] Topsell, *Historie* (1607), p. 719, as quoted by the Edward Worth Library: "It is
  sayd that Unicorns above all creatures, doe reverence Virgines and young Maides, and
  that many times at the sight of them they growe tame, and come and sleepe beside them."
  The 1658 reprint adds "other" ("above all other creatures") and modernises the
  spelling. The hunters then come. That is the Gloaming Rest story in Topsell's own
  words, so it can replace an [A] line. He also records the decoy of a young man dressed
  as a woman; leave that out of player-facing copy. The card stays trust and rest, as
  [26](../archive/roadmap/26-unicorn-pack.md) decided.

**Narration.**

| Moment | Current | Proposal |
|---|---|---|
| Kneels (self) | "As the light fails, {name} kneels among the laurel and closes {his} eyes." | Keep, and add: "Somewhere in the dusk, the hunters are listening." [A] |
| Rest broken | "{target}'s rest was broken. {He} rises without its comfort." | "The hunters were waiting! {target}'s rest is broken, and {he} {rises} without its comfort." [A] |
| Rest completes | "{target} rises from the laurel, restored." | "No hunter came. {target} riseth from the laurel, restored." [A] |
| Already resting | "{target} is already resting." | Keep; it is a plain rules message. |

## Horn of Proof

Current card text: "Dip the horn in the cup, and whatever was poisoned is made clean."

- [Q] "The hornes of Unicorns, especially that which is brought from new Islands, being
  beaten and drunk in water, doth wonderfully help against poisons." Topsell, 1607,
  p. 721, as quoted by the Edward Worth Library. The 1658 reprint prints the same
  sentence with "horns", "Islands", and singular "poyson". Dip it and see.
- [A] "Whoso drinketh from the horn shall take no hurt of poison, nor of curse, nor of
  binding: so say the physicians of yore."
- [Q] Topsell, 1658: "The ancient Writers did attribute the force of healing to cups made
  of this horn, Wine being drunk out of them." Of the Indian king who drank from such a
  cup he writes that the drink "expelled and resisted" drunkenness, "and worser things
  cured, meaning that it clean abolished all poyson whatsoever."
- [A], the short form of that story: "Kings drank from such horns, and feared no cup."

**Narration.**

| Moment | Current | Proposal |
|---|---|---|
| Hold loosened | "The horn's touch loosens the hold. {target} is free." | "The horn toucheth the bonds, and they fall away. {target} is free." [A] |
| Curse lifted | "The horn draws out the curse on {target}'s {stat}." | "The horn draweth out the curse on {target}'s {stat}, as it draweth poison from the cup." [A] |
| Bad Batch found | "{target} dips the horn in the cups in the ring. One bad batch is found out and poured away." | "{target} dips the horn in the cups in the ring. One cup froths and hisses; that bad batch is poured away." [T] The froth is Paré's water test (the horn "se prend à bouillonner", raising "petites bulles d'eau comme perles"). The sweat is a different test: Topsell, "the Unicorns horn doth sweat, having any poyson coming over it." Both authors report the belief in order to deny it. Cite them in a source comment either way. |
| Nothing to cleanse | "The horn finds nothing to purify." | "The horn findeth no poison here." [A] |

## Old English

Old English called the unicorn ***ānhorn***. Bosworth-Toller confirms the word. The
online dictionary lemmas it **án-horn** (the acute is the print edition's macron) and
also **án-horna**: "A unicorn; unicornis, monoceros." The citations write it without a
hyphen: "Ánhornes" (*unicornis*, Ps. Surt. 91, 11) and "Ðonne ánhorna" (*sicut
unicornis*, Ps. Th. 91, 9). A related adjective, **án-hyrne**, glosses "Ánhyrne deór" as
*unicornis, vel monoceros, vel rhinoceros*. Keep the noun to one easter egg, for example
a rare witness line: "The oldest English called her *ānhorn*, and did not argue about
her feet." A comment should cite Bosworth-Toller, án-horn
([bosworthtoller.com/1860](https://bosworthtoller.com/1860)).

## Sources

Public domain unless noted. The passages copied in [Research findings](#research-findings)
were read from the editions named there on 2026-09-27. They are a stock of phrases to
borrow. A small difference from the printing is fine; see [Atmosphere](#atmosphere).

- Pliny, *Natural History* book 8, trans. Philemon Holland (1601). Whole Licorne sentence
  in the findings. [Penelope, University of Chicago](https://penelope.uchicago.edu/holland/pliny8.html).
- Solinus, *Polyhistor*, trans. Arthur Golding (1587): "a Monstar that belloweth
  horriblie". Not re-opened in this pass.
  [EEBO-TCP](https://quod.lib.umich.edu/e/eebo/A12581.0001.001/1:69?rgn=div1&view=fulltext).
- Spenser, *The Faerie Queene* II.v.10. 1590 spelling in the findings, from the Spenser
  Archive Prototype, with J. C. Smith's 1909 collation for "enimye".
- Shakespeare, *Julius Caesar* II.i: "unicorns may be betray'd with trees"; *Timon of
  Athens* IV.iii: "wert thou the unicorn, pride and wrath would confound thee and make
  thine own self the conquest of thy fury". Not re-opened in this pass.
  [MIT Shakespeare](https://shakespeare.mit.edu/julius_caesar/julius_caesar.2.1.html),
  [Folger](https://www.folger.edu/explore/shakespeares-works/timon-of-athens/read/4/3/).
- King James Bible (1611): Job 39:9–10; Deuteronomy 33:17. Not re-opened in this pass.
  [Job 39:10](https://www.kingjamesbibleonline.org/Job-39-10/).
- Topsell, *The Historie of Foure-Footed Beastes* (1607), and the 1658 *History of
  Four-footed Beasts*. Lion, maiden, poison, voice, and sweat passages in the findings.
  1607 page numbers are the Edward Worth Library's. The sentences were read in the 1658
  Internet Archive OCR (`historyoffourfoo00tops`). EEBO-TCP A13820 (1607) and A42668
  (1658) list the chapter; Cloudflare blocked the chapter text itself.
- Marco Polo, trans. Henry Yule, Cordier's revision: Gutenberg eBook 12410. Sentence in
  the findings.
- Ambroise Paré, *Discours de la licorne* (1582), Penelope transcription: the horn bubbles
  in water and sweats near venom. Thomas Johnson's 1634 English, chapter 39, "Of the
  Unicornes Horne" (EEBO A08911), was located and not opened.
- The virgin-capture story in the *Physiologus* and the medieval bestiaries. Modern
  translations are in copyright, so those stay [A]. Topsell's own telling is now a [Q].
- Ctesias, *Indica*: the colours of the horn. The translations found were modern; use
  McCrindle's 1882 translation if a direct quote is wanted. Not re-opened in this pass.
- *ānhorn*: Bosworth-Toller, án-horn
  ([bosworthtoller.com/1860](https://bosworthtoller.com/1860)). Etymonline is no longer the
  witness.

## Research findings

Checked on 2026-09-27. Quotations below restore long s, which the 1658 OCR printed as
*f*. They are reading transcriptions, not facsimiles.

### 1. Spenser, *Faerie Queene* II.v.10, 1590

The [Spenser Archive Prototype](https://talus.artsci.wustl.edu/spenserArchivePrototype/html/fq1590.bk2_canto_5.html)
diplomatic text of the 1590 quarto. Where the page jams two spellings together
(`VnicorneUnicorne`, `auoideavoide`), that is its "modern chars" toggle (u beside v). The
1590 form is the first. J. C. Smith's 1909 Oxford text, founded on 1596, records one
variant in this stanza: line 7 "enimye" in 1590, "enimies" in 1596 (Gutenberg 70717,
note 587). An earlier proposal in this file quoted "enimies" as if it were 1590. It is
the 1596 word.

> Like as a Lyon, whose imperiall powre
> A prowd rebellious Vnicorne defyes,
> T'auoide the rash assault and wrathfull stowre
> Of his fiers foe, him to a tree applyes,
> And when him ronning in full course he spyes,
> He slips aside; the whiles that furious beast
> His precious horne, sought of his enimye
> Strikes in the stocke, ne thence can be releast,
> But to the mighty victor yields a bounteous feast.

Smith's 1596 copy-text prints "defies", "applies", "running", "spies", "enimies", and
"victour", and does not note "ronning" or "defyes". Either spelling can be used. See
[Atmosphere](#atmosphere).

### 2. Holland's Pliny, book 8

Opened [Penelope's transcription](https://penelope.uchicago.edu/holland/pliny8.html).
The short phrases already in the proposals match it, including "loweth after an hideous
manner" and "the Licorne or Monoceros". The whole sentence:

> But the most fell and furious beast of all other, is the Licorne or Monoceros: his
> bodie resembleth an horse, his head a stagge, his feet an Elephant, his taile a bore;
> he loweth after an hideous manner; one blacke horn he hath in the mids of his forehead,
> bearing out two cubits in length: by report, this wild beast cannot possibly be caught
> alive.

This is Penelope's transcription, not a scan of the 1601 book. Penelope's contents list,
on the book 1 page, calls the same chapter "the Licorne or Unicorne"; the sentence
itself says "Licorne or Monoceros".

### 3. Topsell, "Of the Unicorne"

EEBO-TCP of the 1607 book (A13820) has the chapter headings "OF THE VNICORNE" and "The
medicine arising from the Vnicorne", and Cloudflare blocked the chapter. The 1607
Internet Archive OCR (`bim_early-english-books-1475-1640_the-historie-of-foure-fo_topsell-edward_1607`)
indexes "Vnicorne" and does not contain a readable chapter. The sentences below were
read in the 1658 reprint's OCR, with long s restored. The Edward Worth Library quotes
the 1607 pages and is the witness for 1607 spelling where the two disagree.

**Lion and tree** (1658, just before "The Medicines arising from the Vnicorn"):

> He is an enemy to the Lions, wherefore as soon as ever a Lion seeth a Unicorn, he
> runneth to a tree for succour, that so when the Unicorn maketh force at him, he may not
> only avoid his horn, but also destroy him; for the Unicorn in the swiftness of his
> course runneth against the tree, wherein his sharp horn sticketh fast, then when the
> Lion seeth the Unicorn fastned by the horn, without all danger he falleth upon him and
> killeth him.

The same stretch confirms the two phrases this file used to call second-hand: "He is an
enemy to the Lions", and "It fighteth both with the mouth and with the heels, with the
mouth biting like a Lion, and with the heels kicking like a Horse."

**Maiden** (1607, p. 719, Worth's quotation): "It is sayd that Unicorns above all
creatures, doe reverence Virgines and young Maides, and that many times at the sight of
them they growe tame, and come and sleepe beside them." The 1658 OCR reads "above all
other creatures" and "grow tame, and come and sleep beside them." Topsell then tells how
hunters dress "a goodly strong and beautiful young man" "in the apparel of a woman", the
unicorn sleeps, and they cut off the horn and send him away alive. He credits Tzetzes and
leaves the reader free to believe or refuse it. That is a [Q] for Gloaming Rest. The
decoy stays out of the card text. Player-facing copy keeps the card as trust and rest.

**Poison** (1607, p. 721, Worth's quotation): "The hornes of Unicorns, especially that
which is brought from new Islands, being beaten and drunk in water, doth wonderfully
help against poisons … I my selfe have heard of a man worthy to be believed, that having
eaten a poison'd cherry, and perceiving his belly to swell, he cured himself by the
marrow of this horne being drunke in wine in very short space." The 1658 OCR has
"horns", "new Islands", singular "poyson", "my self", "poisoned", "horn", and "drunk".

**Voice**, useful for Dissonant Voice (1658): "There was nothing more horrible then the
voice or braying of it, for the voyce is strained above measure."

### 4. Yule's Marco Polo

Gutenberg eBook 12410, *The Travels of Marco Polo*, volume 2, Yule's translation revised
by Henri Cordier. Book 3, the kingdom of Basma. The sentence this file already quoted is
the book's own wording, so the lore line moves from [Q?] to [Q]:

> 'Tis a passing ugly beast to look upon, and is not in the least like that which our
> stories tell of as being caught in the lap of a virgin; in fact, 'tis altogether
> different from what we fancied.

The paragraph around it calls them unicorns with buffalo hair, elephant feet, one thick
black horn, a boar's head carried toward the ground, and a delight "to abide in mire and
mud." They "do no mischief, however, with the horn, but with the tongue alone."

### 5. The horn, poison, sweat, and froth

Two beliefs, both denied by the authors who record them. The Bad Batch line's frothing
cup is the first. The horn sweating beside poison is the second. Browne's chapter on the
unicorn's horn (Penelope, *Pseudodoxia Epidemica* III.xxiii) doubts the antidote and does
not describe either test.

**Froth in the cup.** Paré, *Discours de la licorne* (1582), Penelope transcription:
"Autres tiennent, que la vraye Licorne estant mise en l'eau, se prend à bouillonner,
faisant eslever petites bulles d'eau comme perles." He says an ox horn, a goat horn, a
sheep horn, ivory, a potsherd, tile, or wood does the same, because air leaves the pores.
Johnson's English chapter was not opened, so an English [Q] of this sentence waits on
that chapter or stays a [T] credited to Paré.

**Sweat near poison.** Topsell, 1658: "Some say that the Unicorns horn doth sweat, having
any poyson coming over it, which is false." Paré, same discourse: "On dit davantage, que
la corne de Licorne sue en presence du venin." He calls true sweat an effect of a living
thing, and any damp on the horn the same mist that forms on glass, a mirror, or marble.

### 6. Bosworth-Toller, *ānhorn*

Confirmed at [bosworthtoller.com/1860](https://bosworthtoller.com/1860). The entry is
quoted under [Old English](#old-english). The easter egg's *ānhorn* is the right word.
The dictionary's lemma is the hyphenated án-horn; the psalm quotations write Ánhornes
and ánhorna.

### Spelling differences on record

These are the places two witnesses still disagree. Any of the spellings can ship. See
[Atmosphere](#atmosphere).

- Spenser II.v.10: the 1590 transcription has "ronning", "defyes", "enimye", and "victor";
  Smith's 1596 text has "running", "defies", "enimies", and "victour".
- Holland 1601: the sentence above is Penelope's transcription, which may have smoothed a
  letter.
- Topsell: Worth's quotation of 1607 and the 1658 reprint disagree on "poisons" /
  "poyson" and "above all creatures" / "above all other creatures".
- Paré's bubbling test is in French here. Johnson's 1634 English chapter, "Of the
  Unicornes Horne", was located and not opened. An English line can still credit Paré.
