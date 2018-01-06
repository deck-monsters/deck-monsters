/* eslint-disable max-len */

const BaseCard = require('./base');

class HazardCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '⚠️'
	} = {}) {
		super({ icon });
	}

	get stats () {
		return this.flavor;
	}

	effect (player) { // eslint-disable-line no-unused-vars
		player.dead = true;

		return player;
	}
}

HazardCard.cardType = 'Hazard';
HazardCard.probability = 10;
HazardCard.description = 'It is dangerous out there...';

HazardCard.flavors = {
	hazard: [
		['you fall and hit your head', 100]
	]
};

module.exports = HazardCard;
