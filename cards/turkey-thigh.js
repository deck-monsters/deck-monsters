const SurvivalKnifeCard = require('./survival-knife');

const { BARBARIAN } = require('../constants/creature-classes');

class TurkeyThighCard extends SurvivalKnifeCard {
	constructor ({
		icon = '🍗',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
}

TurkeyThighCard.cardType = 'Turkey Thigh';
TurkeyThighCard.description = 'Beat your opponent with a huge turkey thigh. If times get tough, take a bite for a quick hp boost.';
TurkeyThighCard.permittedClassesAndTypes = [BARBARIAN];

module.exports = TurkeyThighCard;
