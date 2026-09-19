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

	it('stops a dropped monster\'s background timers', () => {
		const beastmaster = new Beastmaster();
		const disposeTimers = sinon.stub();
		const fakeMonster = { givenName: 'TestMonster', disposeTimers } as any;

		beastmaster.addMonster(fakeMonster);
		beastmaster.dropMonster(fakeMonster);

		expect(disposeTimers.calledOnce).to.equal(true);
	});

	it('does not start a second revival for a monster whose timer is already running', async () => {
		const beastmaster = new Beastmaster();
		const respawn = sinon.stub();
		beastmaster.addMonster({
			givenName: 'Toyota', dead: true, inEncounter: false, respawnTimeout: {}, respawn,
		} as any);

		await expect(beastmaster.reviveMonster({ monsterName: 'Toyota', channel: channelStub }))
			.to.be.rejectedWith("You don't have any monsters to revive.");
		expect(respawn.called).to.equal(false);
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

	it('resolves preset names case-insensitively across connectors', async () => {
		// The text command parser lowercases the whole command, while the web
		// workshop passes presetName verbatim. A preset saved as "Aggro" in the
		// workshop used to be unreachable from `load preset aggro on ...`.
		const beastmaster = new Beastmaster();
		const monster = makeMonster('Stonefang', [makeCard('Hit'), makeCard('Heal')]);
		beastmaster.monsters = [monster as any];

		await beastmaster.savePreset({
			channel: channelStub,
			presetName: 'Aggro',
			monsterName: 'Stonefang',
		});

		monster.cards = [];
		beastmaster.deck = [makeCard('Hit'), makeCard('Heal')];
		const loadResult = await beastmaster.loadPreset({
			channel: channelStub,
			presetName: 'aggro',
			monsterName: 'Stonefang',
		});
		expect(loadResult.equipped).to.equal(2);

		await beastmaster.deletePreset({
			channel: channelStub,
			presetName: 'AGGRO',
			monsterName: 'Stonefang',
		});
		expect(beastmaster.getPresets('Stonefang')).to.deep.equal({});
	});

	it('re-saving under different casing updates the existing preset in place', async () => {
		const beastmaster = new Beastmaster();
		const monster = makeMonster('Stonefang', [makeCard('Hit')]);
		beastmaster.monsters = [monster as any];

		await beastmaster.savePreset({
			channel: channelStub,
			presetName: 'Aggro',
			monsterName: 'Stonefang',
		});
		monster.cards = [makeCard('Heal')];
		await beastmaster.savePreset({
			channel: channelStub,
			presetName: 'aggro',
			monsterName: 'Stonefang',
		});

		const presets = beastmaster.getPresets('Stonefang') as Record<string, string[]>;
		expect(Object.keys(presets)).to.deep.equal(['Aggro']);
		expect(presets.Aggro).to.deep.equal(['Heal']);
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

	it('loadPreset enforces max copies per card when preset strings differ in case from cardType', async () => {
		const beastmaster = new Beastmaster();
		const monster = makeMonster('Stonefang', []) as ReturnType<typeof makeMonster> & {
			options: Record<string, unknown>;
		};
		monster.options = {
			presets: {
				many: ['hit', 'hit', 'hit', 'hit', 'hit'],
			},
		};
		beastmaster.monsters = [monster as any];
		beastmaster.deck = [
			makeCard('Hit'),
			makeCard('Hit'),
			makeCard('Hit'),
			makeCard('Hit'),
			makeCard('Hit'),
		];

		const loadResult = await beastmaster.loadPreset({
			channel: channelStub,
			presetName: 'many',
			monsterName: 'Stonefang',
		});

		expect(loadResult.equipped).to.equal(4);
		expect(loadResult.requested).to.equal(5);
		expect(loadResult.skippedCards).to.deep.equal(['hit']);
		expect(monster.cards.map(c => c.cardType)).to.deep.equal(['Hit', 'Hit', 'Hit', 'Hit']);
	});

	describe('chooseMonster', () => {
		it('resolves a numeric index answer, the shape the web client sends', async () => {
			const beastmaster = new Beastmaster();
			const monsters = [makeMonster('Stonefang'), makeMonster('Emberclaw')] as any;
			channelStub.resolves('1');

			const chosen = await beastmaster.chooseMonster({ channel: channelStub, monsters });

			expect(chosen.givenName).to.equal('Emberclaw');
		});

		it('resolves a label answer, the shape the Discord connector sends', async () => {
			const beastmaster = new Beastmaster();
			const monsters = [makeMonster('Stonefang'), makeMonster('Emberclaw')] as any;
			channelStub.resolves('Emberclaw');

			const chosen = await beastmaster.chooseMonster({ channel: channelStub, monsters });

			expect(chosen.givenName).to.equal('Emberclaw');
		});

		it('rejects an unrecognised monster answer instead of picking undefined', async () => {
			const beastmaster = new Beastmaster();
			const monsters = [makeMonster('Stonefang'), makeMonster('Emberclaw')] as any;
			channelStub.resolves('Not A Monster');

			let error: unknown;
			try {
				await beastmaster.chooseMonster({ channel: channelStub, monsters });
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(Error);
			expect((error as Error).message).to.include('Not A Monster');
		});
	});
});
