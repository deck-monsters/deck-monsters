import { expect } from 'chai';

import { announceHeal } from './heal.js';

describe('./announcements/heal.ts', () => {
	it('adds plain combat data for a heal', () => {
		const published: Array<{ payload: Record<string, unknown> }> = [];
		const eb = {
			publish: (event: { payload: Record<string, unknown> }) => published.push(event),
		};
		const monster = {
			givenName: 'Healer',
			creatureType: 'Jinn',
			icon: '🧞',
			isBoss: true,
			hp: 12,
			maxHp: 20,
		};

		announceHeal(eb as never, { monsterIsInRing: () => true }, '', monster, { amount: 5 });

		const combat = published[0]?.payload.combat;
		expect(combat).to.deep.equal({
			kind: 'heal',
			actor: { name: 'Healer', creatureType: 'Jinn', icon: '🧞', isBoss: true },
			target: { name: 'Healer', creatureType: 'Jinn', icon: '🧞', isBoss: true },
			amount: 5,
			hp: 12,
			maxHp: 20,
		});
		expect(JSON.parse(JSON.stringify(combat))).to.deep.equal(combat);
	});
});
