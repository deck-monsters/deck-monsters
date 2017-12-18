/* eslint-disable max-len */

const ForkedStickCard = require('./forked-stick');
const ImmobilizeCard = require('./immobilize');

class ForkedMetalRodCard extends ForkedStickCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '⑂⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () { // eslint-disable-line class-methods-use-this
		const immobilize = new ImmobilizeCard();

		return `${immobilize.stats}
Attempt to immobilize your opponent by capturing their neck between strong sharp prongs.

Even if you miss, there's a chance you'll just stab them instead...`;
	}
}

ForkedMetalRodCard.cardType = 'Forked Metal Rod';
ForkedMetalRodCard.probability = 20;
ForkedMetalRodCard.description = `A dangerously sharp forked metal rod fashioned for ${ForkedStickCard.strongAgainstCreatureTypes[1]}-hunting.`;
ForkedMetalRodCard.level = 2;
ForkedMetalRodCard.defaults = {
	...ForkedStickCard.defaults,
	attackModifier: 3,
	hitOnFail: true,
	freedomThresholdModifier: 3
};

module.exports = ForkedMetalRodCard;
