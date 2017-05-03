const BaseCard = require('./base');

class FleeCard extends BaseCard {
	// Only needed if you want to do something else in the constructor
	// constructor (options) {
	// 	super(options);
	// }

	// This doesn't have to be static if it needs access to the instance
	static effect (player, target, game) { // eslint-disable-line no-unused-vars
		// TO-DO: fill this in with more complete and realistic actions
		player.leaveCombat();
	}

	toString () {
		return JSON.stringify({
			name: FleeCard.name,
			options: this.options
		});
	}
}

FleeCard.probability = 40;

module.exports = FleeCard;
