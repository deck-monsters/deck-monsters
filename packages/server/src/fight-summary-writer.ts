/**
 * Assembles fight_summaries rows from ring.fight (start) + ring.fightResolved + ring.cardDrop.
 *
 * Reliability contract (bug doc #15):
 * - Pending fight metadata (startedAt, cardDropName) is snapshotted and cleared
 *   SYNCHRONOUSLY when ring.fightResolved is delivered. The DB write itself is
 *   queued and retried asynchronously; reading `pendingByRoom` inside the queued
 *   task allowed a next fight's `fightBegins` to clobber the pending entry (wrong
 *   duration on fight A) and then have A's post-write cleanup delete B's entry
 *   (zero duration + spurious warning on fight B).
 * - Writes are serialized per room and retried on failure with short backoff, so
 *   a transient DB hiccup no longer permanently drops the fight. Only exhausting
 *   all retries counts as a write failure (metric + error log).
 */
import { eq, sql } from 'drizzle-orm';

import type { RoomEventBus, GameEvent } from '@deck-monsters/engine';
import type { Db } from './db/index.js';
import { fightSummaries, rooms } from './db/schema.js';
import { createLogger } from './logger.js';
import { fightSummaryWriteFailures } from './metrics/index.js';

const log = createLogger('fight-summary');

type Pending = {
	startedAt: Date;
	cardDropName?: string;
};

const pendingByRoom = new Map<string, Pending>();

/** Serialize fight-summary writes per room so concurrent fightResolved handlers do not interleave. */
const fightSummaryWriteQueues = new Map<string, Promise<void>>();

const DEFAULT_RETRY_DELAYS_MS = [1_000, 5_000];

function enqueueFightSummaryWrite(roomId: string, fn: () => Promise<void>): void {
	const prev = fightSummaryWriteQueues.get(roomId) ?? Promise.resolve();
	const next = prev
		.catch(() => {
			/* continue the chain after a prior failure */
		})
		.then(fn);
	fightSummaryWriteQueues.set(roomId, next);
}

