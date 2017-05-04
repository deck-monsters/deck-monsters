const BaseCard = require('./base');

class FleeCard extends BaseCard {
	// Only needed if you want to do something else in the constructor
	// constructor (options) {
	// 	super(options);
	// }

	// This doesn't have to be static if it needs access to the instance
	static effect (player, target, game) { // eslint-disable-line no-unused-vars

		const fleeBonus = target.ac - player.ac;
		const fleeRoll = roll('1d20' + fleeBonus);

		if (target.ac <= fleeRoll) {
			player.leaveCombat();
			this.emit('win', { player, target, reason: 'fled combat' });
		}
	}
}

FleeCard.probability = 40;
FleeCard.description = 'There is no shame in living to fight another day.';

module.exports = FleeCard;
