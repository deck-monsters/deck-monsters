/* eslint-disable max-len */
const Promise = require('bluebird');

const ImmobilizeCard = require('./immobilize');
const { roll } = require('../helpers/chance');

const {
	BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL
} = require('../helpers/creature-types');

class MesmerizeCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		dexModifier,
		hitOnFail,
		icon = '🌠',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			dexModifier,
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

	getAttackRoll (player, target) {
		return roll({ primaryDice: this.attackDice, modifier: player.intModifier + this.getAttackModifier(target), bonusDice: player.bonusAttackDice, crit: true });
	}

	getTargetPropValue (target) { // eslint-disable-line class-methods-use-this
		return target.int;
	}

	effect (player, target, ring, activeContestants) {
		return Promise.map(activeContestants, ({ monster }) => super.effect(player, monster, ring, activeContestants))
			.then(() => !target.dead);
	}
}

MesmerizeCard.cardType = 'Mesmerize';
MesmerizeCard.actions = ['mesmerize', 'mesmerizes', 'mesmerized'];
MesmerizeCard.permittedClassesAndTypes = [WEEPING_ANGEL];
MesmerizeCard.strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
MesmerizeCard.weakAgainstCreatureTypes = [JINN, MINOTAUR, WEEPING_ANGEL];
MesmerizeCard.uselessAgainstCreatureTypes = [];
MesmerizeCard.probability = 30;
MesmerizeCard.description = `You strut and preen. Your beauty overwhelms and ${MesmerizeCard.actions[1]} everyone, including yourself.`;
MesmerizeCard.cost = 15;

MesmerizeCard.defaults = {
	...ImmobilizeCard.defaults,
	dexModifier: 2,
	hitOnFail: false,
	freedomThresholdModifier: 0
};

MesmerizeCard.flavors = {
	hits: [
		['overwhelms', 80],
		['uses their natural beauty to overwhelm', 30],
		['stuns', 30]
	]
};

module.exports = MesmerizeCard;
