import { actionCard } from '../helpers/card.js';
import type { RoomEventBus } from '../events/index.js';

export function announceCard(
	eb: RoomEventBus,
	className: string,
	card: any,
	{ player }: { player: any },
): void {
	const cardPlayed = actionCard(card);

	eb.publish({
		type: 'card.played',
		scope: 'public',
		text: `${player.identity} lays down the following card:\n${cardPlayed}`,
		payload: { player, card },
	});
}
