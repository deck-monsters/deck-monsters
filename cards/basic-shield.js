const BoostCard = require('./boost');

const { FIGHTER } = require('../helpers/classes');

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
BasicShieldCard.permittedClassesAndTypes = [FIGHTER];
BasicShieldCard.description = 'Equip yourself for the battle ahead.';
BasicShieldCard.level = 2;
BasicShieldCard.cost = 30;

BasicShieldCard.defaults = {
	...BoostCard.defaults,
	boostAmount: 2
};

module.exports = BasicShieldCard;
