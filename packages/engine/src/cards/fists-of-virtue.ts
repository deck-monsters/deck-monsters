import { HitCard } from './hit.js';
import { COMMON } from '../helpers/probabilities.js';
import { CHEAP } from '../helpers/costs.js';
import {
	TARGET_HIGHEST_HP_PLAYER,
	getTarget,
} from '../helpers/targeting-strategies.js';

export class FistsOfVirtueCard extends HitCard {
	static cardType = 'Fists of Virtue';
	static probability = COMMON.probability;
	static description = 'You strike at the biggest bully in the room.';
	static level = 1;
	static cost = CHEAP.cost;
	static defaults = {
		...HitCard.defaults,
		damageDice: '1d8',
	};

	constructor({ icon = '🙏', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
	}

	override get stats(): string {
		return `${super.stats}\nStrikes opponent with highest current hp.`;
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
				strategy: TARGET_HIGHEST_HP_PLAYER,
			}) as any).monster,
		];
	}
}

export default FistsOfVirtueCard;