/** Accept any UUID-shaped hex so non-v4 profile IDs still pass; rejects Discord snowflakes etc. */
const UUID_HEX_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function profileUuidOrNull(value: string | undefined): string | null {
	if (!value || !UUID_HEX_RE.test(value)) return null;
	return value;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function attachFightSummaryWriter(
	eventBus: RoomEventBus,
	db: Db,
	legacyLog: (err: unknown) => void = () => {},
	{ retryDelaysMs = DEFAULT_RETRY_DELAYS_MS }: { retryDelaysMs?: number[] } = {}
): () => void {
	const roomId = eventBus.roomId;
	const subscriberId = `fight-summary:${roomId}`;

	const writeWithRetries = async (event: GameEvent, pending: Pending | undefined): Promise<void> => {
		for (let attempt = 0; ; attempt++) {
			try {
				await onFightResolved(db, roomId, event, pending);
				return;
			} catch (err) {
				const stack = err instanceof Error ? err.stack : undefined;
				const pgCode =
					err && typeof err === 'object' && 'code' in err
						? String((err as { code?: unknown }).code)
						: undefined;

				if (attempt < retryDelaysMs.length) {
					log.warn('fight-summary-writer: write failed, retrying', {
						err,
						roomId,
						attempt: attempt + 1,
						nextDelayMs: retryDelaysMs[attempt],
						pgCode,
					});
					await wait(retryDelaysMs[attempt]!);
					continue;
				}

				fightSummaryWriteFailures.inc({ room_id: roomId });
				legacyLog(err);
				log.error('fight-summary-writer: failed to write fight summary after retries', {
					err,
					roomId,
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
			if (event.type === 'ring.fight') {
				try {
					onRingFight(roomId, event);
				} catch (err) {
					legacyLog(err);
					log.error('fight-summary-writer: onRingFight threw', { err, roomId });
				}
				return;
			}
			if (event.type === 'ring.cardDrop' && event.scope === 'public') {
				onCardDrop(roomId, event);
				return;
			}
			if (event.type === 'ring.fightResolved') {
				// Snapshot & clear synchronously — see the reliability contract above.
				const pending = pendingByRoom.get(roomId);
				pendingByRoom.delete(roomId);
				enqueueFightSummaryWrite(roomId, () => writeWithRetries(event, pending));
			}
		},
	});

	return () => {
		unsubscribe();
		// Drop per-room state so long-lived servers don't accumulate entries for
		// every room ever loaded. An in-flight write chain settles on its own; a
		// re-attach starts a fresh chain, which is safe because rooms are only
		// unloaded when idle (no fight can be resolving at that moment).
		pendingByRoom.delete(roomId);
		fightSummaryWriteQueues.delete(roomId);
	};
}

function onRingFight(roomId: string, event: GameEvent): void {
	const payload = event.payload as { eventName?: string };
	if (payload.eventName === 'fightConcludes') return;

	const startedAt = new Date(event.timestamp);
	pendingByRoom.set(roomId, { startedAt });
	log.debug('fight start recorded', { roomId, eventName: payload.eventName, startedAt: startedAt.toISOString() });
}

function onCardDrop(roomId: string, event: GameEvent): void {
	const pending = pendingByRoom.get(roomId);
	if (!pending) return;
	const payload = event.payload as { cardDropName?: string };
	const name = payload.cardDropName;
	if (name) pending.cardDropName = name;
}

async function onFightResolved(
	db: Db,
	roomId: string,
	event: GameEvent,
	pending: Pending | undefined
): Promise<void> {
	const payload = event.payload as {
		rounds: number;
		deaths: number;
		outcome: string;
		participants?: unknown[];
		winnerMonsterId?: string;
		winnerMonsterName?: string;
		winnerOwnerUserId?: string;
		loserMonsterId?: string;
		loserMonsterName?: string;
		loserOwnerUserId?: string;
	};

	const participants = (payload.participants ?? []) as Array<{
		monsterId: string;
		outcome: string;
		xpGained: number;
	}>;

	let winnerXp = 0;
	let loserXp = 0;
	for (const p of participants) {
		if (p.outcome === 'win') winnerXp = p.xpGained;
		if (p.outcome === 'loss' || p.outcome === 'permaDeath') loserXp = p.xpGained;
	}

	const endedAt = new Date(event.timestamp);
	const startedAt = pending?.startedAt ?? endedAt;

	if (!pending) {
		log.warn('ring.fightResolved received with no pending fight start — duration will be zero', {
			roomId,
			outcome: payload.outcome,
		});
	}

	const durationMs = endedAt.getTime() - startedAt.getTime();

	await db.transaction(async (tx) => {
		const rows = await tx
			.update(rooms)
			.set({
				fightCounter: sql`${rooms.fightCounter} + 1`,
				updatedAt: new Date(),
			})
			.where(eq(rooms.id, roomId))
			.returning({ fightCounter: rooms.fightCounter });

		const fightNumber = rows[0]?.fightCounter ?? 1;

		await tx.insert(fightSummaries).values({
			roomId,
			fightNumber,
			startedAt,
			endedAt,
			outcome: payload.outcome,
			winnerMonsterId: payload.winnerMonsterId ?? null,
			winnerMonsterName: payload.winnerMonsterName ?? null,
			winnerOwnerUserId: profileUuidOrNull(payload.winnerOwnerUserId),
			loserMonsterId: payload.loserMonsterId ?? null,
			loserMonsterName: payload.loserMonsterName ?? null,
			loserOwnerUserId: profileUuidOrNull(payload.loserOwnerUserId),
			roundCount: payload.rounds,
			winnerXpGained: winnerXp,
			loserXpGained: loserXp,
			cardDropName: pending?.cardDropName ?? null,
			notableCards: null,
			participants: payload.participants ?? [],
		});

		log.debug('fight summary written', {
			roomId,
			fightNumber,
			outcome: payload.outcome,
			rounds: payload.rounds,
			durationMs,
			winner: payload.winnerMonsterName,
			loser: payload.loserMonsterName,
		});
	});
}
