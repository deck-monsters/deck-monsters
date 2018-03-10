/* eslint-disable max-len */

const BaseScroll = require('./base');

const { COMMON } = require('../../helpers/probabilities');
const { REASONABLE } = require('../../helpers/costs');

class SpinUp extends BaseScroll {
	constructor ({
		icon = '🏩'
	} = {}) {
		super({ icon });
	}

	healingMessage (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName}'s hp is fully restored.`;
	}

	action ({ channel, channelName, monster }) {
		if (monster && !monster.inEncounter && !monster.dead) {
			this.emit('narration', {
				environment: monster.environment,
				channel,
				channelName,
				narration: this.healingMessage(monster)
			});

			monster.heal(monster.maxHp - monster.hp);

			return true;
		}

		return false;
	}
}

// Altered Carbon reference...
SpinUp.itemType = 'Pokecen';
SpinUp.probability = COMMON.probability;
SpinUp.numberOfUses = 1;
SpinUp.description = 'ポケモンセンター Heal Your Monsters!';
SpinUp.level = 1;
SpinUp.cost = REASONABLE.cost;

module.exports = SpinUp;
