const BaseCard = require('./base');

class HealCard extends BaseCard {
	// Only needed if you want to do something else in the constructor
	// constructor (options) {
	// 	super(options);
	// }

	// This doesn't have to be static if it needs access to the instance
	static effect (player, target, game) { // eslint-disable-line no-unused-vars
		// TO-DO: fill this in with more complete and realistic actions
		player.heal(1);
	}
}

HealCard.probability = 60;

module.exports = HealCard;
