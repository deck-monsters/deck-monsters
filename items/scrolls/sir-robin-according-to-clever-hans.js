/* eslint-disable max-len */

const SirRobinScroll = require('./sir-robin');
const { TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');

// The "Fists of Virtue" scroll
class SirRobinScrollAccordingToCleverHans extends SirRobinScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that whenever ${monster.pronouns.he} is in the ring ${monster.pronouns.he} should bravely look about, choose the monster with the highest current hp, and target them, unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

SirRobinScrollAccordingToCleverHans.notForSale = true;
SirRobinScrollAccordingToCleverHans.cost = ALMOST_NOTHING;
SirRobinScrollAccordingToCleverHans.itemType = 'The Tale of Sir Robin According to Clever Hans';
SirRobinScrollAccordingToCleverHans.description = `He was not in the least bit scared to be mashed into a pulp, or to have his eyes gouged out, and his elbows broken, to have his kneecaps split, and his body burned away... brave Sir Robin!

Your mother told you to target whichever monster currently has the highest hp, and that's exactly what you'll do.`;
SirRobinScrollAccordingToCleverHans.targetingStrategy = TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS;

module.exports = SirRobinScrollAccordingToCleverHans;
