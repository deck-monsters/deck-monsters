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
		// Only my purchase is removed; the other player's is not resurrected. The Sorting Hat
		// every shop keeps is all that is left.
		expect(committed.items.map((i: any) => i.itemType)).to.deep.equal(['Sorting Hat']);
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

	it('sells the restocked Sorting Hat when another player bought the one on show', async () => {
		const shownHat = { name: 'Sorting Hat', itemType: 'Sorting Hat', cost: 0 };
		const restockedHat = { name: 'Sorting Hat', itemType: 'Sorting Hat', cost: 0 };
		const staleShop: Shop = { ...defaultShop, items: [shownHat] };
		const shopAfterPurchase: Shop = { ...defaultShop, items: [restockedHat] };

		let shopReads = 0;
		const host: ShopHost & { commitShop: sinon.SinonStub } = {
			get shop() {
				shopReads += 1;
				return shopReads === 1 ? staleShop : shopAfterPurchase;
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
		channelStub.onCall(1).resolves('Sorting Hat');
		channelStub.onCall(3).resolves('yes');

		await buyItems({ character, channel: channelStub, host });

		expect(character.addItem.calledOnceWithExactly(restockedHat)).to.equal(true);
		expect(channelStub.calledWith(sinon.match({ announce: sinon.match(/sold while you were deciding/) }))).to.equal(false);
		const committed = host.commitShop.firstCall.args[0] as Shop;
		const hats = committed.items.filter((i: any) => i.itemType === 'Sorting Hat');
		expect(hats).to.have.length(1);
		expect(hats[0]).to.not.equal(restockedHat);
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
		// The rest remain, beside the Sorting Hat every shop keeps.
		expect(committed.items.map((i: any) => i.itemType)).to.deep.equal(['Potion', 'Sorting Hat']);
		expect(committed.items).to.include(remainingItem);
		// Original shop object must not have been mutated in place.
		expect(shop.items).to.deep.equal([purchasedItem, remainingItem]);
	});

	it('names the items in the confirm and the receipt, and says what to do next', async () => {
		const bandage = { name: 'Bandage', itemType: 'Bandage', cost: 10 };
		const potion = { name: 'Potion', itemType: 'Potion', cost: 5 };
		const shop: Shop = { ...defaultShop, priceOffset: 1, items: [bandage, potion] };
		const character = {
			givenName: 'Ada',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 100,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		channelStub.resolves();
		channelStub.onCall(0).resolves('0');
		channelStub.onCall(1).resolves('0, 1');
		channelStub.onCall(3).resolves('yes');

		await buyItems({ character, channel: channelStub, host: makeHost(shop) });

		const questions = channelStub.getCalls().map(call => call.args[0]?.question).filter(Boolean);
		// The shop's pick prompt carries the marker the web client reads for its Buy button.
		expect(questions[1]).to.match(/^Choose one or more of the following items to buy:/);
		// Prices are doubled (priceOffset * 2): 10 * 2 + 5 * 2 = 30.
		expect(questions[2]).to.equal('Bandage and Potion from Gorgons and Gremlins for 30 coins. Buy them? (yes/no)');
		expect(channelStub.calledWith({
			announce: 'Sold: Bandage and Potion. Ada has 70 coins left. Use an item with use, or give it to a monster with give.'
		})).to.equal(true);
		// The receipt already says the balance; it is not repeated on its own line.
		expect(channelStub.calledWith({ announce: 'Ada has 70 coins.' })).to.equal(false);
	});

	it('asks "Buy it?" and says "1 coin" for a single one-coin item', async () => {
		const pebble = { name: 'Pebble', itemType: 'Pebble', cost: 0.5 };
		const shop: Shop = { ...defaultShop, priceOffset: 1, items: [pebble] };
		const character = {
			givenName: 'Ada',
			pronouns: { he: 'she', him: 'her', his: 'her' },
			coins: 5,
			cards: [] as any[],
			items: [] as any[],
			addCard: sinon.stub(),
			addItem: sinon.stub()
		};

		channelStub.resolves();
		channelStub.onCall(0).resolves('0');
		channelStub.onCall(1).resolves('Pebble');
		channelStub.onCall(3).resolves('no');

		await buyItems({ character, channel: channelStub, host: makeHost(shop) });

		const questions = channelStub.getCalls().map(call => call.args[0]?.question).filter(Boolean);
		expect(questions[2]).to.equal('Pebble from Gorgons and Gremlins for 1 coin. Buy it? (yes/no)');
		// Declining still closes with the balance.
		expect(channelStub.calledWith({ announce: 'Ada has 5 coins.' })).to.equal(true);
	});

	const makeBuyer = () => ({
		givenName: 'Ada',
		pronouns: { he: 'she', him: 'her', his: 'her' },
		coins: 1000,
		cards: [] as any[],
		items: [] as any[],
		addCard: sinon.stub(),
		addItem: sinon.stub()
	});

	// Answers by prompt content, so the test does not depend on how many announces sit between.
	const answerBy = (menu: string, pick: string) => {
		channelStub.callsFake(async (msg: any = {}) => {
			if (!msg.question) return undefined;
			if (msg.question.includes('Which would you like to see')) return menu;
			if (msg.question.includes('items to buy')) return pick;
			return 'yes';
		});
	};

	it('groups copies in the confirm and receipt: "Bandage ×2 and Potion"', async () => {
		const shop: Shop = {
			...defaultShop,
			priceOffset: 1,
			items: [
				{ name: 'Bandage', itemType: 'Bandage', cost: 1 },
				{ name: 'Bandage', itemType: 'Bandage', cost: 1 },
				{ name: 'Potion', itemType: 'Potion', cost: 1 }
			]
		};
		answerBy('0', 'Bandage, Bandage, Potion');

		await buyItems({ character: makeBuyer(), channel: channelStub, host: makeHost(shop) });

		const questions = channelStub.getCalls().map(call => call.args[0]?.question).filter(Boolean);
		expect(questions.some((q: string) => q.startsWith('Bandage ×2 and Potion from Gorgons and Gremlins for 6 coins. Buy them? (yes/no)'))).to.equal(true);
		expect(channelStub.calledWith({
			announce: 'Sold: Bandage ×2 and Potion. Ada has 994 coins left. Use an item with use, or give it to a monster with give.'
		})).to.equal(true);
	});

	it('asks "Buy them?" for two copies of one item', async () => {
		const shop: Shop = {
			...defaultShop,
			priceOffset: 1,
			items: [
				{ name: 'Bandage', itemType: 'Bandage', cost: 1 },
				{ name: 'Bandage', itemType: 'Bandage', cost: 1 }
			]
		};
		answerBy('0', 'Bandage, Bandage');

		await buyItems({ character: makeBuyer(), channel: channelStub, host: makeHost(shop) });

		const questions = channelStub.getCalls().map(call => call.args[0]?.question).filter(Boolean);
		expect(questions.some((q: string) => q.startsWith('Bandage ×2 from Gorgons and Gremlins for 4 coins. Buy them? (yes/no)'))).to.equal(true);
	});

	it('carries the buy marker in the Back Room pick prompt, and a cards-only receipt omits the item hint', async () => {
		const card = { name: 'Hit', cardType: 'Hit', cost: 1 };
		const shop: Shop = { ...defaultShop, backRoomOffset: 1, backRoom: [card] };
		answerBy('2', 'Hit');

		await buyItems({ character: makeBuyer(), channel: channelStub, host: makeHost(shop) });

		const questions = channelStub.getCalls().map(call => call.args[0]?.question).filter(Boolean);
		expect(questions.some((q: string) => q.startsWith('Choose one or more of the following items to buy:'))).to.equal(true);
		const receipt = channelStub.getCalls().map(call => call.args[0]?.announce).find((a: string) => a?.startsWith('Sold:'));
		expect(receipt).to.equal('Sold: Hit. Ada has 999 coins left.');
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
