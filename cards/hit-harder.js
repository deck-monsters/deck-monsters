/* eslint-disable max-len */

const HitCard = require('./hit');
const { roll, max } = require('../helpers/chance');

class HitHarder extends HitCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			damageDice: '1d6', // Lucky you, the pound card does double damage
			icon: '🔨'
		};

		super(Object.assign(defaultOptions, options));
	}

	rollForDamage (player, target, strokeOfLuck) {
		const damageRoll1 = roll({ primaryDice: this.damageDice, modifier: player.damageModifier, bonusDice: player.bonusAttackDice });
		const damageRoll2 = roll({ primaryDice: this.damageDice, modifier: player.damageModifier, bonusDice: player.bonusAttackDice });

		const betterRoll = (damageRoll2.naturalRoll.result > damageRoll1.naturalRoll.result) ? damageRoll2 : damageRoll1;
		const worseRoll = (damageRoll2.naturalRoll.result < damageRoll1.naturalRoll.result) ? damageRoll2 : damageRoll1;

		let commentary = `Natural rolls were ${betterRoll.naturalRoll.result} and ${worseRoll.naturalRoll.result}; used ${betterRoll.naturalRoll.result} as better roll.`;

		this.emit('rolling', {
			reason: 'for damage twice and uses the best roll',
			card: this,
			roll: betterRoll,
			player,
			target,
			outcome: ''
		});

		if (strokeOfLuck) {
			// change the natural roll into a max roll
			betterRoll.naturalRoll.result = max(this.damageDice);
			betterRoll.result = max(this.damageDice) * 2;
		}

		if (betterRoll.result === 0) {
			betterRoll.result = 1;
		}

		this.emit('rolled', {
			reason: 'for damage',
			card: this,
			roll: betterRoll,
			player,
			target,
			outcome: commentary
		});

		return betterRoll;
	}
}

HitHarder.cardType = 'Hit Harder';
HitHarder.probability = 20;
HitHarder.description = 'You hit just a little bit harder than the average bear... Roll for damage twice, and use the best result.';

module.exports = HitHarder;
