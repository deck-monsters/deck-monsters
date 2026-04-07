import type { RoomEventBus } from '../events/index.js';

export function announceFight(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestants }: { contestants: any[] },
): void {
	eb.publish({
		type: 'ring.fight',
		scope: 'public',
		text: `\n________________________________________\n^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n${contestants.length} contestants stand tall under the laudations and hissing jeers of a roaring crowd.\n\n⚔︎ Let the games begin! ⚔︎\n`,
		payload: { contestants },
	});
}
