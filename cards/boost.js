const BaseCard = require('./base');

const { COMMON } = require('../helpers/probabilities');
const { VERY_CHEAP } = require('../helpers/costs');
const { difference } = require('../helpers/difference');
const { getFlavor } = require('../helpers/flavor');

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
		const acBoost = (this.boostedProp === 'ac') ?
			'\nIf hit by melee attack, damage comes out of ac boost first.' :
			'';
		return `Boost: ${this.boostedProp} +${this.boostAmount} (max boost of level * 2, or 1 for beginner, then boost granted to hp instead).${acBoost}`;
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	getBoostNarrative (player, target) {
		const items = {
			str: [
				['pops some Ant nectar', 50],
				['eats some Mississippi Quantum Pie', 30],
				['drinks some beer', 60],
				['pops some Buffout', 50]
			],
			int: [
				['pops some Mentats', 50],
				['pops some Berry Mentats', 30],
				['puts on Button\'s wig', 10],
				['puts on Lincoln\'s hat', 10]
			],
			ac: [
				['pops some Buffout', 50],
				['drinks some Nuka-Cola Quantum', 60],
				['eats some Nukalurk meat', 40],
				['drinks some Jet', 30],
				['drinks some Ultrajet', 10]
			],
			dex: [
				['drinks some Fire ant nectar', 60],
				['puts on  Poplar\'s hood', 10],
				['wishes on the monkey\'s paw', 1]
			],
			hp: [
				['eats a red mushroom', 40],
				['absorbs a purple circle strangely floating in the air', 30],
				['eats a bowl of nazi guard dog food', 10],
				['steps on a red-cross med-pack', 10]
			]
		};

		const { text: flavor } = getFlavor(this.boostedProp, items);
		return `${target.givenName} ${flavor} and boosts their ${this.boostedProp}`;
	}

	getBoostOverflowNarrative (player, target) {
		return `${target.givenName}'s ${this.cursedProp} boosts have been maxed out. Boost will be granted to hp instead.`;
	}

	effect (player, target) {
		const preBoostedPropValue = target[this.boostedProp];
		let boostAmount = Math.abs(this.boostAmount);
		const postBoostedPropValue = preBoostedPropValue + boostAmount;
		const preBattlePropValue = target.getPreBattlePropValue(this.boostedProp);
		const aggregateTotalBoostAmount = difference(preBattlePropValue, postBoostedPropValue);

		// If the target has already been boosted for the max amount, make the boost overflow into their HP
		const hpBoostOverflow = this.boostedProp !== 'hp' ? aggregateTotalBoostAmount - target.getMaxModifications(this.boostedProp) : 0;
		if (hpBoostOverflow > 0) {
			boostAmount -= hpBoostOverflow;

			this.emit('narration', {
				narration: this.getBoostOverflowNarrative(player, target)
			});
			player.heal(hpBoostOverflow, target, this);
		}

		if (boostAmount > 0) {
			this.emit('narration', {
				narration: this.getBoostNarrative(player, target)
			});
			target.setModifier(this.boostedProp, boostAmount);
		}

		return true;
	}
}

BoostCard.cardClass = 'Boost';
BoostCard.cardType = 'Harden';
BoostCard.probability = COMMON.probability;
BoostCard.description = "It's time to put on your big boy pants, and toughen up!";
BoostCard.level = 1;
BoostCard.cost = VERY_CHEAP.cost;

BoostCard.defaults = {
	boostAmount: 1,
	boostedProp: 'ac'
};

module.exports = BoostCard;
