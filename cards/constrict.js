/* eslint-disable max-len */

const CoilCard = require('./coil');

const { VERY_RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class ConstrictCard extends CoilCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '➰➰',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
}

ConstrictCard.cardType = 'Constrict';
ConstrictCard.actions = { IMMOBILIZE: 'constrict', IMMOBILIZES: 'constricts', IMMOBILIZED: 'constricted' };
ConstrictCard.probability = VERY_RARE.probability;
ConstrictCard.level = 1;
ConstrictCard.cost = PRICEY.cost;
ConstrictCard.notForSale = false;

ConstrictCard.defaults = {
	...CoilCard.defaults,
	ongoingDamage: 2,
	freedomThresholdModifier: 3
};

module.exports = ConstrictCard;
