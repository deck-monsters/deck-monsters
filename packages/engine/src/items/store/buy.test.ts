import { expect } from 'chai';
import sinon from 'sinon';

import buyItems from './buy.js';
import type { Shop, ShopHost } from './shop.js';
import { chooseCards } from '../../cards/helpers/choose.js';
import { getCards } from './stock.js';

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

		channelStub.resolves('0');

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

		channelStub.resolves('1');

		return buyItems({ character, channel: channelStub, host: makeHost() }).catch(() => {
			return expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any cards") }))).to.equal(true);
		});
	});

	it('commits against the shop as it is at commit time, not the pre-prompt snapshot', async () => {
		// Two members of a room browse at once: their command actions run in
		// separate per-user lanes, so this flow's prompts interleave with the
		// other's purchase. Committing a mutation of the snapshot captured before
		// the prompts would resurrect the item the other player already bought.
		const myItem = { name: 'Bandage', itemType: 'Bandage', cost: 10 };
		const theirItem = { name: 'Potion', itemType: 'Potion', cost: 5 };
		const staleShop: Shop = { ...defaultShop, items: [myItem, theirItem] };
		// The other player's purchase lands while this flow is awaiting prompts.
		const shopAfterTheirPurchase: Shop = { ...defaultShop, items: [myItem] };

		let shopReads = 0;
		const host: ShopHost & { commitShop: sinon.SinonStub } = {
			get shop() {
				shopReads += 1;
				return shopReads === 1 ? staleShop : shopAfterTheirPurchase;
			},
			commitShop: sinon.stub()
		};

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
		channelStub.onCall(0).resolves('0');
		channelStub.onCall(1).resolves('Bandage');
		channelStub.onCall(3).resolves('yes');

		await buyItems({ character, channel: channelStub, host });

		expect(host.commitShop.calledOnce).to.equal(true);
		const committed = host.commitShop.firstCall.args[0] as Shop;
		// Only my purchase is removed; the other player's is not resurrected.
		expect(committed.items).to.deep.equal([]);
	});

	it('does not charge for stock that sold out while the player was deciding', async () => {
		const wantedItem = { name: 'Bandage', itemType: 'Bandage', cost: 10 };
		const staleShop: Shop = { ...defaultShop, items: [wantedItem] };
		const shopAfterSellout: Shop = { ...defaultShop, items: [] };

		let shopReads = 0;
		const host: ShopHost & { commitShop: sinon.SinonStub } = {
			get shop() {
				shopReads += 1;
				return shopReads === 1 ? staleShop : shopAfterSellout;
			},
			commitShop: sinon.stub()
		};

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
		channelStub.onCall(0).resolves('0');
		channelStub.onCall(1).resolves('Bandage');
		channelStub.onCall(3).resolves('yes');

		await buyItems({ character, channel: channelStub, host });

		expect(character.coins).to.equal(500);
		expect(character.addItem.called).to.equal(false);
		expect(host.commitShop.called).to.equal(false);
		expect(channelStub.calledWith(sinon.match({ announce: sinon.match(/sold while you were deciding/) }))).to.equal(true);
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
		channelStub.onCall(0).resolves('0');
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

	// Regression test for the shop menu off-by-one: the menu text and the web client both
	// use 0-based indices ("0) Items"), but the dispatch used to compare against the
	// 1-based literal `1`, so answering with the index for "Items" fell through to the
	// Back Room instead. See docs/roadmap/10b-bugs-fixed.md.
	it('routes the 0-based index for "Items" to the items branch, not the Back Room', () => {
		const backRoomItem = { name: 'Secret Stash', itemType: 'Secret Stash', cost: 999 };
		const shop: Shop = { ...defaultShop, items: [], backRoom: [backRoomItem] };

		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		// "0" is the index InlineChoices.tsx sends for the first menu entry (Items).
		channelStub.resolves('0');

		return buyItems({ character, channel: channelStub, host: makeHost(shop) }).catch(() => {
			// Reaching the items branch (which is empty) throws "don't have any items" —
			// NOT the Back Room's "special in stock" announcement.
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any items") }))).to.equal(true);
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match(/special in stock/) }))).to.equal(false);
		});
	});

	it('routes the 0-based index for "Cards" to the cards branch, not Items', () => {
		const item = { name: 'Bandage', itemType: 'Bandage', cost: 10 };
		const shop: Shop = { ...defaultShop, items: [item], cards: [] };

		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		// "1" is the index InlineChoices.tsx sends for the second menu entry (Cards).
		channelStub.resolves('1');

		return buyItems({ character, channel: channelStub, host: makeHost(shop) }).catch(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any cards") }))).to.equal(true);
		});
	});

	it('routes the Discord button label "Items" to the items branch', () => {
		const shop: Shop = { ...defaultShop, items: [] };

		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		// Discord's PromptHandler resolves with the button's label text, not an index.
		channelStub.resolves('Items');

		return buyItems({ character, channel: channelStub, host: makeHost(shop) }).catch(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any items") }))).to.equal(true);
		});
	});

	// End-to-end regression for the "shop cards are always empty" bug
	// (docs/roadmap/10b-bugs-fixed.md #5): with real stock from `getCards()` and the real
	// `chooseCards` wired through (as `characters/base.ts` now does), the Cards branch
	// must actually reach a card purchase instead of dead-ending on "We don't have any
	// cards here." or "Cards are not available."
	it('buys a real card from real shop stock end-to-end instead of dead-ending', async () => {
		const cards = getCards();
		expect(cards.length).to.be.above(0);

		const wantedCard = cards[0];
		const shop: Shop = { ...defaultShop, cards };
		const host = makeHost(shop);

		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 100000,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		channelStub.resolves();
		channelStub.onCall(0).resolves('1'); // "Cards" menu entry
		channelStub.onCall(1).resolves(wantedCard.cardType); // choose it by name
		channelStub.onCall(3).resolves('yes'); // confirm purchase

		await buyItems({ character, channel: channelStub, host, chooseCards: chooseCards as any });

		expect(channelStub.calledWith(sinon.match({ announce: sinon.match("don't have any cards") }))).to.equal(false);
		expect(channelStub.calledWith(sinon.match({ announce: sinon.match('not available') }))).to.equal(false);
		expect(character.addCard.calledOnce).to.equal(true);
		expect(character.addCard.firstCall.args[0].cardType).to.equal(wantedCard.cardType);
		expect(host.commitShop.calledOnce).to.equal(true);
	});

	it('rejects an unrecognised answer explicitly instead of silently picking a branch', () => {
		const shop: Shop = { ...defaultShop, items: [], cards: [], backRoom: [] };

		const character = {
			givenName: 'Character',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 500,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		channelStub.resolves('nonsense');

		return buyItems({ character, channel: channelStub, host: makeHost(shop) }).catch(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match(/didn't understand/) }))).to.equal(true);
		});
	});
});
