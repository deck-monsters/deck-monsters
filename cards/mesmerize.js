/* eslint-disable max-len */
const Promise = require('bluebird');

const ImmobilizeCard = require('./immobilize');

const {
	GLADIATOR, MINOTAUR, BASILISK, WEEPING_ANGEL
} = require('../helpers/creature-types');

class MesmerizeCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		hitOnFail,
		icon = '🌠',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			attackModifier,
			hitOnFail
		});
	}
	get stats () {
		return `${super.stats}
Chance to immobilize everyone with your shocking beauty.`;
	}

	getFreedomThresholdBase () { // eslint-disable-line class-methods-use-this
		return 10;
	}

	effect (player, target, ring, activeContestants) {
		return Promise.map(activeContestants, ({ monster }) => super.effect(player, monster, ring, activeContestants))
			.then(() => !target.dead);
	}
}

MesmerizeCard.cardType = 'Mesmerize';
MesmerizeCard.actions = ['mesmerize', 'mesmerizes', 'mesmerized'];
MesmerizeCard.strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
MesmerizeCard.probability = 30;
MesmerizeCard.description = `You strut and preen. Your beauty overwhelms and ${MesmerizeCard.actions[1]} everyone, including yourself.`;
MesmerizeCard.permittedClassesAndTypes = [WEEPING_ANGEL];
MesmerizeCard.weakAgainstCreatureTypes = [MINOTAUR, WEEPING_ANGEL];
MesmerizeCard.uselessAgainstCreatureTypes = [];
MesmerizeCard.defaults = {
	...ImmobilizeCard.defaults,
	attackModifier: 2,
	hitOnFail: false,
	freedomThresholdModifier: 0
};

MesmerizeCard.flavors = {
	hits: [
		[MesmerizeCard.actions[1], 80],
		['uses their natural beauty to overwhelm', 30],
		[`${MesmerizeCard.actions[1]} even Narcissus himself with their beauty... Which leaves no hope for`, 5]
	]
};

module.exports = MesmerizeCard;
