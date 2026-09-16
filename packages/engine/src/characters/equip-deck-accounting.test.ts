import { expect } from 'chai';

import Beastmaster from './beastmaster.js';
import Basilisk from '../monsters/basilisk.js';
import HitCard from '../cards/hit.js';
import HealCard from '../cards/heal.js';
import { equipHelpersReady } from '../monsters/helpers/equip.js';

const silentChannel = (async () => undefined) as never;

function setup(deckSize = 3) {
	const beastmaster = new Beastmaster({ name: 'Ada' });
	const monster = new Basilisk({ name: 'Stonefang' });
	beastmaster.addMonster(monster);
	beastmaster.deck = Array.from({ length: deckSize }, () => new HitCard()) as never;
	return { beastmaster, monster };
}

/**
 * `character.deck` is the unequipped pool: `unequipAll` returns cards to it, and
 * `equipCards` / `loadPreset` splice equipped cards out. The console `equip` command
 * did neither, so cards sat in the deck *and* on the monster — and every
 * equip → clear cycle duplicated them into the saved state without bound (#91).
 */
describe('./characters/beastmaster.ts equip deck accounting', () => {
	before(async () => {
		await equipHelpersReady;
	});

	it('removes equipped cards from the character deck', async () => {
		const { beastmaster, monster } = setup(3);

		await beastmaster.equipMonster({
			channel: silentChannel,
			monsterName: 'Stonefang',
			cardSelection: ['Hit', 'Hit'],
		});

		expect(monster.cards).to.have.lengthOf(2);
		expect(beastmaster.deck).to.have.lengthOf(1);
	});

	it('never leaves the same card instance in both the deck and a monster’s hand', async () => {
		const { beastmaster, monster } = setup(3);

		await beastmaster.equipMonster({
			channel: silentChannel,
			monsterName: 'Stonefang',
			cardSelection: ['Hit', 'Hit'],
		});

		const shared = monster.cards.filter(card => beastmaster.deck.includes(card));
		expect(shared, 'no card instance may be equipped and in the deck at once').to.have.lengthOf(0);
	});

	it('conserves total cards across repeated equip → clear cycles', async () => {
		const { beastmaster, monster } = setup(3);
		const total = () => beastmaster.deck.length + monster.cards.length;

		for (let cycle = 0; cycle < 3; cycle += 1) {
			await beastmaster.equipMonster({
				channel: silentChannel,
				monsterName: 'Stonefang',
				cardSelection: ['Hit', 'Hit'],
			});
			expect(total(), `cards conserved while equipped (cycle ${cycle})`).to.equal(3);

			await beastmaster.unequipAll({ channel: silentChannel, monsterName: 'Stonefang' });
			expect(beastmaster.deck, `deck restored exactly (cycle ${cycle})`).to.have.lengthOf(3);
		}
	});

	it('returns cards the monster no longer holds to the deck', async () => {
		const beastmaster = new Beastmaster({ name: 'Ada' });
		const monster = new Basilisk({ name: 'Stonefang' });
		beastmaster.addMonster(monster);
		beastmaster.deck = [new HitCard(), new HealCard()] as never;

		await beastmaster.equipMonster({
			channel: silentChannel,
			monsterName: 'Stonefang',
			cardSelection: ['Hit'],
		});
		expect(monster.cards.map(c => c.cardType)).to.deep.equal(['Hit']);
		expect(beastmaster.deck.map(c => c.cardType)).to.deep.equal(['Heal']);

		// Re-equipping with a different card must hand the Hit back, not drop it.
		await beastmaster.equipMonster({
			channel: silentChannel,
			monsterName: 'Stonefang',
			cardSelection: ['Heal'],
		});
		expect(monster.cards.map(c => c.cardType)).to.deep.equal(['Heal']);
		expect(beastmaster.deck.map(c => c.cardType)).to.deep.equal(['Hit']);
	});

	it('keeps the deck alphabetically sorted after a return', async () => {
		const beastmaster = new Beastmaster({ name: 'Ada' });
		const monster = new Basilisk({ name: 'Stonefang' });
		beastmaster.addMonster(monster);
		beastmaster.deck = [new HealCard(), new HitCard()] as never;

		await beastmaster.equipMonster({
			channel: silentChannel,
			monsterName: 'Stonefang',
			cardSelection: ['Hit'],
		});
		await beastmaster.equipMonster({
			channel: silentChannel,
			monsterName: 'Stonefang',
			cardSelection: ['Heal'],
		});

		const names = beastmaster.deck.map(c => c.cardType);
		expect(names).to.deep.equal([...names].sort());
	});
});

/**
 * `BaseCharacter.cards` used to mint a fresh starting deck whenever the deck was
 * empty, because the constructor always seeds `{ deck: [] }` and the only test was
 * `length <= 0` — so "never had a deck" and "spent every card" were indistinguishable.
 * Fixing the equip accounting above made an empty deck reachable in normal play,
 * which turned that into an unbounded card fountain (#92).
 */
describe('./characters/base.ts starting-deck grant', () => {
	before(async () => {
		await equipHelpersReady;
	});

	it('grants a starting deck to a brand-new character', () => {
		const beastmaster = new Beastmaster({ name: 'Ada' });
		expect(beastmaster.deck.length).to.be.greaterThan(0);
	});

	it('does not refill a deck that was legitimately emptied', () => {
		const beastmaster = new Beastmaster({ name: 'Ada' });
		expect(beastmaster.deck.length).to.be.greaterThan(0);

		beastmaster.deck = [] as never;

		expect(beastmaster.deck, 'an emptied deck must stay empty').to.have.lengthOf(0);
		expect(beastmaster.deck).to.have.lengthOf(0);
	});

	it('does not refill after equipping every card in the deck', async () => {
		const beastmaster = new Beastmaster({ name: 'Ada' });
		const monster = new Basilisk({ name: 'Stonefang' });
		beastmaster.addMonster(monster);
		beastmaster.deck = [new HitCard(), new HitCard()] as never;

		await beastmaster.equipMonster({
			channel: silentChannel,
			monsterName: 'Stonefang',
			cardSelection: ['Hit', 'Hit'],
		});

		expect(monster.cards).to.have.lengthOf(2);
		expect(beastmaster.deck, 'equipping the whole deck must not mint a new one').to.have.lengthOf(0);
	});

	it('marks a restored character with cards as already granted', () => {
		// Simulates a character saved before `deckInitialized` existed: it must be
		// flagged on first read, while it still holds cards, so emptying it later
		// cannot trigger the refill.
		const beastmaster = new Beastmaster({ name: 'Ada' });
		beastmaster.setOptions({ deck: [new HitCard()], deckInitialized: undefined } as never);

		expect(beastmaster.deck).to.have.lengthOf(1);

		beastmaster.deck = [] as never;
		expect(beastmaster.deck, 'legacy character must not refill after emptying').to.have.lengthOf(0);
	});
});
