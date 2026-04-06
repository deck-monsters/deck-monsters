import { expect } from 'chai';
import { equipHelpersReady } from './equip.js';
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
});
