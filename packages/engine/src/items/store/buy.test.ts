import { expect } from 'chai';
import sinon from 'sinon';

import buyItems from './buy.js';

const defaultShop = {
	adjective: 'rusty',
	backRoom: [] as any[],
	backRoomOffset: 9,
	cards: [] as any[],
	closingTime: new Date(Date.now() + 28800000),
	items: [] as any[],
	name: 'Gorgons and Gremlins',
	priceOffset: 0.6689276100094799,
	pronouns: { he: 'she', him: 'her', his: 'her' }
};

describe('./items/store/buy.ts', () => {
	let clock: sinon.SinonFakeTimers;
	const channelStub = sinon.stub();

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		channelStub.resolves();
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
	});

	it('rejects if no items are in the store and items are chosen', () => {
		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		channelStub.resolves('1');

		return buyItems({ character, channel: channelStub }).catch(() => {
			return expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any items") }))).to.equal(true);
		});
	});

	it('rejects if no cards are in the store and cards are chosen', () => {
		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		channelStub.resolves('2');

		return buyItems({ character, channel: channelStub }).catch(() => {
			return expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any cards") }))).to.equal(true);
		});
	});
});
