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
}

ChaosTheoryAccordingToCleverHansScroll.notForSale = true;
ChaosTheoryAccordingToCleverHansScroll.cost = ALMOST_NOTHING;
ChaosTheoryAccordingToCleverHansScroll.itemType = 'Chaos Theory for Beginners According to Clever Hans';
ChaosTheoryAccordingToCleverHansScroll.targetingStrategy = TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS;
ChaosTheoryScroll.description = `Tiny variations, the orientation of hairs on your hand, the amount of blood distending your vessels, imperfections in the skin... vastly affect the outcome.

Target a random opponent in the ring rather than following a defined order.`;

module.exports = ChaosTheoryAccordingToCleverHansScroll;
