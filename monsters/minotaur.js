/* eslint-disable max-len */

const random = require('lodash.sample');

const BaseMonster = require('./base');
const { BARBARIAN } = require('../helpers/classes');

const DEFAULT_COLOR = 'angry red';
const DEFAULT_NAME = 'Taurus';

const PATTERNS = [
	'crescent',
	'mind-blowingly intricate',
	'bold'
];

const DESCRIPTORS = [
	'tremendous',
	'awe-inspiring',
	'fearsome'
];

class Minotaur extends BaseMonster {
	constructor (options) {
		const defaultOptions = {
			color: DEFAULT_COLOR,
			name: DEFAULT_NAME,
			pattern: random(PATTERNS),
			descriptor: random(DESCRIPTORS),
			icon: '🐗'
		};

		super(Object.assign(defaultOptions, options));
	}

	get color () {
		return this.options.color;
	}

	get pattern () {
		return this.options.pattern;
	}

	get descriptor () {
		return this.options.descriptor;
	}

	get description () {
		return `a battle-hardened, ${this.color} minotaur with a ${this.pattern} pattern shaved into ${this.pronouns[2]} thick fur. Make no mistake, despite ${this.pronouns[2]} ${this.descriptor} bulk ${this.pronouns[0]} is a first-class host who has never been put to shame at a dinner party.`;
	}
}

Minotaur.creatureType = 'Minotaur';
Minotaur.class = BARBARIAN;
Minotaur.description =
`
The bull-folk have many of the same characteristics as the bulls they resemble. Both genders have horned heads covered with shaggy hair. Warriors braid their hair with teeth or other tokens of fallen enemies. The thick hair covering their large bodies varies widely in color, from bright white to medium red-browns to dark brown and black. Many minotaurs shave or dye their fur in patterns signifying their allegiances and beliefs. Other methods of decoration include brands, ritual scars, and gilding or carving their horns.

Adult males can reach a height of 6 ½ – 7 feet, with females averaging 3 inches shorter. Both genders have a great deal of muscle mass even for their considerable size, and physical prowess plays a large part in their social structure. Minotaurs can live as long as humans but reach adulthood 3 years earlier. Childhood ends around the age of 10 and adulthood is celebrated at 15. However, most minotaurs don’t form their own families until at least the age of 25. They spend those 10 years proving themselves to their elders.

Minotaurs are omnivores and consume large quantities of both meat and vegetation. Great banquets mark important social and religious occasions, and a successful feast is often a point of regional pride; competition between regional cuisines is fierce, sometimes violent, and eagerly anticipated. The minotaurs are particularly mindful of meals before great ceremonies or displays of skill, and the hosts of such events can earn nearly as much honor as the champions by providing memorable feasts. To fail as a host brings deep shame.
`;

module.exports = Minotaur;
