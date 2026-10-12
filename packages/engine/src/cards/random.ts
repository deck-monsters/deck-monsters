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
		'You find the illegible scraps of an ancient card in the corner. Curious to see what it does, you play it, and it crumbles to dust.';
	static cost = ALMOST_NOTHING.cost;

	constructor({ icon = '🎲' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	override async play(
		player: any,
		proposedTarget?: any,
		ring?: any,
		activeContestants?: any,
		shouldApplyEffects: boolean | 'card' = true
	): Promise<any> {
		// Lets a boss's narration reach the room feed; see BaseCard.playedBy.
		this.playedBy = player;

		// The turn starts before the scraps are found: a time-shifted or held monster never
		// finds them, and a burn or the end of being winded reads above this card's box, not
		// between it and the card it becomes (owner screenshot, 2026-10-12).
		// 'card': this card was itself drawn or stolen, and the outer card ran the turn start.
		const { card: started, lost } =
			shouldApplyEffects === 'card'
				? { card: this.clone(), lost: false }
				: await this.startTurn(player, proposedTarget, ring, activeContestants);
		if (lost) return started.play(player, proposedTarget, ring, activeContestants, false);
		await started.announcePlay(player, ring);

		// Narrated and paced via playNestedCard: without it the drawn card's own
		// announcement landed immediately after this one with nothing saying the two
		// were connected, so the feed read as the same monster playing twice in a row.
		const narration = `The ancient scraps crumble in ${player.givenName}'s hands — and reassemble into something else...`;

		// Lazy import to avoid circular dependency (random → draw → all → random)
		const draw = randomCardHelpers.draw ?? (await import('./helpers/draw.js')).draw;
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
	}
}

export default RandomCard;
