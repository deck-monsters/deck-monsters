import { HitCard } from './hit.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';
import {
	TARGET_LOWEST_HP_PLAYER,
	getTarget,
} from '../helpers/targeting-strategies.js';

export class FistsOfVillainyCard extends HitCard {
	static cardType = 'Fists of Villainy';
	static probability = UNCOMMON.probability;
	static description = 'You show no mercy to the weak.';
	static level = 1;
	static cost = VERY_CHEAP.cost;

	constructor({ icon = '🐀', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
	}

	override get stats(): string {
		return `${super.stats}\nStrikes opponent with lowest current hp.`;
	}

	override getTargets(
		player: any,
		_proposedTarget: any,
		_ring: any,
		activeContestants: any
	): any[] {
		return [
			(getTarget({
				contestants: activeContestants,
				playerMonster: player,
				strategy: TARGET_LOWEST_HP_PLAYER,
			}) as any).monster,
		];
	}
}

export default FistsOfVillainyCard;
