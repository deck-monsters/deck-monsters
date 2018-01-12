/* eslint-disable max-len */

const sample = require('lodash.sample');

const BaseMonster = require('./base');

const { BARBARIAN } = require('../helpers/classes');
const { BASILISK } = require('../helpers/creature-types');

const DEFAULT_COLOR = 'tan';

const SIZES = [
	{ adjective: 'slender', weight: '240lbs' },
	{ adjective: 'powerful', weight: '300lbs' },
	{ adjective: 'stocky', weight: '320lbs' },
	{ adjective: 'massive', weight: 'over 400lbs' }
];

const LOCATIONS = [
	'forest',
	'desert',
	'cave'
];

class Basilisk extends BaseMonster {
	constructor (options) {
		const defaultOptions = {
			dexModifier: -1,
			strModifier: 2,
			intModifier: 1,
			color: DEFAULT_COLOR,
			location: sample(LOCATIONS),
			size: sample(SIZES),
			icon: '🐍'
		};

		super(Object.assign(defaultOptions, options));
	}

	get size () {
		return this.options.size;
	}

	get color () {
		return this.options.color;
	}

	get location () {
		return this.options.location;
	}

	get description () {
		return `a ${this.size.adjective}, ${this.color}, ${this.location}-dwelling basilisk with a nasty disposition and the ability to turn creatures to stone with ${this.pronouns[2]} gaze. In the forest ${this.pronouns[0]} is king and (weighing ${this.size.weight}) in the ring ${this.pronouns[0]} is much to be feared. See how ${this.pronouns[0]} rears ${this.pronouns[2]} head, and rolls about ${this.pronouns[2]} dreadful eyes, to drive all virtue out, or look it dead!`;
	}
}

Basilisk.creatureType = BASILISK;
Basilisk.class = BARBARIAN;
Basilisk.acVariance = 2;
Basilisk.description =
`
The basilisk, often called the “King of Serpents,” is in fact not a serpent at all, but rather an eight-legged reptile with a nasty disposition and the ability to turn creatures to stone with its gaze. Folklore holds that, much like the cockatrice, the first basilisks hatched from eggs laid by snakes and incubated by roosters, but little in the basilisk’s physiology lends any credence to this claim.

Basilisks live in nearly any terrestrial environment, from forest to desert, and their hides tend to match and reflect their surroundings—a desert-dwelling basilisk might be tan or brown, while one that lives in a forest could be bright green. They tend to make their lairs in caves, burrows, or other sheltered areas, and these dens are often marked by statues of people and animals in lifelike poses—the petrified remains of those unfortunate enough to stumble across the basilisk.

Basilisks have the ability to consume the creatures they petrify, their churning stomach acid dissolving and extracting nutrients from the stone, but the process is slow and inefficient, making them lazy and sluggish. As a result, basilisks rarely stalk prey or chase those who avoid their gaze, counting on their stealth and the element of surprise to keep them safe and fed. When not lying in wait for the small mammals, birds, and reptiles that normally make up their diet, basilisks spend their time sleeping in their lairs, and those brave enough to capture basilisks or hide treasure near them find that they make natural guardians and watchdogs.

An adult basilisk is 13 feet long, with fully half of that made up by its long tail, and weighs 300 pounds. Some breeds have short, curved horns on their noses or small crests of bony growths topping their heads like crowns. Though normally solitary creatures, coming together only to mate and lay eggs, in particularly dangerous areas small groups may band together for protection and attack intruders en masse.
`;

module.exports = Basilisk;
