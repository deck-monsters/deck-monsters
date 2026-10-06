import type { RoomEventBus } from '../events/index.js';
import type { FeedLine } from '../events/types.js';

export function announceEndOfDeck(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { monster } = contestant;

	const text = `${monster.identity} is out of cards.`;

	eb.publish({
		type: 'announce',
		scope: 'public',
		text,
		payload: { lines: [{ kind: 'end-of-deck', text, name: monster.givenName }] satisfies FeedLine[] },
	});
}
