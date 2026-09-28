import { expect } from 'chai';
import { engineReady } from '@deck-monsters/engine';
import { REFERENCE_FIELD_HAND, catalogueCards } from './catalogue.js';

describe('balance catalogue', () => {
	before(async () => {
		await engineReady;
	});

	it('lists every card but Flee, each with an action class and a readable label', () => {
		const cards = catalogueCards();
		expect(cards.length).to.be.greaterThan(50);
		expect(cards.map(c => c.cardType)).to.not.include('Flee');
		for (const card of cards) {
			expect(card.actionClass, card.cardType).to.be.a('string').and.not.equal('');
			expect(card.label, card.cardType).to.match(/^[A-Za-z]/);
		}
	});

	it('uses a nine-card reference field hand', () => {
		expect(REFERENCE_FIELD_HAND).to.have.length(9);
	});
});
