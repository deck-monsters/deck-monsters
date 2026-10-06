import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';
import { roundBeat } from './ring-flavour.js';

export function announceNextRound(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ round }: { round: number },
): void {
	const beat = roundBeat(ring);
	eb.publish({
		type: 'announce',
		scope: 'public',
		// A rule plus the flag. Rounds are rarer than turns, so this is the heavier of the
		// two banners — see nextTurn.ts for why the dice went away.
		text: `\n--------------------\n🏁  round ${round + 1}\n${beat}\n`,
		payload: { round, lines: [
			{ kind: 'round', text: `🏁  round ${round + 1}`, round: round + 1 },
			{ kind: 'narration', text: beat },
		] satisfies FeedLine[] },
	});
}
