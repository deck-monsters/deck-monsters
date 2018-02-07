/* eslint-disable max-len */

const HouseLannister = require('./house-lannister');
const { TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS, getStrategyDescription } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');

class HouseLannisterAccordingToCleverHans extends HouseLannister {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that ${monster.pronouns.he} should target the monster who attacked ${monster.pronouns.him} last, unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

HouseLannisterAccordingToCleverHans.notForSale = true;
HouseLannisterAccordingToCleverHans.cost = ALMOST_NOTHING.cost;
HouseLannisterAccordingToCleverHans.itemType = 'House Lannister According To Clever Hans';
HouseLannisterAccordingToCleverHans.targetingStrategy = TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS;
HouseLannisterAccordingToCleverHans.description = `A Lannister always pays his debts...

${getStrategyDescription(HouseLannisterAccordingToCleverHans.targetingStrategy)}`;

module.exports = HouseLannisterAccordingToCleverHans;
