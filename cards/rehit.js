/* eslint-disable max-len */

/*
	Eventually this card will become a lower energy card that instead modifies the next card that is played.
	It will make the next roll be a re-rollable roll. The mechanics are not in place for card chaining yet.
*/

const HitCard = require('./hit');

const { roll } = require('../helpers/chance');
const { BARD, CLERIC } = require('../helpers/classes');

class Rehit extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🔂',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	hitCheck (player, target) {
		let attackRoll = roll({ primaryDice: this.attackDice, modifier: player.dexModifier, bonusDice: player.bonusAttackDice, crit: true });
		let commentary = `Originally rolled ${attackRoll.naturalRoll.result}`;

		if (attackRoll.naturalRoll.result < 10) {
			attackRoll = roll({ primaryDice: this.attackDice, modifier: player.dexModifier, bonusDice: player.bonusAttackDice, crit: true });
			commentary += ', which was less than 10. Rerolled and used second roll.';
		} else {
			commentary += ', which was greater than 10. Kept first roll.';
		}

		const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(attackRoll, target.ac);

		if (strokeOfLuck) {
			commentary += ` ${player.givenName} rolled a natural 20. Automatic double max damage.`;
		} else if (curseOfLoki) {
			commentary += ` ${player.givenName} rolled a 1. Even if ${player.pronouns.he} would have otherwise hit, ${player.pronouns.he} misses.`;
		} else if (tie) {
			commentary = 'Miss... Tie goes to the defender.';
		}

		this.emit('rolled', {
			reason: `vs ac (${target.ac}) to determine if the hit was a success.`,
			card: this,
			roll: attackRoll,
			player,
			target,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...',
			vs: target.ac
		});

		return {
			attackRoll,
			success,
			strokeOfLuck,
			curseOfLoki
		};
	}
}

Rehit.cardType = 'Rehit';
Rehit.permittedClassesAndTypes = [BARD, CLERIC];
Rehit.probability = 40;
Rehit.description = 'Roll for attack, if you roll less than 10, roll again and use the second roll no matter what.';
Rehit.level = 2;
Rehit.cost = 15;

module.exports = Rehit;
