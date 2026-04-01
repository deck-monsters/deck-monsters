import type { RoomEventBus } from '../events/index.js';

export function announceContestantLeave(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { character, monster } = contestant;

	eb.publish({
		type: 'ring.remove',
		scope: 'public',
		text: `${monster.givenName} was summoned from the ring by ${character.identity}.`,
		payload: { contestant },
	});
}
