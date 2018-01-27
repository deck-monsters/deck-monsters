/* eslint-disable max-len */

const EnthrallCard = require('./enthrall');

const ImmobilizeCard = require('./immobilize');

const { RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class EntranceCard extends EnthrallCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		dexModifier,
		icon = '🎆',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			dexModifier
		});

		this.immobilizeCard = new ImmobilizeCard({
			strongAgainstCreatureTypes: this.strongAgainstCreatureTypes,
			weakAgainstCreatureTypes: this.weakAgainstCreatureTypes,
			uselessAgainstCreatureTypes: this.uselessAgainstCreatureTypes
		});
	}
	get stats () { // eslint-disable-line class-methods-use-this
		return `${this.immobilizeCard.stats}
Chance to immobilize and damage your opponents with your painfully shocking beauty.`;
	}
}

EntranceCard.cardType = 'Entrance';
EntranceCard.actions = ['entrance', 'entrances', 'entranced'];
EntranceCard.probability = RARE.probability;
EntranceCard.description = `You strut and preen. Your _painful_ beauty overwhelms and ${EntranceCard.actions[1]} everyone, except yourself.`;
EntranceCard.level = 3;
EntranceCard.cost = PRICEY.cost;
EntranceCard.notForSale = true;

EntranceCard.defaults = {
	...EnthrallCard.defaults,
	doDamageOnImmobilize: true,
	freedomThresholdModifier: 2
};

EntranceCard.flavors = {
	hits: [
		['stuns', 80],
		['uses their painfully stunning natural beauty against', 30],
		["stuns even Narcissus himself with their beauty... And that's when they sucker punch", 5]
	]
};

module.exports = EntranceCard;
