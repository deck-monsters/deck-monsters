import { expect } from 'chai';

import { engineReady, getHydratorStatus } from './engine-ready.js';

describe('helpers/engine-ready.ts', () => {
	it('engineReady resolves without rejecting', async () => {
		let err: unknown;
		try {
			await engineReady;
		} catch (e) {
			err = e;
		}
		expect(err, 'engineReady should not reject').to.be.undefined;
	});

	it('all hydrators are loaded (not stubs) after engineReady resolves', async () => {
		await engineReady;

		const status = getHydratorStatus();

		expect(status, 'getHydratorStatus should return an object').to.be.an('object');
		expect(Object.keys(status).length, 'should have at least one hydrator status entry').to.be.above(0);

		for (const [key, loaded] of Object.entries(status)) {
			expect(
				loaded,
				`hydrator "${key}" should be loaded (true), but was still a stub (false)`
			).to.equal(true);
		}
	});

	it('getHydratorStatus returns the expected hydrator keys', async () => {
		await engineReady;

		const status = getHydratorStatus();

		// Character hydrators
		expect(status).to.have.property('hydrateDeck');
		expect(status).to.have.property('fillDeck');
		expect(status).to.have.property('hydrateItems');
		expect(status).to.have.property('hydrateMonster');

		// Monster hydrators
		expect(status).to.have.property('hydrateCard');
		expect(status).to.have.property('hydrateItem');
	});
});
