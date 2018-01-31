/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { BARD, BARBARIAN, FIGHTER } = require('../helpers/classes');
const { BASILISK, GLADIATOR, JINN, MINOTAUR } = require('../helpers/creature-types');
const { UNCOMMON } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');

class ForkedStickCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		freedomSavingThrowTargetAttr,
		icon = '⑂',
		targetProp,
		...rest
	} = {}) {
		super({ freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	// do not auto-succeed since this already hits twice
	immobilizeCheck (player, target) {
		const immobilizeRoll = this.getImmobilizeRoll(player, target);
		const { success: immobilizeSuccess } = this.checkSuccess(immobilizeRoll, target[this.targetProp]);

		const failMessage = `${this.actions.IMMOBILIZE} failed.`;
		const outcome = immobilizeSuccess ? `${this.actions.IMMOBILIZE} succeeded!` : failMessage;

		this.emit('rolled', {
			reason: `to see if ${player.pronouns.he} ${this.actions.IMMOBILIZES} ${target.givenName}.`,
			card: this,
			roll: immobilizeRoll,
			who: player,
			outcome,
			vs: target[this.targetProp]
		});

		if (!immobilizeSuccess) {
			this.emit('miss', {
				attackResult: immobilizeRoll.result,
				immobilizeRoll,
				player,
				target
			});
		}

		return immobilizeSuccess;
	}

	get stats () {
		return `Attempt to immobilize your opponent by ${this.actions.IMMOBILIZING} them between the branches of a forked stick.

Chance to immobilize: 1d20 vs ${this.freedomSavingThrowTargetAttr.toUpperCase()}.
${super.stats}`;
	}
}

ForkedStickCard.cardType = 'Forked Stick';
ForkedStickCard.actions = { IMMOBILIZE: 'pin', IMMOBILIZES: 'pins', IMMOBILIZED: 'pinned', IMMOBILIZING: 'pinning' };
ForkedStickCard.permittedClassesAndTypes = [BARD, BARBARIAN, FIGHTER];
ForkedStickCard.strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
ForkedStickCard.weakAgainstCreatureTypes = [JINN, MINOTAUR];
ForkedStickCard.probability = UNCOMMON.probability;
ForkedStickCard.description = `A simple weapon fashioned for ${ForkedStickCard.strongAgainstCreatureTypes.join(' and ')}-hunting.`;
ForkedStickCard.cost = REASONABLE.cost;
ForkedStickCard.level = 0;

ForkedStickCard.defaults = {
	...ImmobilizeCard.defaults,
	freedomSavingThrowTargetAttr: 'str',
	targetProp: 'dex'
};

ForkedStickCard.flavors = {
	hits: [
		['hits', 80],
		['pokes (in a not-so-facebook-flirting kind of way)', 50],
		['snags and brutally lofts into the air their thoroughly surprised opponent', 5]
	],
	spike: 'branch'
};

module.exports = ForkedStickCard;
