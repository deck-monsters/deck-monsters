/* eslint-disable max-len */

const HitCard = require('./hit');

const { roll, max } = require('../helpers/chance');
const { BARBARIAN, FIGHTER } = require('../helpers/classes');

class HitHarder extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageDice,
		icon = '🔨',
		...rest
	} = {}) {
		super({ damageDice, icon, ...rest });
	}

	getDamageRoll (player) {
		const damageRoll1 = roll({ primaryDice: this.damageDice, modifier: player.strengthModifier, bonusDice: player.bonusAttackDice });
		const damageRoll2 = roll({ primaryDice: this.damageDice, modifier: player.strengthModifier, bonusDice: player.bonusAttackDice });

		return {
			betterRoll: (damageRoll2.naturalRoll.result > damageRoll1.naturalRoll.result) ? damageRoll2 : damageRoll1,
			worseRoll: (damageRoll2.naturalRoll.result < damageRoll1.naturalRoll.result) ? damageRoll2 : damageRoll1
		};
	}

	rollForDamage (player, target, strokeOfLuck) {
		const { betterRoll, worseRoll } = this.getDamageRoll(player);

		if (strokeOfLuck) {
			// change the natural roll into a max roll
			betterRoll.naturalRoll.result = max(this.damageDice);
			betterRoll.result = max(this.damageDice) + betterRoll.modifier;
		} else {
			const commentary = `Natural rolls were ${betterRoll.naturalRoll.result} and ${worseRoll.naturalRoll.result}; used ${betterRoll.naturalRoll.result} as better roll.`;

			this.emit('rolling', {
				reason: `twice for damage against ${target.givenName} and uses the best roll`,
				card: this,
				roll: betterRoll,
				player,
				target,
				outcome: ''
			});

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
		}

		return betterRoll;
	}
}

HitHarder.cardType = 'Hit Harder';
HitHarder.probability = 50;
HitHarder.description = 'You hit just a little bit harder than the average bear... Roll for damage twice, and use the best result.';
HitHarder.cost = 6;
HitHarder.level = 2;
HitHarder.permittedClassesAndTypes = [BARBARIAN, FIGHTER];
HitHarder.defaults = {
	...HitCard.defaults,
	damageDice: '1d6'
};

HitHarder.flavors = {
	hits: [
		['pounds', 80],
		['mercilessly beats', 70],
		['trashes', 70],
		['clubs', 50],
		['lifts up a nearby tree and bashes', 5]
	]
};

module.exports = HitHarder;
