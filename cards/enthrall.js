/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const MesmerizeCard = require('./mesmerize');

const {
	GLADIATOR, MINOTAUR, BASILISK, WEEPING_ANGEL
} = require('../helpers/creature-types');

class EnthrallCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		dexModifier,
		hitOnFail,
		icon = '🎇',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			dexModifier,
			hitOnFail
		});

		this.mesmerizeCard = new MesmerizeCard();
	}
	get stats () { // eslint-disable-line class-methods-use-this
		return `${super.stats}
Chance to immobilize your opponents with your shocking beauty.`;
	}

	getFreedomThresholdBase (player) {
		return this.mesmerizeCard.getFreedomThresholdBase(player);
	}

	getAttackRoll (player, target) {
		return this.mesmerizeCard.getAttackRoll(player, target);
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return activeContestants.map(({ monster }) => monster).filter(target => target !== player);
	}
}

EnthrallCard.cardType = 'Enthrall';
EnthrallCard.actions = ['enthrall', 'enthralls', 'enthralled'];
EnthrallCard.level = 2;
EnthrallCard.strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
EnthrallCard.probability = 30;
EnthrallCard.description = `You strut and preen. Your beauty overwhelms and ${EnthrallCard.actions[1]} everyone, except yourself.`;
EnthrallCard.permittedClassesAndTypes = [WEEPING_ANGEL];
EnthrallCard.weakAgainstCreatureTypes = [MINOTAUR, WEEPING_ANGEL];
EnthrallCard.uselessAgainstCreatureTypes = [];

EnthrallCard.defaults = {
	...ImmobilizeCard.defaults,
	dexModifier: 2,
	hitOnFail: false,
	freedomThresholdModifier: 1
};

EnthrallCard.flavors = {
	hits: [
		['stuns', 80],
		['uses their natural beauty to incapacitate', 30],
		['burns even Narcissus himself with their beauty... Which leaves no hope for', 5]
	]
};

module.exports = EnthrallCard;
