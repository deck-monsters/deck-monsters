/* eslint-disable max-len */

const TargetingScroll = require('./targeting');
const { TARGET_LOWEST_HP_PLAYER, getStrategyDescription } = require('../../helpers/targeting-strategies');

// The "Fists of Villainy" scroll
class CobraKaiScroll extends TargetingScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🐍'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName} will target the player with the lowest current xp while ${monster.pronouns.he} is in the ring unless directed otherwise by a specific card.`;
	}
}

CobraKaiScroll.itemType = 'The Way of the Cobra Kai';
CobraKaiScroll.description = `We do not train to be merciful here. Mercy is for the weak. Here, in the streets, in competition: A man confronts you, he is the enemy. An enemy deserves no mercy.

${getStrategyDescription(CobraKaiScroll.targetingStrategy)}`;
CobraKaiScroll.targetingStrategy = TARGET_LOWEST_HP_PLAYER;

module.exports = CobraKaiScroll;
