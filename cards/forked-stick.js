/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { BARD, BARBARIAN, FIGHTER } = require('../helpers/classes');
const { BASILISK, GLADIATOR, JINN, MINOTAUR } = require('../helpers/creature-types');
const { UNCOMMON } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');

class ForkedStickCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	getTargetPropValue (target) { // eslint-disable-line class-methods-use-this
		return target.dex;
	}

	// do not auto-succeed since this already hits twice
	immobilizeCheck (player, target) {
		const attackRoll = this.getAttackRoll(player, target);
		const attackSuccess = this.checkSuccess(attackRoll, this.getTargetPropValue(target));

		const failMessage = `${this.actions.IMMOBILIZE} failed.`;
		const outcome = attackSuccess.success ? `${this.actions.IMMOBILIZE} succeeded!` : failMessage;

		this.emit('rolled', {
			reason: `to see if ${player.pronouns.he} ${this.actions.IMMOBILIZES} ${target.givenName}.`,
			card: this,
			roll: attackRoll,
			who: player,
			outcome,
			vs: this.getTargetPropValue(target)
		});

		if (!attackSuccess) {
			this.emit('miss', {
				attackResult: attackRoll.result,
				attackRoll,
				player,
				target
			});
		}

		return attackSuccess;
	}

	get stats () {
		return `Attempt to pin your opponent between the branches of a forked stick.

If immobilized, then hit.
${super.stats}`;
	}
}

ForkedStickCard.cardType = 'Forked Stick';
ForkedStickCard.actions = { IMMOBILIZE: 'pin', IMMOBILIZES: 'pins', IMMOBILIZED: 'pinned' };
ForkedStickCard.permittedClassesAndTypes = [BARD, BARBARIAN, FIGHTER];
ForkedStickCard.strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
ForkedStickCard.weakAgainstCreatureTypes = [JINN, MINOTAUR];
ForkedStickCard.probability = UNCOMMON.probability;
ForkedStickCard.description = `A simple weapon fashioned for ${ForkedStickCard.strongAgainstCreatureTypes.join(' and ')}-hunting.`;
ForkedStickCard.cost = REASONABLE.cost;
ForkedStickCard.level = 0;

ForkedStickCard.defaults = {
	...ImmobilizeCard.defaults
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
