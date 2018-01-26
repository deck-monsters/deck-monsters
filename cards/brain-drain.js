const CurseCard = require('./curse');

const { REASONABLE } = require('../helpers/costs');

class BrainDrainCard extends CurseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🤡',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
}

BrainDrainCard.cardType = 'Brain Drain';
BrainDrainCard.description = 'And we shall bury our enemies in their own confusion.';
BrainDrainCard.cost = REASONABLE.cost;

BrainDrainCard.defaults = {
	...CurseCard.defaults,
	curseAmount: -20,
	cursedProp: 'xp'
};

module.exports = BrainDrainCard;
