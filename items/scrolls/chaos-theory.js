/* eslint-disable max-len */

const TargetingScroll = require('./targeting');
const { TARGET_RANDOM_PLAYER } = require('../../helpers/targeting-strategies');

class ChaosTheoryScroll extends TargetingScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🐍'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName} will look around the ring and pick a random foe to target, unless directed otherwise by a specific card.`;
	}
}

ChaosTheoryScroll.itemType = 'Chaos Theory for Beginners';
ChaosTheoryScroll.description = `Tiny variations, the orientation of hairs on your hand, the amount of blood distending your vessels, imperfections in the skin... vastly affect the outcome.

Target a random opponent in the ring (other than yourself) rather than following a defined order.`;
ChaosTheoryScroll.targetingStrategy = TARGET_RANDOM_PLAYER;

module.exports = ChaosTheoryScroll;
