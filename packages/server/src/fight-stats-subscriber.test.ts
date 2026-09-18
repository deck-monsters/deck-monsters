import { expect } from 'chai';

import { RoomEventBus } from '@deck-monsters/engine';
import { attachFightStatsSubscriber, reconcilePlayerCoinStats } from './fight-stats-subscriber.js';

const ROOM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PLAYER_ONE = '11111111-2222-3333-4444-555555555555';
const PLAYER_TWO = '66666666-7777-8888-9999-aaaaaaaaaaaa';
/** The sentinel every boss contestant carries — see engine `helpers/bosses.ts`. */
const BOSS_USER_ID = 'boss';

type InsertedRow = Record<string, unknown>;

/**
 * Minimal Db double. `uuidColumns` names the columns that must hold a real uuid, so the
 * double rejects the boss sentinel exactly the way Postgres does.
 */
function makeDb() {
	const inserted: { table: string; row: InsertedRow }[] = [];
	const conflictUpdates: unknown[] = [];

	const insertInto = () => ({
		values(row: InsertedRow) {
			const table = row.monsterId ? 'room_monster_stats' : 'room_player_stats';
			const chain = {
				onConflictDoUpdate: async (options?: unknown) => {
					// Mirror Postgres: a uuid column rejects the boss sentinel.
					for (const value of [row.userId, row.ownerUserId]) {
						if (typeof value === 'string' && !value.includes('-')) {
							throw new Error(`invalid input syntax for type uuid: "${value}"`);
						}
					}
					inserted.push({ table, row });
					conflictUpdates.push(options);
				},
				then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
					return chain.onConflictDoUpdate().then(resolve, reject);
				},
			};
			return chain;
		},
	});

	const db = {
		// Drizzle table objects are opaque to this double, so classify by row shape:
		// only room_monster_stats rows carry a monsterId.
		insert: () => insertInto(),
	};

	return { db, inserted, conflictUpdates };
}

const participant = (ownerUserId: string, monsterId: string) => ({
	monsterId,
	monsterName: `Monster ${monsterId}`,
	monsterType: 'Basilisk',
	ownerUserId,
	ownerDisplayName: 'Someone',
	outcome: 'win' as const,
	xpGained: 7,
	level: 2,
});

const settle = async (): Promise<void> => {
	for (let i = 0; i < 50; i++) {
		await new Promise<void>((resolve) => setTimeout(resolve, 5));
	}
};

describe('fight-stats-subscriber.ts', () => {
	it('repairs zero coin projections from current balances without accepting invalid owners', async () => {
		const { db, inserted, conflictUpdates } = makeDb();

		await reconcilePlayerCoinStats(db as never, ROOM_ID, {
			[PLAYER_ONE]: { coins: 19.8 },
			boss: { coins: 500 },
			[PLAYER_TWO]: { coins: 0 },
		});

		expect(inserted).to.have.length(1);
		expect(inserted[0]?.row).to.include({
			roomId: ROOM_ID,
			userId: PLAYER_ONE,
			coinsEarned: 19,
		});
		expect(conflictUpdates).to.have.length(1);
	});

	it('records every player when a boss is the first participant', async () => {
		// Regression: participants were written in a sequential `for … await` loop with no
		// per-row isolation, so the boss sentinel ('boss', not a uuid) threw on the
		// room_player_stats insert and aborted every participant after it. Ring order is
		// shuffled, so a boss in slot 0 silently dropped the whole fight's stats —
		// leaderboards were quietly missing every boss fight.
		const bus = new RoomEventBus(ROOM_ID);
		const { db, inserted } = makeDb();
		const unsubscribe = attachFightStatsSubscriber(bus, db as never);

		bus.publish({
			type: 'ring.fightResolved',
			scope: 'public',
			text: 'resolved',
			payload: {
				participants: [
					participant(BOSS_USER_ID, 'boss-monster'),
					participant(PLAYER_ONE, 'monster-1'),
					participant(PLAYER_TWO, 'monster-2'),
				],
			},
		});

		await settle();
		unsubscribe();

		const playerRows = inserted.filter((entry) => entry.table === 'room_player_stats');
		const userIds = playerRows.map((entry) => entry.row.userId);

		expect(userIds).to.have.members([PLAYER_ONE, PLAYER_TWO]);
		expect(userIds).to.not.include(BOSS_USER_ID);
	});

	it('keeps boss monsters off the monster leaderboard', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const { db, inserted } = makeDb();
		const unsubscribe = attachFightStatsSubscriber(bus, db as never);

		bus.publish({
			type: 'ring.fightResolved',
			scope: 'public',
			text: 'resolved',
			payload: {
				participants: [
					participant(BOSS_USER_ID, 'boss-monster'),
					participant(PLAYER_ONE, 'monster-1'),
				],
			},
		});

		await settle();
		unsubscribe();

		const monsterRows = inserted.filter((entry) => entry.table === 'room_monster_stats');
		expect(monsterRows.map((entry) => entry.row.monsterId)).to.deep.equal(['monster-1']);
	});

	it('ignores the boss sentinel on bonus coin events', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const { db, inserted } = makeDb();
		const unsubscribe = attachFightStatsSubscriber(bus, db as never);

		bus.publish({
			type: 'ring.xp',
			scope: 'public',
			text: 'xp',
			payload: { coinsGained: 5, contestant: { userId: BOSS_USER_ID } },
		});

		await settle();
		unsubscribe();

		expect(inserted).to.have.length(0);
	});

	it('records coins from private reward events without exposing them to other players', async () => {
		const bus = new RoomEventBus(ROOM_ID);
		const { db, inserted } = makeDb();
		const unrelatedDeliveries: unknown[] = [];
		const unsubscribeStats = attachFightStatsSubscriber(bus, db as never);
		const unsubscribeOtherPlayer = bus.subscribe('other-player', {
			userId: PLAYER_TWO,
			deliver: (event) => unrelatedDeliveries.push(event),
		});

		bus.publish({
			type: 'ring.xp',
			scope: 'private',
			targetUserId: PLAYER_ONE,
			text: 'You gained coins.',
			payload: { coinsGained: 7, contestant: { userId: PLAYER_ONE } },
		});

		await settle();
		unsubscribeOtherPlayer();
		unsubscribeStats();

		const playerRows = inserted.filter((entry) => entry.table === 'room_player_stats');
		expect(playerRows).to.have.length(1);
		expect(playerRows[0]?.row).to.include({ userId: PLAYER_ONE, coinsEarned: 7 });
		expect(unrelatedDeliveries).to.have.length(0);
	});
});
