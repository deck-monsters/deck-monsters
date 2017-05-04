const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

class FleeCard extends BaseCard {
	static get stats () {
		return 'Chance to run away';
	}

	// This doesn't have to be static if it needs access to the instance
	effect (player, target, game) { // eslint-disable-line no-unused-vars
		const fleeBonus = target.ac - player.ac;
		const fleeRoll = roll({
			quantity: 1,
			sides: 20,
			transformations: [
				'sum',
				['add', fleeBonus]
			]
		});

		this.emit('rolled', { fleeRoll, player, target });

		if (target.ac <= fleeRoll) {
			player.leaveCombat();
		}
	}
}

FleeCard.probability = 40;
FleeCard.description = 'There is no shame in living to fight another day.';

module.exports = FleeCard;
