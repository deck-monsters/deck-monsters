/**
 * Assembles fight_summaries rows from ring.fight (start) + ring.fightResolved + ring.cardDrop.
 * Best-effort: errors are logged, not propagated.
 */
import { eq, sql } from 'drizzle-orm';

import type { RoomEventBus, GameEvent } from '@deck-monsters/engine';
import type { Db } from './db/index.js';
import { fightSummaries, rooms } from './db/schema.js';

type Pending = {
	startedAt: Date;
	cardDropName?: string;
};

const pendingByRoom = new Map<string, Pending>();

export function attachFightSummaryWriter(
	eventBus: RoomEventBus,
	db: Db,
	log: (err: unknown) => void = () => {}
): () => void {
	const roomId = eventBus.roomId;
	const subscriberId = `fight-summary:${roomId}`;

	return eventBus.subscribe(subscriberId, {
		deliver(event: GameEvent) {
			if (event.type === 'ring.fight') {
				try {
					onRingFight(roomId, event);
				} catch (err) {
					log(err);
				}
				return;
			}
			if (event.type === 'ring.cardDrop' && event.scope === 'public') {
				onCardDrop(roomId, event);
				return;
			}
			if (event.type === 'ring.fightResolved') {
				void onFightResolved(db, roomId, event).catch(log);
			}
		},
	});
}

function onRingFight(roomId: string, event: GameEvent): void {
	const payload = event.payload as { eventName?: string };
	if (payload.eventName === 'fightConcludes') return;

	pendingByRoom.set(roomId, {
		startedAt: new Date(event.timestamp),
	});
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
	pendingByRoom.delete(roomId);

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
			winnerOwnerUserId: payload.winnerOwnerUserId ?? null,
			loserMonsterId: payload.loserMonsterId ?? null,
			loserMonsterName: payload.loserMonsterName ?? null,
			loserOwnerUserId: payload.loserOwnerUserId ?? null,
			roundCount: payload.rounds,
			winnerXpGained: winnerXp,
			loserXpGained: loserXp,
			cardDropName: pending?.cardDropName ?? null,
			notableCards: null,
			participants: payload.participants ?? [],
		});
	});
}
