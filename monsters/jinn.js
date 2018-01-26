/* eslint-disable max-len */

const sample = require('lodash.sample');

const BaseMonster = require('./base');

const { BARD } = require('../helpers/classes');
const { JINN } = require('../helpers/creature-types');

const DEFAULT_COLOR = 'fiery red';

const ANIMALS = [
	'black dog',
	'coyote',
	'goat',
	'crow',
	'lamp'
];

const DESCRIPTORS = [
	'lurks',
	'sulks',
	'tip-toes',
	'hides'
];

class Jinn extends BaseMonster {
	constructor (options) {
		const defaultOptions = {
			dexModifier: 1,
			strModifier: 0,
			intModifier: 1,
			color: DEFAULT_COLOR,
			animal: sample(ANIMALS),
			descriptor: sample(DESCRIPTORS),
			icon: '🕌'
		};

		super(Object.assign(defaultOptions, options));
	}

	get color () {
		return this.options.color;
	}

	get animal () {
		return this.options.animal;
	}

	get descriptor () {
		return this.options.descriptor;
	}

	get description () {
		return `a ${this.color} figure ${this.descriptor} in the dusty shadows at the corner of your vision. At first you think it might be human and you wonder who or what ${this.pronouns.he} is. What is ${this.pronouns.he} about? When you turn to look closer all you see is a ${this.animal} and a gently settling cloud of sand.`;
	}
}

Jinn.creatureType = JINN;
Jinn.class = BARD;
Jinn.acVariance = 2;
Jinn.hpVariance = 0;
Jinn.description =
`
Jinn are not purely spiritual, but also physical in nature, being able to interact in a tactile manner with people and objects and also subject to bodily desires like eating and sleeping. Generally jinn lack individuality and are thought to appear in mists or standstorms, but when they materialize in different forms they may gain individuality. Individual jinn are commonly depicted as monstrous and anthropomorphized creatures with body parts from different animals or human with animalic traits. Their speed, cunning, and amorphous nature makes them difficult to catch a glimpse of against their will.
`;

module.exports = Jinn;
