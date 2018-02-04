/* eslint-disable max-len */

const CurseCard = require('./curse');

const { REASONABLE } = require('../helpers/costs');

class MolassesCard extends CurseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🍯',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}
}

MolassesCard.cardType = 'Molasses';
MolassesCard.description = "Slow down your enemies like it's 1919.";
MolassesCard.cost = REASONABLE.cost;

MolassesCard.defaults = {
	...CurseCard.defaults,
	cursedProp: 'dex'
};

module.exports = MolassesCard;
