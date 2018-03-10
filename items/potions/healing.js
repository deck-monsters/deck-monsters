/* eslint-disable max-len */

const BaseScroll = require('./base');

const { COMMON } = require('../../helpers/probabilities');
const { REASONABLE } = require('../../helpers/costs');

class HealingPotion extends BaseScroll {
	constructor ({
		icon = '💊'
	} = {}) {
		super({ icon });
	}

	get healAmount () {
		return this.constructor.healAmount;
	}

	healingMessage (monster) {
		return `${monster.givenName} drinks ${monster.pronouns.his} ${this.icon} ${this.itemType} for ${this.healAmount} hp.`;
	}

	action ({ channel, channelName, monster }) {
		const { healAmount } = this;

		if (monster && !monster.dead && healAmount) {
			this.emit('narration', {
				environment: monster.environment,
				channel,
				channelName,
				narration: this.healingMessage(monster)
			});

			monster.heal(healAmount);

			return true;
		}

		return false;
	}
}

HealingPotion.itemType = 'Potion of Healing';
HealingPotion.probability = COMMON.probability;
HealingPotion.healAmount = 8;
HealingPotion.numberOfUses = 1;
HealingPotion.description = `Instantly heal ${HealingPotion.healAmount} hp.`;
HealingPotion.level = 1;
HealingPotion.cost = REASONABLE.cost;

module.exports = HealingPotion;
