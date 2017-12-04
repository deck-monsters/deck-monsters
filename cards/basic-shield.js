const BoostCard = require('./boost');

const { FIGHTER } = require('../helpers/classes');

class BasicShieldCard extends BoostCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		boostAmount = 2,
		icon = '🛡',
		...rest
	} = {}) {
		super({ boostAmount, icon, ...rest });
	}
}

BasicShieldCard.cardType = 'Basic Shield';
BasicShieldCard.description = 'Equip yourself for the battle ahead.';
BasicShieldCard.level = 2;
BasicShieldCard.permittedClasses = [FIGHTER];

module.exports = BasicShieldCard;
