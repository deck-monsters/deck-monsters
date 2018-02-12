/* eslint-disable max-len */

const BerserkCard = require('./berserk');

const { GLADIATOR } = require('../constants/creature-types');
const { EPIC } = require('../helpers/probabilities');
const { EXPENSIVE } = require('../helpers/costs');

class BattleFocusCard extends BerserkCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		bigFirstHit,
		damage,
		damageDice,
		icon = '🥋',
		...rest
	} = {}) {
		super({ bigFirstHit, damage, damageDice, icon, ...rest });
	}
}

BattleFocusCard.cardType = 'Battle Focus';
BattleFocusCard.permittedClassesAndTypes = [GLADIATOR];
BattleFocusCard.probability = EPIC.probability;
BattleFocusCard.description = 'Years of training, drill after drill, kick in. An attack is not a single hit, but a series of strikes each leading to another. Time seems to disappear and for a brief moment you and your adversary become perfectly in sync as you lead in a dance of their destruction.';
BattleFocusCard.level = 0;
BattleFocusCard.cost = EXPENSIVE.cost;
BattleFocusCard.notForSale = true;

BattleFocusCard.defaults = {
	...BerserkCard.defaults,
	damageDice: '1d6',
	bigFirstHit: true
};


module.exports = BattleFocusCard;
