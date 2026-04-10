import { actionCard } from '../helpers/card.js';
import type { RoomEventBus } from '../events/index.js';

interface CardDropOpts {
	contestant: any;
	card: any;
}

export function announceCardDrop(
	eb: RoomEventBus,
	className: string,
	game: any,
	{ contestant, card }: CardDropOpts,
): void {
	const cardDropped = actionCard(card, true);
	const cardDropName = (card?.name ?? (card?.constructor as { name?: string })?.name ?? 'Card') as string;

	const text = `${contestant.monster.identity} finds a card for ${contestant.character.identity} in the dust of the ring:\n\n${cardDropped}`;

	// Send privately to the player and also broadcast publicly
	const payload = { contestant, card, cardDropName };
	eb.publish({ type: 'ring.cardDrop', scope: 'private', targetUserId: contestant.userId, text, payload });
	eb.publish({ type: 'ring.cardDrop', scope: 'public', text, payload });
}
