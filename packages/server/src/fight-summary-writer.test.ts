import { expect } from 'chai';

import { RoomEventBus } from '@deck-monsters/engine';
import { attachFightSummaryWriter } from './fight-summary-writer.js';

const ROOM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_UUID = '11111111-2222-3333-4444-555555555555';

type InsertedRow = {
	roomId: string;
	startedAt: Date;
	endedAt: Date;
	outcome: string;
	winnerOwnerUserId: string | null;
	cardDropName: string | null;
	fightNumber: number;
};

/**
 * Minimal Db double for the writer's transaction shape. `failuresRemaining`
 * makes the next N transactions throw, to exercise the retry path.
 */
function makeDb(): { db: unknown; inserted: InsertedRow[]; state: { failuresRemaining: number } } {
	const inserted: InsertedRow[] = [];
	const state = { failuresRemaining: 0 };
	let fightCounter = 0;

	const db = {
		async transaction(fn: (tx: unknown) => Promise<void>) {
			if (state.failuresRemaining > 0) {
				state.failuresRemaining -= 1;
				throw new Error('simulated db failure');
			}
			const tx = {
				update: () => ({
					set: () => ({
						where: () => ({
							returning: async () => [{ fightCounter: ++fightCounter }],
						}),
					}),
				}),
				insert: () => ({
					values: async (row: InsertedRow) => {
						inserted.push(row);
					},
				}),
			};
			await fn(tx);
		},
	};

	return { db, inserted, state };
}

/** Poll until `done()` returns true (or ~1s passes) — robust against retry backoff timers. */
const settle = async (done: () => boolean = () => false): Promise<void> => {
	for (let i = 0; i < 200; i++) {
		await new Promise<void>((resolve) => setTimeout(resolve, 5));
		if (done()) return;
	}
};

const publishFightBegins = (bus: RoomEventBus) =>
	bus.publish({
		type: 'ring.fight',
		scope: 'public',
		text: 'begins',
		payload: { eventName: 'fightBegins' },
	});

const publishFightResolved = (bus: RoomEventBus, outcome = 'win') =>
	bus.publish({
		type: 'ring.fightResolved',
		scope: 'public',
		text: 'resolved',
		payload: {
			rounds: 3,
			deaths: 1,
			outcome,
			participants: [
				{ monsterId: 'm1', outcome: 'win', xpGained: 12 },
				{ monsterId: 'm2', outcome: 'loss', xpGained: 3 },
			],
			winnerOwnerUserId: USER_UUID,
			loserOwnerUserId: 'discord-snowflake-123456789',
		},
	});

