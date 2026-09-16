import { BaseCard, type CardOptions } from './base.js';
import { PSYCHIC } from '../constants/card-classes.js';
import { COMMON } from '../helpers/probabilities.js';
import { ALMOST_NOTHING } from '../helpers/costs.js';
import { playNestedCard } from './helpers/nested-play.js';

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

		// Narrated and paced via playNestedCard: without it the drawn card's own
		// announcement landed immediately after this one with nothing saying the two
		// were connected, so the feed read as the same monster playing twice in a row.
		const narration = `The ancient scraps crumble in ${player.givenName}'s hands — and reassemble into something else...`;

		if (randomCardHelpers.draw) {
			const randomCard = randomCardHelpers.draw(this.options as any, player);
			return playNestedCard({
				card: randomCard,
				player,
				proposedTarget,
				ring,
				activeContestants,
				narration,
				emit: (event, payload) => this.emit(event, payload),
			});
		}

		// Lazy import to avoid circular dependency (random → draw → all → random)
		return import('./helpers/draw.js').then(({ draw }) => {
			const randomCard = draw(this.options as any, player);
			return playNestedCard({
				card: randomCard,
				player,
				proposedTarget,
				ring,
				activeContestants,
				narration,
				emit: (event, payload) => this.emit(event, payload),
			});
		});
	}
}

export default RandomCard;
