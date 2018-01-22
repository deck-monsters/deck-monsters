const HealCard = require('./heal');

const { REASONABLE } = require('../helpers/costs');

class WhiskeyShotCard extends HealCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		healthDice,
		icon = '🥃',
		...rest
	} = {}) {
		super({ healthDice, icon, ...rest });
	}
}

WhiskeyShotCard.cardType = 'Whiskey Shot';
WhiskeyShotCard.description = '1 shot of whiskey for your health. Doctor\'s orders.';
WhiskeyShotCard.level = 2;
WhiskeyShotCard.cost = REASONABLE.cost;

WhiskeyShotCard.defaults = {
	...HealCard.defaults,
	healthDice: '1d8'
};

module.exports = WhiskeyShotCard;
