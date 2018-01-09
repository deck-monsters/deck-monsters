/* eslint-disable max-len */

const HornGoreCard = require('./horn-gore');
const ImmobilizeCard = require('./immobilize');

const STARTING_FREEDOM_THRESHOLD_MODIFIER = 3;
const STARTING_ATTACK_MODIFIER = 3;

class ForkedMetalRodCard extends HornGoreCard {
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

	resetImmobilizeStrength () {
		this.freedomThresholdModifier = STARTING_FREEDOM_THRESHOLD_MODIFIER;
		this.attackModifier = STARTING_ATTACK_MODIFIER;
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		// if the player stabs with their first horn, make it slightly more likely that the second
		// horn will also stab, but just for this one attack. Therefore, need to store their
		// pre-gore attackModifier and restore it once the second stab is resolved (and before the
		// actual immobilize takes place so it doesn't interfere with the immobilize logic).
		const originalAttackModifier = player.encounterModifiers.attackModifier;

		this.resetImmobilizeStrength();
		const horn1 = this.gore(player, target, 1);
		const horn2 = this.gore(player, target, 2);
		const didHit = horn1.success || horn2.success;

		player.encounterModifiers = { attackModifier: originalAttackModifier };

		if (!player.dead) {
			if (target.dead) {
				return false;
			}

			return super.effect(player, target, ring, activeContestants);
		}

		return !target.dead;
	}
}

ForkedMetalRodCard.cardType = 'Forked Metal Rod';
ForkedMetalRodCard.probability = 20;
ForkedMetalRodCard.description = `A dangerously sharp forked metal rod fashioned for ${HornGoreCard.strongAgainstCreatureTypes[1]}-hunting.`;
ForkedMetalRodCard.level = 2;
ForkedStickCard.strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
ForkedStickCard.permittedClassesAndTypes = [FIGHTER, BARBARIAN];
ForkedStickCard.weakAgainstCreatureTypes = [MINOTAUR];
ForkedMetalRodCard.defaults = {
	...HornGoreCard.defaults,
	freedomThresholdModifier: STARTING_FREEDOM_THRESHOLD_MODIFIER,
	attackModifier: STARTING_ATTACK_MODIFIER
};

ForkedMetalRodCard.actions = ['pin', 'pins', 'pinned'];

ForkedMetalRodCard.flavors = {
	hits: [
		[`${ForkedMetalRodCard.actions[1]} to the ground, the head of`, 80],
		[`${ForkedMetalRodCard.actions[1]} to the wall, the neck of`, 50],
		['in a fit of brute strength, snags by the neck, and brutally lofts into the air, their thoroughly surprised opponent', 5]
	]
};

module.exports = ForkedMetalRodCard;
