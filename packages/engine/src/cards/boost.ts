import { BaseCard, type CardOptions } from './base.js';
import { BOOST } from '../constants/card-classes.js';
import { COMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';
import { difference } from '../helpers/difference.js';
import { flavor } from '../helpers/flavor.js';

export interface BoostCardOptions extends CardOptions {
	boostAmount?: number;
	boostedProp?: string;
}

export class BoostCard extends BaseCard<BoostCardOptions> {
	static cardClass = [BOOST];
	static cardType = 'Harden';
	static probability = COMMON.probability;
	static description = "It's time to put on your big boy pants, and toughen up!";
	static level = 1;
	static cost = VERY_CHEAP.cost;
	static defaults = {
		boostAmount: 1,
		boostedProp: 'ac',
	};

	constructor({
		boostAmount,
		icon = '🆙',
		boostedProp,
	}: Partial<BoostCardOptions> = {}) {
		super({ boostAmount, icon, boostedProp } as Partial<BoostCardOptions>);
	}

	get boostAmount(): number {
		return (this.options as BoostCardOptions).boostAmount!;
	}

	get boostedProp(): string {
		return (this.options as BoostCardOptions).boostedProp!;
	}

	get stats(): string {
		const acBoost =
			this.boostedProp === 'ac'
				? '\nIf hit by melee attack, damage comes out of ac boost first.'
				: '';
		return `Boost: ${this.boostedProp} +${this.boostAmount} (max boost of level * 2, or 1 for beginner, then boost granted to hp instead).${acBoost}`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	getBoostNarrative(_player: any, target: any): string {
		const items: Record<string, any[]> = {
			str: [
				['pops some Ant nectar', 50],
				['eats some Mississippi Quantum Pie', 30],
				['drinks some beer', 60],
				['pops some Buffout', 50],
			],
			int: [
				['pops some Mentats', 50],
				['pops some Berry Mentats', 30],
				["puts on Button's wig", 10],
				["puts on Lincoln's hat", 10],
			],
			ac: [
				['pops some Buffout', 50],
				['drinks some Nuka-Cola Quantum', 60],
				['eats some Nukalurk meat', 40],
				['drinks some Jet', 30],
				['drinks some Ultrajet', 10],
			],
			dex: [
				['drinks some Fire ant nectar', 60],
				["puts on  Poplar's hood", 10],
				["wishes on the monkey's paw", 1],
			],
			hp: [
				['eats a red mushroom', 40],
				['absorbs a purple circle strangely floating in the air', 30],
				['tears open a suspicious foil packet labeled "HP+"', 10],
				['steps on a red-cross med-pack', 10],
			],
		};

		const { text: flavorText } = flavor.getFlavor(
			this.boostedProp as any,
			items as any
		);
		return `${target.givenName} ${flavorText} and boosts their ${this.boostedProp}`;
	}

	getBoostOverflowNarrative(_player: any, target: any): string {
		return `${target.givenName}'s ${this.boostedProp} boosts have been maxed out. Boost will be granted to hp instead.`;
	}

	async effect(player: any, target: any): Promise<any> {
		const preBoostedPropValue = target[this.boostedProp];
		let { boostAmount } = this;
		const postBoostedPropValue = preBoostedPropValue + boostAmount;
		const preBattlePropValue = target.getPreBattlePropValue(this.boostedProp);
		const aggregateTotalBoostAmount = difference(
			preBattlePropValue,
			postBoostedPropValue
		);

		const hpBoostOverflow =
			this.boostedProp !== 'hp'
				? aggregateTotalBoostAmount -
				  target.getMaxModifications(this.boostedProp)
				: 0;
		if (hpBoostOverflow > 0) {
			boostAmount -= hpBoostOverflow;
			this.emit('narration', {
				narration: this.getBoostOverflowNarrative(player, target),
			});
			await player.heal(hpBoostOverflow, target, this);
		}

		if (boostAmount > 0) {
			this.emit('narration', {
				narration: this.getBoostNarrative(player, target),
			});
			target.setModifier(this.boostedProp, boostAmount);
		}

		return true;
	}
}

export default BoostCard;
