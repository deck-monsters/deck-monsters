/* eslint-disable max-len */

const EnthrallCard = require('./enthrall');

const { RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class EntranceCard extends EnthrallCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		freedomSavingThrowTargetAttr,
		icon = '🎆',
		...rest
	} = {}) {
		super({ freedomSavingThrowTargetAttr, icon, ...rest });
	}
}

EntranceCard.cardType = 'Entrance';
EntranceCard.actions = { IMMOBILIZE: 'entrance', IMMOBILIZES: 'entrances', IMMOBILIZED: 'entranced' };
EntranceCard.probability = RARE.probability;
EntranceCard.description = `You strut and preen. Your painful beauty hits and ${EntranceCard.actions.IMMOBILIZES} everyone, except yourself.`;
EntranceCard.level = 3;
EntranceCard.cost = PRICEY.cost;
EntranceCard.notForSale = true;

EntranceCard.defaults = {
	...EnthrallCard.defaults,
	doDamageOnImmobilize: true,
	ongoingDamage: 1
};

EntranceCard.flavors = {
	hits: [
		['stuns', 80],
		['uses their painfully stunning natural beauty against', 30],
		["stuns even Narcissus himself with their beauty... And that's when they sucker punch", 5]
	]
};

module.exports = EntranceCard;
