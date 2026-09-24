import { expect } from 'chai';
import sinon from 'sinon';
import sellItems from './sell.js';
import { sellToShop } from './sell-to-shop.js';
import type { Shop, ShopHost } from './shop.js';
import Beastmaster from '../../characters/beastmaster.js';
import Basilisk from '../../monsters/basilisk.js';
import HitCard from '../../cards/hit.js';
import { equipHelpersReady } from '../../monsters/helpers/equip.js';

const silentChannel = (async () => undefined) as never;

const item = (itemType: string, cost: number) => ({ itemType, cost });
// Real card instances alias `itemType` to `cardType` (see `cards/base.ts`); this fixture
// only sets `cardType`, matching the plain-object shape `sellToShop` must also accept —
// mirrors the same fixture shape `purchase.test.ts` uses for `purchaseShopItem`.
const card = (cardType: string, cost: number) => ({ cardType, cost });

const makeShop = (overrides: Partial<Shop> = {}): Shop => ({
	adjective: 'gilded',
	backRoom: [],
	backRoomOffset: 5,
	cards: [],
	closingTime: new Date(Date.now() + 60_000),
	items: [],
	name: 'The Test Emporium',
	priceOffset: 0.8,
	pronouns: {} as Shop['pronouns'],
	...overrides,
});

const makeCharacter = (opts: { items?: any[]; cards?: any[]; coins?: number } = {}) => {
	const items = opts.items ?? [];
	const cards = opts.cards ?? [];
	return {
		coins: opts.coins ?? 0,
		items,
		cards,
		// `sellToShop` removes sold cards via `removeCardFromPool` (splice-by-identity +
		// `emit`), not `character.removeCard` (bug #182) — see remove-card-from-pool.ts.
		// `emit` is exercised for real by the Beastmaster test below; stubbed here so the
		// plain-object doubles above don't need to be full BaseClass instances.
		emit: sinon.stub(),
		removeItem: sinon.stub().callsFake((toRemove: any) => {
			const index = items.indexOf(toRemove);
			if (index >= 0) return items.splice(index, 1)[0];
			return undefined;
		}),
		removeCard: sinon.stub().callsFake((toRemove: any) => {
			const index = cards.indexOf(toRemove);
			if (index >= 0) return cards.splice(index, 1)[0];
			return undefined;
		}),
	};
};

