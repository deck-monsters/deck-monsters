/**
 * Assembles fight_summaries rows from ring.fight (start) + ring.fightResolved + ring.cardDrop.
 * Best-effort: errors are logged and counted in metrics; pending fight metadata is kept until a successful write.
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

/** Serialize fight-summary writes per room so concurrent fightResolved handlers do not corrupt pending state. */
const fightSummaryWriteQueues = new Map<string, Promise<void>>();

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

export function attachFightSummaryWriter(
	eventBus: RoomEventBus,
	db: Db,
	legacyLog: (err: unknown) => void = () => {}
): () => void {
	const roomId = eventBus.roomId;
	const subscriberId = `fight-summary:${roomId}`;

	return eventBus.subscribe(subscriberId, {
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
				enqueueFightSummaryWrite(roomId, async () => {
					try {
						await onFightResolved(db, roomId, event);
					} catch (err) {
						fightSummaryWriteFailures.inc({ room_id: roomId });
						const stack = err instanceof Error ? err.stack : undefined;
						const pg =
							err && typeof err === 'object' && 'code' in err
								? String((err as { code?: unknown }).code)
								: undefined;
						log.error('fight-summary-writer: failed to write fight summary', {
							err,
							roomId,
							stack,
							pgCode: pg,
						});
						legacyLog(err);
					}
				});
			}
		},
	});
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

async function onFightResolved(db: Db, roomId: string, event: GameEvent): Promise<void> {
	const pending = pendingByRoom.get(roomId);

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

	pendingByRoom.delete(roomId);
}
