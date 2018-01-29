const BoostCard = require('./boost');

const { BARD, CLERIC } = require('../helpers/classes');
const { PRICEY } = require('../helpers/costs');

class FelineCompanionCard extends BoostCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🐈',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
}

FelineCompanionCard.cardType = 'Feline Companion';
FelineCompanionCard.permittedClassesAndTypes = [BARD, CLERIC];
FelineCompanionCard.description = 'A low purr in your ears helps you focus your energy.';
FelineCompanionCard.level = 2;
FelineCompanionCard.cost = PRICEY.cost;
FelineCompanionCard.notForSale = true;

FelineCompanionCard.defaults = {
	...BoostCard.defaults,
	boostAmount: 2,
	boostedProp: 'int'
};

module.exports = FelineCompanionCard;
