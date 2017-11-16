const BaseCard = require('./base');

class BoostCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		boostAmount = 1,
		icon = '🆙',
		boostedProp = 'ac'
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

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			player.setCondition(this.boostedProp, this.boostAmount);

			resolve(true);
		});
	}
}

BoostCard.cardType = 'Harden';
BoostCard.probability = 10;
BoostCard.description = "It's time to put on your big boy pants, and toughen up!";
BoostCard.cost = 2;
BoostCard.level = 1;

module.exports = BoostCard;
