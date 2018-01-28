/* eslint-disable max-len */

const CoilCard = require('./coil');

const { VERY_RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class ConstrictCard extends CoilCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		actions,
		icon = '➰➰',
		...rest
	} = {}) {
		super({ actions, icon, ...rest });
	}
}

ConstrictCard.cardType = 'Constrict';
ConstrictCard.probability = VERY_RARE.probability;
ConstrictCard.level = 1;
ConstrictCard.cost = PRICEY.cost;
ConstrictCard.notForSale = false;

ConstrictCard.defaults = {
	...CoilCard.defaults,
	ongoingDamage: 2,
	freedomThresholdModifier: 3,
	actions: { IMMOBILIZE: 'constrict', IMMOBILIZES: 'constricts', IMMOBILIZED: 'constricted' }
};

module.exports = ConstrictCard;
