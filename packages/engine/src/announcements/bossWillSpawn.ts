import { add, formatRelative } from '../helpers/time.js';
import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';

export function announceBossWillSpawn(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ delay }: { delay: number },
): void {
	const text = `A boss will enter the ring ${formatRelative(add(Date.now(), delay))}.`;

	eb.publish({
		type: 'announce',
		scope: 'public',
		text,
		payload: { delay, lines: [{ kind: 'boss-soon', text, delay }] satisfies FeedLine[] },
	});
}
