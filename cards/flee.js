const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

class FleeCard extends BaseCard {
	get stats () { // eslint-disable-line class-methods-use-this
		return 'Chance to run away';
	}

	effect (player, target, game) { // eslint-disable-line no-unused-vars
		const fleeBonus = target.ac - player.ac;
		const fleeRoll = roll({ primaryDice: '1d20', modifier: fleeBonus });

		this.emit('rolled', {
			fleeResult: fleeRoll.result,
			fleeRoll,
			player,
			target
		});

		if (target.ac <= fleeRoll.result) {
			return player.leaveCombat(target);
		}

		this.emit('stay', {
			fleeResult: fleeRoll.result,
			fleeRoll,
			player,
			target
		});

		return true;
	}
}

FleeCard.cardType = 'Flee';
FleeCard.probability = 40;
FleeCard.description = 'There is no shame in living to fight another day.';

module.exports = FleeCard;
