/* eslint-disable max-len */

const random = require('lodash.sample');

const BaseMonster = require('./base');
const { FIGHTER } = require('../helpers/classes');

const DEFAULT_COLOR = 'leather';
const DEFAULT_NAME = 'Maximus';

const SIZES = [
	{ adjective: 'nimble', height: 'just over 5 feet' },
	{ adjective: 'powerful', height: 'a towering 6 feet' },
	{ adjective: 'stocky', height: 'a portly five and a half feet' },
	{ adjective: 'gigantic', height: 'well over 8 feet' }
];

const LOCATIONS = [
	'the Roman colosseum',
	'a dusty rural arena',
	'an underground fight club'
];

class Gladiator extends BaseMonster {
	constructor (options) {
		const defaultOptions = {
			attackModifier: 1,
			damageModifier: 1,
			color: DEFAULT_COLOR,
			location: random(LOCATIONS),
			name: DEFAULT_NAME,
			size: random(SIZES),
			icon: '💪'
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
		return `a ${this.size.adjective} gladiator, dressed in ${this.color} and hailing from ${this.location}. Many years ago ${this.pronouns[0]} was captured, stripped of ${this.pronouns[2]} title and land, and forced to compete in brutal matches for the entertainment of a blood-thirsty crowd. Standing ${this.size.height} tall, when you see ${this.pronouns[1]} you know instantly that this is a warrior who has winessed the worst humankind has to offer and has overcome.`;
	}
}

Gladiator.creatureType = 'Gladiator';
Gladiator.class = FIGHTER;
Gladiator.description =
`
The gladiator is a professional duelist. Many are born slaves and reared in gladiatorial schools, until such time as they earn their freedom in battle, escape, or rebel. Some join dueling academies voluntarily, seeking fame or fortune in prize fights and honor matches. Some gladiators began as warriors from faroff lands, captured in battle and forced to fight to the death, while others are condemned criminals, paying their debt to society by participating in ritual combat for the public. Whatever their station or background, the gladiator has been hardened by combat and has learned to anticipate a wily foe. While gladiatorial matches often follow a prescribed, even ritual format, the gladiator must always be ready for the possibility that they will be thrown into a situation with unusual weapons, conditions, or opponents. Some arena fighters specialize in fighting exotic animals and monsters.
`;

module.exports = Gladiator;
