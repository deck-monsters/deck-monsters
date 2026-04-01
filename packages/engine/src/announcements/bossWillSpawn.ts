import { add, formatRelative } from '../helpers/time.js';
import type { RoomEventBus } from '../events/index.js';

export function announceBossWillSpawn(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ delay }: { delay: number },
): void {
	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `A boss will enter the ring ${formatRelative(add(Date.now(), delay))}`,
		payload: { delay },
	});
}
