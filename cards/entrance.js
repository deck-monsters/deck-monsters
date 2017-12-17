/* eslint-disable max-len */

const EnthrallCard = require('./enthrall');
const ImmobilizeCard = require('./immobilize');

class EntranceCard extends EnthrallCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		hitOnFail,
		icon = '🎆',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			attackModifier,
			hitOnFail
		});
	}
	get stats () {
		const immobilize = new ImmobilizeCard();

		return `${immobilize.stats}
Chance to immobilize and damage your opponents with your painfully shocking beauty.`;
	}
}

EntranceCard.cardType = 'Entrance';
EntranceCard.probability = 20;
EntranceCard.level = 3;
EntranceCard.description = 'You strut and preen. Your _painful_ beauty overwhelms and entrances everyone, except yourself.';
EntranceCard.defaults = {
	...EnthrallCard.defaults,
	hitOnFail: true,
	doDamageOnImmobilize: true,
	freedomThresholdModifier: 2
};
EntranceCard.action = ['entrance', 'entrances', 'entranced'];

EntranceCard.flavors = {
	hits: [
		['You entrance your adversaries, your magnificence is painful to look at', 80],
		['Your natural beauty overwhelmes your enemies causing them to fall senseless to the ground', 30],
		['Narcisus himself would be distracted by your magnificence... and that\'s when you hit.', 5]
	]
};

module.exports = EntranceCard;
