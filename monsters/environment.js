/* eslint-disable max-len */

const sample = require('lodash.sample');

const BaseMonster = require('./base');

const DEFAULT_COLOR = 'stony green';

const PATTERNS = [
	'hill covered',
	'swamp ridden',
	'flat and featureless'
];

const DESCRIPTORS = [
	'terrifying',
	'cold',
	'stark',
	'barren'
];

class Environment extends BaseMonster {
	constructor (options) {
		const defaultOptions = {
			damageModifier: 0,
			color: DEFAULT_COLOR,
			pattern: sample(PATTERNS),
			descriptor: sample(DESCRIPTORS),
			icon: '🌎'
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
		return `before you is a ${this.color} ${this.pattern} landscape. As ${this.descriptor} as it is beckoning. What you most need is where you most fear to go.`;
	}
}

Environment.creatureType = 'The World';
Environment.class = 'wilderness';
Environment.acVariance = 0;
Environment.hpVariance = 0;
Environment.description =
`
The world. In all its terror and beauty.
`;

module.exports = Environment;
