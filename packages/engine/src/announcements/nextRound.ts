import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';

export function announceNextRound(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ round }: { round: number },
): void {
	eb.publish({
		type: 'announce',
		scope: 'public',
		// A rule plus the flag. Rounds are rarer than turns, so this is the heavier of the
		// two banners — see nextTurn.ts for why the dice went away.
		text: `\n--------------------\n🏁  round ${round + 1}\n`,
		payload: { round, lines: [{ kind: 'round', text: `🏁  round ${round + 1}`, round: round + 1 }] satisfies FeedLine[] },
	});
}
