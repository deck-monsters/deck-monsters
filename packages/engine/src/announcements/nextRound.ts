import type { RoomEventBus } from '../events/index.js';

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
		payload: { round },
	});
}
