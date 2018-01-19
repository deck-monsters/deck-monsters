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
		const damageRoll1 = roll({ primaryDice: this.damageDice, modifier: player.strModifier, bonusDice: player.bonusAttackDice });
		const damageRoll2 = roll({ primaryDice: this.damageDice, modifier: player.strModifier, bonusDice: player.bonusAttackDice });

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

			if (betterRoll.result === 0) {
				betterRoll.result = 1;
			}

			let reason;
			if (player === target) {
				reason = `for damage against ${target.pronouns.him}self.`;
			} else {
				reason = `for damage against ${target.givenName}.`;
			}

			this.emit('rolled', {
				reason,
				card: this,
				roll: betterRoll,
				who: player,
				outcome: commentary
			});
		}

		return betterRoll;
	}
}

HitHarder.cardType = 'Hit Harder';
HitHarder.permittedClassesAndTypes = [BARBARIAN, FIGHTER];
HitHarder.probability = 50;
HitHarder.description = 'You hit just a little bit harder than the average bear... Roll for damage twice, and use the best result.';
HitHarder.level = 2;
HitHarder.cost = 30;

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
