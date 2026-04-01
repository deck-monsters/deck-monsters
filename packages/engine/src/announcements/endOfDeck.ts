import type { RoomEventBus } from '../events/index.js';

export function announceEndOfDeck(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { monster } = contestant;

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${monster.identity} is out of cards.`,
		payload: {},
	});
}
