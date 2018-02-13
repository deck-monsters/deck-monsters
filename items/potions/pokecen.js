/* eslint-disable max-len */

const BaseScroll = require('./base');
const random = require('../../helpers/random');

const { COMMON } = require('../../helpers/probabilities');
const { REASONABLE } = require('../../helpers/costs');

class SpinUp extends BaseScroll {
	constructor ({
		icon = '🏩'
	} = {}) {
		super({ icon });
	}

	healingMessage (monster, healAmount) {
		return `${monster.givenName}'s hp is fully restored.`;
	}

	action ({ channel, channelName, monster }) {
		if (monster && !monster.inEncounter && !monster.dead) {
			this.emit('narration', {
				channel,
				channelName,
				narration: this.healingMessage(monster)
			});

			monster.heal(monster.maxHP);

			return true;
		}

		return false;
	}
}

// Altered Carbon reference...
SpinUp.itemType = 'Pokecen';
SpinUp.probability = COMMON.probability;
SpinUp.numberOfUses = 1;
SpinUp.description = `ポケモンセンター Heal Your Monsters!`;
SpinUp.level = 1;
SpinUp.cost = REASONABLE.cost;

module.exports = SpinUp;
