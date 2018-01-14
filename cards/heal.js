const BaseCard = require('./base');

const { roll } = require('../helpers/chance');
const isProbable = require('../helpers/is-probable');

class HealCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		healthDice,
		modifier,
		icon = '💊'
	} = {}) {
		super({ healthDice, modifier, icon });
	}

	get healthDice () {
		return this.options.healthDice;
	}

	get modifier () {
		return this.options.modifier;
	}

	get stats () {
		return `Health: ${this.healthDice}
Possiblity of Stroke of Luck`;
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	getHealRoll (player) {
		// Heals get weaker each time down to zero, then start back from the top
		if (!player.encounterModifiers.healModifier) {
			player.encounterModifiers.healModifier = (player.intModifier + this.modifier);
		} else {
			player.encounterModifiers.healModifier = Math.max(player.encounterModifiers.healModifier - 1, 0);
		}

		return roll({ primaryDice: this.healthDice, modifier: player.encounterModifiers.healModifier, bonusDice: player.bonusIntDice });
	}

	// This doesn't have to be static if it needs access to the instance
	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		const healRoll = this.getHealRoll(player);
		let healResult = healRoll.result;
		let outcome = '';

		// Stroke of Luck
		if (isProbable({ probability: 1 })) {
			healResult = Math.floor(player.maxHp / 2);
			outcome = 'Stroke of luck. Heal half max hp.';
		}

		this.emit('rolled', {
			reason: 'to determine how much to heal',
			card: this,
			roll: healRoll,
			player,
			target,
			outcome
		});

		return target.heal(healResult);
	}
}

HealCard.cardType = 'Heal';
HealCard.probability = 40;
HealCard.description = 'A well-timed healing can be the difference between sweet victory and devastating defeat.';
HealCard.level = 0;
HealCard.cost = 5;

HealCard.defaults = {
	healthDice: '1d4',
	modifier: 0
};

module.exports = HealCard;
