import { sample } from '../helpers/random.js';
import { agree } from '../helpers/pronouns.js';
import { capitalize } from '../helpers/capitalize.js';
import { WIZARD } from '../constants/creature-classes.js';
import { DRAGON } from '../constants/creature-types.js';
import BaseMonster from './base.js';

/*
 * The Dragon was asked for by the owner's eight-year-old son, whose favourite dragons are
 * sleek ones (a flat head, a long body, aerodynamic wings), sea dragons, and dragons whose
 * colour follows their mood. The research and decisions are in
 * docs/roadmap/29-dragon-research.md and docs/roadmap/30-dragon-pack.md. The shape is our
 * own: no book or film dragon's name, species, design, or words.
 *
 * Sources, quoted for atmosphere (the owner's rule: see "Quoting old texts" in
 * docs/architecture/cards-and-encounter-effects.md):
 *   - Job 41:19-21 and 41:31 (1611 King James Bible), Leviathan: "Out of his mouth go
 *     burning lamps, and sparks of fire leap out", "he maketh the deep to boil like a pot".
 *     A sea dragon that breathes fire, so the sea and fire strands are one beast here.
 *   - Isaiah 27:1 ("the dragon that is in the sea") and 30:6 ("the fiery flying serpent").
 *   - Pliny, Natural History book 8, on the chameleon, whose colour follows what it is near
 *     (Holland's 1601 English), for the mood scales.
 *   - Topsell, The Historie of Serpents (1608), gives dragons wings and puts their strength
 *     in the tail.
 *   - Beowulf, in Gummere's 1910 English: the fire-drake that woke because one cup was
 *     taken from its hoard.
 *   - The Viking prow and the Roman draco standard, a cloth dragon that howled in the wind,
 *     for the setting the requester knows from his books.
 * The `look at` profile is an original joke on the stat lines of dragon trading cards, with
 * our own categories (29, "Appearance, profile, and voice leads").
 */

const HEADS = ['flat-headed', 'wedge-headed', 'crested'];

const BODIES = ['long and sleek', 'whip-thin', 'as long as a sea serpent'];

const WINGS = ['swept-back', 'bat-webbed', 'fin-edged'];

const HOMES = ['a sea cave', 'the storm cliffs', 'a smoking mountain', 'the cold deep'];

// Default scale colours when the spawn prompt is skipped: sea and fire.
const SCALES = ['deep-sea blue', 'storm grey', 'ember red', 'kelp green'];

// One rating per line of the `look at` profile, drawn at spawn and kept in options.
const HOARD_PATIENCE = ['counts the hoard twice a day', 'will notice one cup missing', 'none whatsoever', 'sleeps on the hoard, lightly'];
const SMOKE_CONTROL = ['excellent', 'mostly', 'sneezes sparks', 'do not stand downwind'];
const ROMAN_OPINION = ['low', 'very low', 'has eaten a standard', 'politely suspicious'];
const TABLE_MANNERS = ['eats the plate too', 'cooks everything first', 'surprisingly good', 'chews with mouth open, and on fire'];

const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a');

class Dragon extends BaseMonster {
	constructor(options: Record<string, unknown> = {}) {
		const defaultOptions = {
			dexModifier: 2,
			strModifier: -1,
			intModifier: 1,
			color: sample(SCALES),
			head: sample(HEADS),
			body: sample(BODIES),
			wings: sample(WINGS),
			home: sample(HOMES),
			hoardPatience: sample(HOARD_PATIENCE),
			smokeControl: sample(SMOKE_CONTROL),
			romanOpinion: sample(ROMAN_OPINION),
			tableManners: sample(TABLE_MANNERS),
			icon: '🐉',
		};

		super(Object.assign(defaultOptions, options));
	}

	get color(): string {
		return this.options.color as string;
	}

	get head(): string {
		return this.options.head as string;
	}

	get body(): string {
		return this.options.body as string;
	}

	get wings(): string {
		return this.options.wings as string;
	}

	get home(): string {
		return this.options.home as string;
	}

	/** The rated profile, read aloud as one line. */
	get profile(): string {
		const { hoardPatience, smokeControl, romanOpinion, tableManners } = this.options as Record<string, string>;
		return `Hoard patience: ${hoardPatience}. Smoke control: ${smokeControl}. Opinion of Romans: ${romanOpinion}. Table manners: ${tableManners}.`;
	}

	get description(): string {
		const { pronouns } = this;
		// The scales get a sentence of their own, as the Unicorn's coat does: a player-chosen
		// colour can carry its own "with".
		return `${article(this.head)} ${this.head} dragon, ${this.body}, with ${this.wings} wings. ${capitalize(pronouns.his)} scales are ${this.color}, and ${pronouns.he} ${agree(pronouns, 'keeps', 'keep')} to ${this.home}. ${this.profile}`;
	}
}

Dragon.creatureType = DRAGON;
// The first Wizard: a caster that starts fragile and grows strong, the small dragon that
// becomes a terror. Owner decision, 2026-09-27 (docs/roadmap/30-dragon-pack.md).
Dragon.class = WIZARD;
// The quick, clever flier (DEX +2, INT +1) with the Basilisk keeping strength; the same +2
// budget as every monster. Scales give one point of AC, and a caster's body sits at the
// roster midpoint for HP.
(Dragon as any).acVariance = 1;
(Dragon as any).hpVariance = 2;
(Dragon as any).description = `
"Out of his mouth go burning lamps, and sparks of fire leap out. Out of his nostrils goeth smoke, as out of a seething pot." So the Book of Job describes Leviathan, and Leviathan is a sea dragon: "he maketh the deep to boil like a pot." Isaiah knew "the dragon that is in the sea," and, over the dry south, "the fiery flying serpent." The dragon of the ring is all of these at once. It hatches in the cold deep, small enough to carry in two hands, and grows, if it lives, into a flame with wings.

Dragons are clever, vain, and fast. They talk, and they will tell you so. Their scales keep their mood, as Pliny says the chameleon takes the colour of whatever it is near: calm, and a dragon fades into rock and sea; angry, and it burns red and cannot hide. Topsell, writing of serpents in 1608, puts a dragon's strength in its tail. Topsell never stood in front of its mouth.

Vikings carved dragons on their prows. Romans marched behind a dragon of cloth that howled when the wind filled it. Neither ever tamed a real one. A dragon who fights beside a Beastmaster has decided to, and it counts its hoard every night: in Beowulf, a thief took one cup from a sleeping dragon's hoard, and the old king died of it.
`;

export { Dragon };
export default Dragon;
