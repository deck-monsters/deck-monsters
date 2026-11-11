import { expect } from 'chai';
import sinon from 'sinon';

import Beastmaster from './beastmaster.js';
import { listen, loadHandlers } from '../commands/index.js';
import { presetTakenMessage, presetTakeQuestion } from './helpers/equip-message.js';

/**
 * Loading a preset may take a card another of the player's monsters holds, once the caller
 * has named it (the Workshop asks in the UI; the console asks with a prompt). One atomic
 * change: deck first, never from a monster in the ring or fighting, copy limit still applies.
 */
describe('characters/beastmaster loadPreset taking cards from other monsters', () => {
	const makeCard = (cardType: string) => ({ cardType, name: cardType });
	const makeMonster = (name: string, cards: any[] = [], presets: Record<string, string[]> = {}) => ({
		givenName: name,
		creatureType: 'Basilisk',
		level: 4,
		cardSlots: 9,
		inEncounter: false,
		items: [],
		cards: [...cards],
		options: { presets },
		canHoldCard: () => true,
		setOptions(update: Record<string, unknown>) {
			this.options = { ...this.options, ...update };
		},
	});
	const cardNames = (monster: { cards: any[] }) => monster.cards.map(card => card.cardType);
	const quiet = () => sinon.stub().resolves(undefined);

	// Stonefang's preset wants Hit x2 and Blast. The deck has one Hit; Brass holds a Hit and a Blast.
	function setup() {
		const beastmaster = new Beastmaster();
		const stonefang = makeMonster('Stonefang', [makeCard('Heal')], { raid: ['Hit', 'Hit', 'Blast'] });
		const hit = makeCard('Hit');
		const brassHit = makeCard('Hit');
		const brassBlast = makeCard('Blast');
		const brassSpare = makeCard('Heal');
		const brass = makeMonster('Brass', [brassHit, brassBlast, brassSpare, makeCard('Heal'), makeCard('Heal'), makeCard('Heal'), makeCard('Heal'), makeCard('Heal'), makeCard('Heal')].slice(0, 9));
		beastmaster.monsters = [stonefang as any, brass as any];
		beastmaster.deck = [hit] as any;
		return { beastmaster, stonefang, brass, hit, brassHit, brassBlast };
	}

	it('without a list behaves as before: deck only, the other monster keeps its cards', async () => {
		const { beastmaster, stonefang, brass } = setup();
		const brassBefore = [...brass.cards];

		const result = await beastmaster.loadPreset({ channel: quiet(), presetName: 'raid', monsterName: 'Stonefang' });

		expect(cardNames(stonefang)).to.deep.equal(['Hit']);
		expect(result.skippedCards).to.deep.equal(['Hit', 'Blast']);
		expect(result.taken).to.deep.equal([]);
		expect(brass.cards).to.deep.equal(brassBefore);
		// The old Heal went back to the deck.
		expect((beastmaster.deck as any[]).map(card => card.cardType)).to.deep.equal(['Heal']);
	});

	it('takes only what the deck cannot cover, and says what the donor is left with', async () => {
		const { beastmaster, stonefang, brass, hit, brassHit, brassBlast } = setup();
		const channel = quiet();

		const result = await beastmaster.loadPreset({
			channel,
			presetName: 'raid',
			monsterName: 'Stonefang',
			takeFrom: [{ monsterName: 'Brass', cardName: 'Hit' }, { monsterName: 'Brass', cardName: 'Blast' }],
		});

		expect(stonefang.cards).to.deep.equal([hit, brassHit, brassBlast]);
		expect(result.taken).to.deep.equal([
			{ cardName: 'Hit', fromMonsterName: 'Brass' },
			{ cardName: 'Blast', fromMonsterName: 'Brass' },
		]);
		expect(result.donors).to.deep.equal([{ monsterName: 'Brass', cardCount: 7, cardSlots: 9 }]);
		expect(result.skippedCards).to.deep.equal([]);
		expect(brass.cards).to.have.length(7);
		// The deck's own Hit was used first and is no longer in the deck; the old Heal came back.
		expect((beastmaster.deck as any[]).map(card => card.cardType)).to.deep.equal(['Heal']);
		const message = channel.firstCall.args[0].announce as string;
		expect(message).to.include('Took Hit and Blast from Brass.');
		expect(message).to.include('Brass now holds 7 of 9 cards. Fill the rest before the ring.');
	});

	it('does not touch another monster when the deck already has the card', async () => {
		const { beastmaster, stonefang, brass } = setup();
		beastmaster.deck = [makeCard('Hit'), makeCard('Hit'), makeCard('Blast')] as any;
		const brassBefore = [...brass.cards];

		const result = await beastmaster.loadPreset({
			channel: quiet(),
			presetName: 'raid',
			monsterName: 'Stonefang',
			takeFrom: [{ monsterName: 'Brass', cardName: 'Hit' }],
		});

		expect(cardNames(stonefang)).to.deep.equal(['Hit', 'Hit', 'Blast']);
		expect(result.taken).to.deep.equal([]);
		expect(brass.cards).to.deep.equal(brassBefore);
	});

	it('refuses a donor that is fighting, changing nothing', async () => {
		const { beastmaster, stonefang, brass } = setup();
		brass.inEncounter = true;
		const deckBefore = [...(beastmaster.deck as any[])];
		const handBefore = [...stonefang.cards];
		const brassBefore = [...brass.cards];

		let error: unknown;
		await beastmaster.loadPreset({
			channel: quiet(), presetName: 'raid', monsterName: 'Stonefang', takeFrom: [{ monsterName: 'Brass', cardName: 'Blast' }],
		}).catch((err) => { error = err; });

		expect((error as Error).message).to.equal('You cannot take cards from Brass while they are in the ring or fighting!');
		expect(beastmaster.deck).to.deep.equal(deckBefore);
		expect(stonefang.cards).to.deep.equal(handBefore);
		expect(brass.cards).to.deep.equal(brassBefore);
	});

	it('refuses a donor waiting in the ring, changing nothing', async () => {
		const { beastmaster, stonefang, brass } = setup();
		const ring = { contestants: [{ monster: brass }] };
		const handBefore = [...stonefang.cards];
		const brassBefore = [...brass.cards];

		let error: unknown;
		await beastmaster.loadPreset({
			channel: quiet(), presetName: 'raid', monsterName: 'Stonefang', ring, takeFrom: [{ monsterName: 'Brass', cardName: 'Blast' }],
		}).catch((err) => { error = err; });

		expect((error as Error).message).to.include('Brass while they are in the ring or fighting');
		expect(stonefang.cards).to.deep.equal(handBefore);
		expect(brass.cards).to.deep.equal(brassBefore);
		// And it is never offered.
		expect(beastmaster.suggestPresetTakes({ presetName: 'raid', monsterName: 'Stonefang', ring })).to.deep.equal([]);
	});

	it('is atomic: a stale list (the donor no longer holds the card) leaves every hand and the deck as they were', async () => {
		const { beastmaster, stonefang, brass } = setup();
		const deckBefore = [...(beastmaster.deck as any[])];
		const handBefore = [...stonefang.cards];
		const brassBefore = [...brass.cards];

		let error: unknown;
		await beastmaster.loadPreset({
			channel: quiet(),
			presetName: 'raid',
			monsterName: 'Stonefang',
			// The first entry is fine, the second is not: neither may land.
			takeFrom: [{ monsterName: 'Brass', cardName: 'Blast' }, { monsterName: 'Brass', cardName: 'Dragon Breath' }],
		}).catch((err) => { error = err; });

		expect((error as Error).message).to.equal('Brass is not holding Dragon Breath.');
		expect(beastmaster.deck).to.deep.equal(deckBefore);
		expect(stonefang.cards).to.deep.equal(handBefore);
		expect(brass.cards).to.deep.equal(brassBefore);
	});

	it('refuses an unknown donor', async () => {
		const { beastmaster } = setup();
		let error: unknown;
		await beastmaster.loadPreset({
			channel: quiet(), presetName: 'raid', monsterName: 'Stonefang', takeFrom: [{ monsterName: 'Nobody', cardName: 'Hit' }],
		}).catch((err) => { error = err; });
		expect((error as Error).message).to.equal('I can find no monster named Nobody.');
	});

	it('the copy limit still applies to taken cards', async () => {
		const beastmaster = new Beastmaster();
		const target = makeMonster('Stonefang', [], { many: ['Hit', 'Hit', 'Hit', 'Hit', 'Hit'] });
		const donor = makeMonster('Brass', [makeCard('Hit'), makeCard('Hit'), makeCard('Hit'), makeCard('Hit'), makeCard('Hit')]);
		beastmaster.monsters = [target as any, donor as any];
		// Assigning an empty deck does not clear the starter deck, so give it one unrelated card.
		beastmaster.deck = [makeCard('Heal')] as any;

		const result = await beastmaster.loadPreset({
			channel: quiet(), presetName: 'many', monsterName: 'Stonefang', takeFrom: [{ monsterName: 'Brass', cardName: 'Hit', count: 5 }],
		});

		expect(cardNames(target)).to.deep.equal(['Hit', 'Hit', 'Hit', 'Hit']);
		expect(result.skipped).to.deep.equal([{ cardName: 'Hit', reason: 'max_copies' }]);
		// The fifth Hit never left Brass.
		expect(cardNames(donor)).to.deep.equal(['Hit']);
	});

	it('does not take a card the loading monster cannot hold', async () => {
		const { beastmaster, stonefang, brass } = setup();
		(stonefang as any).canHoldCard = (card: any) => card.cardType !== 'Blast';
		const result = await beastmaster.loadPreset({
			channel: quiet(), presetName: 'raid', monsterName: 'Stonefang', takeFrom: [{ monsterName: 'Brass', cardName: 'Blast' }],
		});
		expect(result.taken).to.deep.equal([]);
		expect(brass.cards.some(card => card.cardType === 'Blast')).to.equal(true);
	});

	it('suggestPresetTakes lists what only other monsters hold, and changes nothing', () => {
		const { beastmaster, stonefang, brass } = setup();
		const handBefore = [...stonefang.cards];
		const brassBefore = [...brass.cards];

		expect(beastmaster.suggestPresetTakes({ presetName: 'raid', monsterName: 'Stonefang' })).to.deep.equal([
			{ cardName: 'Hit', fromMonsterName: 'Brass' },
			{ cardName: 'Blast', fromMonsterName: 'Brass' },
		]);
		expect(stonefang.cards).to.deep.equal(handBefore);
		expect(brass.cards).to.deep.equal(brassBefore);
	});

	describe('console command', () => {
		before(() => {
			loadHandlers();
		});

		function run(answers: string[]) {
			const parts = setup();
			const questions: Array<{ question: string; choices: string[] }> = [];
			const announcements: string[] = [];
			const remaining = [...answers];
			const channel = async (message: any) => {
				if (message.question) {
					questions.push({ question: message.question, choices: message.choices });
					return remaining.shift();
				}
				if (message.announce) announcements.push(message.announce);
				return undefined;
			};
			const game = { getCharacter: async () => parts.beastmaster, log: sinon.stub(), ring: { contestants: [] } };
			const action = listen({ command: 'load preset raid on Stonefang', game: game as any });
			return action!({ channel, channelName: 'dm', isDM: true, isAdmin: false, user: { id: 'u', name: 'T' }, game } as any)
				.then(() => ({ ...parts, questions, announcements, game }));
		}

		it('asks, and takes the cards on yes (label or index)', async () => {
			const { questions, stonefang, brass } = await run(['Yes']);
			expect(questions).to.have.length(1);
			expect(questions[0]!.question).to.equal('Hit and Blast are on Brass. Take them from Brass for Stonefang?');
			expect(questions[0]!.choices).to.deep.equal(['Yes', 'No']);
			expect(cardNames(stonefang)).to.deep.equal(['Hit', 'Hit', 'Blast']);
			expect(brass.cards).to.have.length(7);

			const byIndex = await run(['0']);
			expect(cardNames(byIndex.stonefang)).to.deep.equal(['Hit', 'Hit', 'Blast']);
		});

		it('keeps today\'s behaviour on no', async () => {
			const { stonefang, brass } = await run(['No']);
			expect(cardNames(stonefang)).to.deep.equal(['Hit']);
			expect(brass.cards).to.have.length(9);
		});

		it('does not read a command typed mid-prompt as yes or no (prompt contract rule 4)', async () => {
			const { questions, stonefang, announcements } = await run(['send Brass to the ring', 'yes']);
			expect(questions).to.have.length(2);
			expect(announcements).to.include('Please answer Yes or No.');
			expect(cardNames(stonefang)).to.deep.equal(['Hit', 'Hit', 'Blast']);
		});

		it('does not ask when the deck covers the preset', async () => {
			const parts = setup();
			parts.beastmaster.deck = [makeCard('Hit'), makeCard('Hit'), makeCard('Blast')] as any;
			const channel = sinon.stub().resolves(undefined);
			const game = { getCharacter: async () => parts.beastmaster, log: sinon.stub(), ring: { contestants: [] } };
			await listen({ command: 'load preset raid on Stonefang', game: game as any })!(
				{ channel, channelName: 'dm', isDM: true, isAdmin: false, user: { id: 'u', name: 'T' }, game } as any,
			);
			expect(channel.args.some(([message]) => message.question)).to.equal(false);
			expect(cardNames(parts.stonefang)).to.deep.equal(['Hit', 'Hit', 'Blast']);
		});
	});

	describe('wording', () => {
		it('asks with the owner\'s example line', () => {
			expect(presetTakeQuestion({
				monsterName: 'Stonefang',
				takes: [
					{ cardName: 'Hit', fromMonsterName: 'Brass' },
					{ cardName: 'Hit', fromMonsterName: 'Brass' },
					{ cardName: 'Blast', fromMonsterName: 'Brass' },
				],
			})).to.equal('Hit ×2 and Blast are on Brass. Take them from Brass for Stonefang?');
		});

		it('names each donor when there are several, and one card as "it"', () => {
			expect(presetTakeQuestion({
				monsterName: 'Stonefang',
				takes: [{ cardName: 'Hit', fromMonsterName: 'Brass' }, { cardName: 'Blast', fromMonsterName: 'Ember' }],
			})).to.equal('Hit is on Brass and Blast is on Ember. Take them for Stonefang?');
			expect(presetTakeQuestion({ monsterName: 'Stonefang', takes: [{ cardName: 'Blast', fromMonsterName: 'Brass' }] }))
				.to.equal('Blast is on Brass. Take it from Brass for Stonefang?');
		});

		it('says nothing when nothing was taken, and a full donor hand is not called short', () => {
			expect(presetTakenMessage({ taken: [], donors: [] })).to.equal('');
			expect(presetTakenMessage({
				taken: [{ cardName: 'Hit', fromMonsterName: 'Brass' }],
				donors: [{ monsterName: 'Brass', cardCount: 9, cardSlots: 9 }],
			})).to.equal('Took Hit from Brass. Brass still holds 9 of 9 cards.');
		});
	});
});
