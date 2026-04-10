/**
 * One-off: seed room_player_stats / room_monster_stats from serialized room state blobs.
 * Run with: DATABASE_URL=... pnpm exec tsx scripts/backfill-leaderboard-from-state.ts
 *
 * Does not infer win/loss history (starts at 0); updates XP/levels/names from current state.
 */
import { restoreGame } from '@deck-monsters/engine';

import { db } from '../src/db/index.js';
import { rooms, roomPlayerStats, roomMonsterStats } from '../src/db/schema.js';

async function main(): Promise<void> {
	const rows = await db.select({ id: rooms.id, stateBlob: rooms.stateBlob }).from(rooms);

	for (const row of rows) {
		if (!row.stateBlob) continue;
		let game: ReturnType<typeof restoreGame>;
		try {
			game = restoreGame(row.stateBlob, () => {});
		} catch {
			console.warn(`skip room ${row.id}: bad state blob`);
			continue;
		}

		const characters = (game as any).characters as Record<string, any> | undefined;
		if (characters) {
			for (const [userId, ch] of Object.entries(characters)) {
				const xp = ch.xp ?? 0;
				await db
					.insert(roomPlayerStats)
					.values({
						roomId: row.id,
						userId,
						xp,
						wins: 0,
						losses: 0,
						draws: 0,
						coinsEarned: ch.coins ?? 0,
					})
					.onConflictDoUpdate({
						target: [roomPlayerStats.roomId, roomPlayerStats.userId],
						set: { xp, coinsEarned: ch.coins ?? 0 },
					});

				for (const m of ch.monsters ?? []) {
					const mid = m?.stableId;
					if (typeof mid !== 'string') continue;
					await db
						.insert(roomMonsterStats)
						.values({
							roomId: row.id,
							monsterId: mid,
							ownerUserId: userId,
							displayName: m.givenName ?? 'Monster',
							monsterType: m.constructor?.name ?? 'Monster',
							xp: m.xp ?? 0,
							level: m.level ?? 1,
							wins: m.battles?.wins ?? 0,
							losses: m.battles?.losses ?? 0,
							draws: 0,
						})
						.onConflictDoUpdate({
							target: [roomMonsterStats.roomId, roomMonsterStats.monsterId],
							set: {
								ownerUserId: userId,
								displayName: m.givenName ?? 'Monster',
								monsterType: m.constructor?.name ?? 'Monster',
								xp: m.xp ?? 0,
								level: m.level ?? 1,
								wins: m.battles?.wins ?? 0,
								losses: m.battles?.losses ?? 0,
							},
						});
				}
			}
		}

		game.dispose?.();
		console.log(`backfilled room ${row.id}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
