import { expect } from 'chai';
import sinon from 'sinon';
import { purchaseShopItem } from './purchase.js';
import type { Shop, ShopHost } from './shop.js';

const item = (itemType: string, cost: number) => ({ itemType, cost });

const makeShop = (): Shop => ({
	adjective: 'gilded',
	backRoom: [item('Sorting Hat', 100)],
	backRoomOffset: 5,
	cards: [],
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
		})).to.throw('no longer in stock');

		expect(() => purchaseShopItem({
			character,
			host: { shop, commitShop },
			section: 'items',
			stockIndex: 0,
			expectedItemType: 'Potion of Healing',
		})).to.throw('need 80 coins');
		expect(character.coins).to.equal(10);
		expect(addItem.called).to.equal(false);
		expect(commitShop.called).to.equal(false);
	});
});

