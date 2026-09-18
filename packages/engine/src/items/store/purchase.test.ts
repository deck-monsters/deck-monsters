import { expect } from 'chai';
import sinon from 'sinon';
import { purchaseShopItem } from './purchase.js';
import type { Shop, ShopHost } from './shop.js';

const item = (itemType: string, cost: number) => ({ itemType, cost });
// Real card instances alias `itemType` to `cardType` (see `cards/base.ts`); this fixture
// only sets `cardType`, matching the plain-object shape `purchaseShopItem` must also accept.
const card = (cardType: string, cost: number) => ({ cardType, cost });

const makeShop = (): Shop => ({
	adjective: 'gilded',
	backRoom: [item('Sorting Hat', 100)],
	backRoomOffset: 5,
	cards: [card('Whiskey Shot', 30)],
	closingTime: new Date(Date.now() + 60_000),
	items: [item('Potion of Healing', 50), item('Swiss Chocolate', 20)],
	name: 'The Test Emporium',
	priceOffset: 0.8,
	pronouns: {} as Shop['pronouns'],
});

describe('./items/store/purchase.ts', () => {
	it('buys one standard item and commits the room shop', () => {
		const shop = makeShop();
		const host: ShopHost = { shop, commitShop: sinon.stub() };
		const character = { coins: 100, addItem: sinon.stub() };

		const result = purchaseShopItem({
			character,
			host,
			section: 'items',
			stockIndex: 0,
			expectedItemType: 'Potion of Healing',
			expectedClosingTime: shop.closingTime.toISOString(),
		});

		expect(result.price).to.equal(80);
		expect(result.remainingCoins).to.equal(20);
		expect(character.addItem.calledOnceWithExactly(shop.items[0])).to.equal(true);
		expect((host.commitShop as sinon.SinonStub).firstCall.args[0].items).to.deep.equal([shop.items[1]]);
	});

	it('uses the back-room price without changing standard stock', () => {
		const shop = makeShop();
		const host: ShopHost = { shop, commitShop: sinon.stub() };
		const character = { coins: 600, addItem: sinon.stub() };

		purchaseShopItem({
			character,
			host,
			section: 'backRoom',
			stockIndex: 0,
			expectedItemType: 'Sorting Hat',
			expectedClosingTime: shop.closingTime.toISOString(),
		});

		const committed = (host.commitShop as sinon.SinonStub).firstCall.args[0] as Shop;
		expect(committed.backRoom).to.deep.equal([]);
		expect(committed.items).to.equal(shop.items);
		expect(character.coins).to.equal(100);
	});

	it('rejects stale stock and insufficient funds without mutating anything', () => {
		const shop = makeShop();
		const commitShop = sinon.stub();
		const addItem = sinon.stub();
		const character = { coins: 10, addItem };

		expect(() => purchaseShopItem({
			character,
			host: { shop, commitShop },
			section: 'items',
			stockIndex: 0,
			expectedItemType: 'A Different Item',
			expectedClosingTime: shop.closingTime.toISOString(),
		})).to.throw('no longer in stock');

		expect(() => purchaseShopItem({
			character,
			host: { shop, commitShop },
			section: 'items',
			stockIndex: 0,
			expectedItemType: 'Potion of Healing',
			expectedClosingTime: shop.closingTime.toISOString(),
		})).to.throw('need 80 coins');
		expect(character.coins).to.equal(10);
		expect(addItem.called).to.equal(false);
		expect(commitShop.called).to.equal(false);
	});

	it('buys a card at the same price offset as standard items and adds it to the deck, not the item list', () => {
		const shop = makeShop();
		const host: ShopHost = { shop, commitShop: sinon.stub() };
		const character = { coins: 100, addItem: sinon.stub(), addCard: sinon.stub() };

		const result = purchaseShopItem({
			character,
			host,
			section: 'cards',
			stockIndex: 0,
			expectedItemType: 'Whiskey Shot',
			expectedClosingTime: shop.closingTime.toISOString(),
		});

		// priceOffset (0.8) * 2 = 1.6; 30 * 1.6 = 48 — identical multiplier to a standard item.
		expect(result.price).to.equal(48);
		expect(result.remainingCoins).to.equal(52);
		expect(character.addCard.calledOnceWithExactly(shop.cards[0])).to.equal(true);
		expect(character.addItem.called).to.equal(false);
		expect((host.commitShop as sinon.SinonStub).firstCall.args[0].cards).to.deep.equal([]);
		expect((host.commitShop as sinon.SinonStub).firstCall.args[0].items).to.equal(shop.items);
	});

	it('rejects a stale card token without mutating the deck or the shop', () => {
		const shop = makeShop();
		const commitShop = sinon.stub();
		const addCard = sinon.stub();
		const character = { coins: 100, addItem: sinon.stub(), addCard };

		expect(() => purchaseShopItem({
			character,
			host: { shop, commitShop },
			section: 'cards',
			stockIndex: 0,
			expectedItemType: 'A Different Card',
			expectedClosingTime: shop.closingTime.toISOString(),
		})).to.throw('no longer in stock');

		expect(addCard.called).to.equal(false);
		expect(commitShop.called).to.equal(false);
	});

	it('rejects a token from the previous shop rotation even when the same item is at the same index', () => {
		const shop = makeShop();
		const commitShop = sinon.stub();
		const character = { coins: 100, addItem: sinon.stub() };

		expect(() => purchaseShopItem({
			character,
			host: { shop, commitShop },
			section: 'items',
			stockIndex: 0,
			expectedItemType: 'Potion of Healing',
			expectedClosingTime: new Date(shop.closingTime.getTime() - 1).toISOString(),
		})).to.throw('shop has rotated');
		expect(character.addItem.called).to.equal(false);
		expect(commitShop.called).to.equal(false);
	});
});
