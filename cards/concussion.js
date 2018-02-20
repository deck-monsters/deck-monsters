/* eslint-disable max-len */
const random = require('lodash.random');

const CurseCard = require('./curse');

const { BARBARIAN, FIGHTER } = require('../constants/creature-classes');
const { MELEE } = require('../constants/card-classes');
const { REASONABLE } = require('../helpers/costs');

class ConcussionCard extends CurseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🥊',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get curseAmount () {
		return random(-1, this.options.curseAmount);
	}

	get curseDescription () {
		return `Curse: ${this.cursedProp} -1${this.options.curseAmount} depending on how hard the hit is`;
	}
}

ConcussionCard.cardClass = [MELEE];
ConcussionCard.cardType = 'Concussion';
ConcussionCard.permittedClassesAndTypes = [BARBARIAN, FIGHTER];
ConcussionCard.description = 'A hard blow to the head should do the trick.';
ConcussionCard.cost = REASONABLE.cost;

ConcussionCard.defaults = {
	...CurseCard.defaults,
	curseAmount: -2,
	cursedProp: 'int'
};

module.exports = ConcussionCard;
