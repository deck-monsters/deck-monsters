/**
 * Subscribes to a RoomEventBus and persists every published event to the
 * room_events table. This gives clients the ability to catch up on events
 * after a long disconnect, and provides a persistent battle history.
 *
 * Writes are fire-and-forget (errors are logged, not propagated) so a DB
 * hiccup never crashes the event fan-out or breaks the game loop. Transient
 * insert failures are retried with short backoff; only exhausting all retries
 * counts as a write failure (metric + error callback).
 */
import type { RoomEventBus } from '@deck-monsters/engine';
import type { GameEvent } from '@deck-monsters/engine';
import type { Db } from './db/index.js';
import { roomEvents } from './db/schema.js';
import { profileUuidOrNull } from './db/profile-id.js';
import { createLogger, isTraceEnabled } from './logger.js';
import { eventPersistFailures } from './metrics/index.js';

const log = createLogger('event-persister');

const SUBSCRIBER_ID_PREFIX = 'db-persister';

const DEFAULT_RETRY_DELAYS_MS = [1_000, 5_000];

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function attachEventPersister(
	eventBus: RoomEventBus,
	db: Db,
	onError: (err: unknown) => void = () => {},
	{ retryDelaysMs = DEFAULT_RETRY_DELAYS_MS }: { retryDelaysMs?: number[] } = {}
): () => void {
	const subscriberId = `${SUBSCRIBER_ID_PREFIX}:${eventBus.roomId}`;
	const roomId = eventBus.roomId;
	let writeQueue = Promise.resolve();

	// Set by the detach function. Queued/retrying writes check this between
	// steps so no write can land after the room is unloaded or reset.
	let detached = false;

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

	const persistEvent = async (event: GameEvent): Promise<void> => {
		await db
			.insert(roomEvents)
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
			.onConflictDoNothing();
	};

	const writeWithRetries = async (event: GameEvent): Promise<void> => {
		for (let attempt = 0; ; attempt++) {
			if (detached) return;
			try {
				await persistEvent(event);
				return;
			} catch (err) {
				const stack = err instanceof Error ? err.stack : undefined;
				const pgCode =
					err && typeof err === 'object' && 'code' in err
						? String((err as { code?: unknown }).code)
						: undefined;

				if (attempt < retryDelaysMs.length) {
					log.warn('event-persister: write failed, retrying', {
						err,
						roomId,
						eventId: event.id,
						attempt: attempt + 1,
						nextDelayMs: retryDelaysMs[attempt],
						pgCode,
					});
					await wait(retryDelaysMs[attempt]!);
					continue;
				}

				eventPersistFailures.inc({ room_id: roomId });
				onError(err);
				log.error('event-persister: failed to persist event after retries', {
					err,
					roomId,
					eventId: event.id,
					attempts: attempt + 1,
					stack,
					pgCode,
				});
				return;
			}
		}
	};

	const unsubscribe = eventBus.subscribe(subscriberId, {
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
				.catch(() => {
					/* continue the chain after a prior failure */
				})
				.then(() => writeWithRetries(event));
		},
	});

	return () => {
		unsubscribe();
		detached = true;
	};
}
