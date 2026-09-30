import { expect } from 'chai';

import { announceCardDrop } from './cardDrop.js';
import { HealCard } from '../cards/heal.js';

describe('./announcements/cardDrop.ts', () => {
	it('names the dropped card by its display name, not its class name', () => {
		const published: Array<{ payload: { cardDropName: string } }> = [];
		const eb = { publish: (event: { payload: { cardDropName: string } }) => published.push(event) };
		const contestant = {
			userId: 'u1',
			monster: { identity: 'Pip' },
			character: { identity: 'Ada' },
		};

		announceCardDrop(eb as never, 'Ring', {}, { contestant, card: new HealCard() });

		expect(published).to.have.length(2);
		// "Heal", as the card is called everywhere a player sees it; the Fights list showed
		// "Card: HealCard" before (Cursor's live check, roadmap 39).
		expect(published.map((e) => e.payload.cardDropName)).to.deep.equal(['Heal', 'Heal']);
	});
});
