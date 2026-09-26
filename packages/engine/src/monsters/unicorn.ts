import { sample } from '../helpers/random.js';
import { agree } from '../helpers/pronouns.js';
import { CLERIC } from '../constants/creature-classes.js';
import { UNICORN } from '../constants/creature-types.js';
import BaseMonster from './base.js';

/*
 * The Unicorn is assembled from contradictory reports on purpose, so each spawn reads as
 * one witness's account rather than a canonical anatomy. Sources behind the variants, all
 * checked against the anthology A Book of Unicorns (Green Tiger Press); paraphrased here,
 * and see docs/roadmap/12-new-content-backlog.md for the research brief:
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
 * Player-facing copy below is original prose; no source is quoted beyond these comments.
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
const WITNESS_DETAILS = ['eyes', 'retreat', 'voice'];

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
			icon: '🦄',
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

	get witnessDetail(): string {
		const { pronouns } = this;
		switch (this.witness) {
			case 'retreat':
				return `${pronouns.he} ${agree(pronouns, 'keeps', 'keep')} to ${this.retreat}`;
			case 'voice':
				return `${pronouns.his} voice is ${this.voice}`;
			default:
				return `${pronouns.his} eyes are ${this.eyes}`;
		}
	}

	get description(): string {
		return `${article(this.build)} ${this.build} unicorn with a coat of ${this.color} and ${article(this.horn)} ${this.horn} horn. One witness swears that ${this.witnessDetail}; the next account will disagree.`;
	}
}

Unicorn.creatureType = UNICORN;
// Cleric because the existing class vocabulary already grants healing and antidotal cards.
// Deliberately not a new one-off class; see the Unicorn decision note in
// docs/roadmap/12-new-content-backlog.md.
Unicorn.class = CLERIC;
// Swift and hard to pin down, but not tougher than the roster: AC ties the best existing
// spawn offset (Basilisk, Jinn) rather than exceeding it, and HP sits one below the roster
// midpoint (Basilisk's +2). Modifier budget matches every other monster (+2 total).
(Unicorn as any).acVariance = 2;
(Unicorn as any).hpVariance = 1;
(Unicorn as any).description = `
No two accounts of the unicorn agree. Ancient travellers described a wild creature of distant lands, white in body and dark red about the head, swifter than any horse, with a single horn banded white, crimson, and black. Other ancient writers gave them a stag's head, a boar's tail, even an elephant's feet, and later ones a goat's beard and cloven hooves. What survives every retelling is the silhouette: a pale, horse-shaped animal with one horn, glimpsed at a distance and gone before anyone gets closer.

The horn is at the heart of every story. Some tellers say that whoever drinks from a cup carved from it is safe from poison; others describe a weapon long and sharp enough to run a foe straight through. In the ring both stories hold. A unicorn's charge is terrible, but a patient opponent who steps aside at the last instant can leave that horn stuck fast in the timber.

Unicorns keep to deserted places. They are gentle with most creatures, yet they are said to fight their own kind, and they cannot be taken and held against their will. A unicorn who fights beside a Beastmaster has chosen to, and one who trusts a companion may kneel to rest in the evening light, which is the closest anyone ever gets.
`;

export { Unicorn };
export default Unicorn;
