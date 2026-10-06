import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';

export function announceFight(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestants }: { contestants: any[] },
): void {
	const crowd = `${contestants.length} contestants stand tall under the laudations and hissing jeers of a roaring crowd.`;
	const lines: FeedLine[] = [
		{ kind: 'fight-start', text: crowd, contestants: contestants.length },
		{ kind: 'fight-start', text: '⚔︎ Let the games begin! ⚔︎', contestants: contestants.length },
	];

	eb.publish({
		type: 'ring.fight',
		scope: 'public',
		text: `\n________________________________________\n^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n${contestants.length} contestants stand tall under the laudations and hissing jeers of a roaring crowd.\n\n⚔︎ Let the games begin! ⚔︎\n`,
		payload: { contestants, lines },
	});
}
