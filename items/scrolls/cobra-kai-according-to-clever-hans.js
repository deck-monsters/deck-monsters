/* eslint-disable max-len */

const CobraKaiScroll = require('./cobra-kai');
const { TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');

class CobraKaiAccordingToCleverHansScroll extends CobraKaiScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}
}

CobraKaiAccordingToCleverHansScroll.notForSale = true;
CobraKaiAccordingToCleverHansScroll.cost = ALMOST_NOTHING;
CobraKaiAccordingToCleverHansScroll.itemType = 'The Way of the Cobra Kai According to Clever Hans';
CobraKaiAccordingToCleverHansScroll.targetingStrategy = TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS;

module.exports = CobraKaiAccordingToCleverHansScroll;
