/* eslint-disable max-len */
const HitCard = require('./hit');
const { roll } = require('../helpers/chance');
const { CLERIC } = require('../helpers/classes');

class Rehit extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🔂',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	hitCheck (player, target) {
		let attackRoll = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
		let commentary = `Originally rolled ${attackRoll.naturalRoll.result}`;

		if (attackRoll.naturalRoll.result < 10) {
			attackRoll = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
			commentary += ', which was less than 10. Rerolled and used second roll.';
		} else {
			commentary += ', which was greater than 10. Kept first roll.';
		}

		this.emit('rolling', {
			reason: `vs AC (${target.ac}) to determine if the hit was a success. If roll is less than 10, rolls again and uses second roll.`,
			card: this,
			roll: attackRoll,
			player,
			target
		});

		const { success, strokeOfLuck, curseOfLoki } = this.checkSuccess(attackRoll, target.ac);

		if (strokeOfLuck) {
			commentary += ` ${player.givenName} rolled a natural 20. Automatic double max damage.`;
		} else if (curseOfLoki) {
			commentary += ` ${player.givenName} rolled a 1. Even if ${player.pronouns[0]} would have otherwise hit, ${player.pronouns[0]} misses.`;
		}

		this.emit('rolled', {
			reason: `vs AC (${target.ac})`,
			card: this,
			roll: attackRoll,
			player,
			target,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...'
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
Rehit.probability = 50;
Rehit.description = 'Roll for attack, if you roll less than 10, roll again and use the second roll no matter what.';
Rehit.cost = 5;
Rehit.level = 2;
Rehit.permittedClassesAndTypes = [CLERIC];

module.exports = Rehit;
