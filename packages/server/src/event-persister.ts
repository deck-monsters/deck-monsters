/**
 * Subscribes to a RoomEventBus and persists every published event to the
 * room_events table. This gives clients the ability to catch up on events
 * after a long disconnect, and provides a persistent battle history.
 *
 * Writes are fire-and-forget (errors are logged, not propagated) so a DB
 * hiccup never crashes the event fan-out or breaks the game loop.
 */
import type { RoomEventBus } from '@deck-monsters/engine';
import type { GameEvent } from '@deck-monsters/engine';
import type { Db } from './db/index.js';
import { roomEvents } from './db/schema.js';

const SUBSCRIBER_ID_PREFIX = 'db-persister';

export function attachEventPersister(
	eventBus: RoomEventBus,
	db: Db,
	log: (err: unknown) => void = () => {}
): () => void {
	const subscriberId = `${SUBSCRIBER_ID_PREFIX}:${eventBus.roomId}`;

	// Event types that are transient state-sync signals and should not be
	// persisted to the history table — they have no replay value.
	const EPHEMERAL_TYPES = new Set(['ring.state', 'handshake']);

	return eventBus.subscribe(subscriberId, {
		deliver(event: GameEvent) {
			if (EPHEMERAL_TYPES.has(event.type)) return;
			db.insert(roomEvents)
				.values({
					roomId: event.roomId,
					type: event.type,
					scope: event.scope,
					targetUserId: event.targetUserId ?? null,
					payload: event.payload as Record<string, unknown>,
					text: event.text,
					eventId: event.id,
				})
				.catch((err: unknown) => log(err));
		},
	});
}
