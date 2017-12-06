const BoostCard = require('./boost');

const { FIGHTER } = require('../helpers/classes');

class BasicShieldCard extends BoostCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		boostAmount,
		icon = '🛡',
		...rest
	} = {}) {
		super({ boostAmount, icon, ...rest });

		this.defaults = {
			...this.defaults,
			boostAmount: 2
		};
	}
}

BasicShieldCard.cardType = 'Basic Shield';
BasicShieldCard.description = 'Equip yourself for the battle ahead.';
BasicShieldCard.level = 2;
BasicShieldCard.permittedClasses = [FIGHTER];

module.exports = BasicShieldCard;
