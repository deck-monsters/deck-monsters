/* eslint-disable max-len */

const TargetingScroll = require('./targeting');
const { TARGET_HIGHEST_HP_PLAYER } = require('../../helpers/targeting-strategies');

// The "Fists of Virtue" scroll
class SirRobinScroll extends TargetingScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🙏'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `whenever ${monster.givenName} is in the ring ${monster.pronouns.he} will bravely look about, choose the player with the highest current hp, and target them, unless directed otherwise by a specific card.`;
	}
}

SirRobinScroll.itemType = 'The Tale of Sir Robin';
SirRobinScroll.description = `He was not in the least bit scared to be mashed into a pulp, or to have his eyes gouged out, and his elbows broken, to have his kneecaps split, and his body burned away... brave Sir Robin!

Target whichever opponent currently has the highest hp.`;
SirRobinScroll.targetingStrategy = TARGET_HIGHEST_HP_PLAYER;

module.exports = SirRobinScroll;
