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

		// Only the first insert should have started due to serialization.
		expect(insertOrder.map((r) => r.eventId)).to.deep.equal([e1.id]);
		expect(activeInserts).to.equal(1);

		dbCompletes[0]?.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// Second insert starts only after first resolves.
		expect(insertOrder.map((r) => r.eventId)).to.deep.equal([e1.id, e2.id]);
		expect(activeInserts).to.equal(1);

		dbCompletes[1]?.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(activeInserts).to.equal(0);
	});
});
