import { expect } from 'chai';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import sinon from 'sinon';

import { roomStateSavesStale } from './metrics/index.js';
import { nextStateVersion, PostgresStateStore } from './state-store.js';

function makeDb(returning: unknown[] = [{ id: 'r' }]) {
	const returningStub = sinon.stub().resolves(returning);
	const where = sinon.stub().returns({ returning: returningStub });
	const set = sinon.stub().returns({ where });
	const update = sinon.stub().returns({ set });
	return { db: { update } as never, set, where, returningStub };
}

describe('nextStateVersion', () => {
	it('is strictly increasing even within one millisecond', () => {
		const a = nextStateVersion();
		const b = nextStateVersion();
		const c = nextStateVersion();
		expect(b).to.be.greaterThan(a);
		expect(c).to.be.greaterThan(b);
		expect(Number.isSafeInteger(c)).to.be.true;
	});
});

describe('PostgresStateStore', () => {
	afterEach(() => sinon.restore());
	const state = { name: 'Game', options: { roomId: 'r' } };

	it('writes the object itself (not a string) and a version, and never state_blob', async () => {
		const { db, set } = makeDb();
		await new PostgresStateStore(db).save('r', state);

		const written = set.firstCall.args[0];
		expect(written.state).to.equal(state);
		expect(written.stateVersion).to.be.a('number').greaterThan(0);
		// Release 2 of roadmap 37: the legacy blob is no longer written.
		expect(written).to.not.have.property('stateBlob');
	});

	it('stamps versions at call time, so writes landing in reverse order keep the newer state', async () => {
		// In-memory row that honours the `state_version < $v` guard by inspecting the recorded
		// where-clause, with each write held so the second save lands first.
		const row = { state: null as unknown, stateVersion: 0 };
		const gates: Array<() => void> = [];
		let lastWhere: unknown;
		const db = {
			update: () => ({
				set: (values: { state: unknown; stateVersion: number }) => ({
					where: (cond: unknown) => {
						lastWhere = cond;
						return {
							returning: () =>
								new Promise((resolve) => {
									gates.push(() => {
										if (row.stateVersion < values.stateVersion) {
											row.state = values.state;
											row.stateVersion = values.stateVersion;
											resolve([{ id: 'r' }]);
										} else resolve([]);
									});
								}),
						};
					},
				}),
			}),
		} as never;
		const store = new PostgresStateStore(db);
		const older = { name: 'Game', options: { marker: 'older' } };
		const newer = { name: 'Game', options: { marker: 'newer' } };

		const p1 = store.save('r', older);
		const p2 = store.save('r', newer);
		gates[1]!(); // newer lands first
		gates[0]!(); // older lands last and must match no row
		await Promise.all([p1, p2]);

		expect(row.state).to.equal(newer);
		// The guard is in the SQL, not just in the fake.
		const rendered = new PgDialect().sqlToQuery(lastWhere as SQL);
		expect(rendered.sql).to.match(/"id" = \$1 and "rooms"."state_version" < \$2|"state_version" </);
	});

	it('counts a save that matched no row as stale and does not throw or retry', async () => {
		const { db, set } = makeDb([]);
		const before = (await roomStateSavesStale.get()).values[0]?.value ?? 0;

		await new PostgresStateStore(db).save('r', state);

		expect((await roomStateSavesStale.get()).values[0].value).to.equal(before + 1);
		expect(set.calledOnce).to.be.true;
	});

	it('rethrows a failed write', async () => {
		const { db, returningStub } = makeDb();
		returningStub.rejects(new Error('boom'));
		await expect(new PostgresStateStore(db).save('r', state)).to.be.rejectedWith('boom');
	});
});
