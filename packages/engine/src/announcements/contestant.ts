import { monsterCard } from '../helpers/card.js';
import flavor from '../helpers/flavor.js';
import type { RoomEventBus } from '../events/index.js';

export function announceContestant(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { character, monster } = contestant;

	eb.publish({
		type: 'ring.add',
		scope: 'public',
		text: `A${flavor.getFlavor('monsterAdjective').text} ${monster.creatureType} has entered the ring at the behest of ${character.icon} ${character.givenName}.\n${monsterCard(monster)}`,
		payload: { contestant },
	});
}
