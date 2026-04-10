/**
 * Best-effort upserts for room_player_stats and room_monster_stats from
 * ring.fightResolved, ring.xp, and ring.cardDrop events.
 */
import { sql } from 'drizzle-orm';

import type { RoomEventBus, GameEvent } from '@deck-monsters/engine';
import type { Db } from './db/index.js';
import { roomMonsterStats, roomPlayerStats } from './db/schema.js';

type Participant = {
	monsterId: string;
	monsterName: string;
	monsterType: string;
	ownerUserId: string;
	ownerDisplayName: string;
	outcome: 'win' | 'loss' | 'draw' | 'fled' | 'permaDeath';
	xpGained: number;
	level: number;
};

function outcomeToMonsterDelta(
	outcome: Participant['outcome']
): { wins: number; losses: number; draws: number } {
	switch (outcome) {
		case 'win':
			return { wins: 1, losses: 0, draws: 0 };
		case 'loss':
		case 'permaDeath':
			return { wins: 0, losses: 1, draws: 0 };
		case 'draw':
		case 'fled':
			return { wins: 0, losses: 0, draws: 1 };
		default:
			return { wins: 0, losses: 0, draws: 0 };
	}
}

function outcomeToPlayerDelta(
	outcome: Participant['outcome']
): { wins: number; losses: number; draws: number } {
	return outcomeToMonsterDelta(outcome);
}

export function attachFightStatsSubscriber(
	eventBus: RoomEventBus,
	db: Db,
	log: (err: unknown) => void = () => {}
): () => void {
	const subscriberId = `fight-stats:${eventBus.roomId}`;

	return eventBus.subscribe(subscriberId, {
		deliver(event: GameEvent) {
			if (event.type === 'ring.fightResolved') {
				void handleFightResolved(db, event).catch(log);
				return;
			}
			// Coins from XP announcements (ring.xp can include coinsGained).
			if (event.type === 'ring.xp') {
				void handleXpCoinsOnly(db, event).catch(log);
			}
		},
	});
}

async function handleFightResolved(db: Db, event: GameEvent): Promise<void> {
	const roomId = event.roomId;
	const payload = event.payload as {
		participants?: Participant[];
	};
	const participants = payload.participants;
	if (!participants?.length) return;

	for (const p of participants) {
		const { wins, losses, draws } = outcomeToPlayerDelta(p.outcome);
		const pd = outcomeToMonsterDelta(p.outcome);

		await db
			.insert(roomPlayerStats)
			.values({
				roomId,
				userId: p.ownerUserId,
				xp: p.xpGained,
				wins,
				losses,
				draws,
				coinsEarned: 0,
			})
			.onConflictDoUpdate({
				target: [roomPlayerStats.roomId, roomPlayerStats.userId],
				set: {
					xp: sql`${roomPlayerStats.xp} + ${p.xpGained}`,
					wins: sql`${roomPlayerStats.wins} + ${wins}`,
					losses: sql`${roomPlayerStats.losses} + ${losses}`,
					draws: sql`${roomPlayerStats.draws} + ${draws}`,
					updatedAt: new Date(),
				},
			});

		await db
			.insert(roomMonsterStats)
			.values({
				roomId,
				monsterId: p.monsterId,
				ownerUserId: p.ownerUserId,
				displayName: p.monsterName,
				monsterType: p.monsterType,
				xp: p.xpGained,
				level: p.level,
				wins: pd.wins,
				losses: pd.losses,
				draws: pd.draws,
			})
			.onConflictDoUpdate({
				target: [roomMonsterStats.roomId, roomMonsterStats.monsterId],
				set: {
					ownerUserId: p.ownerUserId,
					displayName: p.monsterName,
					monsterType: p.monsterType,
					xp: sql`${roomMonsterStats.xp} + ${p.xpGained}`,
					level: p.level,
					wins: sql`${roomMonsterStats.wins} + ${pd.wins}`,
					losses: sql`${roomMonsterStats.losses} + ${pd.losses}`,
					draws: sql`${roomMonsterStats.draws} + ${pd.draws}`,
					updatedAt: new Date(),
				},
			});
	}
}

/** XP and W/L are applied from ring.fightResolved only; this handles bonus coin lines on ring.xp. */
async function handleXpCoinsOnly(db: Db, event: GameEvent): Promise<void> {
	const payload = event.payload as {
		coinsGained?: number;
		contestant?: { userId?: string };
	};
	const coinsGained = payload.coinsGained ?? 0;
	const userId = payload.contestant?.userId;
	if (coinsGained <= 0 || !userId) return;

	await db
		.insert(roomPlayerStats)
		.values({
			roomId: event.roomId,
			userId,
			xp: 0,
			wins: 0,
			losses: 0,
			draws: 0,
			coinsEarned: coinsGained,
		})
		.onConflictDoUpdate({
			target: [roomPlayerStats.roomId, roomPlayerStats.userId],
			set: {
				coinsEarned: sql`${roomPlayerStats.coinsEarned} + ${coinsGained}`,
				updatedAt: new Date(),
			},
		});
}
