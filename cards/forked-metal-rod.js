/* eslint-disable max-len */

const HornGoreCard = require('./horn-gore');

const ImmobilizeCard = require('./immobilize');

const STARTING_FREEDOM_THRESHOLD_MODIFIER = 3;
const STARTING_ATTACK_MODIFIER = 3;

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');

class ForkedMetalRodCard extends HornGoreCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '⑂⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.immobilizeCard = new ImmobilizeCard({ strongAgainstCreatureTypes: this.strongAgainstCreatureTypes });
	}

	get stats () { // eslint-disable-line class-methods-use-this
		return `${this.immobilizeCard.stats}
Attempt to stab your opponent with strong sharp prongs.

Even if you miss, there's a chance you'll pin them...`;
	}

	resetImmobilizeStrength () {
		this.freedomThresholdModifier = STARTING_FREEDOM_THRESHOLD_MODIFIER;
		this.dexModifier = STARTING_ATTACK_MODIFIER;
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		// if the player stabs with their first horn, make it slightly more likely that the second
		// horn will also stab, but just for this one attack. Therefore, need to store their
		// pre-gore dexModifier and restore it once the second stab is resolved (and before the
		// actual immobilize takes place so it doesn't interfere with the immobilize logic).
		const originalAttackModifier = player.encounterModifiers.dexModifier;

		this.resetImmobilizeStrength();
		this.gore(player, target, 1);
		this.gore(player, target, 2);

		player.encounterModifiers = { dexModifier: originalAttackModifier };

		if (!player.dead) {
			if (target.dead) {
				return false;
			}

			return this.immobilizeCard.effect(player, target, ring, activeContestants);
		}

		return !target.dead;
	}
}

ForkedMetalRodCard.cardType = 'Forked Metal Rod';
ForkedMetalRodCard.probability = 20;
ForkedMetalRodCard.level = 2;
ForkedMetalRodCard.strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
ForkedMetalRodCard.permittedClassesAndTypes = [FIGHTER, BARBARIAN];
ForkedMetalRodCard.weakAgainstCreatureTypes = [MINOTAUR];
ForkedMetalRodCard.description = `A dangerously sharp forked metal rod fashioned for ${ForkedMetalRodCard.strongAgainstCreatureTypes.join(' and ')}-hunting.`;
ForkedMetalRodCard.defaults = {
	...HornGoreCard.defaults,
	freedomThresholdModifier: STARTING_FREEDOM_THRESHOLD_MODIFIER,
	dexModifier: STARTING_ATTACK_MODIFIER
};

ForkedMetalRodCard.actions = ['pin', 'pins', 'pinned'];

ForkedMetalRodCard.flavors = {
	hits: [
		['stabs', 80],
		['pokes (in a not-so-facebook-flirting kind of way)', 50],
		['snags and brutally lofts into the air their thoroughly surprised opponent', 5]
	]
};

module.exports = ForkedMetalRodCard;
