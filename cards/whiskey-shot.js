const HealCard = require('./heal');

class WhiskeyShotCard extends HealCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		healthDice,
		icon = '🥃',
		...rest
	} = {}) {
		super({ healthDice, icon, ...rest });

		this.defaults = {
			...this.defaults,
			healthDice: '1d8'
		};
	}
}

WhiskeyShotCard.cardType = 'Whiskey Shot';
WhiskeyShotCard.description = '1 shot of whiskey for your health. Doctor\'s orders.';
WhiskeyShotCard.level = 2;

module.exports = WhiskeyShotCard;
