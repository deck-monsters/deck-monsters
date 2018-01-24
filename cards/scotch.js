const WhiskeyShotCard = require('./whiskey-shot');

const { RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class ScotchCard extends WhiskeyShotCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		healthDice,
		...rest
	} = {}) {
		super({ healthDice, ...rest });
	}
}

ScotchCard.cardType = 'Scotch';
ScotchCard.probability = RARE.probability;
ScotchCard.description = 'Keep the heid, this battle\'s far from over.';
ScotchCard.level = 4;
ScotchCard.cost = PRICEY.cost;
ScotchCard.notForSale = true;

ScotchCard.defaults = {
	...WhiskeyShotCard.defaults,
	healthDice: '2d6'
};

module.exports = ScotchCard;
