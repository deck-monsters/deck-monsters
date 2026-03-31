import { BaseCard, type CardOptions } from './base.js';
import { AOE } from '../constants/card-classes.js';
import { CLERIC } from '../constants/creature-classes.js';
import { ABUNDANT } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import {
	TARGET_ALL_CONTESTANTS,
	getTarget,
} from '../helpers/targeting-strategies.js';

export interface BlastCardOptions extends CardOptions {
	damage?: number;
	levelDamage?: number;
}

export class BlastCard extends BaseCard<BlastCardOptions> {
	static cardClass = [AOE];
	static cardType = 'Blast';
	static permittedClassesAndTypes = [CLERIC];
	static probability = ABUNDANT.probability;
	static description =
		'A magical blast against every opponent in the encounter.';
	static level = 0;
	static cost = REASONABLE.cost;
	static defaults: { damage: number; levelDamage?: number } = {
		damage: 3,
		levelDamage: 1,
	};
	static flavors = {
		hits: [
			['blasts', 80],
			['sends a magical blast hurtling into', 70],
			['invokes an ancient spell against', 70],
			['incinerates', 50],
			['farts in the general direction of', 5],
		],
	};

	constructor({
		damage,
		icon = '💥',
		levelDamage,
	}: Partial<BlastCardOptions> = {}) {
		super({ damage, icon, levelDamage } as Partial<BlastCardOptions>);
	}

	get damage(): number {
		return (this.options as BlastCardOptions).damage!;
	}

	get levelDamage(): number {
		return (this.options as BlastCardOptions).levelDamage!;
	}

	get stats(): string {
		return `Blast: ${this.damage} base damage +${this.levelDamage} per level of the caster`;
	}

	override getTargets(
		player: any,
		_proposedTarget: any,
		_ring: any,
		activeContestants: any
	): any[] {
		return (getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS,
		}) as any[]).map(({ monster }: any) => monster);
	}

	effect(player: any, target: any): any {
		const damage = this.damage + this.levelDamage * player.level;
		return target.hit(damage, player, this);
	}
}

export default BlastCard;
