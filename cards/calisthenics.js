const random = require('lodash.random');

const BoostCard = require('./boost');

const { BARBARIAN, FIGHTER } = require('../constants/creature-classes');
const { REASONABLE } = require('../helpers/costs');

class CalisthenicsCard extends BoostCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🙆‍',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get boostAmount () {
		return random(1, this.options.boostAmount);
	}

	get stats () {
		return `Boost: ${this.boostedProp} +1-${this.options.boostAmount} depending on how deep the stretch is`;
	}
}

CalisthenicsCard.cardType = 'Calisthenics';
CalisthenicsCard.permittedClassesAndTypes = [BARBARIAN, FIGHTER];
CalisthenicsCard.description = 'Your daily workout routine limbers you up for battle.';
CalisthenicsCard.level = 2;
CalisthenicsCard.cost = REASONABLE.cost;

CalisthenicsCard.defaults = {
	...BoostCard.defaults,
	boostAmount: 2,
	boostedProp: 'dex'
};

module.exports = CalisthenicsCard;
