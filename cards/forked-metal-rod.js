/* eslint-disable max-len */

const HornGoreCard = require('./horn-gore');

const ImmobilizeCard = require('./immobilize');

const STARTING_FREEDOM_THRESHOLD_MODIFIER = 3;
const STARTING_DEX_MODIFIER = 3;

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK, JINN, WEEPING_ANGEL } = require('../helpers/creature-types');
const { VERY_RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class ForkedMetalRodCard extends HornGoreCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		freedomSavingThrowTargetAttr,
		icon = '⑂⑂',
		targetProp,
		...rest
	} = {}) {
		super({ freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	resetImmobilizeStrength () {
		this.freedomThresholdModifier = STARTING_FREEDOM_THRESHOLD_MODIFIER;
		this.dexModifier = STARTING_DEX_MODIFIER;
	}

	get mechanics () {
		return `Attack twice (once with each ${this.flavors.spike}). +2 to hit and immobilize for each successfull ${this.flavors.spike} hit.

Chance to immobilize: 1d20 vs ${this.freedomSavingThrowTargetAttr}.`;
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		// if the player stabs with their first horn, make it slightly more likely that the second
		// horn will also stab, but just for this one attack. Therefore, need to store their
		// pre-gore dexModifier and restore it once the second stab is resolved (and before the
		// actual immobilize takes place so it doesn't interfere with the immobilize logic).
		const originalDexModifier = player.encounterModifiers.dexModifier;

		this.resetImmobilizeStrength();
		this.gore(player, target, 1);
		this.gore(player, target, 2);

		player.encounterModifiers.dexModifier = originalDexModifier;

		if (!player.dead) {
			if (target.dead) {
				return false;
			}

			return this.immobilize(player, target, ring, activeContestants);
		}

		return !target.dead;
	}
}

ForkedMetalRodCard.cardType = 'Forked Metal Rod';
ForkedMetalRodCard.permittedClassesAndTypes = [FIGHTER, BARBARIAN];
ForkedMetalRodCard.strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
ForkedMetalRodCard.uselessAgainstCreatureTypes = [WEEPING_ANGEL];
ForkedMetalRodCard.weakAgainstCreatureTypes = [JINN, MINOTAUR];
ForkedMetalRodCard.probability = VERY_RARE.probability;
ForkedMetalRodCard.description = `A dangerously sharp forked metal rod fashioned for ${ForkedMetalRodCard.strongAgainstCreatureTypes.join(' and ')}-hunting.`;
ForkedMetalRodCard.level = 2;
ForkedMetalRodCard.cost = PRICEY.cost;
ForkedMetalRodCard.notForSale = true;

ForkedMetalRodCard.defaults = {
	...HornGoreCard.defaults,
	damageDice: '1d6',
	freedomThresholdModifier: STARTING_FREEDOM_THRESHOLD_MODIFIER,
	freedomSavingThrowTargetAttr: 'str',
	targetProp: 'ac'
};

ForkedMetalRodCard.flavors = {
	hits: [
		['stabs', 80],
		['pokes (in a not-so-facebook-flirting kind of way)', 50],
		['snags and brutally lofts into the air their thoroughly surprised opponent', 5]
	],
	spike: 'prong'
};

module.exports = ForkedMetalRodCard;
