import { expect } from 'chai';
import sinon from 'sinon';
import Beastmaster from './beastmaster.js';

describe('characters/beastmaster', () => {
	let channelStub: sinon.SinonStub;

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

	beforeEach(() => {
		channelStub = sinon.stub().resolves(undefined);
	});

	afterEach(() => {
		channelStub.reset();
		sinon.restore();
	});

	it('can be instantiated', () => {
		const beastmaster = new Beastmaster();

		expect(beastmaster).to.be.instanceOf(Beastmaster);
	});

	it('starts with the correct number of monster slots', () => {
		const beastmaster = new Beastmaster();

		expect(beastmaster.monsterSlots).to.equal(7);
	});

	it('starts with an empty monster list', () => {
		const beastmaster = new Beastmaster();

		expect(beastmaster.monsters).to.deep.equal([]);
	});

	it('can add a monster', () => {
		const beastmaster = new Beastmaster();
		const fakeMonster = { givenName: 'TestMonster' } as any;

		beastmaster.addMonster(fakeMonster);

		expect(beastmaster.monsters).to.include(fakeMonster);
	});

	it('can drop a monster', () => {
		const beastmaster = new Beastmaster();
		const fakeMonster = { givenName: 'TestMonster' } as any;

		beastmaster.addMonster(fakeMonster);
		expect(beastmaster.monsters).to.include(fakeMonster);

		beastmaster.dropMonster(fakeMonster);
		expect(beastmaster.monsters).to.not.include(fakeMonster);
	});

	it('can report whether it owns a monster by name', () => {
		const beastmaster = new Beastmaster();
		const fakeMonster = { givenName: 'Ragnar' } as any;

		expect(beastmaster.ownsMonster('Ragnar')).to.equal(false);

		beastmaster.addMonster(fakeMonster);

		expect(beastmaster.ownsMonster('Ragnar')).to.equal(true);
		expect(beastmaster.ownsMonster('ragnar')).to.equal(true);
		expect(beastmaster.ownsMonster('Unknown')).to.equal(false);
	});

	it('formats a combined card inventory with equipped and unequipped cards', async () => {
		const beastmaster = new Beastmaster();
		beastmaster.monsters = [makeMonster('Stonefang', [makeCard('Hit'), makeCard('Heal')]) as any];
		beastmaster.deck = [makeCard('Blink'), makeCard('Hit')];

		await beastmaster.lookAtCardInventory(channelStub);

		expect(channelStub.called).to.equal(true);
		const announce = channelStub.firstCall.args[0].announce as string;
		expect(announce).to.include('Your Card Inventory');
		expect(announce).to.include('Stonefang');
		expect(announce).to.include('Unequipped (2 cards)');
		expect(announce).to.include('Blink');
	});

	it('unequips cards from a monster and returns them to deck', async () => {
		const beastmaster = new Beastmaster();
		const monster = makeMonster('Stonefang', [makeCard('Hit'), makeCard('Hit'), makeCard('Heal')]);
		beastmaster.monsters = [monster as any];
		beastmaster.deck = [];
		const hitsBefore = beastmaster.deck.filter(card => card.cardType === 'Hit').length;

		const result = await beastmaster.unequipCard({
			channel: channelStub,
			cardName: 'Hit',
			count: 2,
			monsterName: 'Stonefang',
		});

		expect(result.removedCount).to.equal(2);
		expect(monster.cards.map(card => card.cardType)).to.deep.equal(['Heal']);
		const hitsAfter = beastmaster.deck.filter(card => card.cardType === 'Hit').length;
		expect(hitsAfter).to.equal(hitsBefore + 2);
	});

	it('moves cards between monsters directly', async () => {
		const beastmaster = new Beastmaster();
		const fromMonster = makeMonster('Stonefang', [makeCard('Hit'), makeCard('Heal')]);
		const toMonster = makeMonster('Mirebell', [makeCard('Blink')]);
		beastmaster.monsters = [fromMonster as any, toMonster as any];

		const result = await beastmaster.moveCard({
			channel: channelStub,
			cardName: 'Hit',
			fromMonsterName: 'Stonefang',
			toMonsterName: 'Mirebell',
		});

		expect(result.movedCount).to.equal(1);
		expect(fromMonster.cards.map(card => card.cardType)).to.deep.equal(['Heal']);
		expect(toMonster.cards.map(card => card.cardType)).to.deep.equal(['Blink', 'Hit']);
	});

	it('reorders a monster hand by moving a card to a new index', async () => {
		const beastmaster = new Beastmaster();
		const monster = makeMonster('Stonefang', [makeCard('Hit'), makeCard('Heal'), makeCard('Blink')]);
		beastmaster.monsters = [monster as any];

		const result = await beastmaster.reorderCards({
			channel: channelStub,
			monsterName: 'Stonefang',
			fromIndex: 0,
			toIndex: 2,
		});

		expect(result.monsterName).to.equal('Stonefang');
		expect(result.fromIndex).to.equal(0);
		expect(result.toIndex).to.equal(2);
		expect(monster.cards.map(card => card.cardType)).to.deep.equal(['Heal', 'Blink', 'Hit']);
	});

	it('saves, loads, and deletes presets', async () => {
		const beastmaster = new Beastmaster();
		const monster = makeMonster('Stonefang', [makeCard('Hit'), makeCard('Heal')]);
		beastmaster.monsters = [monster as any];
		beastmaster.deck = [makeCard('Blink')];

		const saveResult = await beastmaster.savePreset({
			channel: channelStub,
			presetName: 'aggro',
			monsterName: 'Stonefang',
		});
		expect(saveResult.presetName).to.equal('aggro');

		monster.cards = [makeCard('Blink')];
		beastmaster.deck = [makeCard('Hit'), makeCard('Heal')];
		const loadResult = await beastmaster.loadPreset({
			channel: channelStub,
			presetName: 'aggro',
			monsterName: 'Stonefang',
		});
		expect(loadResult.equipped).to.equal(2);
		expect(monster.cards.map(card => card.cardType)).to.deep.equal(['Hit', 'Heal']);

		const deleteResult = await beastmaster.deletePreset({
			channel: channelStub,
			presetName: 'aggro',
			monsterName: 'Stonefang',
		});
		expect(deleteResult.presetName).to.equal('aggro');
		expect(beastmaster.getPresets('Stonefang')).to.deep.equal({});
	});

	it('returns skipped cards when loading an incomplete preset', async () => {
		const beastmaster = new Beastmaster();
		const monster = makeMonster('Stonefang', [makeCard('Hit'), makeCard('Heal')]);
		beastmaster.monsters = [monster as any];

		await beastmaster.savePreset({
			channel: channelStub,
			presetName: 'starter',
			monsterName: 'Stonefang',
		});

		monster.cards = [];
		beastmaster.deck = [makeCard('Hit')];
		const loadResult = await beastmaster.loadPreset({
			channel: channelStub,
			presetName: 'starter',
			monsterName: 'Stonefang',
		});

		expect(loadResult.equipped).to.equal(1);
		expect(loadResult.requested).to.equal(2);
		expect(loadResult.skippedCards).to.deep.equal(['Heal']);
	});
});
