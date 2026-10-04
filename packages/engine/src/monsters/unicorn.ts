import { sample } from '../helpers/random.js';
import { agree } from '../helpers/pronouns.js';
import { capitalize } from '../helpers/capitalize.js';
import { CLERIC } from '../constants/creature-classes.js';
import { UNICORN } from '../constants/creature-types.js';
import BaseMonster from './base.js';

/*
 * The Unicorn is assembled from contradictory reports on purpose, so each spawn reads as
 * one witness's account rather than a canonical anatomy. Sources behind the variants, all
 * checked against the anthology A Book of Unicorns (Green Tiger Press); paraphrased here,
 * and see docs/archive/roadmap/26-unicorn-pack.md for the research brief:
 *   - Ctesias, Indica fragment 25 (ancient report, 4th century BCE): wild asses of India
 *     with white bodies, dark-red heads, dark-blue eyes, and a horn white at the base,
 *     black in the middle, and crimson at the tip; "exceedingly swift and powerful".
 *   - Pliny, Natural History (ancient report, 1st century): the monoceros has a stag's
 *     head, elephant's feet, a boar's tail, a deep lowing voice, and one black horn two
 *     cubits long, and "cannot be taken alive".
 *   - Aelian, De Animalium Natura (ancient report, 2nd century): the cartazon of India's
 *     inaccessible mountains has tawny hair, a ringed black horn, the most dissonant voice
 *     of any animal, seeks deserted places, and is gentle with other kinds but fights its own.
 *   - Julius Solinus, Polyhistoria (3rd century, early-modern English): a horn "of a
 *     wonderful brightness", and a monster that "belloweth horriblie".
 *   - Olfert Dapper, Die Unbekante Neue Welt (1673): cloven hooves, black eyes, a long
 *     straight horn, and "the loneliest wildernesses".
 *   - Welleran Poltarnees' introduction to the anthology lists a goat's beard among the
 *     bizarre traits; Marco Polo's heavy, muddy "unicorn" (almost certainly a rhinoceros:
 *     reception history, not an observation of the mythic animal) informs the stocky build.
 *
 * Player-facing copy quotes the public-domain English editions directly (owner decision,
 * September 2026; see "Quoting old texts" in docs/architecture/cards-and-encounter-effects.md
 * and docs/archive/roadmap/28-unicorn-voice-punch-up.md for the checked passages):
 *   - Pliny, trans. Philemon Holland (1601): "the most fell and furious beast of all other",
 *     "the Licorne or Monoceros", "loweth after an hideous manner".
 *   - Marco Polo, trans. Henry Yule (rev. Cordier): "a passing ugly beast to look upon".
 *   - Topsell (1607): the horn "doth wonderfully help against poisons".
 *   - Deuteronomy 33:17 and Job 39:9 (King James, 1611).
 *   - Spenser, The Faerie Queene II.v.10 (1590): "slips aside", "strikes in the stocke, ne
 *     thence can be releast".
 *   - Bosworth-Toller, án-horn: Old English "ānhorn", a unicorn (the rare witness line).
 * The look-at line has one authority swear to something the unicorn then undoes in front of
 * you; the pools below are who may swear.
 */

const COATS = ['ivory white', 'winter white', 'tawny', 'white with a dark-red head'];

const EYES = ['dark blue', 'black', 'woodland brown'];

const HORNS = ['ringed black', 'white, crimson, and black', 'bright ivory', 'long, straight black'];

// The elephant-footed account is the rare one, so it gets one slot among several.
const BUILDS = [
	'horse-like',
	'horse-like',
	'goat-bearded',
	'goat-bearded',
	'stag-headed',
	'stag-headed',
	'stocky, cloven-hoofed',
	'stocky, cloven-hoofed',
	'elephant-footed',
];

const RETREATS = [
	'a rocky gorge',
	'a laurel grove',
	'an inaccessible mountain',
	'a lonely wilderness',
	'an enclosed garden',
];

const VOICES = ['low as a lowing ox', 'clear as a bell', 'startlingly dissonant'];

// Which detail this monster's "witness" swears to. Only one is shown so `look at` stays
// to three variant clauses (build and coat, horn, witness detail); the others are still
// generated and kept in options for later flavour.
const WITNESS_DETAILS = ['eyes', 'retreat', 'voice', 'horn'];

/*
 * Where you actually found the unicorn, against an authority's lonely wilderness (owner,
 * 2026-10-04: "But just this morning you found them in the garden, eating your roses").
 * The joke is the gap between the grand claim and your own back yard, so a sighting that
 * would agree with the claim (`unless`) is never paired with it.
 */
const SIGHTINGS: { where: string; unless?: string }[] = [
	{ where: 'in your garden, eating your roses', unless: 'an enclosed garden' },
	{ where: 'in your kitchen, eating the bread' },
	{ where: 'at the village well, drinking out of the bucket' },
	{ where: 'in your orchard, knocking down the apples' },
	{ where: 'asleep in your hayloft' },
];

