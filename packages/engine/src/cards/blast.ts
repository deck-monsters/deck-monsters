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

/** Levels that each add the full `levelDamage`; past them, a level adds half. */
export const FULL_SCALING_LEVELS = 10;

/**
 * The caster level Blast and Sandstorm scale by: every level up to 10, then one for every two
 * levels past it. At +1 per level, level 15 Blast dealt 18.9 a hit against 11.7 for a Hit, to
 * every opponent and undodgeable, and a Weeping Angel with two Blasts won 95–99% at levels
 * 15–20 on likely decks. The owner kept casters strong late but chose to flatten the runaway
 * past level 10, leaving early and mid game untouched (docs/archive/roadmap/32-pass-c-mega-boss-and-balance.md).
 */
export const scaledCasterLevel = (level: number): number => {
	const safe = Math.max(0, level);
	return Math.min(safe, FULL_SCALING_LEVELS) + Math.floor(Math.max(0, safe - FULL_SCALING_LEVELS) / 2);
};

export class BlastCard extends BaseCard<BlastCardOptions> {
	static cardClass = [AOE];
	static cardType = 'Blast';
	static permittedClassesAndTypes = [CLERIC];
	static probability = ABUNDANT.probability;
	static description =
		'A magical blast against every opponent in the fight.';
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
		return `Blast: ${this.damage} base damage +${this.levelDamage} per level of the caster (per two levels past level ${FULL_SCALING_LEVELS})`;
	}

	override getTargets(
		player: any,
		_proposedTarget: any,
		ring: any,
		activeContestants: any
	): any[] {
		return (getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS,
			ring,
		}) as any[]).map(({ monster }: any) => monster);
	}

	/**
	 * Roadmap 36, being measured: the caster level Blast stops scaling at. Infinity is today's
	 * rule. A cap is the fallback if no dragon-side answer to the level 7 Blast matchup works; it
	 * changes every caster.
	 */
	static levelCap = Infinity;

	effect(player: any, target: any): any {
		const level = Math.min(player.level, (this.constructor as typeof BlastCard).levelCap);
		const damage = this.damage + this.levelDamage * scaledCasterLevel(level);
		return target.hit(damage, player, this);
	}
}

export default BlastCard;
