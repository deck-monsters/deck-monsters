import { BaseCard, type CardOptions } from './base.js';
import { PSYCHIC } from '../constants/card-classes.js';
import { COMMON } from '../helpers/probabilities.js';
import { ALMOST_NOTHING } from '../helpers/costs.js';

export type DrawFn = (options: Record<string, unknown>, creature?: any) => any;

// Mutable helper for test injection — avoids ESM live-binding restrictions
// and circular dependency (random → draw → all → random).
export const randomCardHelpers: { draw: DrawFn | undefined } = {
	draw: undefined,
};

export class RandomCard extends BaseCard {
	static cardClass = [PSYCHIC];
	static cardType = 'Random Play';
	static probability = COMMON.probability;
	static description =
		'You find the illegible scraps of an ancient card in the corner. Curious to see what it does, you play it --as it crumbles to dust.';
	static cost = ALMOST_NOTHING.cost;

	constructor({ icon = '🎲' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	override play(
		player: any,
		proposedTarget?: any,
		ring?: any,
		activeContestants?: any
	): Promise<any> {
		this.emit('played', { player });

		if (randomCardHelpers.draw) {
			const randomCard = randomCardHelpers.draw(this.options as any, player);
			return Promise.resolve(randomCard.play(player, proposedTarget, ring, activeContestants));
		}

		// Lazy import to avoid circular dependency (random → draw → all → random)
		return import('./helpers/draw.js').then(({ draw }) => {
			const randomCard = draw(this.options as any, player);
			return randomCard.play(player, proposedTarget, ring, activeContestants);
		});
	}
}

export default RandomCard;
