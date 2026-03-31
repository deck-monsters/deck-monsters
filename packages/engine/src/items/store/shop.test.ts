import { expect } from 'chai';
import sinon from 'sinon';

import getShop from './shop.js';

describe('./items/store/shop.ts', () => {
	let clock: sinon.SinonFakeTimers;

	beforeEach(() => {
		clock = sinon.useFakeTimers({ toFake: ['Date'] });
	});

	afterEach(() => {
		clock.restore();
	});

	it('can generate a shop', () => {
		const shop = getShop();

		expect(shop.name).to.be.a('string');
		expect(shop.adjective).to.be.a('string');
		expect(shop.priceOffset).to.be.below(1);
		expect(shop.backRoomOffset).to.be.below(10);
		expect(shop.items.length).to.be.above(4);
		expect(shop.items.length).to.be.below(21);
		expect(shop.pronouns).to.be.an('object');
	});

	it('gets the same shop within 8 hours', () => {
		const shop1 = getShop();
		const shop2 = getShop();

		expect(shop1).to.equal(shop2);
	});

	it('gets a different shop after 8 hours', () => {
		const shop1 = getShop();

		clock.tick(28800001);

		const shop2 = getShop();

		expect(shop1).to.not.equal(shop2);
	});
});
