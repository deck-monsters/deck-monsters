import { HitCard } from './hit.js';
import { chance } from '../helpers/chance.js';
import { BARBARIAN, FIGHTER } from '../constants/creature-classes.js';
import { COMMON } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';

const { roll, max } = chance;

export class HitHarder extends HitCard {
	static cardType = 'Hit Harder';
	static permittedClassesAndTypes = [BARBARIAN, FIGHTER];
	static probability = COMMON.probability;
	static description =
		'You hit just a little bit harder than the average bear...';
	static level = 2;
	static cost = EXPENSIVE.cost;
	static defaults = {
		...HitCard.defaults,
		damageDice: '1d6',
	};
	static flavors = {
		hits: [
			['pounds', 80],
			['mercilessly beats', 70],
			['trashes', 70],
			['clubs', 50],
			['lifts up a nearby tree and bashes', 5],
		],
	};

	constructor({
		damageDice,
		icon = '🔨',
		...rest
	}: Record<string, any> = {}) {
		super({ damageDice, icon, ...rest } as any);
	}

	override get stats(): string {
		return `${super.stats}\nRoll for damage twice, and use the best result.`;
	}

	override getDamageRoll(player: any): any {
		const damageRoll1 = roll({
			primaryDice: this.damageDice,
			modifier: player.strModifier,
			bonusDice: player.bonusAttackDice,
		});
		const damageRoll2 = roll({
			primaryDice: this.damageDice,
			modifier: player.strModifier,
			bonusDice: player.bonusAttackDice,
		});

		return {
			betterRoll:
				damageRoll2.naturalRoll.result > damageRoll1.naturalRoll.result
					? damageRoll2
					: damageRoll1,
			worseRoll:
				damageRoll2.naturalRoll.result < damageRoll1.naturalRoll.result
					? damageRoll2
					: damageRoll1,
		};
	}

	override rollForDamage(player: any, target: any, strokeOfLuck?: boolean): any {
		const { betterRoll, worseRoll } = this.getDamageRoll(player) as any;

		if (strokeOfLuck) {
			betterRoll.naturalRoll.result = max(this.damageDice);
			betterRoll.result = max(this.damageDice) + betterRoll.modifier;
		} else {
			const commentary = `Natural rolls were ${betterRoll.naturalRoll.result} and ${worseRoll.naturalRoll.result}; used ${betterRoll.naturalRoll.result} as better roll.`;

			if (betterRoll.result === 0) {
				betterRoll.result = 1;
			}

			let reason: string;
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
				outcome: commentary,
			});
		}

		return betterRoll;
	}
}

export default HitHarder;
