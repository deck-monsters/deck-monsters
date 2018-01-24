/* eslint-disable max-len */

const ChaosTheoryScroll = require('./chaos-theory');
const { TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');

class ChaosTheoryAccordingToCleverHansScroll extends ChaosTheoryScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that ${monster.pronouns.he} should look around the ring and pick a random monster to target, unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

ChaosTheoryAccordingToCleverHansScroll.notForSale = true;
ChaosTheoryAccordingToCleverHansScroll.cost = ALMOST_NOTHING;
ChaosTheoryAccordingToCleverHansScroll.itemType = 'Chaos Theory for Beginners According to Clever Hans';
ChaosTheoryAccordingToCleverHansScroll.targetingStrategy = TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS;
ChaosTheoryScroll.description = `Tiny variations, the orientation of hairs on your hand, the amount of blood distending your vessels, imperfections in the skin... vastly affect the outcome.

Your mother told you to target a random monster in the ring rather than following a defined order, and that's exactly what you'll do.`;

module.exports = ChaosTheoryAccordingToCleverHansScroll;
