import { veryShortDelay, delaysAreSkipped } from '../../helpers/delay-times.js';

/**
 * Plays a card that another card put into play (Random Play's drawn card, Pick
 * Pocket's stolen card) with the same pacing the main fight loop gives a normal
 * card-to-card transition.
 *
 * Two bugs made these chains unreadable in live feeds:
 *
 * 1. **No pacing.** `doAction` in `ring/index.ts` paces card-to-card transitions
 *    with `veryShortDelay(round)`, but a nested card was played by calling
 *    `inner.play(...)` directly, so it emitted its full announcement — a ten-line
 *    card box — immediately after the outer card's. A Random Play that drew Pick
 *    Pocket, which then stole a Delayed Hit, dumped three card boxes into the feed
 *    inside the window normally given to one. On a phone that is a wall of text
 *    appearing at once. This is the same class of regression the timing doc warns
 *    about (`subEventDelay` between card plays making fights scroll past in
 *    seconds), except nested plays had no pacing at all.
 *
 * 2. **No indication it was a chain.** The nested card announces with the identical
 *    "<player> lays down the following card:" wording as a top-level play, so the
 *    feed read as one monster taking three turns in a row.
 *
 * Pacing it like a real card-to-card transition fixes both: the reader gets the
 * same beat they get between turns, and the narration line says why another card
 * is being played.
 *
 * Skip mode (`DECK_MONSTERS_SKIP_DELAYS`) resolves without a real timer so tests
 * and the harness stay fast — same treatment as `doAction`'s continuation paths.
 */
export function playNestedCard({
	card,
	player,
	proposedTarget,
	ring,
	activeContestants,
	narration,
	emit,
}: {
	card: any;
	player: any;
	proposedTarget?: any;
	ring?: any;
	activeContestants?: any;
	/** Line explaining why this card is being played; omitted when the caller already narrated. */
	narration?: string;
	/** The outer card's `emit`, so the narration is attributed to it. */
	emit?: (event: string, payload: Record<string, unknown>) => void;
}): Promise<any> {
	if (narration && emit) {
		emit('narration', { narration });
	}

	const round = typeof player?.round === 'number' ? player.round : 1;

	const paced = delaysAreSkipped()
		? Promise.resolve()
		: new Promise<void>(resolve => setTimeout(resolve, veryShortDelay(round)));

	return paced.then(() => card.play(player, proposedTarget, ring, activeContestants));
}
