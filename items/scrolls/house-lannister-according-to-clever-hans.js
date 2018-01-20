/* eslint-disable max-len */

const HouseLannister = require('./house-lannister');
const { TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');

class HouseLannisterAccordingToHans extends HouseLannister {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}
}

HouseLannisterAccordingToHans.probability = 75;
HouseLannisterAccordingToHans.cost = 18;
HouseLannisterAccordingToHans.itemType = 'House Lannister According To Clever Hans';
HouseLannisterAccordingToHans.targetingStrategy = TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS;

module.exports = HouseLannisterAccordingToHans;
