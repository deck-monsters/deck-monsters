const BoostCard = require('./boost');

const { BARD, FIGHTER } = require('../constants/creature-classes');
const { REASONABLE } = require('../helpers/costs');

class BasicShieldCard extends BoostCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🛡',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
}

BasicShieldCard.cardType = 'Basic Shield';
BasicShieldCard.permittedClassesAndTypes = [BARD, FIGHTER];
BasicShieldCard.description = 'Equip yourself for the battle ahead.';
BasicShieldCard.level = 2;
BasicShieldCard.cost = REASONABLE.cost;

BasicShieldCard.defaults = {
	...BoostCard.defaults,
	boostAmount: 2
};

module.exports = BasicShieldCard;
