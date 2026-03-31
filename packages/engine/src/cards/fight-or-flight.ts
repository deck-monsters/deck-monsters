import { HitCard } from './hit.js';
import { FleeCard } from './flee.js';
import { ABUNDANT } from '../helpers/probabilities.js';
import { ALMOST_NOTHING } from '../helpers/costs.js';

export class FightOrFlightCard extends HitCard {
	static cardType = 'Fight or Flight';
	static probability = ABUNDANT.probability;
	static description = 'Survival instincts are nothing to be ashamed of.';
	static cost = ALMOST_NOTHING.cost;
	static noBosses = true;

	private fleeEffect: (...args: any[]) => any;

	constructor({ icon = '😖', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
		this.fleeEffect = new FleeCard().effect.bind(new FleeCard());
	}

	override get stats(): string {
		return `${super.stats}\nChance to flee if below a quarter health`;
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
			return this.fleeEffect(player, target, ring, activeContestants);
		}
		return super.effect(player, target, ring, activeContestants);
	}
}

export default FightOrFlightCard;
