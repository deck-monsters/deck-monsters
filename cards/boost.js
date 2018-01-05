const BaseCard = require('./base');

const isProbable = require('../helpers/is-probable');

class BoostCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		boostAmount,
		icon = '🆙',
		boostedProp
	} = {}) {
		super({ boostAmount, icon, boostedProp });
	}

	get boostAmount () {
		return this.options.boostAmount;
	}

	get boostedProp () {
		return this.options.boostedProp;
	}

	get stats () {
		return `Boost: ${this.boostedProp} +${this.boostAmount}`;
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	effect (player, target) {
		return new Promise((resolve) => {
			if (isProbable({ probability: 5 })) {
				this.pop(player);
			}
			target.setModifier(this.boostedProp, this.boostAmount);

			resolve(true);
		});
	}
}

BoostCard.cardType = 'Harden';
BoostCard.probability = 30;
BoostCard.description = "It's time to put on your big boy pants, and toughen up!";
BoostCard.cost = 2;
BoostCard.level = 1;
BoostCard.defaults = {
	boostAmount: 1,
	boostedProp: 'ac'
};

module.exports = BoostCard;
