const EcdysisCard = require('./ecdysis');

const { BARBARIAN, FIGHTER } = require('../helpers/classes');

class AdrenalineRushCard extends EcdysisCard {
	constructor ({
		boosts,
		icon = '❗️',
		...rest
	} = {}) {
		super({ boosts, icon, ...rest });
	}
}

AdrenalineRushCard.cardType = 'Adrenaline Rush';
AdrenalineRushCard.permittedClassesAndTypes = [BARBARIAN, FIGHTER];
AdrenalineRushCard.description = 'Life or Death brings about a certain focus... A certain AWAKENESS most people don\'t actually want. It\'s what you live for. It\'s how you know you exist. You embrace it a welcome the rush.'; // eslint-disable-line max-len

AdrenalineRushCard.defaults = {
	...EcdysisCard.defaults
};

module.exports = AdrenalineRushCard;
