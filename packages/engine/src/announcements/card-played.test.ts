import { expect } from 'chai';

import { announceCard } from './card-played.js';

describe('./announcements/card-played.ts', () => {
	it('adds plain combat data for the card player', () => {
		const published: Array<{ payload: Record<string, unknown> }> = [];
		const eb = {
			publish: (event: { payload: Record<string, unknown> }) => published.push(event),
		};
		const player = {
			givenName: 'Attacker',
			creatureType: 'Gladiator',
			icon: '💪',
			isBoss: false,
			identity: '💪 Attacker',
		};
		const card = { name: 'Hit', cardClass: ['Melee'], icon: '⚔️', itemType: 'Hit' };

		announceCard(eb as never, '', card, { player });

		const combat = published[0]?.payload.combat;
		expect(combat).to.deep.equal({
			kind: 'card',
			actor: { name: 'Attacker', creatureType: 'Gladiator', icon: '💪', isBoss: false },
			card: { name: 'Hit', cardClass: 'Melee' },
		});
		expect(JSON.parse(JSON.stringify(combat))).to.deep.equal(combat);
	});
});
