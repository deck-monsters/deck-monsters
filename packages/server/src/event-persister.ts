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
import { profileUuidOrNull } from './db/profile-id.js';
import { createLogger, isTraceEnabled } from './logger.js';

const log = createLogger('event-persister');

const SUBSCRIBER_ID_PREFIX = 'db-persister';

export function attachEventPersister(
	eventBus: RoomEventBus,
	db: Db,
	onError: (err: unknown) => void = () => {}
): () => void {
	const subscriberId = `${SUBSCRIBER_ID_PREFIX}:${eventBus.roomId}`;
	let writeQueue = Promise.resolve();

	// Event types that are transient state-sync signals and should not be
	// persisted to the history table — they have no replay value.
	// `quick_actions` is included because suggestions describe the game state at
	// one instant; replaying an old set would surface chips that no longer apply.
	const EPHEMERAL_TYPES = new Set([
		'ring.state',
		'handshake',
		'system.gap',
		'quick_actions',
	]);

	return eventBus.subscribe(subscriberId, {
		deliver(event: GameEvent) {
			if (EPHEMERAL_TYPES.has(event.type)) return;
			if (isTraceEnabled) {
				log.trace('persisting event', {
					roomId: event.roomId,
					type: event.type,
					scope: event.scope,
					eventId: event.id,
				});
			}
			// Preserve persistence order even when DB latency varies between writes.
			// This keeps history replay stable across browser reloads.
			writeQueue = writeQueue
				.then(() =>
					db.insert(roomEvents)
						.values({
							roomId: event.roomId,
							type: event.type,
							scope: event.scope,
							// 'boss' is not a profile uuid — boss win/loss events carry it as their
						// target. Writing it to a uuid column throws and the event is lost.
						targetUserId: profileUuidOrNull(event.targetUserId),
							payload: event.payload as Record<string, unknown>,
							text: event.text,
							eventId: event.id,
						})
						.onConflictDoNothing()
						.then(() => undefined)
				)
				.catch((err: unknown) => onError(err));
		},
	});
}
