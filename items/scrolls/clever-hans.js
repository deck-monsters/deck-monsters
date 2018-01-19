/* eslint-disable max-len */

const TargetingScroll = require('./targeting');
const { TARGET_NEXT_PLAYER } = require('../../helpers/targeting-strategies');

// The "default" scroll
class CleverHansScroll extends TargetingScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🐎'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName} will obey ${monster.pronouns.his} mother and keep ${monster.pronouns.his} friends close and ${monster.pronouns.his} enemies closer, always attacking the next opponent in line unless directed otherwise by a specific card.`;
	}
}

CleverHansScroll.itemType = 'The Gospel According to Clever Hans';
CleverHansScroll.numberOfUses = 0;
CleverHansScroll.description = `My mother said that if you know your enemy and know yourself, you will not be put at risk even in a hundred battles. If you only know yourself, but not your opponent, you may win or may lose. If you know neither yourself nor your enemy, you will always endanger yourself.

Keep your strategy simple: your opponent is always the person next to you.`;
CleverHansScroll.level = 0;
CleverHansScroll.targetingStrategy = TARGET_NEXT_PLAYER;

module.exports = CleverHansScroll;
