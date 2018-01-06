/* eslint-disable max-len */

const BaseCard = require('./base');
const { roll } = require('../../helpers/chance');

class HazardCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageDice,
		icon = '⚠️'
	} = {}) {
		super({ damageDice, icon });
	}

	get damageDice () {
		return this.options.damageDice;
	}

	set damageDice (damageDice) {
		this.setOptions({
			damageDice
		});
	}

	get stats () {
		return this.flavor;
	}

	effect (player) {
		const assailant = {
			icon: this.icon,
			givenName: 'The World'
		}
		const damage = roll({ primaryDice: this.damageDice }).result;
		player.hit(damage, assailant, this);

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
HazardCard.defaults = {
	damageDice: '1d4'
};


module.exports = HazardCard;
