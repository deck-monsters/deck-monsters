/* eslint-disable max-len */

const MesmerizeCard = require('./mesmerize');
const ImmobilizeCard = require('./immobilize');

class EnthrallCard extends MesmerizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		hitOnFail,
		icon = '🎇',
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
Chance to immobilize your opponents with your shocking beauty.`;
	}

	effect (player, target, ring, activeContestants) {
		return new Promise((resolve) => {
			resolve(Promise.all(activeContestants.map(({ monster }) => {
				if (monster !== player && (this.strongAgainstCreatureTypes.includes(monster.type) || this.weakAgainstCreatureTypes.includes(monster.type))) {
					return super.effect(player, target, ring, activeContestants);
				}

				return Promise.resolve();
			}))
				.then(() => !target.dead));
		});
	}
}

EnthrallCard.cardType = 'Enthrall';
EnthrallCard.level = 2;
EnthrallCard.description = 'You strut and preen. Your beauty overwhelms and enthralls everyone, except yourself.';
EnthrallCard.action = ['enthrall', 'enthralls', 'enthralled'];

EnthrallCard.defaults = {
	...MesmerizeCard.defaults,
	freedomThresholdModifier: 1
};

EnthrallCard.flavors = {
	hits: [
		['Your enthrall your adversaries', 80],
		['Your natural beauty overwhelmes your enemies', 30],
		['Narcisus himself would be distracted by your beauty... and that\'s when you hit.', 5]
	]
};

module.exports = EnthrallCard;
