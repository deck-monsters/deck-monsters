import { expect } from 'chai';

import { RoomEventBus } from '@deck-monsters/engine';
import { attachEventPersister } from './event-persister.js';

type InsertCall = {
	roomId: string;
	type: string;
	eventId: string | null;
};

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function makeDb(): {
	db: unknown;
	inserted: InsertCall[];
	state: { failuresRemaining: number };
} {
	const inserted: InsertCall[] = [];
	const state = { failuresRemaining: 0 };

	const db = {
		insert() {
			return {
				values(input: InsertCall) {
					return {
						onConflictDoNothing() {
							if (state.failuresRemaining > 0) {
								state.failuresRemaining -= 1;
								return Promise.reject(new Error('simulated db failure'));
							}
							inserted.push(input);
							return Promise.resolve();
						},
					};
				},
			};
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

async function flushMacrotask(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('event persister', () => {
	it('writes events to DB in publish order even with async inserts', async () => {
		const eventBus = new RoomEventBus('room-1');
		const insertOrder: InsertCall[] = [];
		const dbCompletes: Array<ReturnType<typeof deferred<void>>> = [];
		let activeInserts = 0;

		const db = {
			insert() {
				return {
					values(input: InsertCall) {
						insertOrder.push(input);
						activeInserts += 1;
						const d = deferred<void>();
						dbCompletes.push(d);
						return {
							onConflictDoNothing() {
								return d.promise.finally(() => {
									activeInserts -= 1;
								});
							},
						};
					},
				};
			},
		};

		attachEventPersister(eventBus, db as any, () => {});

		const e1 = eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: 'one',
			payload: {},
		});
		const e2 = eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: 'two',
			payload: {},
		});

		await flushMacrotask();

		// Only the first insert should have started due to serialization.
		expect(insertOrder.map((r) => r.eventId)).to.deep.equal([e1.id]);
		expect(activeInserts).to.equal(1);

		dbCompletes[0]?.resolve();
		await flushMacrotask();
		await flushMacrotask();

		// Second insert starts only after first resolves.
		expect(insertOrder.map((r) => r.eventId)).to.deep.equal([e1.id, e2.id]);
		expect(activeInserts).to.equal(1);

		dbCompletes[1]?.resolve();
		await flushMacrotask();
		await flushMacrotask();
		expect(activeInserts).to.equal(0);
	});

	it('retries transient failures and still writes the event', async () => {
		const { db, inserted, state } = makeDb();
		const eventBus = new RoomEventBus('room-1');
		const detach = attachEventPersister(eventBus, db as never, () => {}, { retryDelaysMs: [1, 1] });
		state.failuresRemaining = 2;

		const e1 = eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: 'one',
			payload: {},
		});

		await settle(() => inserted.length === 1);
		detach();

		expect(inserted).to.have.length(1);
		expect(inserted[0]!.eventId).to.equal(e1.id);
	});

	it('gives up after exhausting retries without throwing into the event bus', async () => {
		const { db, inserted, state } = makeDb();
		const errors: unknown[] = [];
		const eventBus = new RoomEventBus('room-1');
		const detach = attachEventPersister(eventBus, db as never, (err) => errors.push(err), {
			retryDelaysMs: [1],
		});
		state.failuresRemaining = 5;

		eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: 'lost',
			payload: {},
		});

		await settle(() => errors.length === 1);
		detach();

		expect(inserted).to.have.length(0);
		expect(errors).to.have.length(1);
	});

	it('does not call onError for transient failures that eventually succeed', async () => {
		const { db, inserted, state } = makeDb();
		const errors: unknown[] = [];
		const eventBus = new RoomEventBus('room-1');
		const detach = attachEventPersister(eventBus, db as never, (err) => errors.push(err), {
			retryDelaysMs: [1],
		});
		state.failuresRemaining = 1;

		eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: 'retry-ok',
			payload: {},
		});

		await settle(() => inserted.length === 1);
		detach();

		expect(errors).to.have.length(0);
	});

	it('writes events in publish order when the first insert needs retries', async () => {
		const { db, inserted, state } = makeDb();
		const eventBus = new RoomEventBus('room-1');
		const detach = attachEventPersister(eventBus, db as never, () => {}, { retryDelaysMs: [5] });
		state.failuresRemaining = 1;

		const e1 = eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: 'one',
			payload: {},
		});
		const e2 = eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: 'two',
			payload: {},
		});

		await settle(() => inserted.length === 2);
		detach();

		expect(inserted.map((r) => r.eventId)).to.deep.equal([e1.id, e2.id]);
	});

	it('detaching cancels a queued retry so no write lands after unload', async () => {
		const { db, inserted, state } = makeDb();
		const eventBus = new RoomEventBus('room-1');
		const detach = attachEventPersister(eventBus, db as never, () => {}, { retryDelaysMs: [50] });
		state.failuresRemaining = 1;

		eventBus.publish({
			type: 'announce',
			scope: 'public',
			text: 'gone',
			payload: {},
		});

		await new Promise<void>((resolve) => setTimeout(resolve, 15));
		detach();
		await new Promise<void>((resolve) => setTimeout(resolve, 120));

		expect(inserted).to.have.length(0);
	});
});
