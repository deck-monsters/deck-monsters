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
	// The display name ("Heal"), not the class name ("HealCard"): this is what the Fights list
	// shows as a fight's card drop (Cursor's live check, roadmap 39). Rows written before this
	// keep the class name.
	const cardDropName = (card?.cardType ?? card?.name ?? (card?.constructor as { name?: string })?.name ?? 'Card') as string;

	const text = `${contestant.monster.identity} finds a card for ${contestant.character.identity} in the dust of the ring:\n\n${cardDropped}`;

	// Send privately to the player and also broadcast publicly
	const payload = { contestant, card, cardDropName };
	eb.publish({ type: 'ring.cardDrop', scope: 'private', targetUserId: contestant.userId, text, payload });
	eb.publish({ type: 'ring.cardDrop', scope: 'public', text, payload });
}