// Who swears to the witness detail, and in what shape. The shape, both authorities, and the
// commoner are all drawn at spawn and kept in options, so `look at` reads the same after a
// restore. Commoners get their own shape: they are never believed, and never wrong.
const AUTHORITIES = ['Pliny', 'Aelian', 'Ctesias', 'Solinus', 'Topsell', 'Marco Polo'];
const COMMONERS = [
	{ who: 'a drunken sailor', pronoun: 'he' },
	{ who: 'a very old woman in the market', pronoun: 'she' },
];
// What you noticed about the horn up close, besides its colour. The owner's example was the
// candy cane; the rest keep the same note of nonsense.
const HORN_ODDITIES = [
	'tasted a little like a candy cane',
	'smelled faintly of toast',
	'whistled a little when the wind blew',
	'had a sparrow nesting near the tip',
];
/*
 * `seen` is the line the owner asked for (roadmap 42 B): one authority makes a claim and the
 * unicorn, in front of you, undoes it. The quarrel is shown rather than reported. It replaced
 * `liar` ("Pliny swears…; Aelian calls Pliny a liar") and `saith`, which only told the reader
 * that two names disagreed. Saved unicorns with either old shape read as `seen`.
 */
const WITNESS_SHAPES = ['seen', 'seen', 'seen', 'commoner'];

// About one look-at in twenty ends with the Old English word for the beast.
const ANHORN_CHANCE = [true, ...Array(19).fill(false)];

const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a');

class Unicorn extends BaseMonster {
	constructor(options: Record<string, unknown> = {}) {
		const defaultOptions = {
			dexModifier: 2,
			strModifier: 1,
			intModifier: -1,
			color: sample(COATS),
			eyes: sample(EYES),
			horn: sample(HORNS),
			build: sample(BUILDS),
			retreat: sample(RETREATS),
			voice: sample(VOICES),
			witness: sample(WITNESS_DETAILS),
			anhorn: sample(ANHORN_CHANCE),
			icon: '🦄',
			// How the witness line is told is drawn only for a new unicorn. A saved one that
			// already has its witness detail but predates these keys must not redraw them on
			// every restore (hydrateMonster spreads saved options into this constructor), or
			// its description would change between looks. It reads the getters' fixed
			// fallbacks instead.
			...(options.witness === undefined ? {
				witnessShape: sample(WITNESS_SHAPES),
				swearer: sample(AUTHORITIES),
				commoner: sample(COMMONERS.map(({ who }) => who)),
				// One stored number fixes what you saw and how it is told.
				sightingRoll: Math.random(),
			} : {}),
		};

		super(Object.assign(defaultOptions, options));
	}

	get color(): string {
		return this.options.color as string;
	}

	get eyes(): string {
		return this.options.eyes as string;
	}

	get horn(): string {
		return this.options.horn as string;
	}

	get build(): string {
		return this.options.build as string;
	}

	get retreat(): string {
		return this.options.retreat as string;
	}

	get voice(): string {
		return this.options.voice as string;
	}

	get witness(): string {
		return this.options.witness as string;
	}

	get witnessShape(): string {
		return (this.options.witnessShape as string) ?? 'seen';
	}

	get swearer(): string {
		return (this.options.swearer as string) ?? AUTHORITIES[0];
	}

	get commoner(): { who: string; pronoun: string } {
		return COMMONERS.find(({ who }) => who === this.options.commoner) ?? COMMONERS[0];
	}

	/** In [0, 1). Unicorns saved before it existed get 0, so their line is stable too. */
	get sightingRoll(): number {
		const roll = Number(this.options.sightingRoll);
		return Number.isFinite(roll) && roll >= 0 && roll < 1 ? roll : 0;
	}

	/** Picks from a list with the stored roll; `salt` lets two picks differ. */
	private pick<T>(list: readonly T[], salt = 0): T {
		const roll = (this.sightingRoll * (1 + salt * 7)) % 1;
		return list[Math.floor(roll * list.length) % list.length];
	}

	/** A value from `pool` that is never the claimed one. */
	private other(pool: readonly string[], claimed: string, salt = 0): string {
		const rest = pool.filter(value => value !== claimed);
		return this.pick(rest.length > 0 ? rest : pool, salt);
	}

	get witnessLine(): string {
		if (this.witnessShape === 'commoner') {
			const { who, pronoun } = this.commoner;
			return `${capitalize(who)} swears that ${this.witnessDetail}. ${capitalize(pronoun)} is not believed, but ${pronoun} is not wrong.`;
		}
		return this.seenLine;
	}

