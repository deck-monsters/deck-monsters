/* eslint-disable max-len */

/*
	Eventually this card will become a lower energy card that instead modifies the next card that is played.
	It will make the next roll be a re-rollable roll. The mechanics are not in place for card chaining yet.
*/

const HitCard = require('./hit');
const { roll, max, nat20 } = require('../helpers/chance');

class Rehit extends HitCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			icon: '🔂'
		};

		super(Object.assign(defaultOptions, options));
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

		let strokeOfLuck = false;
		let curseOfLoki = false;

		if (attackRoll.naturalRoll.result === max(this.attackDice)) {
			strokeOfLuck = true;

			commentary += 'Nice roll! ';

			if (nat20(attackRoll)) {
				commentary += `${player.givenName} rolled a natural 20. `;
			}

			commentary += 'Automatic double max damage.';
		} else if (attackRoll.naturalRoll.result === 1) {
			curseOfLoki = true;

			commentary = `${player.givenName} rolled a 1. Even if ${player.pronouns[0]} would have otherwise hit, ${player.pronouns[0]} misses.`;
		}

		// results vs AC
		const success = strokeOfLuck || (!curseOfLoki && target.ac < attackRoll.result);

		this.emit('rolled', {
			reason: `vs AC (${target.ac})`,
			card: this,
			roll: attackRoll,
			strokeOfLuck,
			curseOfLoki,
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
Rehit.probability = 20;
Rehit.description = 'Roll for attack, if you roll less than 10, roll again and use the second roll no matter what.';
Rehit.cost = 5;
Rehit.level = 2;

module.exports = Rehit;
