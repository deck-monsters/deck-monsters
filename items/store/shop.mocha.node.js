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
		expect(shop.items.length).to.be.above(4);
		expect(shop.items.length).to.be.below(21);
		expect(shop.cards.length).to.be.above(4);
		expect(shop.cards.length).to.be.below(21);
		expect(shop.backRoom.length).to.be.above(0);
		expect(shop.backRoom.length).to.be.below(7);
		expect(shop.pronouns).to.be.an('object');
	});

	it('gets the same shop for 8 hours', () => {
		const shop = getShop();
		const shop2 = getShop();

		expect(shop).to.equal(shop2);
	});

	it('gets a different shop after 8 hours', () => {
		const shop = getShop();

		clock.tick(28800001);

		const shop2 = getShop();

		expect(shop).to.not.equal(shop2);
	});
});
