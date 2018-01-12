const { expect, sinon } = require('../../shared/test-setup');

const getShop = require('./shop');

describe('./items/store/shop.js', () => {
	let clock;

	beforeEach(() => {
		clock = sinon.useFakeTimers();
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
		expect(shop.items).to.be.an.instanceof(Array);
		expect(shop.cards.length).to.equal(20);
		expect(shop.backRoom.length).to.equal(1);
	});

	it('gets the same shop for 2 hours', () => {
		const shop = getShop();
		const shop2 = getShop();

		expect(shop).to.equal(shop2);
	});

	it('gets a different shop after 2 hours', () => {
		const shop = getShop();

		clock.tick(7200001);

		const shop2 = getShop();

		expect(shop).to.not.equal(shop2);
	});
});