describe('fight summary writer', () => {
	it('writes a summary with duration from the recorded fight start', async () => {
		const { db, inserted } = makeDb();
		const bus = new RoomEventBus(ROOM_ID);
		const detach = attachFightSummaryWriter(bus, db as never, () => {}, { retryDelaysMs: [] });

		const begin = publishFightBegins(bus);
		bus.publish({
			type: 'ring.cardDrop',
			scope: 'public',
			text: 'drop',
			payload: { cardDropName: 'Lucky Strike' },
		});
		publishFightResolved(bus);
		await settle(() => inserted.length === 1);
		detach();

		expect(inserted).to.have.length(1);
		const row = inserted[0]!;
		expect(row.startedAt.getTime()).to.equal(begin.timestamp);
		expect(row.cardDropName).to.equal('Lucky Strike');
		expect(row.winnerOwnerUserId).to.equal(USER_UUID);
		expect(row.fightNumber).to.equal(1);
	});

	it('nulls non-UUID owner ids instead of failing the insert', async () => {
		const { db, inserted } = makeDb();
		const bus = new RoomEventBus(ROOM_ID);
		const detach = attachFightSummaryWriter(bus, db as never, () => {}, { retryDelaysMs: [] });

		publishFightBegins(bus);
		publishFightResolved(bus);
		await settle(() => inserted.length === 1);
		detach();

		expect((inserted[0] as unknown as { loserOwnerUserId: string | null }).loserOwnerUserId).to.equal(null);
	});

	it('keeps each fight paired with its own start when a new fight begins before the write flushes', async () => {
		// Regression for bug doc #15 path 4: pending was read inside the queued
		// write, so fight B's begin clobbered A's startedAt and A's cleanup then
		// deleted B's pending entirely.
		const { db, inserted, state } = makeDb();
		const bus = new RoomEventBus(ROOM_ID);
		// One retry so fight A's write is still pending when fight B begins.
		const detach = attachFightSummaryWriter(bus, db as never, () => {}, { retryDelaysMs: [1] });
		state.failuresRemaining = 1;

		const beginA = publishFightBegins(bus);
		publishFightResolved(bus);
		// Fight B starts while A's write is queued/retrying.
		await new Promise<void>((resolve) => setTimeout(resolve, 5));
		const beginB = publishFightBegins(bus);
		publishFightResolved(bus);
		await settle(() => inserted.length === 2);
		detach();

		expect(inserted).to.have.length(2);
		expect(inserted[0]!.startedAt.getTime()).to.equal(beginA.timestamp);
		expect(inserted[1]!.startedAt.getTime()).to.equal(beginB.timestamp);
	});

	it('retries transient failures and still writes the row', async () => {
		const { db, inserted, state } = makeDb();
		const bus = new RoomEventBus(ROOM_ID);
		const detach = attachFightSummaryWriter(bus, db as never, () => {}, { retryDelaysMs: [1, 1] });
		state.failuresRemaining = 2;

		publishFightBegins(bus);
		publishFightResolved(bus);
		await settle(() => inserted.length === 1);
		detach();

		expect(inserted).to.have.length(1);
	});

	it('gives up after exhausting retries without throwing into the event bus', async () => {
		const { db, inserted, state } = makeDb();
		const errors: unknown[] = [];
		const bus = new RoomEventBus(ROOM_ID);
		const detach = attachFightSummaryWriter(bus, db as never, (err) => errors.push(err), {
			retryDelaysMs: [1],
		});
		state.failuresRemaining = 5;

		publishFightBegins(bus);
		publishFightResolved(bus);
		await settle(() => errors.length === 1);
		detach();

		expect(inserted).to.have.length(0);
		expect(errors).to.have.length(1);
	});

	it('detaching cancels a queued retry so no write lands after a room reset', async () => {
		// Regression (review of #15): resetRoomState() detaches the writer, clears
		// fight_summaries, and zeroes the fight counter — but a write sitting in
		// its retry backoff used to survive detach and land afterwards, inserting
		// a pre-reset fight and incrementing the fresh counter.
		const { db, inserted, state } = makeDb();
		const bus = new RoomEventBus(ROOM_ID);
		const detach = attachFightSummaryWriter(bus, db as never, () => {}, { retryDelaysMs: [50] });
		state.failuresRemaining = 1; // first attempt fails → 50ms backoff

		publishFightBegins(bus);
		publishFightResolved(bus);
		// Let the first attempt fail, then detach during the backoff window.
		await new Promise<void>((resolve) => setTimeout(resolve, 15));
		detach();
		// Wait well past the backoff — the retry must not fire.
		await new Promise<void>((resolve) => setTimeout(resolve, 120));

		expect(inserted).to.have.length(0);
	});

	it('writes with zero duration when no fight start was seen (restart mid-fight)', async () => {
		const { db, inserted } = makeDb();
		const bus = new RoomEventBus(ROOM_ID);
		const detach = attachFightSummaryWriter(bus, db as never, () => {}, { retryDelaysMs: [] });

		const resolved = publishFightResolved(bus);
		await settle(() => inserted.length === 1);
		detach();

		expect(inserted).to.have.length(1);
		expect(inserted[0]!.startedAt.getTime()).to.equal(resolved.timestamp);
		expect(inserted[0]!.endedAt.getTime()).to.equal(resolved.timestamp);
	});

	it('ignores fightConcludes ring.fight events when recording the start time', async () => {
		const { db, inserted } = makeDb();
		const bus = new RoomEventBus(ROOM_ID);
		const detach = attachFightSummaryWriter(bus, db as never, () => {}, { retryDelaysMs: [] });

		const begin = publishFightBegins(bus);
		await new Promise<void>((resolve) => setTimeout(resolve, 5));
		bus.publish({
			type: 'ring.fight',
			scope: 'public',
			text: 'concludes',
			payload: { eventName: 'fightConcludes' },
		});
		publishFightResolved(bus);
		await settle(() => inserted.length === 1);
		detach();

		expect(inserted[0]!.startedAt.getTime()).to.equal(begin.timestamp);
	});
});
