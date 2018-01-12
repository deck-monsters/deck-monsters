const { expect, sinon } = require('../../shared/test-setup');
const proxyquire = require('proxyquire');

const randomCharacter = require('../../characters/helpers/random');
const HitCard = require('../../cards/hit');

const defaultShop = {
	name: 'Gorgons and Gremlins',
	adjective: 'rusty',
	priceOffset: 0.6689276100094799,
	backRoomOffset: 9,
	items: [],
	cards: [],
	backRoom: []
};

describe('./items/store/sell.js', () => {
	let sellItems;
	let clock;

	const channelStub = sinon.stub();
	const getShopStub = sinon.stub();

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		channelStub.resolves();
		getShopStub.returns(defaultShop);

		sellItems = proxyquire('./sell', {
			'./shop': getShopStub
		});
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
		getShopStub.reset();
	});

	it('can buy a card', () => {
		const character = randomCharacter({ name: 'Character', coins: 500 });
		const shop = {
			...defaultShop
		};
		getShopStub.returns(shop);
		character.cards = [new HitCard(), new HitCard(), new HitCard(), new HitCard(), new HitCard(), new HitCard(), new HitCard()];

		channelStub.withArgs({
			choices: [1, 2],
			question: `You push open a rusty door and find yourself in Gorgons and Gremlins.

You have 0 items and 7 cards. Which would you like to sell?

1) Items
2) Cards`
		})
			.resolves('2');

		channelStub.withArgs({
			question: `Choose one or more of the following cards:

0) Hit [7] - 2 coins`
		})
			.resolves('0');

		channelStub.withArgs({
			question: `Gorgons and Gremlins is willing to buy your pitiful trash for 2 coins.

Would you like to sell? (yes/no)`
		})
			.resolves('yes');

		sellItems({ character, channel: channelStub })
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: "Here's your 2 coins, Character. Pleasure doing business with you."
				});

				expect(channelStub).to.have.been.calledWith({
					announce: 'Character has 502 coins.'
				});

				expect(shop.cards.length).to.equal(1);
				return expect(character.cards.length).to.equal(6);
			});
	});

	it('can buy multiple cards', () => {
		const character = randomCharacter({ name: 'Character', coins: 500 });
		const shop = {
			...defaultShop
		};
		getShopStub.returns(shop);
		character.cards = [new HitCard(), new HitCard(), new HitCard(), new HitCard(), new HitCard(), new HitCard(), new HitCard()];

		channelStub.withArgs({
			choices: [1, 2],
			question: `You push open a rusty door and find yourself in Gorgons and Gremlins.

You have 0 items and 7 cards. Which would you like to sell?

1) Items
2) Cards`
		})
			.resolves('2');

		channelStub.withArgs({
			question: `Choose one or more of the following cards:

0) Hit [7] - 2 coins`
		})
			.resolves('0,0,0,0');

		channelStub.withArgs({
			question: `Gorgons and Gremlins is willing to buy your pitiful trash for 8 coins.

Would you like to sell? (yes/no)`
		})
			.resolves('yes');

		sellItems({ character, channel: channelStub })
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: "Here's your 8 coins, Character. Pleasure doing business with you."
				});

				expect(channelStub).to.have.been.calledWith({
					announce: 'Character has 508 coins.'
				});

				expect(shop.cards.length).to.equal(5);
				return expect(character.cards.length).to.equal(3);
			});
	});
});
