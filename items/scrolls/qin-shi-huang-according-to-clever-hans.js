/* eslint-disable max-len */

const QinShiHuangScroll = require('./qin-shi-huang');
const { TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');

class QinShiHuangAccordingToCleverHansScroll extends QinShiHuangScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName} will seek to consolidate ${monster.pronouns.his} power and lay waste to the biggest monster in the ring by targeting anyone with the highest xp, unless directed otherwise by a specific card.`;
	}
}

QinShiHuangAccordingToCleverHansScroll.probability = 75;
QinShiHuangAccordingToCleverHansScroll.cost = 18;
QinShiHuangAccordingToCleverHansScroll.itemType = 'The Annals of Qin Shi Huang According to Clever Hans';
QinShiHuangAccordingToCleverHansScroll.description = `焚書坑儒

Target the player who has the highest xp.`;
QinShiHuangAccordingToCleverHansScroll.targetingStrategy = TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS;

module.exports = QinShiHuangAccordingToCleverHansScroll;
