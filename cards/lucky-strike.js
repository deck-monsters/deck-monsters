/* eslint-disable max-len */

const HitCard = require('./hit');
const { roll, max, nat20 } = require('../helpers/chance');

class LuckyStrike extends HitCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			icon: '🚬'
		};

		super(Object.assign(defaultOptions, options));
	}

	hitCheck (player, target) {
		const attackRoll1 = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });
		const attackRoll2 = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		const betterRoll = (attackRoll2.naturalRoll.result > attackRoll1.naturalRoll.result) ? attackRoll2 : attackRoll1;
		const worseRoll = (attackRoll2.naturalRoll.result < attackRoll1.naturalRoll.result) ? attackRoll2 : attackRoll1;

		this.emit('rolling', {
			reason: `vs AC (${target.ac}) twice to determine if the hit was a success, and uses the best roll.`,
			card: this,
			roll: betterRoll,
			player,
			target
		});

		let strokeOfLuck = false;
		let curseOfLoki = false;
		let commentary = `Natural rolls were ${betterRoll.naturalRoll.result} and ${worseRoll.naturalRoll.result}; used ${betterRoll.naturalRoll.result} as better roll.`;

		if (betterRoll.naturalRoll.result === max(this.attackDice)) {
			strokeOfLuck = true;

			commentary += 'Nice roll! ';

			if (nat20(betterRoll)) {
				commentary += `${player.givenName} rolled a natural 20. `;
			}

			commentary += `Automatic double max damage.`;
		} else if (betterRoll.naturalRoll.result === 1) {
			curseOfLoki = true;

			commentary = `${player.givenName} rolled a 1. Even if ${player.pronouns[0]} would have otherwise hit, ${player.pronouns[0]} misses.`;
		}

		// results vs AC
		const success = strokeOfLuck || (!curseOfLoki && target.ac < betterRoll.result);

		this.emit('rolled', {
			reason: `vs AC (${target.ac})`,
			card: this,
			roll: betterRoll,
			strokeOfLuck,
			curseOfLoki,
			player,
			target,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...'
		});

		return {
			attackRoll: betterRoll,
			success,
			strokeOfLuck,
			curseOfLoki
		};
	}
}

LuckyStrike.cardType = 'Lucky Strike';
LuckyStrike.probability = 20;
LuckyStrike.description = 'Roll for attack twice, use the best roll to see if you hit.';

module.exports = LuckyStrike;
