/* eslint-disable max-len */

const HouseLannister = require('./house-lannister');
const { TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');

class HouseLannisterAccordingToCleverHans extends HouseLannister {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}
}

HouseLannisterAccordingToCleverHans.probability = 75;
HouseLannisterAccordingToCleverHans.cost = 18;
HouseLannisterAccordingToCleverHans.itemType = 'House Lannister According To Clever Hans';
HouseLannisterAccordingToCleverHans.targetingStrategy = TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS;

module.exports = HouseLannisterAccordingToCleverHans;
