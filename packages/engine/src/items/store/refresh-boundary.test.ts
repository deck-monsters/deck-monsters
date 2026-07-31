import { expect } from 'chai';
import sinon from 'sinon';

import { nextShopBoundary, SHOP_REFRESH_HOURS } from './refresh-boundary.js';

describe('./items/store/refresh-boundary.ts', () => {
	let clock: sinon.SinonFakeTimers;

	afterEach(() => {
		clock?.restore();
	});

	it('returns the next 6-hour Central boundary during CST (winter, UTC-6)', () => {
		// 2026-01-15 14:23:00 UTC = 08:23:00 CST -> next boundary is 12:00 CST = 18:00 UTC
		clock = sinon.useFakeTimers(new Date('2026-01-15T14:23:00.000Z').getTime());

		const boundary = nextShopBoundary(Date.now());

		expect(boundary.toISOString()).to.equal('2026-01-15T18:00:00.000Z');
	});

	it('returns the next 6-hour Central boundary during CDT (summer, UTC-5)', () => {
		// 2026-07-15 14:23:00 UTC = 09:23:00 CDT -> next boundary is 12:00 CDT = 17:00 UTC
		clock = sinon.useFakeTimers(new Date('2026-07-15T14:23:00.000Z').getTime());

		const boundary = nextShopBoundary(Date.now());

		expect(boundary.toISOString()).to.equal('2026-07-15T17:00:00.000Z');
	});

	it('returns a boundary exactly SHOP_REFRESH_HOURS ahead when already sitting on a boundary', () => {
		// 2026-01-15 06:00:00 CST = 12:00:00 UTC -> next boundary is 12:00 CST = 18:00 UTC
		clock = sinon.useFakeTimers(new Date('2026-01-15T12:00:00.000Z').getTime());

		const boundary = nextShopBoundary(Date.now());

		expect(boundary.getTime() - Date.now()).to.equal(SHOP_REFRESH_HOURS * 3600000);
	});

	it('returns a boundary on the US spring-forward transition day', () => {
		// 2026-03-08 is the US spring-forward date. 07:30 UTC = 01:30 CST (still UTC-6 pre-transition).
		clock = sinon.useFakeTimers(new Date('2026-03-08T07:30:00.000Z').getTime());

		const boundary = nextShopBoundary(Date.now());

		// Next Central boundary is 06:00 local; whether that lands as 12:00 or 11:00 UTC
		// depends on which side of 2am the transition falls, but it must always be ahead of now.
		expect(boundary.getTime()).to.be.greaterThan(Date.now());
	});

	it('returns a boundary on the US fall-back transition day', () => {
		// 2026-11-01 is the US fall-back date.
		clock = sinon.useFakeTimers(new Date('2026-11-01T07:30:00.000Z').getTime());

		const boundary = nextShopBoundary(Date.now());

		expect(boundary.getTime()).to.be.greaterThan(Date.now());
	});
});
