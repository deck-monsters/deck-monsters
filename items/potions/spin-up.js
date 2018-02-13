/* eslint-disable max-len */

const BaseScroll = require('./base');
const random = require('../../helpers/random');

const { COMMON } = require('../../helpers/probabilities');
const { REASONABLE } = require('../../helpers/costs');

class SpinUp extends BaseScroll {
	constructor ({
		icon = '🧠'
	} = {}) {
		super({ icon });
	}

	healingMessage (monster, healAmount) {
		return `${monster.givenName} is ${this.icon} spun up in a new sleeve with ${healAmount} hp.`;
	}

	action ({ channel, channelName, monster }) {
		if (monster && !monster.inEncounter && monster.dead) {
			const healAmount = random(1, monster.maxHp);

			this.emit('narration', {
				channel,
				channelName,
				narration: this.healingMessage(monster, healAmount)
			});

			monster.respawn(true);
			monster.heal(healAmount);

			return true;
		}

		return false;
	}
}

// Altered Carbon reference...
SpinUp.itemType = 'Spin Up';
SpinUp.probability = COMMON.probability;
SpinUp.numberOfUses = 1;
SpinUp.description = 'Instantly spin monster back up in a new sleeve.';
SpinUp.level = 1;
SpinUp.cost = REASONABLE.cost;

module.exports = SpinUp;
