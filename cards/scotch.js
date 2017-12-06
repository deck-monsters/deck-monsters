const WhiskeyShotCard = require('./whiskey-shot');

class ScotchCard extends WhiskeyShotCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		healthDice,
		...rest
	} = {}) {
		super({ healthDice, ...rest });

		this.defaults = {
			...this.defaults,
			healthDice: '2d6'
		};
	}
}

ScotchCard.cardType = 'Scotch';
ScotchCard.probability = 10;
ScotchCard.description = 'Keep the heid, this battle\'s far from over.';
ScotchCard.level = 2;

module.exports = ScotchCard;
