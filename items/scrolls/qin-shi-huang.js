/* eslint-disable max-len */

const TargetingScroll = require('./targeting');
const { TARGET_HIGHEST_XP_PLAYER, getStrategyDescription } = require('../../helpers/targeting-strategies');

class QinShiHuangScroll extends TargetingScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '焚'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName} will seek to consolidate ${monster.pronouns.his} power and lay waste to ${monster.pronouns.his} biggest foes in the ring by targeting the opponent with the highest xp, unless directed otherwise by a specific card.`;
	}
}

QinShiHuangScroll.itemType = 'The Annals of Qin Shi Huang';
QinShiHuangScroll.targetingStrategy = TARGET_HIGHEST_XP_PLAYER;
QinShiHuangScroll.description = `焚書坑儒

${getStrategyDescription(QinShiHuangScroll.targetingStrategy)}`;

module.exports = QinShiHuangScroll;
