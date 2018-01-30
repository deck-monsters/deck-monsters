/* eslint-disable max-len */

const TargetingScroll = require('./targeting');
const { TARGET_PLAYER_WHO_HIT_YOU_LAST, getStrategyDescription } = require('../../helpers/targeting-strategies');

class HouseLannisterScroll extends TargetingScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🦁'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName} will target the opponent who attacked ${monster.pronouns.him} last, unless directed otherwise by a specific card.`;
	}
}

HouseLannisterScroll.itemType = 'House Lannister';
HouseLannisterScroll.targetingStrategy = TARGET_PLAYER_WHO_HIT_YOU_LAST;
HouseLannisterScroll.description = `A Lannister always pays his debts...

${getStrategyDescription(HouseLannisterScroll.targetingStrategy)}`;

module.exports = HouseLannisterScroll;
