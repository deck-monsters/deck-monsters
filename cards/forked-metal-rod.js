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
Chance to immobilize opponent by capturing their neck between strong prongs.

Chance to do damage.`;
	}
}

ForkedMetalRodCard.cardType = 'Forked Metal Rod';
ForkedMetalRodCard.probability = 20;
ForkedMetalRodCard.description = `A dangerously strong weapon fashioned for ${ForkedStickCard.creatureTypes[1]}-hunting.`;
ForkedMetalRodCard.level = 2;
ForkedMetalRodCard.defaults = {
	...ForkedStickCard.defaults,
	attackModifier: 3,
	hitOnFail: true,
	freedomThresholdModifier: 1.5
};

module.exports = ForkedMetalRodCard;
