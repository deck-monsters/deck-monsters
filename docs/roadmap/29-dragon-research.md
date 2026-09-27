---
type: Roadmap
title: Dragon Research Round
description: Active source dossier and design synthesis for the requested Dragon content pack.
status: draft
audience: internal
tags: [roadmap, dragon, research, content]
---
# 29 — Dragon Research Round

**Status:** Research started September 2026. This is a source dossier and design proposal,
not an approved content specification. The owner and requester still need to answer the
questions under [Gates and open questions](#gates-and-open-questions), and every `[Q?]`
transcription needs checking against the linked scan before it can become player-facing
`[Q]` copy.

The [original brief](12-new-content-backlog.md#dragon-research-brief) remains the requirements
document. This pass saves the evidence gathered against it so the eventual content pass does
not have to rediscover sources or mistake an attractive inference for an old tradition.

## Tasks

| # | Slice | Status | Evidence | Commit |
|---|---|---|---|---|
| 1 | Norse and Germanic primary-source sweep | Initial sweep saved; locating passages in the named editions open | Source ledger below | 02e26a2 (#401) |
| 2 | Roman primary-source sweep | Initial sweep saved; locating passages open | Source ledger below | 02e26a2 (#401) |
| 3 | Bestiary and early-modern sweep | Initial sweep saved; exact scan records open | Source ledger below | 02e26a2 (#401) |
| 4 | Roster fit and initial card directions | Drafted | Design synthesis below | 02e26a2 (#401) |
| 5 | Engine fit: class and card pool, stat ranges, reusable mechanics, build checklist | Drafted | [Fitting the Dragon into the engine](#fitting-the-dragon-into-the-engine) | this commit |
| 6 | Requester interview and owner source review | Not started | Gates below | — |
| 7 | Approved monster/card specification and implementation slices | Blocked on #6 and on Pass B task 0 (one harness roster, `sim:monster`) | Not yet written | — |

## Research method and quotation key

The round prioritises primary texts in named public-domain editions, then manuscript,
museum, or scholarly catalogues for objects. Modern summaries are navigation aids only.
Links below go to the text, scan, or institutional record rather than a search-result page
where a direct record is known.

- **`[Q]`** means transcribed from the named edition and checked against the linked text or
  page image. There are deliberately no `[Q]` entries yet: outbound archive access was
  unavailable during this round.
- **`[Q?]`** is a quotation candidate with the best locus and edition currently known. A
  broad page range or search record is only a lead, not a precise citation. A `[Q?]` must
  not be attributed to a different translation than the one it came from.
- **`[P]`** is a paraphrase. It can inform original copy but must not be placed in quotation
  marks.
- **`[A]`** is an original Deck Monsters line or idea. It may echo a sourced motif, never a
  modern copyrighted dragon's phrasing, names, species, or design.

**What "checked" means here.** The owner's standing decision for old quotations is
atmosphere, not a diplomatic text ("Quoting old texts" in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules),
and the Unicorn precedent in
[28](../archive/roadmap/28-unicorn-voice-punch-up.md#atmosphere)). So promoting a `[Q?]` to
`[Q]` needs the passage found in the named public-domain edition with its sense intact; a
spelling or punctuation difference between printings is fine, and letter-for-letter
collation is not required. What this round's caution *does* rightly guard is **rights**:
a modern translation or a modern website's English (Aberdeen's, Rolfe's 1935 Ammianus)
stays paraphrase or research-only whatever its age of source, and a line is only quoted
from an edition that is itself public domain.

The rest of this caution is substantive, not clerical. Chapter numbering differs between editions;
OCR mangles long *s* and ligatures; `draco`, *ormr*, and *wyrm* do not automatically mean a
modern winged dragon; and modern web translations can remain copyrighted even when the
underlying work and manuscript are public domain.

## Creative thesis

Make the Dragon an **articulate, airborne hoard-warden whose strength creates openings**.
The main strand is the Norse/Germanic fire-drake: old enough to argue, vain enough to keep
titles, and dangerous enough that taking one cup can burn a kingdom. The Roman strand does
not turn it into a gladiatorial animal. It supplies opponents and arena texture: the whole
army bringing a ballista, the wind-filled *draco* standard, and the fatal weight of an
elephant falling on the serpent that bound it.

The playable identity has four tensions:

1. **Small beginning / ancient terror.** Existing level scaling should express growth before
   a new growth subsystem does. A Fighter-like or caster-like curve remains an owner choice,
   to be tested rather than asserted.
2. **Burst / recovery.** Breath should be frightening across a crowd, then leave a visible
   recovery turn. That is more legible and fair than another unconditional Blast.
3. **Armoured / exposed.** Scale and flight buy bounded defence, while a soft underbelly or
   winded state gives opponents a planned answer.
4. **Proud / self-defeating.** The old stories repeatedly let treasure, coils, weight, or
   certainty undo the monster. Risk should be deterministic and visible; random
   “disobedience” must not replace a Beastmaster's prepared card and erase agency.

The Dragon is therefore not a larger Basilisk. The Basilisk already owns terrestrial
serpent control, Coil/Constrict, petrifying gaze, and physical-stat growth. Dragon owns
fire, flight, speech, hoard-provoked fury, cooldown, and counterplay through exposure.

## Source ledger: Norse and Germanic

### *Völsunga saga*: the speaking, treasure-made wyrm

**Edition.** *The Story of the Volsungs and Niblungs*, translated by Eiríkr Magnússon and
William Morris (Walter Scott, 1888 revised edition; translation first published 1870),
chapters 14 and 18–19. Public-domain text: [Wikisource chapter
18](https://en.wikisource.org/wiki/The_Story_of_the_Volsungs/Chapter_18); scan/ebook record:
[Project Gutenberg 1152](https://www.gutenberg.org/ebooks/1152).

- `[Q?]` Chapter 18: “The sounding gold and the glow-red treasure, the rings shall be thy
  bane.” Check punctuation and hyphenation against the scan before promoting it.
- `[P]` Sigurd wounds Fáfnir from a pit. The dying Fáfnir questions him, warns that the
  treasure destroys its possessor, discusses fate, and names Regin's part in the deed.
- `[P]` Chapter 14 makes the transformation morally useful: Fáfnir is Hreidmar's son before
  greed and possession of the cursed gold make him a serpent, not simply one member of a
  biological dragon species.

**Design inference.** A wounded Dragon can talk back rather than only roar. A hoard may
promise power while arming a delayed bane, but any coin/item mutation stays out until the
economy owner reviews it. “Heart-wisdom” could reveal an opponent's coming card, but the
violent source action should be transformed into readable, non-gory magic rather than
copied literally. Morris's deliberate archaism is a source flavour, not a mandate to make
every line obscure.

### *Beowulf*: the cup, the fire, and the title pool

**Witness and editions.** The primary witness is British Library Cotton MS Vitellius A XV
([manuscript record](https://www.bl.uk/manuscripts/FullDisplay.aspx?ref=Cotton_MS_vitellius_a_xv)).
For lineation and Old English use A. J. Wyatt (ed.), *Beowulf* (1894), available through
[Internet Archive](https://archive.org/details/beowulfwithtext00wyatgoog). John Lesslie
Hall's 1892 public-domain translation is [Project Gutenberg
16328](https://www.gutenberg.org/ebooks/16328). The dragon episode is lines 2200–3182.

| Locus | `[Q?]` Old English | Working gloss `[P]` | Possible use |
|---|---|---|---|
| 2271 | *uhtsceaða* | dawn- or twilight-ravager; translations differ | A title, only after choosing a stated gloss |
| 2273 | *niðdraca* | hostile or malice-dragon | A harsher title |
| 2293 | *hordweard* | hoard-guardian | Defensive/retaliatory build cue |
| 2315 | *lyftfloga* | air-flier | Flight/evasion build cue |
| 2333, 3040 | *ligdraca* | flame-dragon | Breath build cue |
| 2524 | *beorges hyrde* | barrow's guardian | Lair/hoard title |

`[P]` A fugitive takes a single cup from an old hoard. Its guardian discovers the loss,
searches, and burns the land by night. Beowulf's iron shield holds only for a time, his
sword fails, his retainers flee, and Wiglaf alone remains; king and dragon both die.

**Design inference.** Give each Dragon a readable compound title that previews temperament
or build; do not promise that a random title changes mechanics unless the content pass
implements that contract. “One Cup Missing” is an excellent once-per-fight provocation,
but should react to a general theft effect rather than hard-code a card name. “Last
Retainer” suggests team counterplay, and the iron shield argues for temporary survival,
never fire immunity.

### *Prose Edda*: keep the root-gnawer and world-serpent distinct

**Edition.** Snorri Sturluson, *The Prose Edda*, translated by Arthur Gilchrist Brodeur
(1916), *Gylfaginning* §§15, 34, 48, and 51. Use the named [Brodeur edition
landing](https://sacred-texts.com/neu/pre/index.htm), not Gutenberg 18947, which catalogues
a different translation.

- `[Q?]` §15: “Nídhöggr gnaws this root from below.”
- `[Q?]` §34: “this serpent grew so great that he lies in the midst of the ocean
  encompassing all the land”.
- `[P]` Thor fishes for Jörmungandr with an ox-head; Hymir cuts the line (§48). At Ragnarök,
  Thor kills the serpent, walks nine paces, then dies from its venom (§51).

**Design inference.** These are endgame or boss ideas, not cosmetic Dragon variants.
Root-gnawing suggests attrition below a defence; the world-serpent suggests enclosure and a
clearly counted poison consequence after defeat. Combining them would flatten two figures
and drift back into the Basilisk's serpent lane. Snorri is a thirteenth-century Christian
Icelandic synthesis that quotes older verse, not a transparent transcript of pre-Christian
belief.

### Material evidence: pictures and prows

- **Ramsund carving, Sö 101 (c. eleventh century).** Start with the [Swedish National
  Heritage Board Fornsök](https://app.raa.se/open/fornsok/) record (search the identifier)
  and the [Swedish History Museum](https://historiska.se/upptack-historien/). `[P]` The
  serpent-shaped picture band surrounds scenes of Sigurd striking upward, cooking the
  heart, touching his burned thumb, birds, Regin, the horse, and treasure. The runes are a
  Christian-era bridge memorial; they do not narrate the pictures. Call this a carving,
  not casually a “runestone.” A continuous serpent-border card frame is a visual lead, not
  evidence for Dragon anatomy.
- **Ship heads.** The [Museum of the Viking Age's Oseberg
  collection](https://www.vikingtidsmuseet.no/english/the-collection/oseberg/) is strong
  evidence for elaborate animal carving, weak evidence for the stereotyped intact dragon
  head. The [Viking Museum at Ladby](https://vikingemuseetladby.dk/en/) describes surviving
  stem fittings interpreted in reconstruction. Verify the object record before claiming a
  “dragon's mane.” A removable prow-head stance is a promising original idea, but surviving
  material, reconstruction, and later literary rules must remain separate.

## Source ledger: Roman

### Pliny: dragon and elephant

**Edition.** Pliny the Elder, *Natural History* 8.11 §§32–33, translated by John Bostock and
H. T. Riley (1855), public domain. Text: [MIT Classics
Archive](https://classics.mit.edu/Pliny/natural.8.html); Latin/English locus:
[LacusCurtius](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Pliny_the_Elder/8*.html#11).

- `[Q?]` “India produces the largest elephants, as well as the dragons which are
  continually at war with them.”
- `[Q?]` “the elephant, vanquished, falls to the earth, and by its weight crushes the
  dragon which is entwined around it.”
- `[P]` Pliny's *draco* is a gigantic serpent that attacks from concealment, coils an
  elephant, and dies under the defeated animal. This is inherited Roman encyclopedic lore,
  not eyewitness zoology and not evidence of wings or fire.

**Design inference.** The important shape is mutual danger: binding the heaviest foe can
make its fall fatal. That is better as broad counterplay than a Dragon Coil, because the
Basilisk already owns that move.

### The Bagradas serpent: an army brings engines

**Sources.** Pliny, *Natural History* 8.14 §37 ([same edition and
text](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Pliny_the_Elder/8*.html#14));
Valerius Maximus, *Memorable Doings and Sayings* 1.8 ext.19, Karl Kempf's 1888 Latin
edition ([Perseus locus](https://www.perseus.tufts.edu/hopper/text?doc=Val.%20Max.%201.8.ext.19&lang=original));
and Aulus Gellius, *Attic Nights* 7.3.1 (numbered 6.3 in older editions), which attributes
the story to Tuditanus ([LacusCurtius locus](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Gellius/7*.html#3)).

- `[Q?]` Pliny: “it was attacked with military engines and balistæ, and its skin and jaws
  were preserved in a temple at Rome”.
- `[Q?]` Valerius Maximus: “ballistarum tormentis undique petitam silicum crebris et
  ponderosis verberibus procubuisse.”
- `[P]` Original translation of that Latin candidate: attacked on every side by ballista
  engines, it fell under repeated heavy blows of stone.
- `[P]` The accounts give Regulus's army—not a lone gladiator—the victory over an enormous
  African serpent and make ordinary missiles inadequate. Gellius is useful corroboration
  and a source-chain clue, though he writes centuries after the reported event.

**Design inference.** A Ballista Crew counter should require setup or a team threshold and
break armour rather than simply add damage. The comic cadence is escalation—`[A]` “Javelin?
No. Bigger.”—but call the ancient torsion engine a ballista, not a medieval crossbow. A
trophy or temple aftermath is safer as a codex/banner idea than loot taken from a sentient
player companion.

### The *draco* standard: cloth made alive by speed

**Sources.** Arrian, *Ars Tactica* 35.3–5, especially 35.4–5 (A. G. Roos's 1928 Greek
edition; [Perseus text](https://www.perseus.tufts.edu/hopper/text?doc=Arr.%20Tact.%2035.3&lang=original),
[ToposText locus](https://topostext.org/work/487#35.3)); Ammianus Marcellinus, *Res Gestae*
16.10.7, J. C. Rolfe translation (1935, rights unverified and research-only; [Latin/English
locus](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Ammian/16*.html#10.7)).

- `[P]` Arrian describes Scythian dragon standards as long coloured cloth sleeves with a
  serpent-like head. They hang limp at rest; a galloping horse fills them with air so they
  appear alive and make a sound. His Scythian framing should not be erased when discussing
  Roman adoption.
- `[Q?]` Ammianus: “with wide mouths open to the breeze, and hence hissing as if roused by
  anger”. Check the 1935 translation's reuse status in the target jurisdiction; Latin plus
  an original translation is safer for shipped copy.
- `[P]` Ammianus's fourth-century purple, jewelled standards accompany an emperor's
  ceremonial entrance. This is imperial pageantry, not an early arena dragon fight.

**Design inference.** “Raise the Draco” could be a Gladiator/team initiative card: limp
while still, hissing only after speed or a charge wakes it. It makes a memorable visual
counterpart without pretending the cloth standard and the monster are one tradition.
`[A]` “The wind is doing most of the boasting.”

### The honest arena boundary

Suetonius, *Divus Augustus* 43.4, J. C. Rolfe translation (1914, public domain), records
exotic spectacle ([LacusCurtius locus](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Augustus*.html#43.4)).
`[Q?]` He lists “a rhinoceros in the Saepta, a tiger on the stage and a snake of fifty
cubits in front of the Comitium.” The snake is not called a *draco*, and the Comitium
display is not an amphitheatre fight. The defensible synthesis is that Roman sources give
us monster spectacle, military serpent combat, and dragon standards separately. **Do not
claim that historical gladiators fought dragons.**

## Source ledger: bestiary and early modern

These sources preserve the elephant conflict and later European reception. They should
support risk, voice, and visual research—not overwrite the chosen Germanic monster with
every creature ever labelled dragon.

### Aberdeen Bestiary

**Witness.** University of Aberdeen MS 24 (c. 1200), *De dracone*, fols. 65v–66r:
[65v](https://www.abdn.ac.uk/bestiary/ms24/f65v) and
[66r](https://www.abdn.ac.uk/bestiary/ms24/f66r). Check the related elephant sequence and
folio references through the manuscript navigation rather than assuming the modern site's
order.

- `[Q?]` Modern site translation: “The dragon is larger than all other snakes or all other
  animals on earth.”
- `[Q?]` “Its strength lies not in its teeth but in its tail.”
- `[Q?]` “It lies in wait on the paths along which elephants are accustomed to walk.”

The manuscript is public-domain by age, but Aberdeen's English translation and site may
have separate rights. Transcribe the Latin from the facsimile or paraphrase the English
unless reuse terms permit quotation. The elephant's fall is useful counterplay; tail-based
constriction belongs to the Basilisk in this game.

### Topsell and Aldrovandi

- **Edward Topsell,** *The Historie of Serpents. Or, The Second Booke of Living Creatures*
  (William Jaggard, 1608), “Of the Dragon,” reported at pp. 153ff. Locate a copy through the
  [Internet Archive record search](https://archive.org/search?query=title%3A%28historie+of+serpents%29+AND+creator%3A%28topsell%29)
  and save its item/page URL during verification. `[Q?]` “Among all kindes of Serpents,
  there is none comparable to the Dragon.” `[Q?]` “their greatest strength is in their
  tails.” Topsell compiles older lore, so he is reception rather than an independent
  witness. A 1658 combined reprint exists; name the edition actually transcribed instead of
  giving 1608 credit to clearer 1658 typography.
- **Ulisse Aldrovandi,** *Serpentum, et draconum historiae libri duo* (Bologna: Clemente
  Ferroni, 1640). Begin at the [Biodiversity Heritage Library title
  search](https://www.biodiversitylibrary.org/search?searchTerm=Serpentum%20et%20draconum%20historiae#/titles),
  then record the exact item, page, image identifier, and rights statement. Its plates and
  taxonomic reception are more useful here than an improvised English translation of its
  Latin. Do not present a translated line as `[Q]` without a named translation.

OCR is not evidence for either early-modern work: long *s*, signatures, and ligatures must
be checked against the page image.

## Roster fit and candidate cards

**Requester requirement (September 2026):** the owner's son asked specifically for a
**flight** card and a **fire-breath** card. The names are open, but the ideas are fixed: the
pack ships one card built on each, so Banked Breath and Scale-Wing below are required
directions, and the remaining one to three cards are the choice.

These are directions for owner review, not names or final mechanics. Each keeps state on
the encounter, where fight cleanup already owns it, and must handle confusion turning its
effect onto self or ally.

| Direction | Source and game role | Risk | Counterplay / bound |
|---|---|---|---|
| **Banked Breath / Ashen Breath** (required: fire breath) | Germanic flame-dragon; modest area burst | A plain area hit is a better-looking Blast; a dead recovery draw may feel bad; area damage scales with ring size, and rings hold 2 to 12 | Successful breath arms `winded`; its next appearance recovers or becomes a weak single-target puff. Opponents exploit the telegraphed window. Compare against Blast (Cleric-only, 3 base +1 per caster level to every opponent) and measure across ring sizes, not only 1v1. |
| **Scale-Wing** (required: flight) | Flight and armour; bounded defence. Flight could also be evasion or a repositioning turn rather than armour; the requester's ask is flight, not scales | Can copy Basic Shield or the Unicorn's ward, or become immunity | Brace only the next appropriate melee blow, spend on attempt, and expose the belly or impose `winded`; non-melee damage or an opening card bypasses it. It never blocks holds by fiat. |
| **Soft Underbelly** | Sigurd's pit as a broad counter | A Dragon-only counter is dead elsewhere | Reward striking any opponent during a visible post-defence/cooldown opening; grant extra Dragon flavour, not species-only function. |
| **One Cup Missing / Hoard-Wrath** | *Beowulf*'s stolen cup | Card-name coupling, runaway retaliation; coin/item theft would need the economy owner | A theft effect already exists in the fight: **Pick Pocket** (`cards/pick-pocket.ts`) takes a card from the highest-XP opponent's hand and plays it. The hoard can be the Dragon's *hand*, not its coins: when a card is taken from it, arm one bounded next-attack bonus as encounter state. That needs a small, generic "a card was taken from you" hook on the victim rather than a Pick Pocket special case, and no economy change. |
| **Raise the Draco / Ballista Crew** | Arrian's moving standard or Bagradas army | Too much Roman content can displace the requested monster; raw bonus is dull | Gladiator/team setup creates initiative or breaks a visible armour stance. Require movement, crew, or a setup turn and keep the two historical motifs as separate candidate cards. |

The bestiary “Elephant's Fall” is better treated as generic recoil/counterplay than a Dragon
card. A target that overcommits a bind may be hurt by the defender's fall, but implementing
it through the hold system risks Basilisk overlap and should be rejected unless it reads
cleanly for every holder and target.

### Ideas to reject or defer

- **Dragon Coil/Constrict, petrification, or shedding:** the Basilisk already owns those.
- **Unconditional flight or scale immunity:** every defence needs a visible spend and answer.
- **Randomly replacing the prepared card as “disobedience”:** funny fiction is not enough
  reason to remove the Beastmaster's pre-fight decision. Keep the joke in narration or a
  deterministic, disclosed risk.
- **Direct hoard coins/items:** requires economy-owner review and expands the content pass.
  The card-theft version above needs neither.
- **Every tradition as an appearance:** East Asian dragons, Níðhöggr, Jörmungandr, bestiary
  serpents, and the Roman cloth *draco* are not skins for one Germanic fire-drake.

## Appearance, profile, and voice leads

- Appearance axes can include wing form, crest/horns, scale colour, tail, smoke, a single
  hoard object, and lair. Habitats are descriptive only; cave/forest already occur on the
  Basilisk and should not imply shared mechanics.
- An original rated profile can nod to the expectation of a dragon card without copying
  the five copyrighted category names: **Hoard Patience**, **Smoke Control**, **Roman
  Opinion**, and **Table Manners** are candidate jokes. Final labels go through requester
  read-aloud review.
- Titles should be readable compounds inspired by Old English formation, not a false claim
  that every invented title occurs in *Beowulf*: Flame-Dragon and Air-Flier can sit beside
  original `[A]` forms such as Cup-Counter or Shield-Scorcher once the voice pass tests them.
- Source voices can disagree without cloning the Unicorn's witness routine. `[A]` “Topsell
  calls the tail my strength. Topsell never stood before my mouth.”
- The Dragon can be vain, sarcastic, articulate, funny, and a little frightening. Keep
  injury non-gory and make the most dramatic line easy to read aloud.

## Fitting the Dragon into the engine

How a monster is built here is set by the checklist in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#adding-a-card-or-a-monster)
and the Unicorn precedent ([26](../archive/roadmap/26-unicorn-pack.md)). The research above
has to land inside those constraints. This section records them so the owner decisions are
made with the costs in view. Nothing here is decided.

### Class is the card pool, not only a label

A monster's class decides which class-gated cards it may hold, on top of cards that name
its creature type. That makes class the biggest single design choice.

| Class | Roster today | What the Dragon would draw on | Fit and cost |
|---|---|---|---|
| **Wizard** | none | Very little: Cloak of Invisibility and Revive are the only Wizard-legal class cards today | The natural late-bloomer caster, and an unused class. But the Dragon pack would have to supply most of its own deck (or the pass adds Wizard cards), or it plays generic cards only. Largest content cost, cleanest identity. |
| **Barbarian** | Basilisk, Minotaur | Berserk, Vengeful Rampage, Hit Harder, Pound, Adrenaline Rush, and the rest of the brute pool | An early brute. Crowded, and two of three Barbarians would be big scaled beasts; hardest to keep distinct from the Basilisk. |
| **Fighter** | Gladiator | The Fighter pool, Basic Shield included | Early and steady; shares the Roman arena with the Gladiator, which the research wants as an opponent's world, not the Dragon's. |
| **Bard** | Jinn | Bard pool (Bad Batch, Iocane, Basic Shield, Pound…) | A talker, which suits the speaking wyrm; balance-wise a middle curve. |
| **Cleric** | Weeping Angel, Unicorn | Blast, Heal, Horn of Proof… | Would give it Blast for free, which the breath card is meant *not* to be. Two Clerics already. |

The requester's answer to "small dragon that grows, or a big one now?" maps almost directly
onto Wizard/Bard (late) versus Barbarian/Fighter (early), per the
[balance target](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).

### Stats: the shared budget and the roster's ranges

- Modifiers total **+2** across dex, str, and int, like every monster (a test enforces it).
  The flavour pulls toward str (the hoard-warden) and int (the talker), with dex lowest,
  which also leaves the Unicorn as the agile one. For example `str +1, int +2, dex −1`
  (caster lean) or `str +2, int +1, dex −1` (brute lean).
- The roster's spawn offsets run **AC 0–2** and **HP 0–4**. A test keeps a new monster within
  one AC of the best existing offset. Scales argue for AC 2; a caster lean argues for HP
  1–2; a brute lean for HP 3–4.
- Growth "from wyrmling to terror" should come from level scaling that already exists, the
  way Blast adds damage per caster level, before any new growth system.

### What already exists to build on

- **Braces.** A positive `encounterModifiers.ac` already absorbs melee blows in
  `creature.hit()`; Scale-Wing can be a brace plus an exposure, not a new defence system.
- **Encounter state.** Anything that lasts past one play (`winded`, exposure, hoard
  anger) lives on `creature.encounterModifiers` or `encounterEffects` and is cleared with
  the fight; no timers or `game.on` listeners.
- **Holds and the ward.** Anything that binds goes through `ImmobilizeCard.immobilize()`
  and is subject to the Unconquerable Horn ward; the dossier already rejects a Dragon Coil.
- **Card theft.** Pick Pocket, above.
- **Confusion.** Every Dragon card must read sensibly when Sandstorm turns it onto its own
  player or an ally (`target === player`).

### What would be new

- **An "exposed"/opening state that other cards read.** Soft Underbelly as written needs
  attackers to check the target's exposure; today no card reads another's opening
  (Sticketh's "has an opening" is narration only). That is a shared mechanic touching
  every attack roll, so it needs its own design and review, or the underbelly becomes a
  Dragon-owned penalty (e.g. lower AC while winded), which needs nothing new.
- **A "card was taken from you" hook** for the hoard, if chosen.
- **The profile panel** in the `look at` text, which is string work only.

### Build checklist (from the Unicorn pass)

When the specification is approved, the content pass touches: a creature-type constant; the
class; `monsters/helpers/all.ts` (append, never insert); the spawn colour example and a name
generator; a pixel sprite (wings make it the first flying silhouette, see
[ring roster and pixel monsters](../architecture/ring-roster-and-pixel-monsters.md)); the
cards with badge keywords in `apps/web/src/utils/cards.ts`; the server spawn-catalog test;
`pnpm run build:docs` for `MONSTERS.md`, `CARDS.md`, `DMG.md`, and the generated strings
inventory (which becomes the read-aloud script for the requester); and balance evidence
from `sim:monster Dragon` across ring sizes, which is why Pass B task 0 comes first.

## Gates and open questions

### Ask the requester first

Already answered: he wants a **flight** card and a **fire-breath** card (see
[Roster fit](#roster-fit-and-candidate-cards)). Still to ask:

1. Which dragons in the books are your favourites, and what makes each one funny, scary,
   clever, or lovable?
2. Would you rather begin with a small dragon that grows formidable, or command a large
   one immediately?
3. Which moments would you most want the cards to *feel like*? Describe them in your own
   words; do not copy dialogue, species names, or designs.
4. Which profile jokes, titles, and breath/recovery ideas are fun when read aloud?

### Owner decisions before a specification

1. Confirm the Germanic fire-drake thesis, and choose the class with its card pool in view
   (see [Class is the card pool](#class-is-the-card-pool-not-only-a-label)); Wizard means the
   pack also supplies most of the deck. Final stat numbers stay unset until then.
2. Breath and flight are required by the requester. Choose one to three more directions
   from the candidate table, and decide whether either Roman card belongs in the Dragon
   pack or a later Gladiator pack.
3. Decide whether the hoard enters now as card theft (Pick Pocket already takes cards
   mid-fight; no economy change) or waits for coin/item work.
4. Supply or nominate the dragon anthology counterpart requested in the original brief.
5. Approve this source palette after `[Q?]` entries have scan URLs/page images and are
   promoted to `[Q]` or downgraded to `[P]`.

### Acceptance gates for the research step

- Every shipped quotation has a named edition, exact locus, durable link, rights note, and
  completed `[Q]` transcription check.
- Every source-shaped mechanic points back to this ledger; every modern-book influence is
  confined to setting/feel and requester feedback, with no borrowed names, dialogue,
  species, plots, or visual design.
- The approved monster specification states class, modifier budget, AC/HP range,
  appearance fields, look-at/profile shape, and a clean distinction from Basilisk and
  Unicorn.
- Three to five approved cards state target, level/rarity/distribution range, source motif,
  encounter state, risk, counterplay, confusion behavior, and relevant balance comparison.
- Implementation is split into reviewed slices (monster shell, signature vertical slice,
  support cards, generated references, simulation, live/read-aloud check) only after the
  owner reviews the brief.
- The final strings inventory is read aloud to the requester before the content pass closes.
