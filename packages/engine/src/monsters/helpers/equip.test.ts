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
});
