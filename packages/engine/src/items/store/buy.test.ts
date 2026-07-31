import { expect } from 'chai';
import sinon from 'sinon';

import buyItems from './buy.js';
import type { Shop, ShopHost } from './shop.js';

const defaultShop: Shop = {
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

const makeHost = (shop: Shop = defaultShop): ShopHost & { commitShop: sinon.SinonStub } => ({
	shop,
	commitShop: sinon.stub()
});

describe('./items/store/buy.ts', () => {
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

		return buyItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
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

		return buyItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
			return expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any cards") }))).to.equal(true);
		});
	});

	it('removes a purchased item from the shop and commits the updated shop', async () => {
		const purchasedItem = { name: 'Bandage', itemType: 'Bandage', cost: 10 };
		const remainingItem = { name: 'Potion', itemType: 'Potion', cost: 5 };
		const shop: Shop = { ...defaultShop, items: [purchasedItem, remainingItem] };
		const host = makeHost(shop);

		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		channelStub.resolves();
		channelStub.onCall(0).resolves('1');
		channelStub.onCall(1).resolves('Bandage');
		channelStub.onCall(3).resolves('yes');

		await buyItems({ character, channel: channelStub, host });

		expect(character.addItem.calledWith(purchasedItem)).to.equal(true);
		expect(host.commitShop.calledOnce).to.equal(true);
		const committed = host.commitShop.firstCall.args[0] as Shop;
		expect(committed.items).to.deep.equal([remainingItem]);
		// Original shop object must not have been mutated in place.
		expect(shop.items).to.deep.equal([purchasedItem, remainingItem]);
	});
});
