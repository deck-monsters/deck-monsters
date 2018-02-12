const HealCard = require('./heal');

const { BARD, CLERIC, WIZARD } = require('../constants/creature-classes');
const { EXPENSIVE } = require('../helpers/costs');

class ReviveCard extends HealCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		healthDice = '2d4',
		modifier = 3,
		icon = '⛑',
		...rest
	} = {}) {
		super({
			healthDice,
			modifier,
			icon,
			...rest
		});
	}
}

ReviveCard.cardType = 'Revive';
ReviveCard.probability = 0;
ReviveCard.description = 'Luckily, you happened to have a fairy in your pocket.';
ReviveCard.cost = EXPENSIVE.cost;
ReviveCard.level = 3;
ReviveCard.permittedClassesAndTypes = [BARD, CLERIC, WIZARD];
ReviveCard.notForSale = true;

module.exports = ReviveCard;