	/** An authority's claim, then what the unicorn does in front of you. */
	get seenLine(): string {
		const p = this.pronouns;
		const He = capitalize(p.he);
		const who = this.swearer;
		switch (this.witness) {
			case 'voice': {
				const heard = this.other(VOICES, this.voice);
				return this.pick([
					`${who} says ${p.his} voice is ${this.voice}. But just this morning ${p.he} called across the yard, ${heard}.`,
					`${who} wrote that ${p.his} voice is ${this.voice}. ${He} ${agree(p, 'hums', 'hum')} at dusk, ${heard}, and the dogs leave the room.`,
				], 1);
			}
			case 'retreat': {
				const sightings = SIGHTINGS.filter(({ unless }) => unless !== this.retreat);
				const { where } = this.pick(sightings, 2);
				return `${who} says ${p.he} ${agree(p, 'keeps', 'keep')} to ${this.retreat}. But just this morning you found ${p.him} ${where}.`;
			}
			case 'horn': {
				const claimed = this.other(HORNS, this.horn);
				// A bit of nonsense keeps the line from reading dry (owner, 2026-10-04).
				const oddly = this.pick(HORN_ODDITIES, 2);
				return `${who} swears ${p.his} horn is ${claimed}. You have seen ${p.his} horn up close: ${this.horn}, and ${oddly}.`;
			}
			default: {
				const seen = this.other(EYES, this.eyes);
				return this.pick([
					`${who} says ${p.his} eyes are ${this.eyes}. But ${p.he} ${agree(p, 'blinks', 'blink')} slowly, and you would swear they are ${seen}.`,
					`${who} wrote that ${p.his} eyes are ${this.eyes}. ${He} ${agree(p, 'turns', 'turn')} to look at you, and ${p.his} eyes are ${seen}.`,
				], 1);
			}
		}
	}

	/** What the commoner swears to: always the truth, which is the joke. */
	get witnessDetail(): string {
		const { pronouns } = this;
		switch (this.witness) {
			case 'retreat':
				return `${pronouns.he} ${agree(pronouns, 'keeps', 'keep')} to ${this.retreat}`;
			case 'voice':
				return `${pronouns.his} voice is ${this.voice}`;
			// No horn case: the description already names the horn, so a commoner who is "not
			// wrong" about it says nothing new. A horn witness falls back to the eyes.
			default:
				return `${pronouns.his} eyes are ${this.eyes}`;
		}
	}

	get description(): string {
		// The coat gets a sentence of its own: player-chosen colours often carry their own
		// "with" (the spawn prompt's own example is "ivory white with a dark-red head"), and
		// "with a coat of … with a … and a … horn" read badly in a live check.
		const anhorn = this.options.anhorn
			? ` The oldest English called ${this.pronouns.him} ānhorn, and did not argue about ${this.pronouns.his} feet.`
			: '';
		return `${article(this.build)} ${this.build} unicorn bearing ${article(this.horn)} ${this.horn} horn. ${capitalize(this.pronouns.his)} coat is ${this.color}. ${this.witnessLine}${anhorn}`;
	}
}

Unicorn.creatureType = UNICORN;
// Cleric because the existing class vocabulary already grants healing and antidotal cards.
// Deliberately not a new one-off class; see the Unicorn decision note in
// docs/archive/roadmap/26-unicorn-pack.md.
Unicorn.class = CLERIC;
// Swift and hard to pin down, but not tougher than the roster: AC ties the best existing
// spawn offset (Basilisk, Jinn) rather than exceeding it, and HP sits one below the roster
// midpoint (Basilisk's +2). Modifier budget matches every other monster (+2 total).
(Unicorn as any).acVariance = 2;
(Unicorn as any).hpVariance = 1;
(Unicorn as any).description = `
Of all beasts, the most fell and furious. So says Pliny, and Pliny had never met this one. Philemon Holland, Englishing him in 1601, gives "the Licorne or Monoceros" a horse's body, a stag's head, an elephant's feet, a boar's tail, one black horn two cubits long, and a voice that "loweth after an hideous manner." Ctesias saw a white body, a dark-red head, and a horn banded white, black, and crimson. Marco Polo met one wallowing in mud and called it "a passing ugly beast to look upon," nothing like the one the stories catch in a maiden's lap. No two witnesses agree, and each calls the last a liar.

The horn is the heart of every tale. Topsell swore that the horn "doth wonderfully help against poisons"; the King James Bible says that with such horns "he shall push the people together to the ends of the earth." In the ring both tales hold. But heed Spenser: the wise foe "slips aside," and the furious beast's horn "strikes in the stocke, ne thence can be releast."

"Will the unicorn be willing to serve thee, or abide by thy crib?" Not by any art of man. A unicorn who fights beside a Beastmaster has chosen to. And if thou seest one kneel to rest in the gloaming, beware: the books of yore say that is how the hunters take it.
`;

export { Unicorn };
export default Unicorn;