describe('./items/store/sell-to-shop.ts', () => {
	it('sells one owned item at the shop price offset and commits the room shop', () => {
		const bandage = item('Bandage', 10);
		const shop = makeShop();
		const host: ShopHost = { shop, commitShop: sinon.stub() };
		const character = makeCharacter({ items: [bandage], coins: 5 });

		const result = sellToShop({
			character,
			host,
			selections: [{ section: 'items', type: 'Bandage', count: 1 }],
			expectedClosingTime: shop.closingTime.toISOString(),
		});

		expect(result.totalValue).to.equal(8); // round(10 * 0.8)
		expect(result.remainingCoins).to.equal(13);
		expect(character.removeItem.calledOnceWithExactly(bandage)).to.equal(true);
		expect((host.commitShop as sinon.SinonStub).firstCall.args[0].items).to.deep.equal([bandage]);
		// Original shop object must not have been mutated in place.
		expect(shop.items).to.deep.equal([]);
	});

	it('sells a card at the same offset as an item (no *2 markup — that only applies to buying)', () => {
		const whiskeyShot = card('Whiskey Shot', 30);
		const shop = makeShop();
		const host: ShopHost = { shop, commitShop: sinon.stub() };
		const character = makeCharacter({ cards: [whiskeyShot] });

		const result = sellToShop({
			character,
			host,
			selections: [{ section: 'cards', type: 'Whiskey Shot', count: 1 }],
			expectedClosingTime: shop.closingTime.toISOString(),
		});

		expect(result.totalValue).to.equal(24); // round(30 * 0.8)
		// Removed via `removeCardFromPool` (identity splice), not `character.removeCard`
		// — see the Beastmaster test below for why that distinction matters (bug #182).
		expect(character.removeCard.called).to.equal(false);
		expect(character.cards).to.deep.equal([]);
		expect((host.commitShop as sinon.SinonStub).firstCall.args[0].cards).to.deep.equal([whiskeyShot]);
	});

	it('sells multiple of the same type and multiple selections in one call', () => {
		const bandages = [item('Bandage', 10), item('Bandage', 10)];
		const potion = item('Potion of Healing', 50);
		const shop = makeShop();
		const host: ShopHost = { shop, commitShop: sinon.stub() };
		const character = makeCharacter({ items: [...bandages, potion] });

		const result = sellToShop({
			character,
			host,
			selections: [
				{ section: 'items', type: 'Bandage', count: 2 },
				{ section: 'items', type: 'Potion of Healing', count: 1 },
			],
			expectedClosingTime: shop.closingTime.toISOString(),
		});

		// round(10*0.8)*2 + round(50*0.8) = 16 + 40 = 56
		expect(result.totalValue).to.equal(56);
		expect(character.items).to.deep.equal([]);
		expect((host.commitShop as sinon.SinonStub).firstCall.args[0].items).to.deep.equal([...bandages, potion]);
	});

	it('matches the console sell flow price for the same shop and items', async () => {
		const bandage = item('Bandage', 10);
		const consoleShop = makeShop({ items: [bandage] });
		const consoleHost: ShopHost = { shop: consoleShop, commitShop: sinon.stub() };
		const consoleCharacter = {
			givenName: 'Console Player',
			pronouns: { he: 'he', him: 'him', his: 'his' },
			coins: 0,
			items: [bandage],
			cards: [] as any[],
			removeItem: sinon.stub(),
			removeCard: sinon.stub(),
		};
		const channel = sinon.stub();
		channel.onCall(0).resolves('0'); // "Items"
		channel.onCall(1).resolves('Bandage');
		channel.onCall(3).resolves('yes');
		channel.resolves();

		await sellItems({ character: consoleCharacter, channel, host: consoleHost });
		expect(consoleCharacter.coins).to.equal(8);

		const webShop = makeShop({ items: [item('Bandage', 10)] });
		const webHost: ShopHost = { shop: webShop, commitShop: sinon.stub() };
		const webCharacter = makeCharacter({ items: [item('Bandage', 10)] });

		const result = sellToShop({
			character: webCharacter,
			host: webHost,
			selections: [{ section: 'items', type: 'Bandage', count: 1 }],
			expectedClosingTime: webShop.closingTime.toISOString(),
		});

		expect(result.totalValue).to.equal(consoleCharacter.coins);
	});

	it('refuses to sell an item or card the character does not own, without mutating anything', () => {
		const shop = makeShop();
		const character = makeCharacter({ items: [item('Bandage', 10)] });

		expect(() =>
			sellToShop({
				character,
				host: { shop, commitShop: sinon.stub() },
				selections: [{ section: 'items', type: 'Potion of Healing', count: 1 }],
				expectedClosingTime: shop.closingTime.toISOString(),
			}),
		).to.throw("don't have a Potion of Healing to sell");
		expect(character.items).to.deep.equal([item('Bandage', 10)]);
		expect(character.removeItem.called).to.equal(false);
	});

	it('refuses to sell more copies than the character owns, without a partial sale', () => {
		const shop = makeShop();
		const character = makeCharacter({ items: [item('Bandage', 10)] });

		expect(() =>
			sellToShop({
				character,
				host: { shop, commitShop: sinon.stub() },
				selections: [{ section: 'items', type: 'Bandage', count: 2 }],
				expectedClosingTime: shop.closingTime.toISOString(),
			}),
		).to.throw("don't have 2 Bandages to sell");
		expect(character.removeItem.called).to.equal(false);
	});

	it('never sells a card equipped on a monster, because it is not in character.cards', () => {
		// A card moved onto a monster's deck leaves `character.cards` (see
		// characters/base.ts's `removeCard` / the equip flow) — `sellToShop` only ever
		// reads `character.cards`/`character.items`, so an equipped card is simply absent
		// from the pool it can match against, the same way the console flow can't sell it.
		const equippedElsewhere = card('Horn Gore', 15);
		const shop = makeShop();
		const character = makeCharacter({ cards: [] }); // Horn Gore lives on the monster, not here

		expect(() =>
			sellToShop({
				character,
				host: { shop, commitShop: sinon.stub() },
				selections: [{ section: 'cards', type: equippedElsewhere.cardType, count: 1 }],
				expectedClosingTime: shop.closingTime.toISOString(),
			}),
		).to.throw('to sell');
	});

	it('rejects a token from a previous shop rotation without mutating anything', () => {
		const shop = makeShop({ items: [item('Bandage', 10)] });
		const commitShop = sinon.stub();
		const character = makeCharacter({ items: [item('Bandage', 10)] });

		expect(() =>
			sellToShop({
				character,
				host: { shop, commitShop },
				selections: [{ section: 'items', type: 'Bandage', count: 1 }],
				expectedClosingTime: new Date(shop.closingTime.getTime() - 1).toISOString(),
			}),
		).to.throw('shop has rotated');
		expect(character.removeItem.called).to.equal(false);
		expect(commitShop.called).to.equal(false);
	});

	it('re-reads the shop at commit time so a concurrent purchase by another member is preserved', () => {
		const bandage = item('Bandage', 10);
		const shop = makeShop({ items: [] });
		// Simulate another room member's purchase landing on the host between this flow
		// opening the shop and committing the sale — `host.shop` returns the post-purchase
		// stock when `sellToShop` reads it, just like `purchaseShopItem`'s equivalent test.
		const rotatedShop = { ...shop, items: [item('Potion of Healing', 50)] };
		const host: ShopHost = {
			get shop() {
				return rotatedShop;
			},
			commitShop: sinon.stub(),
		};
		const character = makeCharacter({ items: [bandage] });

		sellToShop({
			character,
			host,
			selections: [{ section: 'items', type: 'Bandage', count: 1 }],
			expectedClosingTime: shop.closingTime.toISOString(),
		});

		const committed = (host.commitShop as sinon.SinonStub).firstCall.args[0] as Shop;
		expect(committed.items).to.deep.equal([item('Potion of Healing', 50), bandage]);
	});

	it('rejects an empty selection', () => {
		const shop = makeShop();
		expect(() =>
			sellToShop({
				character: makeCharacter(),
				host: { shop, commitShop: sinon.stub() },
				selections: [],
				expectedClosingTime: shop.closingTime.toISOString(),
			}),
		).to.throw('at least one');
	});

	// Regression test for #182: `Beastmaster.removeCard` also calls
	// `monster.resetCards({ matchCard })` on every owned monster, which clears a
	// monster's ENTIRE hand if it holds any card that is JSON-identical (same
	// `cardType`) to the one being removed — even though equipped and unequipped
	// cards are always disjoint *instances* (`reconcileDeckAfterEquip`). Selling one
	// unequipped `Hit` used to wipe an equipped Beastmaster monster's whole deck.
	// Uses real classes, not the plain-object doubles above, because the bug lives
	// entirely in the real `Beastmaster`/`BaseMonster` override chain that a stub
	// `removeCard` never exercises.
	describe('a real Beastmaster with an equipped monster', () => {
		before(async () => {
			await equipHelpersReady;
		});

		it('sells an unequipped card without touching a monster holding an identical one', async () => {
			const beastmaster = new Beastmaster({ name: 'Ada' }) as never as { deck: any[]; coins: number };
			const monster = new Basilisk({ name: 'Stonefang' });
			(beastmaster as unknown as { addMonster: (m: unknown) => void }).addMonster(monster);
			// Three JSON-identical `Hit` instances: two equipped on the monster, one left
			// unequipped in the character's pool.
			beastmaster.deck = [new HitCard(), new HitCard(), new HitCard()];

			await (beastmaster as unknown as {
				equipMonster: (opts: unknown) => Promise<unknown>;
			}).equipMonster({
				channel: silentChannel,
				monsterName: 'Stonefang',
				cardSelection: ['Hit', 'Hit'],
			});

			expect(monster.cards).to.have.lengthOf(2);
			expect(beastmaster.deck).to.have.lengthOf(1);

			const shop = makeShop();
			const host: ShopHost = { shop, commitShop: sinon.stub() };

			const result = sellToShop({
				character: beastmaster,
				host,
				selections: [{ section: 'cards', type: 'Hit', count: 1 }],
				expectedClosingTime: shop.closingTime.toISOString(),
			});

			expect(result.sold).to.have.lengthOf(1);
			// The equipped deck must be untouched — this is the bug: it used to be wiped
			// to [] by `resetCards({ matchCard })`.
			expect(monster.cards, "equipped deck must survive selling an identical unequipped card").to.have.lengthOf(2);
			// The unequipped pool shrank by exactly the sold count.
			expect(beastmaster.deck, 'pool shrank by exactly the sold count').to.have.lengthOf(0);
		});
	});
});
