import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { FIGHTER } from '../constants/creature-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';

export class SurvivalKnifeCard extends HitCard {
	static cardType = 'Survival Knife';
	static probability = UNCOMMON.probability;
	static description =
		'If times get too rough, stab yourself in the thigh and press the pommel for a Stimpak injection.';
	static permittedClassesAndTypes = [FIGHTER];
	static level = 1;
	static cost = VERY_CHEAP.cost;
	static notForSale = true;
	static defaults = {
		...HitCard.defaults,
		damageDice: '2d4',
	};

	protected healCard: HealCard;

	constructor({ icon = '🗡', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
		this.healCard = new HealCard({ healthDice: this.damageDice });
	}

	override get stats(): string {
		return `${super.stats}\n- or, below 1/4 health -\n${this.healCard.stats}`;
	}

	override getTargets(player: any, proposedTarget: any): any[] {
		if (player.hp < player.bloodiedValue / 2) {
			return [player];
		}
		return [proposedTarget];
	}

	override effect(
		player: any,
		target: any,
		ring: any,
		activeContestants: any
	): any {
		if (player.hp < player.bloodiedValue / 2) {
			return this.healCard.effect(player, target, ring, activeContestants);
		}
		return super.effect(player, target, ring, activeContestants);
	}
}

export default SurvivalKnifeCard;
