/* eslint-disable max-len */

const TargetingScroll = require('./targeting');
const { ABUNDANT } = require('../../helpers/probabilities');
const { TARGET_NEXT_PLAYER, getStrategyDescription } = require('../../helpers/targeting-strategies');

// The "default" scroll
class ParsifalScroll extends TargetingScroll {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🏇'
	} = {}) {
		super({ icon });
	}

	getTargetingDetails (monster) { // eslint-disable-line class-methods-use-this
		return `${monster.givenName} will obey ${monster.pronouns.his} mother and keep ${monster.pronouns.his} friends close and ${monster.pronouns.his} enemies closer, always attacking the opponent next to ${monster.pronouns.him} unless directed otherwise by a specific card.`;
	}
}

ParsifalScroll.itemType = 'The Gospel According to Parsifal';
ParsifalScroll.numberOfUses = 0;
ParsifalScroll.targetingStrategy = TARGET_NEXT_PLAYER;
ParsifalScroll.description = `My mother said that if you know your enemy and know yourself, you will not be put at risk even in a hundred battles. If you only know yourself, but not your opponent, you may win or may lose. If you know neither yourself nor your enemy, you will always endanger yourself.

${getStrategyDescription(ParsifalScroll.targetingStrategy)}`;
ParsifalScroll.level = 0;
ParsifalScroll.probability = ABUNDANT.probability;

module.exports = ParsifalScroll;
