const BaseCard = require('./base');

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
		target.setModifier(this.boostedProp, this.boostAmount);

		return true;
	}
}

BoostCard.cardType = 'Harden';
BoostCard.probability = 30;
BoostCard.description = "It's time to put on your big boy pants, and toughen up!";
BoostCard.level = 1;
BoostCard.cost = 10;

BoostCard.defaults = {
	boostAmount: 1,
	boostedProp: 'ac'
};

module.exports = BoostCard;
