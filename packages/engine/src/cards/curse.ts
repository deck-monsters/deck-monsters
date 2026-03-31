import { HitCard } from './hit.js';
import { chance } from '../helpers/chance.js';
import { difference } from '../helpers/difference.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';
import * as STATS from '../constants/stats.js';

const { roll, max } = chance;

export interface CurseCardOptions {
	curseAmount?: number;
	cursedProp?: string;
	hasChanceToHit?: boolean;
	[key: string]: unknown;
}

export class CurseCard extends HitCard {
	static cardType = 'Soften';
	static probability = UNCOMMON.probability;
	static description = 'Sweep the leg... You have a problem with that? No mercy.';
	static level = 1;
	static cost = VERY_CHEAP.cost;
	static defaults = {
		...HitCard.defaults,
		curseAmount: -1,
		cursedProp: 'ac',
		hasChanceToHit: true,
		damageDice: '1d4',
	};

	constructor({
		curseAmount,
		icon = '😖',
		cursedProp,
		hasChanceToHit,
		...rest
	}: Record<string, any> = {}) {
		super({ icon, ...rest });
		this.setOptions({ hasChanceToHit, cursedProp, curseAmount } as any);
	}

	get hasChanceToHit(): boolean {
		return (this.options as any).hasChanceToHit;
	}

	set curseAmount(curseAmount: number) {
		this.setOptions({ curseAmount } as any);
	}

	get curseAmount(): number {
		return (this.options as any).curseAmount;
	}

	get cursedProp(): string {
		return (this.options as any).cursedProp;
	}

	get curseDescription(): string {
		return `Curse: ${this.cursedProp} ${this.curseAmount}`;
	}

	override get stats(): string {
		const maxMod = (STATS.MAX_PROP_MODIFICATIONS as any)[this.cursedProp] ?? 1;
		let stats = `${this.curseDescription}, with a maximum total curse of -${maxMod * 3} per level. Afterwards penalties come out of hp instead.`;
		if (this.hasChanceToHit) {
			stats = `${super.stats}\n${stats}`;
		}
		return stats;
	}

	getCurseNarrative(player: any, target: any): string {
		const targetName =
			target.givenName === player.givenName
				? `${player.pronouns.him}self`
				: target.givenName;
		return `${player.givenName} skillfully harries ${targetName} with a targetted sweeping blow intended to sting and distract.`;
	}

	getCurseOverflowNarrative(player: any, target: any): string {
		const playerName =
			target.givenName === player.givenName
				? player.pronouns.his
				: `${player.givenName}'s`;
		return `${target.givenName}'s ${this.cursedProp} penalties have been maxed out.\n${playerName} harrying jab takes from hp instead.`;
	}

	override getAttackRoll(player: any): any {
		return roll({
			primaryDice: this.attackDice,
			modifier: player.intModifier,
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	override effect(player: any, target: any, ring: any, _activeContestants?: any): any {
		const preCursedPropValue = target[this.cursedProp];
		let curseAmount = Math.abs(this.curseAmount);
		const postCursedPropValue = preCursedPropValue - curseAmount;
		const preBattlePropValue = target.getPreBattlePropValue(this.cursedProp);
		const aggregateTotalCurseAmount = difference(
			preBattlePropValue,
			postCursedPropValue
		);

		const maxMod = (STATS.MAX_PROP_MODIFICATIONS as any)[this.cursedProp] ?? 1;
		const hpCurseOverflow =
			this.cursedProp !== 'hp'
				? aggregateTotalCurseAmount - target.getMaxModifications(this.cursedProp)
				: 0;
		if (hpCurseOverflow > 0) {
			curseAmount -= hpCurseOverflow;
			this.emit('narration', {
				narration: this.getCurseOverflowNarrative(player, target),
			});
			target.hit(
				Math.min(hpCurseOverflow, max(this.damageDice)),
				player,
				this
			);
		}

		if (curseAmount > 0) {
			this.emit('narration', {
				narration: this.getCurseNarrative(player, target),
			});
			target.setModifier(this.cursedProp, -curseAmount);
		}

		if (this.hasChanceToHit) {
			return super.effect(player, target, ring);
		}
		return !target.dead;
	}
}

export default CurseCard;
