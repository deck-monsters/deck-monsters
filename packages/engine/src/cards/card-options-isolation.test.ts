import { expect } from 'chai';

import all from './helpers/all.js';

/**
 * 2026-09-24 production crash: Ecdysis and Adrenaline Rush forwarded `...rest` into their saved
 * options, so a caller's `deck` array (which held the card itself) made the room circular and every
 * save threw. No card may keep options that are not its own.
 */
describe('card options isolation', () => {
	(all as any[]).forEach(Card => {
		it(`${Card.cardType ?? Card.name} keeps no deck, monsters or items in its options`, () => {
			const card = new Card({ deck: [], monsters: [], items: [] });
			['deck', 'monsters', 'items'].forEach(key => {
				expect(card.options).not.to.have.property(key);
			});
			expect(() => JSON.stringify(card)).not.to.throw();
		});
	});

	it('Ecdysis and Adrenaline Rush round-trip their own options', async () => {
		const { default: EcdysisCard } = await import('./ecdysis.js');
		const { default: AdrenalineRushCard } = await import('./adrenaline-rush.js');
		[EcdysisCard, AdrenalineRushCard].forEach((Card: any) => {
			const boosts = [{ prop: 'int', amount: 2 }];
			const card = new Card({ boosts, icon: 'X' });
			const restored = new Card(JSON.parse(JSON.stringify(card)).options);
			expect(restored.boosts).to.deep.equal(boosts);
			expect(restored.icon).to.equal('X');
		});
	});
});
