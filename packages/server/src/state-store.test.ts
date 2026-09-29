import { expect } from 'chai';
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

	it('writes the object itself (not a string), a version and the legacy blob', async () => {
		const { db, set } = makeDb();
		await new PostgresStateStore(db).save('r', state);

		const written = set.firstCall.args[0];
		expect(written.state).to.equal(state);
		expect(written.stateVersion).to.be.a('number').greaterThan(0);
		expect(written.stateBlob).to.be.a('string');
	});

	it('stamps versions at call time, so a later snapshot always carries a higher one', async () => {
		const first = makeDb();
		const second = makeDb();
		const store1 = new PostgresStateStore(first.db);
		const store2 = new PostgresStateStore(second.db);
		// Both writes are started in snapshot order; the second one's update is what lands first
		// on the database. Only the versions matter for the guard.
		const p1 = store1.save('r', state);
		const p2 = store2.save('r', state);
		await Promise.all([p2, p1]);

		const v1 = first.set.firstCall.args[0].stateVersion;
		const v2 = second.set.firstCall.args[0].stateVersion;
		expect(v2).to.be.greaterThan(v1);
		// The guard `state_version < $v` is what makes the older write match no row.
		expect(first.where.calledOnce).to.be.true;
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
