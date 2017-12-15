const HealCard = require('./heal');
const { CLERIC, WIZARD } = require('../helpers/classes');

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
ReviveCard.cost = 5;
ReviveCard.level = 3;
ReviveCard.permittedClassesAndTypes = [CLERIC, WIZARD];

module.exports = ReviveCard;
