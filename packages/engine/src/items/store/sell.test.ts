import { expect } from 'chai';
import sinon from 'sinon';

import sellItems from './sell.js';

describe('./items/store/sell.ts', () => {
	let clock: sinon.SinonFakeTimers;
	const channelStub = sinon.stub();

	beforeEach(() => {
		clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
		channelStub.resolves();
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
	});

	it('rejects if no items and items selected', () => {
		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			removeCard: sinon.stub(),
			removeItem: sinon.stub()
		};

		channelStub.resolves('1');

		return sellItems({ character, channel: channelStub }).catch(() => {
			return expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any items") }))).to.equal(true);
		});
	});

	it('rejects if no cards and cards selected', () => {
		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			removeCard: sinon.stub(),
			removeItem: sinon.stub()
		};

		channelStub.resolves('2');

		return sellItems({ character, channel: channelStub }).catch(() => {
			return expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any cards") }))).to.equal(true);
		});
	});
});
