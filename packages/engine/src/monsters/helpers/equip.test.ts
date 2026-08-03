import { expect } from 'chai';
import sinon from 'sinon';
import { equipMonster, equipHelpersReady } from './equip.js';
import { getItemKey } from '../../items/helpers/counts.js';

describe('equip helpers', () => {
	before(async () => {
		await equipHelpersReady;
	});

	describe('getItemKey', () => {
		it('returns itemType when present', () => {
			expect(getItemKey({ itemType: 'Potion', cardType: 'Hit', name: 'Potion' })).to.equal('Potion');
		});

		it('returns cardType when itemType absent', () => {
			expect(getItemKey({ cardType: 'Hit', name: 'Hit' })).to.equal('Hit');
		});

		it('returns name when both absent', () => {
			expect(getItemKey({ name: 'MyThing' })).to.equal('MyThing');
		});

		it('returns Unknown when all absent', () => {
			expect(getItemKey({})).to.equal('Unknown');
		});

		it('treats two cards with same cardType as the same key', () => {
			const card1 = { cardType: 'DelayedHit', name: 'card1' };
			const card2 = { cardType: 'DelayedHit', name: 'card2' };
			expect(getItemKey(card1)).to.equal(getItemKey(card2));
		});
	});

	describe('equipMonster (cardSelection path)', () => {
		const makeCard = (cardType: string) => ({ cardType, name: cardType });

		// cardSlots must match the number of cards being equipped to avoid the
		// interactive fill-remaining-slots loop (which would block without a real channel).
		const makeMonster = (cardSlots: number) => ({
			givenName: 'Stonefang',
			inEncounter: false,
			cardSlots,
			cards: [] as ReturnType<typeof makeCard>[],
			canHoldCard: () => true,
		});

		let channelStub: sinon.SinonStub;

		beforeEach(() => {
			channelStub = sinon.stub().resolves(undefined);
		});

		afterEach(() => {
			sinon.restore();
		});

		it('equips a card by exact name match (case-insensitive)', async () => {
			const deck = [makeCard('Hit'), makeCard('Heal')];
			const monster = makeMonster(1) as any;

			const result = await equipMonster({
				deck: deck as any,
				monster,
				cardSelection: ['hit'],
				channel: channelStub,
			});

			expect(result).to.have.length(1);
			expect(result[0].cardType).to.equal('Hit');
		});

		it('equips a card whose name contains "or" (Fight or Flight)', async () => {
			const fightOrFlight = makeCard('Fight or Flight');
			const deck = [fightOrFlight, makeCard('Hit')];
			const monster = makeMonster(1) as any;

			const result = await equipMonster({
				deck: deck as any,
				monster,
				cardSelection: ['fight or flight'],
				channel: channelStub,
			});

			expect(result).to.have.length(1);
			expect(result[0].cardType).to.equal('Fight or Flight');
		});

		it('enforces MAX_CARD_COPIES_IN_HAND (4) for typed cardSelection', async () => {
			const deck = [
				makeCard('Hit'),
				makeCard('Hit'),
				makeCard('Hit'),
				makeCard('Hit'),
				makeCard('Hit'),
			];
			// 4 slots — the 4 allowed copies fill them exactly, no interactive loop
			const monster = makeMonster(4) as any;

			const result = await equipMonster({
				deck: deck as any,
				monster,
				cardSelection: ['Hit', 'Hit', 'Hit', 'Hit', 'Hit'],
				channel: channelStub,
			});

			expect(result).to.have.length(4);
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match(/may not equip more than 4/) }))).to.equal(true);
		});
	});

	describe('equipMonster (interactive partial finish)', () => {
		const makeCard = (cardType: string) => ({ cardType, name: cardType });

		const makeMonster = (cardSlots: number) => ({
			givenName: 'Fang',
			inEncounter: false,
			cardSlots,
			cards: [] as ReturnType<typeof makeCard>[],
			canHoldCard: () => true,
		});

		it('commits already-selected cards when the next prompt is answered with "done"', async () => {
			const deck = [
				makeCard('Hit'),
				makeCard('Heal'),
				makeCard('Blast'),
				makeCard('Flee'),
			];
			const monster = makeMonster(4) as any;
			const questions: string[] = [];
			let promptRound = 0;

			const channel = async ({
				announce,
				question,
			}: {
				announce?: string;
				question?: string;
				choices?: string[];
			}) => {
				if (announce) return undefined;
				if (question) {
					questions.push(question);
					promptRound += 1;
					// Round 1: equip two cards by index. Round 2+: finish without filling all slots.
					if (promptRound === 1) return '0, 1';
					if (promptRound > 5) {
						throw new Error('equip loop did not finish — trapped without done path');
					}
					return 'done';
				}
				return undefined;
			};

			const result = await equipMonster({
				deck: deck as any,
				monster,
				channel: channel as any,
			});

			expect(questions.length).to.equal(2);
			expect(questions[1]).to.match(/slots remaining/i);
			expect(questions[1]).to.match(/reply "done"/i);
			expect(result).to.have.length(2);
			// chooseCards catalogs alphabetically: Blast, Flee, Heal, Hit → indices 0,1
			expect(result.map((c: { cardType: string }) => c.cardType)).to.deep.equal(['Blast', 'Flee']);
			expect(monster.cards).to.have.length(2);
		});

		it('keeps prompting when the first selection is empty (nothing to commit yet)', async () => {
			const deck = [makeCard('Hit'), makeCard('Heal')];
			const monster = makeMonster(2) as any;
			let promptRound = 0;

			const channel = async ({
				announce,
				question,
			}: {
				announce?: string;
				question?: string;
				choices?: string[];
			}) => {
				if (announce) return undefined;
				if (question) {
					promptRound += 1;
					if (promptRound === 1) return ''; // empty — should re-prompt, not finish
					if (promptRound === 2) return '0, 1'; // fill all slots to exit
					throw new Error(`unexpected prompt round ${promptRound}`);
				}
				return undefined;
			};

			const result = await equipMonster({
				deck: deck as any,
				monster,
				channel: channel as any,
			});

			expect(promptRound).to.equal(2);
			expect(result).to.have.length(2);
		});
	});
});
