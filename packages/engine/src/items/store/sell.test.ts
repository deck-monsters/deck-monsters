import { expect } from 'chai';
import sinon from 'sinon';

import sellItems from './sell.js';
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

		channelStub.resolves('0');

		return sellItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
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

		channelStub.resolves('1');

		return sellItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
			return expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any cards") }))).to.equal(true);
		});
	});

	it('adds a sold item to the shop and commits the updated shop', async () => {
		const soldItem = { name: 'Bandage', itemType: 'Bandage', cost: 10 };
		const shop: Shop = { ...defaultShop, items: [] };
		const host = makeHost(shop);

		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [soldItem],
			removeCard: sinon.stub(),
			removeItem: sinon.stub()
		};

		channelStub.resolves();
		channelStub.onCall(0).resolves('0');
		channelStub.onCall(1).resolves('Bandage');
		channelStub.onCall(3).resolves('yes');

		await sellItems({ character, channel: channelStub, host });

		expect(character.removeItem.calledWith(soldItem)).to.equal(true);
		expect(host.commitShop.calledOnce).to.equal(true);
		const committed = host.commitShop.firstCall.args[0] as Shop;
		expect(committed.items).to.deep.equal([soldItem]);
		// Original shop object must not have been mutated in place.
		expect(shop.items).to.deep.equal([]);
	});

	// Regression test for the sell menu off-by-one: the menu text and the web client both
	// use 0-based indices ("0) Items"), but the dispatch used to compare against the
	// 1-based literal `1`, so answering with the index for "Items" always sold Cards
	// instead. See docs/roadmap/10b-bugs-fixed.md.
	it('routes the 0-based index for "Items" to the items branch, not Cards', () => {
		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			removeCard: sinon.stub(),
			removeItem: sinon.stub()
		};

		// "0" is the index InlineChoices.tsx sends for the first menu entry (Items).
		channelStub.resolves('0');

		return sellItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any items") }))).to.equal(true);
		});
	});

	it('routes the 0-based index for "Cards" to the cards branch, not Items', () => {
		const item = { name: 'Bandage', itemType: 'Bandage', cost: 10 };
		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [item],
			removeCard: sinon.stub(),
			removeItem: sinon.stub()
		};

		// "1" is the index InlineChoices.tsx sends for the second menu entry (Cards).
		channelStub.resolves('1');

		return sellItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any cards") }))).to.equal(true);
		});
	});

	it('routes the Discord button label "Items" to the items branch', () => {
		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			removeCard: sinon.stub(),
			removeItem: sinon.stub()
		};

		// Discord's PromptHandler resolves with the button's label text, not an index.
		channelStub.resolves('Items');

		return sellItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any items") }))).to.equal(true);
		});
	});

	it('rejects an unrecognised answer explicitly instead of silently picking a branch', () => {
		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			removeCard: sinon.stub(),
			removeItem: sinon.stub()
		};

		channelStub.resolves('nonsense');

		return sellItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match(/didn't understand/) }))).to.equal(true);
		});
	});
});
