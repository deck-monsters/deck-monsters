import { expect } from 'chai';
import sinon from 'sinon';

import Beastmaster from './beastmaster.js';

/*
 * A monster waiting in the ring keeps its hand (owner, 2026-11-12). Moving, unequipping and
 * clearing its cards used to check only for a fight, so it could be stripped while it waited.
 */
describe('characters/beastmaster: a monster waiting in the ring keeps its hand', () => {
	const makeCard = (cardType: string) => ({ cardType, name: cardType });
	const makeMonster = (name: string, cards: any[] = []) => ({
		givenName: name,
		creatureType: 'Basilisk',
		level: 4,
		cardSlots: 9,
		inEncounter: false,
		items: [],
		cards: [...cards],
		options: {},
		canHoldCard: () => true,
		setOptions(update: Record<string, unknown>) {
			this.options = { ...this.options, ...update };
		},
	});
	const quiet = () => sinon.stub().resolves(undefined);
	const WAITING = /is waiting in the ring, so their cards stay put until they leave it/;

	function setup() {
		const beastmaster = new Beastmaster();
		const brass = makeMonster('Brass', [makeCard('Hit'), makeCard('Blast'), makeCard('Heal')]);
		const ember = makeMonster('Ember', []);
		beastmaster.monsters = [brass as any, ember as any];
		const ring = { contestants: [{ monster: brass }] };
		return { beastmaster, brass, ember, ring };
	}

	it('refuses to move a card off it, changing nothing', async () => {
		const { beastmaster, brass, ember, ring } = setup();
		const channel = quiet();
		await beastmaster
			.moveCard({ cardName: 'Hit', fromMonsterName: 'Brass', toMonsterName: 'Ember', channel, ring })
			.then(() => expect.fail('should refuse'), () => undefined);
		expect(brass.cards).to.have.length(3);
		expect(ember.cards).to.have.length(0);
		expect(String(channel.firstCall.args[0].announce)).to.match(WAITING);
	});

	it('refuses to unequip a card from it, changing nothing', async () => {
		const { beastmaster, brass, ring } = setup();
		const deckBefore = beastmaster.deck.length;
		await beastmaster
			.unequipCard({ cardName: 'Hit', monsterName: 'Brass', channel: quiet(), ring })
			.then(() => expect.fail('should refuse'), () => undefined);
		expect(brass.cards).to.have.length(3);
		expect(beastmaster.deck).to.have.length(deckBefore);
	});

	it('refuses to clear its deck, changing nothing', async () => {
		const { beastmaster, brass, ring } = setup();
		await beastmaster
			.unequipAll({ monsterName: 'Brass', channel: quiet(), ring })
			.then(() => expect.fail('should refuse'), () => undefined);
		expect(brass.cards).to.have.length(3);
	});

	it('still moves and unequips for a monster that is not in the ring', async () => {
		const { beastmaster, brass, ember } = setup();
		const ring = { contestants: [{ monster: ember }] };
		const moved = await beastmaster.moveCard({ cardName: 'Hit', fromMonsterName: 'Brass', toMonsterName: 'Ember', channel: quiet(), ring });
		expect(moved.movedCount).to.equal(1);
		const removed = await beastmaster.unequipCard({ cardName: 'Blast', monsterName: 'Brass', channel: quiet(), ring });
		expect(removed.removedCount).to.equal(1);
		expect(brass.cards).to.have.length(1);
	});
});
