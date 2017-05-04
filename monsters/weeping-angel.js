/* eslint-disable max-len */

const random = require('lodash.sample');

const BaseMonster = require('./base');

const DEFAULT_COLOR = 'stone gray';
const DEFAULT_NAME = 'Aziraphale';

const NATIONALITIES = [
	'English',
	'Welsh',
	'Scottish'
];

const DESCRIPTORS = [
	'frutier',
	'nuttier'
];

class WeepingAngel extends BaseMonster {
	constructor (options) {
		const defaultOptions = {
			accuracyModifier: '+3',
			damageModifier: '-1',
			color: DEFAULT_COLOR,
			name: DEFAULT_NAME,
			nationality: random(NATIONALITIES),
			descriptor: random(DESCRIPTORS)
		};

		super(Object.assign(defaultOptions, options));

		this.options = {
			description: `a ${this.color} weeping angel. On meeting ${this.pronouns[1]}, one might form the following three impressions: that ${this.pronouns[0]} was ${this.nationality}, that ${this.pronouns[0]} was intelligent, and that ${this.pronouns[0]} was ${this.descriptor} than a treeful of monkeys on nitrous oxide.`
		};
	}

	static get creatureType () {
		return 'Basilisk';
	}

	get color () {
		return this.options.color;
	}

	get nationality () {
		return this.options.nationality;
	}

	get descriptor () {
		return this.options.descriptor;
	}
}

WeepingAngel.description =
`
The Weeping Angels are an extremely powerful species of quantum-locked humanoids (sufficient observation changes the thing being observed), so called because their unique nature necessitates that they often cover their faces with their hands to prevent trapping each other in petrified form for eternity by looking at one another. This gives the Weeping Angels their distinct "weeping" appearance. They are known for being "kind" murderous psychopaths, eradicating their victims "mercifully" by dropping them into the past and letting them live out their full lives, just in a different time period. This, in turn, allows them to live off the remaining time energy of the victim's life. However, when this potential energy pales in comparison to an alternative power source to feed on, the Angels are sometimes known to kill by other means, such as snapping their victims' necks.
`;

module.exports = WeepingAngel;
