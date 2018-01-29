/* eslint-disable max-len */

const EnthrallCard = require('./enthrall');

const ImmobilizeCard = require('./immobilize');

const { RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class EntranceCard extends EnthrallCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🎆',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.immobilizeCard = new ImmobilizeCard({
			strongAgainstCreatureTypes: this.strongAgainstCreatureTypes,
			weakAgainstCreatureTypes: this.weakAgainstCreatureTypes,
			uselessAgainstCreatureTypes: this.uselessAgainstCreatureTypes
		});
	}
}

EntranceCard.cardType = 'Entrance';
EntranceCard.actions = { IMMOBILIZE: 'entrance', IMMOBILIZES: 'entrances', IMMOBILIZED: 'entranced' };
EntranceCard.probability = RARE.probability;
EntranceCard.description = `You strut and preen. Your beauty _painfully_ ${EntranceCard.actions.IMMOBILIZES} everyone, except yourself.`;
EntranceCard.level = 3;
EntranceCard.cost = PRICEY.cost;
EntranceCard.notForSale = true;

EntranceCard.defaults = {
	...EnthrallCard.defaults,
	doDamageOnImmobilize: true
};

EntranceCard.flavors = {
	hits: [
		['stuns', 80],
		['uses their painfully stunning natural beauty against', 30],
		["stuns even Narcissus himself with their beauty... And that's when they sucker punch", 5]
	]
};

module.exports = EntranceCard;
