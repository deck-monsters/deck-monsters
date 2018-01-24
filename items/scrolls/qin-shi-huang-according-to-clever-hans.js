/* eslint-disable max-len */

const QinShiHuangScroll = require('./qin-shi-huang');
const { TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');

class QinShiHuangAccordingToCleverHansScroll extends QinShiHuangScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '👦'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} ${monster.pronouns.he} should seek to consolidate ${monster.pronouns.his} power and lay waste to the biggest monster in the ring by targeting the monster with the highest xp, unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

QinShiHuangAccordingToCleverHansScroll.notForSale = true;
QinShiHuangAccordingToCleverHansScroll.cost = ALMOST_NOTHING;
QinShiHuangAccordingToCleverHansScroll.itemType = 'The Annals of Qin Shi Huang According to Clever Hans';
QinShiHuangAccordingToCleverHansScroll.description = `焚書坑儒

Your mother told you to target the monster who has the highest xp, and that's exactly what you'll do.`;
QinShiHuangAccordingToCleverHansScroll.targetingStrategy = TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS;

module.exports = QinShiHuangAccordingToCleverHansScroll;
