import { monsterCard } from '../helpers/card.js';
import type { RoomEventBus } from '../events/index.js';

export function announceTurnBegin(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { monster } = contestant;

	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `*It's ${contestant.character.givenName}'s turn.*\n\n${contestant.character.identity} plays the following monster:\n${monsterCard(monster, contestant.lastMonsterPlayed !== monster)}`,
		payload: { contestant },
	});

	contestant.lastMonsterPlayed = monster;
}
